# 冠希无限画布前端项目治理设计

## 目标

在不改变业务行为、不覆盖现有功能分支、不部署线上的前提下，为冠希无限画布前端建立可审查、可测试、可发布、可追溯的工程基线，并与后端仓库形成明确的配套关系。

配套后端仓库：<https://github.com/huhu771912249-wq/guanxi-canvas-backend>

## 已确认基线

- 治理内容以 `feature/dsp-h3-winner-upgrade` 的 `c2817ce59db64fc7ff7813b5d77831fdad11aa7f` 为事实基线。
- 治理分支为 `chore/project-governance`，不直接修改功能分支。
- 功能分支严格领先当前 `main` 67 个提交，因此治理 PR 先以功能分支为目标；功能分支进入 `main` 后再顺序合并治理内容。
- 基线 `pnpm test` 和 `pnpm build` 均通过。
- 本次不访问、不修改、不部署线上服务器。

## 文档结构

仓库根目录提供以下稳定入口：

- `README.md`：用途、能力边界、快速开始、双仓关系和文档索引。
- `ARCHITECTURE.md`：Vue/Vite/Vue Flow、后端、ComfyUI、FFmpeg、FRW、SCAIL2 的边界和数据流。
- `DEVELOPMENT.md`：Node/pnpm 版本、依赖安装、启动、测试、构建和前后端联调。
- `API.md`：前端消费的接口、请求/响应、错误和异步任务状态约定；以后端实现为最终事实来源。
- `DEPLOYMENT.md`：静态构建、Nginx、release/current、环境变量和版本清单；不包含真实凭据或主机值。
- `OPERATIONS.md`：浏览器日志、接口状态、异步任务、素材目录和故障定位。
- `ROLLBACK.md`：current 软链接回退、前后端版本配对和数据保护。
- `SECURITY.md`：Public 前端边界、客户端密钥风险、上传与 URL 下载边界、漏洞报告。
- `AGENTS.md`：后续 Agent 的范围、命令、分支规则和禁止事项。
- `CHANGELOG.md`：Keep a Changelog 风格的版本记录。

文档不把规划能力写成已上线能力；线上版本、CI、部署和业务验收分别取证。

## Git 与 CI

新增：

- 前端 CI：固定 Node 版本，使用 `pnpm install --frozen-lockfile`、lint、test、build。
- `lint` 只做确定性源码规范检查，不批量格式化或重写业务代码。
- CodeQL、依赖审查、Dependabot 和密钥扫描。
- PR 模板、Bug/Feature Issue 表单、`CODEOWNERS`。
- 分支命名、Conventional Commits、PR 合并、Tag、Release 和 Changelog 规则。

前端 `main` 保护目标：至少一名 Review、required CI、解决会话、禁止 force-push/删除并约束管理员。保护规则只在对应检查已存在并可回读后配置。

## Public 仓库决策

当前仓库是公开上游的 Public Fork。继续公开仅在以下条件成立时合规：

1. 前端仓库不包含任何服务器凭据、Cookie、Token、私有接口秘密、用户素材或模型文件。
2. 所有写入浏览器的配置都按公开信息设计；用户 API Key 不进入源码、构建产物、日志或示例。
3. 个人二维码和不必要的运营素材从公开工程文档入口移除。
4. 补齐真实许可证文件并确认上游许可兼容性；确认前不把 README 中的 MIT 徽章视为法律结论。

若需要保密业务逻辑，应迁移到独立 Private 仓库，而不是依赖 Public Fork 隐藏信息。

## 版本追踪

前端构建接受以下非秘密元数据：

- `VITE_RELEASE_VERSION`
- `VITE_FRONTEND_COMMIT_SHA`
- `VITE_BACKEND_COMMIT_SHA`
- `VITE_BUILD_TIME`

构建脚本生成前端 manifest；部署 release 目录保存双仓 SHA、版本和构建时间。后端 `/health` 返回同一组版本字段。字段缺失时显示 `unknown`，不能伪造当前线上提交。

GitHub Tag 和 Release 使用同一版本号，并附带双仓 SHA 与 manifest 校验值。本次只建设机制，不创建虚假线上 Release。

## 错误处理与兼容性

- 文档与 CI 不改变运行时接口。
- 版本元数据缺失不得阻断本地开发或现有部署。
- 安全扫描失败时阻断 PR，但不在日志中输出命中秘密的完整值。
- required check 名称固定，避免保护规则因 workflow 改名失效。

## 验收

- 文档链接和双仓链接无断链。
- `pnpm lint`、`pnpm test`、`pnpm build` 全部通过。
- CI、安全和依赖工作流在治理 PR 上有真实运行结果。
- 仓库无跟踪的 `.DS_Store`、`._*`、环境文件、运行数据、用户素材或模型文件。
- GitHub API 回读前端 `main` 保护规则。
- PR 说明列出新增内容、CI 结果、Public 决策和遗留风险。

## 非目标

- 不修改画布、视频、H3、素材裂变或登录业务行为。
- 不合并现有功能分支。
- 不部署线上、不切换 `current`、不创建与线上不对应的 Tag/Release。
- 不向 Git 提交任何密钥、Cookie、Token、运行状态、用户素材或模型文件。
