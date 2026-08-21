# CD 流水线运维手册（前端）

本文说明 `Frontend CD` 与 `Frontend CD Rollback` 两个工作流怎么配、怎么用、出事怎么查。

发布契约本身在 [`DEPLOYMENT.md`](../DEPLOYMENT.md) 和 [`ROLLBACK.md`](../ROLLBACK.md)，
本文不重新定义契约，只描述把它自动化的那层。证据层级见 [`OPERATIONS.md`](../OPERATIONS.md)。

> 所有真实主机、域名、路径、账号和密钥都通过 GitHub Environment 的 secrets 注入，
> 仓库里只出现名字。不要把任何真实值写进本文或工作流。

## 1. 这套东西做什么

- 手动触发（`workflow_dispatch`），**不会**因为往 `main` 推代码就自动上线。
- 构建走仓库现成的 `pnpm run ci`（lint + test + build），不另造一套。
- 部署走不可变 release 目录 + 原子软链切换，**不是 `git pull`**。
  Nginx 只服务 `<APP_ROOT>/current/dist`，切软链就是发布。
- 部署后自动做**线上读回**：不只是打个 200，而是核对线上真的在服务
  **这次构建产出的那些带哈希的资源文件**。陈旧的 `dist/` 或没切成功的软链伪造不了这个。
- 回滚是独立可触发的工作流。

## 2. 双仓 SHA 怎么对上

`/health` 的双仓 SHA 由**后端**进程环境提供，前端改不了它。所以：

### 发布顺序：先前端，后后端

| 步骤 | 动作 | 这时 `/health` 说什么 |
| --- | --- | --- |
| 1 | 跑 **Frontend CD**（本仓库） | 还是**上一版**的双仓 SHA（诚实：后端没动） |
| 2 | 跑 **Backend CD** | 本次的双仓 SHA（收口，可验收） |

因此前端 CD 默认**不要求** `/health` 已经报出本次配对——它是第一棒，
后端还没跑，报旧值是正常且诚实的。它只会把差异打印出来提示你去发后端。

发完后端之后想再确认一次，可以重跑前端 CD 并勾上 `require_paired_health`，
这时配对不上就判失败。

> **前端单独发版也必须跑一次后端 CD。** 哪怕后端代码一行没改，
> 也要用同一个 `release_id` 和同一个后端 commit 跑一次，
> 否则 `/health` 里的 `frontend_commit_sha` 会一直停在旧值。

### `release_id` 和 `build_time`

- `release_id` 两个仓库必须**完全相同**，建议 `YYYYMMDD-NN`（例 `20260821-01`）。
  只允许 `A-Z a-z 0-9 . _ -`，最长 64。
- 前端留空 `build_time` 就用当前时间，并把它打印在 job summary 里。
  **把那个值原样填进后端 CD 的 `build_time` 输入**，两仓 manifest 才逐字段一致
  （`ROLLBACK.md` 要求 `/health` 与 manifest 完全一致）。

## 3. 需要配的 Secrets

全部配在 **GitHub Environment** 上（Settings → Environments → 新建，例如 `production`），
这样才能挂 required reviewers。**只列名字和用途，不要把值写进任何文件。**

| 名称 | 必需 | 用途 |
| --- | --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | 是 | 部署用 SSH 私钥（**专用**密钥，不要复用个人密钥） |
| `DEPLOY_SSH_KNOWN_HOSTS` | 是 | 目标主机的公钥指纹；用来锁 `StrictHostKeyChecking` |
| `DEPLOY_HOST` | 是 | 部署主机地址 |
| `DEPLOY_USER` | 是 | 部署用的系统账号 |
| `DEPLOY_PORT` | 否 | SSH 端口，留空默认 22 |
| `APP_ROOT` | 是 | 前端应用根目录（下面有 `releases/`、`current`） |
| `SITE_URL` | 是 | 站点首页的完整 URL（**要带 base path**，见下） |
| `HEALTH_URL` | 是 | 后端 `/health` 的完整 URL |
| `RELOAD_COMMAND` | 否 | 需要 reload Nginx 时才配（见 4.3） |

`SITE_URL` 必须指向 `index.html` 实际所在的路径。本项目构建产物的资源引用形如
`/huobao-canvas/assets/...`，所以 `SITE_URL` 要写到 `.../huobao-canvas/` 这一层。
校验脚本用 URL 解析而不是字符串拼接来定位资源，所以填对这一层就够了。

把主机、路径、URL 放 secrets 而不是 variables，是为了让它们在工作流日志里被自动打码。

Environment 建议再开：**required reviewers** 和 **deployment branches** 限制为 `main`。

## 4. 首次启用要准备什么

服务器上的一次性准备，流水线不会替你做（只会在预检时告诉你缺了什么）。

### 4.1 目录结构

```
<APP_ROOT>/
├── releases/          # 必须先手工建好，且部署账号可写
│   └── <release_id>/  # 由 CD 创建，不可变，永不覆盖
│       ├── dist/
│       ├── release-manifest.json
│       └── SHA256SUMS
├── current -> releases/<release_id>    # 由 CD 原子切换
└── previous -> releases/<上一个>        # 由 CD 记录，仅供人看
```

`releases/` 不存在或不可写，预检会直接失败并说明原因。

### 4.2 Nginx

站点根指向 `<APP_ROOT>/current/dist`，并把 `/auth`、`/v1`、`/public-assets` 代理到后端。
仓库里的 `nginx.conf` 是容器场景的示例，**不是**这套 release 目录部署的配置，别照抄。

关键点：`root` 要走 `current` 这个软链，这样切软链才等于发布。

### 4.3 是否需要 reload

Nginx 每次请求都会重新解析软链路径，所以一般**不需要** reload。
只有开了 `open_file_cache` 之类的缓存时才需要，那就配 `RELOAD_COMMAND` secret
（例如 `sudo -n nginx -s reload`，并配一条只授权这条命令的免密 sudoers 规则）。

### 4.4 SSH 密钥与 known_hosts

```bash
# 本地生成一对专用密钥（私钥进 secret，公钥进服务器 authorized_keys）
ssh-keygen -t ed25519 -C "github-actions-frontend-cd" -f ./deploy_key

# 取主机公钥指纹，整段内容放进 DEPLOY_SSH_KNOWN_HOSTS
ssh-keyscan -p <端口> <主机> 2>/dev/null
```

`ssh-keyscan` 的结果请与服务器上 `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
的指纹核对一致再用，否则等于自己给自己做了一次中间人。

## 5. 怎么发一次版

1. Actions → `Frontend CD` → Run workflow
   - `environment`：选环境
   - `release_id`：本次发布的 id，后端要用同一个
   - `backend_sha`：配套后端的 40 位完整 commit SHA
   - `build_time`：一般留空
   - `dry_run`：**先勾着跑一次演练**，通过后再取消勾选正式发布
2. `build` job 会跑完整的 `pnpm run ci`。构建挂了就不会进到部署环节。
3. 如果配了 required reviewers，`deploy` job 会停下来等批准。
4. 成功后记下 summary 里的 `build_time`，**接着去发后端**（见第 2 节）。

前端绿了只代表静态资源层证据成立。整次双仓发布的验收闸门在后端 CD 的
`/health` 那一步。浏览器关键路径和业务验收是**独立证据**，按 `OPERATIONS.md` 另行确认。

## 6. 怎么回滚

Actions → `Frontend CD Rollback` → Run workflow：

- `release_id`：要回到的那一版（失败发布的 summary 里有 `上一个 release`）
- `dry_run`：同样建议先演练一次

工作流会先重新验证目标 release 的 manifest 和产物校验值，再原子切换软链，
然后把**那一版的 `index.html`** 从服务器取下来，核对线上确实在服务它引用的资源。

**必须成对回滚。** 后端也要回到同一个 `release_id`（跑 `Backend CD Rollback`）。
只回前端会让 `/health` 报着一份已经不在线上的前端 SHA。
前端回滚的最后一步会去核对 `/health`，后端还没回滚时它会失败并提示你去回滚后端——
这是预期行为，不是流水线坏了。

失败的 release 目录**不会被删除**，保留取证。

### 为什么不自动回滚

`ROLLBACK.md` 要求前后端成对回退。自动单仓回滚会违反这个契约，也可能来回抖动。
所以校验失败时流水线**判失败并把回滚目标打印在 summary 里**，由人一键触发回滚。

## 7. 线上读回失败怎么查

失败信息会逐条列出问题。常见几类：

**`this build's asset is not being served: ...`（本次产物没在线上）**

线上服务的还是别的构建。按顺序查：

1. `readlink -f <APP_ROOT>/current` 是不是指向本次 `release_id`。
2. Nginx 的 `root` 是不是走的 `current` 软链，而不是某个写死的旧目录。
3. 开了 `open_file_cache` 的话配上 `RELOAD_COMMAND` 再试。
4. 中间有 CDN 的话，是不是 CDN 还在给旧文件（这种情况 CD 判失败是对的）。

**`backend health unreachable`**

后端没起来或 `HEALTH_URL` 不通，这是后端侧问题，
按后端仓库 `docs/cd-pipeline.md` 第 7 节查。

**`/health does not report this release pair yet`**

默认只是提示不是失败——后端还没发。去发后端。
如果你勾了 `require_paired_health` 而后端确实已经发过了，说明双仓 SHA 真的对不上，
去核对两边的 `release_id` 和 SHA 输入。

排查记录里不要附带 Token、Cookie、用户素材或完整上游响应。
校验脚本本身在日志里会把主机名打码成 `https://***/...`。

## 8. 首次演练方案（低风险）

按这个顺序走，每一步都不会改动线上：

1. **只配 SSH 相关 secrets**，跑 `Frontend CD`，`dry_run` **勾上**。
   构建会完整跑一遍，然后只读预检会报告：`APP_ROOT` 在不在、
   `releases/` 可不可写、`current` 现在指向哪、剩余磁盘。
   这一步**完全不写任何东西**，却能把绝大多数配置问题一次性暴露出来。
2. 按预检的报错补齐第 4 节的服务器准备，重复第 1 步直到全绿。
3. 用一个**明显是演练的 `release_id`**（例如 `20260821-drill`）跑一次真实发布，
   确认线上读回通过，然后跑一次 `Frontend CD Rollback` 回到原来那版。
   一次低风险窗口里同时验证发布路径和回滚路径。
4. 之后再按第 5 节正式发版（记得前端之后要跟一次后端 CD）。

演练用的 release 目录留着不删也没关系，它们是不可变的、互不影响。

## 9. 明确没有被验证的部分

写这套流水线时**没有服务器、没有凭据**，所以：

**已经本地验证过的**

- 两个工作流的 YAML 语法，以及每个 `run:` 块的 bash 语法。
- `scripts/generate-release-manifest.mjs` 真的能生成 manifest，且重复生成会拒绝覆盖。
- `scripts/remote_deploy.sh` / `remote_rollback.sh` 的完整行为，跑在临时 `APP_ROOT` 上
  （`tests/remoteDeployScript.test.mjs`）：不可变 release 不被覆盖、
  校验值不过就绝不切换 `current`、没有 `dist/index.html` 就拒绝发布、
  回滚拒绝 manifest 缺失/损坏/与目录名不符的目标、`release_id` 目录穿越被拒。
- `scripts/verify-release-health.mjs`（`tests/releaseHealthCheck.test.mjs`），
  含对真实 socket 的 HTTP 往返，以及带 base path 的真实场景。
- 端到端串过一次：真实 `pnpm run ci` 的 `dist/` → 打包校验 → `remote_deploy.sh` 落盘 →
  用一个模拟 Nginx 把 `current/dist` 挂在 base path 下 → 校验脚本确认线上
  在服务本次构建那 9 个带哈希的资源；再换成旧哈希的站点，确认它正确判失败。
- 部署步骤里的 SSH 命令拼装（`shq` 引号处理）用本地 ssh/scp 替身跑通过，
  `APP_ROOT` 故意带空格，证明引号不会被打穿。

**没法验证的**

- **真实 SSH 连接、scp 传输、真实 Nginx**——没有主机和凭据，
  这几段只能在你第一次演练时才知道。
- `DEPLOY_SSH_KNOWN_HOSTS` 与真实主机公钥是否匹配。
- `SITE_URL` 是否填到了正确的 base path 那一层（填错会在第一次读回时立刻报出来）。
- GitHub Environment 的 required reviewers 行为。
- 有没有 CDN 挡在前面，以及它的缓存行为。

以上都会在第 8 节的第 1 步 dry run 里第一时间暴露出来，
而 dry run 不写任何文件、不动任何软链。
