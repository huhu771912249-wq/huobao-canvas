# Agent 规则

## 必须执行

```bash
pnpm lint
pnpm test
pnpm build
```

- 先读 README、架构、开发和 API 文档。
- 使用独立工作分支；提交小而独立。
- 业务行为变化先写失败测试并确认失败原因。
- 修改接口时同步更新前后端文档。

## 禁止事项

- 不直接 push `main`，不 force-push，不覆盖功能分支。
- 未经明确授权不部署、不修改线上服务或 `current`。
- 不提交密钥、Cookie、Token、环境文件、运行状态、用户素材、生成媒体或模型。
- 不把测试、截图、HTTP 200 或本地构建冒充线上业务验收。
- 不为通过 lint/CI 批量重写无关业务代码。
