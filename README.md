# 冠希无限画布

冠希无限画布是基于 Vue 3、Vite 和 Vue Flow 的 AI 素材创作前端。它负责可视化工作流、文生图/视频、小说成片、素材再创作、字幕叠加、视频尺寸处理以及异步任务状态展示；媒体处理和模型调用由独立后端完成。

配套后端：<https://github.com/huhu771912249-wq/guanxi-canvas-backend>

## 主要入口

| 路径 | 用途 |
| --- | --- |
| `/huobao-canvas/` | 首页与项目入口 |
| `/huobao-canvas/canvas/:id?` | Vue Flow 无限画布 |
| `/huobao-canvas/video-studio` | 视频创作中心 |
| `/huobao-canvas/video-resize` | 多尺寸视频处理 |
| `/huobao-canvas/gif-editor` | GIF 静态文字、图片水印与导出编辑器 |
| `/huobao-canvas/test-assets` | 精确像素的测试素材生成与下载 |
| `/huobao-canvas/recent-generations` | 最近生成的图片、视频、GIF 和音频 |
| `/huobao-canvas/tasks` | 统一任务中心 |
| `/huobao-canvas/login` | 会话登录 |

## 快速开始

要求 Node.js 22；CI 当前使用 pnpm 11.9.0。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

默认开发代理把 `/auth`、`/v1` 和 `/public-assets` 转发至本地后端。代理目标仅用于本地联调，不是生产配置。

完整质量检查：

```bash
pnpm run ci
```

## 文档

- [开发接手指南](./HANDOFF.md)
- [系统架构](./ARCHITECTURE.md)
- [本地开发](./DEVELOPMENT.md)
- [前端 API 契约](./API.md)
- [部署](./DEPLOYMENT.md)
- [运维](./OPERATIONS.md)
- [回滚](./ROLLBACK.md)
- [安全](./SECURITY.md)
- [贡献规范](./CONTRIBUTING.md)
- [变更记录](./CHANGELOG.md)
- [Agent 规则](./AGENTS.md)
- [后续产品方向：统一创作入口与个人工作空间](./docs/product-direction.md)

## 仓库边界

- 本仓库只存放可公开审查的前端源码、测试、无秘密配置示例和文档。
- API 服务、任务队列、媒体处理、ComfyUI、FFmpeg、FRW 和 SCAIL2 属于后端仓库。
- 密钥、Cookie、Token、运行状态、用户素材、生成媒体和模型文件禁止提交。
- 测试通过、部署完成和业务验收是不同证据，不能相互替代。

## 公开属性

本仓库是公开上游项目的 Public Fork。浏览器收到的代码和配置必须按公开信息设计。当前仓库未跟踪许可证文件，因此历史 README 中的许可证徽章不作为许可结论；发布或再分发前需完成上游许可证核对。

## 分支与发布

- `main`：经过 Review 和 CI 的稳定基线。
- `feature/*`、`fix/*`、`chore/*`、`docs/*`：短期工作分支。
- 提交采用 Conventional Commits。
- Release 使用 `vMAJOR.MINOR.PATCH`，并记录前端、后端 Commit SHA。

详细规则见 [CONTRIBUTING.md](./CONTRIBUTING.md) 和 [DEPLOYMENT.md](./DEPLOYMENT.md)。
