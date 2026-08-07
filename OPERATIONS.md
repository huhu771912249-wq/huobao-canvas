# 运维

## 证据层级

1. Git 提交存在。
2. CI 对该提交通过。
3. release manifest 与产物一致。
4. 服务和 `/health` 可用且返回目标 SHA。
5. 浏览器关键路径验收通过。
6. 业务数据与结果由负责人验收。

各层独立，不能互相替代。

## 排查顺序

1. 浏览器 Console 和 Network：请求 URL、状态码、响应体、CORS。
2. `/auth/session`：确认会话，不在日志中复制 Cookie。
3. 后端 `/health`：核对 release 和双仓 SHA。
4. 异步任务：核对 task ID、真实阶段、最后错误和结果 URL。
5. 媒体结果：检查 Content-Type、可访问性、实际尺寸与编码。

前端不能用固定百分比或倒计时替代后端真实状态。故障记录禁止附带 Token、Cookie、用户素材或完整上游敏感响应。
