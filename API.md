# 前端 API 契约

本文记录前端消费方式。接口的最终实现、鉴权和限制以后端仓库 `API.md` 为准：<https://github.com/huhu771912249-wq/guanxi-canvas-backend/blob/feature/dsp-h3-winner-upgrade-backend/API.md>。

## 基础规则

- 同源路径：`/auth`、`/v1`、`/public-assets`。
- JSON 请求使用 `application/json`；文件上传遵循后端声明的媒体类型和大小上限。
- 前端不得把 API Key 放入 URL、日志或项目持久化数据。
- HTTP 成功不代表异步任务成功，必须继续读取任务状态。

## 会话

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/auth/login` | 建立会话 |
| `GET` | `/auth/session` | 刷新登录状态 |
| `POST` | `/auth/logout` | 结束会话 |

未认证请求通常返回 `401`；不可信浏览器来源或无权操作返回 `403`。

## 主要接口族

| 路径 | 前端用途 |
| --- | --- |
| `/v1/assets/images` | 图片生成或本地图片资产 |
| `/v1/assets/recent` | 最近生成的图片、视频、GIF 和音频列表 |
| `/v1/assets/import` | 受控远程素材导入；默认作为输入素材，生成结果交接可传 `asset_role: generated` |
| `/v1/projects` | 项目摘要列表与按项目 JSON 持久化 |
| `/v1/tasks` | 统一任务中心，合并视频、裂变、小说、DSP 和尺寸处理任务 |
| `/v1/video/generations` | 视频生成 |
| `/v1/audio/generations` | 音频生成 |
| `/v1/media/compositions` | 媒体合成 |
| `/v1/media/text-overlays` | 视频文字叠加 |
| `/v1/material/variations` | 素材再创作 |
| `/v1/video-resize/jobs` | 多尺寸视频任务 |
| `/v1/test-assets/generate` | 精确尺寸生成 PNG、JPG、GIF、MP4 测试素材和批量 ZIP |
| `/v1/studio/documents/parse` | 文档/小说解析 |
| `/v1/studio/storyboards` | 故事板生成 |
| `/v1/studio/novel-video/jobs` | 小说成片任务 |
| `/v1/dsp-creatives` | DSP 素材任务与结果 |

项目接口：`GET /v1/projects` 返回不含 `canvasData` 的摘要列表；`GET /v1/projects/{id}` 返回单个完整项目；`PUT /v1/projects/{id}` 原子保存项目；`DELETE /v1/projects/{id}` 删除项目。项目 JSON 不接受 `data:` 或 `blob:` URL，媒体必须先转成后端素材地址。

H3 当前只接受单张图片参考。连接到 H3 视频节点的首帧或参考图片会自动登记为 `@图1`，并与同一张图片一起提交；编辑器或普通文字节点中的 `@图1` 会在前后端校验并编译为 `<Picture 1>`。有图片但没有显式引用时，客户端也会自动补上该官方标签；有标签但没有实际图片时必须阻止生成。可选 `director_plan.dialogue` 只保存纯台词，提交时编译为 `<d>…</d>`。当前接口不接受 H3 视频或独立音频引用，也没有启用未经验证的 4-step Turbo 参数。

WAI v17 已从前端移除，旧画板打开时回落到 Z-Image。Z-Image Base 支持
28–50 步、CFG 3–5、负面提示词、采样器和随机种子；Krea 2 Turbo 固定
8 步快速生成，不使用负面提示词。两者都是本机 ComfyUI 文生图节点，所需权重
未安装时必须显示真实失败，不静默切换模型。画板中的“视频转 GIF”
节点可连接 H3 视频成品并选择尺寸、适配方式、帧率与颜色数；输出的 GIF
可再连接“文字叠加”和“素材导出”节点。这些节点都是独立积木，不固定连线顺序。

## 异步任务状态

后端状态映射为：

| 规范状态 | 含义 | 前端行为 |
| --- | --- | --- |
| `queued` | 已接受、等待资源 | 显示等待，不伪造进度 |
| `running` | 正在处理 | 展示后端真实阶段/进度 |
| `succeeded` | 成功 | 校验并显示结果 URL |
| `failed` | 失败 | 显示安全错误并允许合规重试 |
| `cancelled` | 已取消 | 停止轮询并保留取消状态 |

后端若使用兼容别名，前端在 `src/utils/videoTaskStatus.js` 等规范化模块中映射，不在组件内散落判断。

## 错误

推荐错误结构：

```json
{
  "error": {
    "code": "invalid_request",
    "message": "可安全展示的错误信息"
  }
}
```

常见状态码：`400` 参数错误、`401` 未认证、`403` 无权限/来源不可信、`404` 资源不存在、`413` 文件过大、`415` 类型不支持、`422` 校验失败、`429` 限流、`5xx` 服务端或上游失败。

客户端不应把后端堆栈、Token、Cookie、主机路径或上游响应原文展示给用户。
