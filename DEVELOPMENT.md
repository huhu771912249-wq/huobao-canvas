# 本地开发

## 环境

- Node.js 22
- pnpm 11.9.0（CI 版本，通过 Corepack）
- 配套后端：<https://github.com/huhu771912249-wq/guanxi-canvas-backend>

## 安装与启动

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Vite 基础路径是 `/huobao-canvas`。本地代理把 `/auth`、`/v1`、`/public-assets` 转发至 `vite.config.js` 中的本地后端目标。

## 测试与构建

```bash
pnpm lint
pnpm test
pnpm build
pnpm run ci
```

`pnpm run ci` 会依次运行 lint、完整测试和生产构建，提交前执行一次即可。

## 联调流程

1. 先启动后端并确认本地 `/health`。
2. 启动前端，访问 `/huobao-canvas/login`。
3. 使用无生产秘密的测试账号/会话。
4. 检查浏览器 Network 中的实际请求、状态码和任务 ID。
5. 对异步任务验证提交、轮询、取消、失败重试、预览与下载。

禁止把真实生产 Token 写进 `.env` 示例、截图、测试或 Issue。`.env.local` 仅限本机且必须被忽略。

## 开发约束

- 不直接向 `main` 推送。
- 从最新目标分支创建 `feature/`、`fix/`、`chore/` 或 `docs/` 分支。
- 业务行为变化必须先有失败测试。
- 不用格式化或 lint 修复顺带重写无关业务代码。
- 前后端接口变更需同步更新两个仓库的 API 文档。

首次接手的产品地图、阅读顺序和未完成方向见 [开发接手指南](./HANDOFF.md)。
