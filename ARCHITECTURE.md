# 系统架构

## 组件边界

```text
Browser
  -> Vue Router / Pinia
  -> Vue Flow workflow nodes
  -> HTTP client (/auth, /v1, /public-assets)
  -> guanxi-canvas-backend
       -> authentication and task APIs
       -> task state / material storage
       -> ComfyUI / SeedVR2
       -> FFmpeg / ffprobe
       -> FRW
       -> SCAIL2
```

前端只负责编排、输入校验、状态展示和结果交互。后端负责鉴权、下载安全、文件验证、模型调用、GPU 队列、媒体处理和持久化。

## 前端模块

- `src/views/`：首页、登录、画布、视频工作台。
- `src/components/nodes/`：Vue Flow 业务节点。
- `src/api/`：后端 API 封装。
- `src/utils/`：任务状态、素材下载、质量和尺寸契约。
- `src/stores/`：会话、项目、画布和模型状态。
- `src/config/`：模型、工作流、输出尺寸等非秘密配置。

## 数据流

1. 用户在页面或画布节点提交文本、图片、视频或文档。
2. 前端把输入转换为后端契约；大文件不会写入项目源码。
3. 后端返回同步结果或异步任务 ID。
4. 前端轮询真实任务状态，并呈现进度、取消、重试、预览和下载入口。
5. 后端将公开结果暴露在受控 `/public-assets/` 路径；前端验证返回 URL 后再展示。

## 项目与浏览器缓存

- 画布项目通过 `/v1/projects` 按项目保存到后端，项目列表只读取摘要，进入画布后再读取完整节点 JSON。
- 图片、视频和音频二进制不进入项目 JSON；内嵌图片会先发布到 `/public-assets/`，项目只保存素材 URL、任务 ID 和必要元数据。
- `localStorage` 只保存当前项目 ID、同步时间等轻量客户端状态。旧版 `ai-canvas-projects` 会在首次成功同步后自动迁移并删除。
- 用户配置的渠道 API Key **不进任何浏览器存储**，只活在 `src/utils/apiKeyVault.js` 的内存里；旧版留在 `api-keys-by-provider` / `apiKey` 的明文会在启动时读入内存并删除。详见 `SECURITY.md`。
- 项目自动保存失败时保留当前页面内存，不再通过删除旧项目或截断画布来规避浏览器配额。

## 外部处理器

- **ComfyUI / SeedVR2**：GPU 工作流与视频超分，由后端管理队列和能力探测。
- **FFmpeg / ffprobe**：媒体探测、转码、拼接、字幕和尺寸输出。
- **FRW**：外部素材/视频生成能力，密钥只存在后端。
- **SCAIL2**：生成任务接口，前端只消费规范化结果和错误。

外部处理器不可用时，前端必须显示后端的真实失败或降级状态，不能用倒计时或固定百分比伪造进度。

## 发布关系

前后端独立构建，但作为一个版本对发布。每个 release manifest 必须包含两个仓库的完整 Commit SHA。后端 `/health` 是运行版本事实入口；前端静态文件本身不能证明线上后端版本。
