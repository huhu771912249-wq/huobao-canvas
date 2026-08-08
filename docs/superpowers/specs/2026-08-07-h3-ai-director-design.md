# H3 专业导演设计

## 目标

把无限画布底部的通用 AI 助手升级为“冠希 H3 导演”。用户只需说一句自然语言需求，系统通过本地 Gemma 生成可审阅的专业导演方案，并自动搭建、按需执行 MiniMax H3 视频工作流。

## 设计原则

- 一次 H3 任务只描述一个连续镜头，避免把多个场景塞进 5 秒视频。
- 先结构化再生成：角色、地点、布景、景别、机位、镜头运动、光影、动作时间线、音频分别建模。
- 默认值透明：未指定时使用 16:9、5 秒、高质量 1080p、成年东亚人物、安全构图；用户明确要求优先。
- 真实闭环：方案预览、应用画布、任务真实阶段、视频预览、下载、失败重试均有入口。
- 不伪装：本地 AI 返回损坏 JSON 时使用确定性专业规则降级，并明确显示“规则补全”，不静默退化成普通文生图。

## 开源调研与采用项

- [Tencent HunyuanVideo 1.5 Prompt Handbook](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/assets/HunyuanVideo_1_5_Prompt_Handbook_EN.md)：采用“主体 + 动作 + 场景 + 景别 + 运镜 + 光线 + 风格 + 氛围”的专业提示词骨架，以及时序动作分解和空间方向约束。
- [HKUDS/ViMax](https://github.com/HKUDS/ViMax)：采用“自然语言需求 → 导演方案 → 分镜/镜头设计 → 生成检查点”的产品流程，并把角色、场景和声音作为独立可审阅字段。
- [vericontext/vibeframe](https://github.com/vericontext/vibeframe)：采用需要一致性时先生成并复用角色/关键帧参考图，再进入图生视频的策略。
- [awesome-seedance-2-prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts)：采用按秒动作时间线、微表情、环境声和一致性约束，但没有照搬其模型专属语法。
- [nkxx188/ComfyUI-MiniMaxH3-Easy](https://github.com/nkxx188/ComfyUI-MiniMaxH3-Easy)：采用“文生/参考生共用入口”、可视化 `@` 引用和台词块的交互模式；界面中的 `@图1` 与纯台词会在提交时分别转换为 `<Picture 1>` 与 `<d>…</d>`。
- [T8mars/comfyui-minimax-h3-audio-T8](https://github.com/T8mars/comfyui-minimax-h3-audio-T8)：作为后续 Turbo LoRA、双时钟采样和预检契约的技术参考；当前服务没有这些节点与模型的已验证工作流，因此本轮不提供虚假的 4-step 加速开关。

这些来源只用于提炼结构和产品模式；实际输出经过 H3 的 2/3/5 秒、16:9/9:16、1000 字符上限和单一连续镜头约束重新设计，不在运行时自动下载或执行不受信任的开源提示词。

当前生产 H3 通道只接受提示词与单张首帧/主体参考。视频和独立音频 `@` 引用要等上游生成接口与 ComfyUI 工作流共同支持后再开放，不能仅在前端伪造输入能力。

## 工作流

### 默认：一句话生成 H3 视频

`自然语言 → 本地 Gemma 导演计划 → 专业 H3 提示词节点 → MiniMax H3 视频节点 → 视频结果`

### 需要角色/产品一致性

`自然语言 → 关键帧提示词 → FRW 生图 → 首帧 → MiniMax H3 图生视频 → 视频结果`

### 分镜/长故事

先拆分为多个连续镜头，每个镜头独立生成专业 H3 提示词；长片继续交给已有小说成片页拼接、字幕和超分，不在一个 H3 请求里伪造长视频。

## 导演计划契约

```json
{
  "workflow_type": "h3_video",
  "title": "一句话标题",
  "summary": "用户可读方案摘要",
  "model": "minimax-h3",
  "aspect_ratio": "16:9",
  "duration_seconds": 5,
  "quality_mode": "quality",
  "requires_keyframe": false,
  "character": {"identity": "", "appearance": "", "wardrobe": "", "continuity": ""},
  "environment": {"location": "", "time": "", "weather": "", "set_dressing": "", "spatial_layout": ""},
  "cinematography": {"shot_size": "", "camera_angle": "", "lens": "", "composition": "", "camera_movement": "", "focus": ""},
  "lighting": {"key_light": "", "color_palette": "", "mood": ""},
  "action_timeline": ["0-2秒：...", "2-5秒：..."],
  "audio_direction": "",
  "image_prompt": "关键帧提示词",
  "video_prompt": "不超过 1000 字符的 H3 连续镜头提示词",
  "negative_prompt": "",
  "assumptions": ["系统补全项"]
}
```

## 页面

- 标题改为“冠希 H3 导演”，副标题说明“说人话，自动补全景别、人物、场景、布景、运镜和声音”。
- 发送后在输入框上方显示导演方案卡：模型、比例、时长、画质、角色、地点/布景、景别/镜头、光影、动作、音频。
- 主按钮“生成 H3 视频”；次按钮“只应用到画布”。自动生成默认开启，但用户可关闭以免消耗额度。
- 解析失败显示明确原因和规则降级状态；不再切回普通文生图。

## 验收

- 输入简短中文需求能得到字段完整的导演方案，H3 提示词不超过 1000 字符。
- 自动工作流明确使用 `minimax-h3`、用户选择或默认比例/时长、`quality` 1080p。
- 未指定人物、地点、布景、景别时可合理补全；明确指定时不覆盖。
- 页面可审阅、应用、生成，失败有可读错误；旧有节点、小说成片和素材再创作继续可用。
