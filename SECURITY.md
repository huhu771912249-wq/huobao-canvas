# 安全策略

## Public 前端边界

- 浏览器收到的源码、构建产物、接口路径和非秘密配置均视为公开。
- API Key、Token、Cookie、密码不得进入源码、URL、日志、截图、测试夹具或示例。
- 本仓库是 Public Fork；需保密的逻辑应迁入独立 Private 仓库。
- 当前仓库未跟踪许可证文件，历史徽章不构成许可结论。

## 用户配置的渠道密钥

用户在「API 设置」里填的第三方渠道密钥（chatfire / openai）**只存在内存**，
唯一落点是 `src/utils/apiKeyVault.js`。任何把它写进 `localStorage`、`sessionStorage`
或 Cookie 的改动都会被 `tests/component/apiKeyStorage.spec.mjs` 判红。

- 默认渠道 `local-material` 不需要密钥，默认路径不受影响。
- 代价：刷新页面后需要重新填写密钥。这是有意的，不要用「加密后存 localStorage」绕开
  —— 解密密钥必须和密文待在同一个 JS 上下文里，等于没加密。
- **残余风险**：内存存储挡不住 XSS。注入脚本能读内存保管处，就像它能读 `localStorage`
  一样。前端把 `Authorization: Bearer <key>` 拼进请求的架构，客户端无法根治这一点。
  彻底修复需要 guanxi-canvas-backend 代持每用户的渠道凭据、在服务端注入上游
  `Authorization` 头，浏览器全程拿不到密钥。在那之前，本仓库只能把**静态留存**的风险
  从「永久留在这台设备上」压到「这个标签页的生命周期」。

## 文件与 URL

前端只做用户体验层校验。真实大小、媒体类型、扩展名、解码结果、下载目标、重定向和 SSRF 防护由后端强制执行。前端不得提供绕过后端限制的直连路径。

## 漏洞报告

不要在公开 Issue 中提交漏洞利用、凭据或用户素材。使用 GitHub Security Advisory 私下报告，并提供最小复现和受影响 Commit SHA。

发现已提交秘密时应立即吊销/轮换，再清理历史；仅删除当前文件不足以消除泄漏。
