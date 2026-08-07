# 冠希无限画布前端项目治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为冠希无限画布前端建立与现行业务分支一致的文档、CI、安全、协作和双仓版本追踪基线，并创建不包含业务改动的治理 PR。

**Architecture:** 治理分支基于 `feature/dsp-h3-winner-upgrade`，文档以当前源码为事实来源；CI 将 lint、既有 Node 测试、Vite 构建和安全检查拆成稳定的 required checks。版本追踪由确定性的 release manifest 生成器提供，部署时注入前后端 SHA，但本次不部署。

**Tech Stack:** Vue 3、Vite 8、Vue Flow、pnpm、Node.js 22、GitHub Actions、ESLint、CodeQL、gitleaks。

---

### Task 1: 建立文档入口和双仓边界

**Files:**
- Modify: `README.md`
- Create: `ARCHITECTURE.md`
- Create: `DEVELOPMENT.md`
- Create: `API.md`

- [ ] **Step 1: 核对源码事实**

Run:

```bash
rg -n "path:|component:" src/router/index.js
rg -n "getMaterialApiBase|/v1/|/auth" src/api src/utils vite.config.js
rg -n "Comfy|SCAIL|FRW|FFmpeg|SeedVR" src docs
```

Expected: 路由、接口路径和集成名称均来自被跟踪源码；文档不得从线上界面反推未实现能力。

- [ ] **Step 2: 重写 README 为稳定入口**

README 必须包含以下索引，不保留错误的 MIT 徽章或旧上游克隆地址：

```markdown
## 文档

- [系统架构](./ARCHITECTURE.md)
- [本地开发](./DEVELOPMENT.md)
- [前端 API 契约](./API.md)
- [部署](./DEPLOYMENT.md)
- [运维](./OPERATIONS.md)
- [回滚](./ROLLBACK.md)
- [安全](./SECURITY.md)
- [变更记录](./CHANGELOG.md)

配套后端：<https://github.com/huhu771912249-wq/guanxi-canvas-backend>
```

- [ ] **Step 3: 编写架构、开发和 API 文档**

`ARCHITECTURE.md` 必须画出以下数据方向：

```text
Browser -> Vue/Vue Flow -> Backend HTTP API -> Task Store
                                      |-> ComfyUI / SeedVR2
                                      |-> FFmpeg / ffprobe
                                      |-> FRW
                                      `-> SCAIL2
```

`DEVELOPMENT.md` 固定命令：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
pnpm build
```

`API.md` 明确前端只是消费方，最终接口事实以配套后端 `API.md` 为准，并记录 `queued/running/succeeded/failed/cancelled` 映射。

- [ ] **Step 4: 验证链接与事实词**

Run:

```bash
node scripts/check-doc-links.mjs
rg -n "已上线|线上当前|生产已部署" README.md ARCHITECTURE.md DEVELOPMENT.md API.md
```

Expected: 链接检查退出 0；不得出现无证据的线上完成声明。

- [ ] **Step 5: 提交文档入口**

```bash
git add README.md ARCHITECTURE.md DEVELOPMENT.md API.md scripts/check-doc-links.mjs
git commit -m "docs: establish frontend documentation entrypoint"
```

### Task 2: 补齐部署、运维、回滚和安全文档

**Files:**
- Create: `DEPLOYMENT.md`
- Create: `OPERATIONS.md`
- Create: `ROLLBACK.md`
- Create: `SECURITY.md`
- Create: `AGENTS.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: 编写 release/current 部署契约**

`DEPLOYMENT.md` 使用变量而不使用真实服务器值：

```bash
release_dir="${APP_ROOT}/releases/${RELEASE_ID}"
ln -sfn "$release_dir" "${APP_ROOT}/current.next"
mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"
```

明确 Nginx 只指向 `current/dist`，每个 release 必须包含 `release-manifest.json`。

- [ ] **Step 2: 编写运维与回滚证据层级**

文档必须分别列出：代码提交、CI、release manifest、HTTP health、浏览器验收和业务验收，禁止把任一层冒充完整上线。

- [ ] **Step 3: 固化 Public 前端安全边界**

`SECURITY.md` 必须包含：

```markdown
- 浏览器收到的代码与配置均视为公开信息。
- API Key 不得进入源码、示例、构建产物、URL、日志或截图。
- 用户上传和 URL 下载由后端执行并校验；前端不承诺绕过后端安全策略。
- 本仓库是 Public Fork；需要保密的业务实现必须迁入独立 Private 仓库。
- 当前仓库未跟踪许可证文件，不把 README 历史徽章视为许可结论。
```

- [ ] **Step 4: 写入 Agent 与发布规则**

`AGENTS.md` 明确测试命令、禁止线上部署、禁止密钥和禁止覆盖功能分支；`CHANGELOG.md` 使用 `Unreleased / Added / Changed / Fixed / Security` 结构。

- [ ] **Step 5: 验证并提交**

```bash
node scripts/check-doc-links.mjs
git diff --check
git add DEPLOYMENT.md OPERATIONS.md ROLLBACK.md SECURITY.md AGENTS.md CHANGELOG.md
git commit -m "docs: document frontend operations and security"
```

### Task 3: 增加确定性 lint 和前端 CI

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `eslint.config.js`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 安装 lint 依赖并添加脚本**

Run:

```bash
pnpm add -D eslint@^9 eslint-plugin-vue@^10 globals@^16
```

将脚本设置为：

```json
{
  "lint": "eslint src tests scripts vite.config.js --max-warnings=0",
  "ci": "pnpm lint && pnpm test && pnpm build"
}
```

- [ ] **Step 2: 添加最小兼容 ESLint 配置**

```js
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off'
    }
  }
]
```

- [ ] **Step 3: 运行 lint 并只做无行为修复**

```bash
pnpm lint
```

Expected: 退出 0。允许删除未使用导入或为有意未使用参数加 `_`；禁止重构业务逻辑来迁就 lint。

- [ ] **Step 4: 添加固定名称 CI**

`.github/workflows/ci.yml` 的 required job 固定为 `frontend-ci`：

```yaml
name: Frontend CI
on:
  pull_request:
  push:
    branches: [main, feature/dsp-h3-winner-upgrade]
permissions:
  contents: read
jobs:
  frontend-ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm ci
```

- [ ] **Step 5: 验证并提交**

```bash
pnpm ci
git diff --check
git add package.json pnpm-lock.yaml eslint.config.js .github/workflows/ci.yml src tests scripts vite.config.js
git commit -m "ci: add frontend quality gate"
```

### Task 4: 增加协作模板和安全工作流

**Files:**
- Create: `.github/CODEOWNERS`
- Create: `.github/pull_request_template.md`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/workflows/codeql.yml`
- Create: `.github/workflows/dependency-review.yml`
- Create: `.github/workflows/secret-scan.yml`
- Create: `.github/dependabot.yml`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: 添加所有权和 PR 验收清单**

```text
* @huhu771912249-wq
/.github/ @huhu771912249-wq
/SECURITY.md @huhu771912249-wq
```

PR 模板必须询问：业务行为是否变化、测试证据、密钥/素材扫描、部署影响和回滚方式。

- [ ] **Step 2: 添加 Issue 表单和贡献规范**

`CONTRIBUTING.md` 固定分支前缀与 Conventional Commits：

```text
feature/ fix/ chore/ docs/ release/
feat: fix: docs: chore: test: ci: build: refactor:
```

- [ ] **Step 3: 添加安全工作流**

CodeQL 仅用 `security-events: write`；dependency review 只在 PR 运行；gitleaks 使用完整 fetch，并将 job 固定命名为 `secret-scan`。所有第三方 Action 使用已审计的主版本，后续由 Dependabot 更新。

- [ ] **Step 4: 检查 YAML 和提交**

```bash
python3 - <<'PY'
from pathlib import Path
import yaml
for path in Path('.github').rglob('*.yml'):
    yaml.safe_load(path.read_text())
print('workflow yaml ok')
PY
git add .github CONTRIBUTING.md
git commit -m "chore: add frontend repository governance"
```

### Task 5: 清理跟踪垃圾并扩大忽略规则

**Files:**
- Modify: `.gitignore`
- Delete: `.DS_Store`
- Delete: `src/.DS_Store`
- Delete: `src/components/.DS_Store`

- [ ] **Step 1: 写入精确忽略规则**

```gitignore
.DS_Store
._*
.env
.env.*
!.env.example
release-manifest.json
uploads/
runtime/
*.safetensors
*.ckpt
*.pt
*.pth
*.onnx
*.gguf
```

- [ ] **Step 2: 从 Git 删除已跟踪 Finder 文件**

```bash
git rm .DS_Store src/.DS_Store src/components/.DS_Store
```

- [ ] **Step 3: 扫描风险路径**

```bash
git ls-files | rg '(^|/)(\.DS_Store|\._|\.env($|\.)|uploads/|runtime/)|\.(safetensors|ckpt|pt|pth|onnx|gguf)$' && exit 1 || true
```

Expected: 无输出。

- [ ] **Step 4: 提交清理**

```bash
git add .gitignore
git commit -m "chore: exclude local and runtime artifacts"
```

### Task 6: 增加双仓 release manifest 生成器

**Files:**
- Create: `scripts/generate-release-manifest.mjs`
- Create: `tests/releaseManifest.test.mjs`
- Create: `release-manifest.example.json`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `DEPLOYMENT.md`

- [ ] **Step 1: 写失败测试**

测试要求缺失 SHA 失败、相同输入输出完全一致、输出包含两个完整 40 位 SHA：

```js
import assert from 'node:assert/strict'
import { buildManifest } from '../scripts/generate-release-manifest.mjs'

const input = {
  releaseId: 'v1.2.3',
  frontendSha: 'a'.repeat(40),
  backendSha: 'b'.repeat(40),
  buildTime: '2026-08-07T00:00:00Z'
}
assert.deepEqual(buildManifest(input), buildManifest(input))
assert.equal(buildManifest(input).schemaVersion, 1)
assert.throws(() => buildManifest({ ...input, backendSha: 'short' }), /40 hexadecimal/)
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node tests/releaseManifest.test.mjs
```

Expected: FAIL，模块或导出不存在。

- [ ] **Step 3: 实现确定性生成器**

```js
const SHA_RE = /^[0-9a-f]{40}$/i

export function buildManifest({ releaseId, frontendSha, backendSha, buildTime }) {
  for (const [name, value] of Object.entries({ frontendSha, backendSha })) {
    if (!SHA_RE.test(value || '')) throw new Error(`${name} must be 40 hexadecimal characters`)
  }
  return { schemaVersion: 1, releaseId, frontendSha, backendSha, buildTime }
}
```

CLI 只读取参数/环境变量并写入显式 `--output` 路径，不读取或打印密钥。

- [ ] **Step 4: 运行全部验证**

```bash
node tests/releaseManifest.test.mjs
pnpm lint
pnpm test
pnpm build
```

Expected: 全部退出 0。

- [ ] **Step 5: 提交版本追踪机制**

```bash
git add scripts/generate-release-manifest.mjs tests/releaseManifest.test.mjs release-manifest.example.json package.json .gitignore DEPLOYMENT.md
git commit -m "feat: add frontend release manifest metadata"
```

### Task 7: 推送治理分支并创建 PR

**Files:**
- No repository file changes.

- [ ] **Step 1: 最终本地验收**

```bash
git status --short
git log --oneline feature/dsp-h3-winner-upgrade..HEAD
pnpm ci
node scripts/check-doc-links.mjs
```

Expected: 工作树干净；只包含治理提交；全部命令退出 0。

- [ ] **Step 2: 推送而不 force-push**

```bash
git push -u personal chore/project-governance
```

- [ ] **Step 3: 创建以功能分支为 base 的 PR**

```bash
gh pr create \
  --repo huhu771912249-wq/huobao-canvas \
  --base feature/dsp-h3-winner-upgrade \
  --head chore/project-governance \
  --title "chore: govern frontend documentation and delivery" \
  --body-file /tmp/huobao-frontend-governance-pr.md
```

PR 正文列出文档、CI、安全、Public 决策、版本机制、测试结果及功能分支先于治理 PR 合并的顺序。

- [ ] **Step 4: 等待并核验 Actions**

```bash
gh pr checks --repo huhu771912249-wq/huobao-canvas --watch
```

Expected: `frontend-ci`、`secret-scan`、CodeQL、dependency review 均成功；不把 pending 说成通过。

- [ ] **Step 5: 配置并回读 main 保护规则**

仅在 required checks 已真实存在后，通过 GitHub API配置：Review 1 人、`frontend-ci` 和 `secret-scan`、conversation resolution、enforce admins、禁止 force-push/删除。随后运行：

```bash
gh api repos/huhu771912249-wq/huobao-canvas/branches/main/protection
```

Expected: API 回读与目标规则一致；若 API 拒绝，保留原始状态并记录为风险，不改用弱规则冒充完成。
