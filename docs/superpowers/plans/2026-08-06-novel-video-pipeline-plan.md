# 小说长视频生产线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 TXT、Markdown、DOCX 和文本 PDF 自动解析，并以智能改编或完整原文模式生成可恢复的分镜长视频项目。

**Architecture:** 后端建立 Document → Scene → Shot → Generation 四层持久任务；前端显示解析确认、故事板和逐镜头状态。单次 H3/LTX Prompt 在提交前压缩到 1000 字符以内，长片由短镜头生成后合成。

**Tech Stack:** Python 3、python-docx、pypdf、FFmpeg、Vue 3、Node test、pytest。

---

### Task 1: 文档解析器

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_document_parser.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_document_parser.py`

- [ ] 先写失败测试，覆盖 UTF-8/UTF-16 TXT、Markdown 标题、DOCX 段落、文本 PDF 和扫描 PDF 明确失败。
- [ ] 实现类型和大小校验、结构化章节输出与安全文件名。
- [ ] 运行 pytest，确认不把扫描件误报为已识别。

### Task 2: 剧本和分镜规划

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_story_planner.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_story_planner.py`

- [ ] 写失败测试，覆盖两种模式、人物表、场景、旁白、对白、预计时长和 3–5 秒镜头拆分。
- [ ] 实现确定性的长度预算与 LLM 结构化结果校验。
- [ ] 智能改编限制 1–3 分钟；完整模式按原文旁白速度估时并显示任务量。

### Task 3: 模型专用提示词

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_video_prompts.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_video_prompts.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 写失败测试，确保 H3/LTX 每个 Prompt 不超过 1000 字符。
- [ ] 区分文生图 Prompt 与图生视频 Prompt；后者只描述动作、镜头运动和时间变化。
- [ ] 生成前拦截超限并自动重写，错误节点只显示简明原因和可执行建议。

### Task 4: 持久任务 API

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_novel_jobs.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_novel_jobs.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 写失败测试，覆盖创建、刷新恢复、单镜头重试、跳过和合成。
- [ ] 增加上传、解析、规划、生成选定镜头、查询和最终合成 API。
- [ ] 状态写入受限 JSON 文件，服务重启后恢复。

### Task 5: 故事板和时间线

**Files:**
- Create: `src/components/video-studio/NovelProjectPanel.vue`
- Create: `src/components/video-studio/StoryboardGrid.vue`
- Create: `src/components/video-studio/StudioTimeline.vue`
- Create: `src/api/novelVideo.js`

- [ ] 上传后显示识别结果、预计镜头数、预计时长和模式。
- [ ] 用户确认后创建故事板；支持逐镜头编辑、试片、重试和换模型。
- [ ] 时间线显示视频、旁白、对白、字幕和音乐轨。
- [ ] 最终输出可下载、保存素材和送入画布。

### Task 6: 公网小样验收

- [ ] 使用短 TXT 和 DOCX 各跑一遍解析与故事板。
- [ ] 只生成一个镜头，验证 Prompt 长度、任务状态和结果恢复。
- [ ] 合成带音频字幕 MP4 并用 ffprobe 检查流。

