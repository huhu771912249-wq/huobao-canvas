# 素材中心与视频尺寸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立上传与生成素材统一管理，并把 1280×720、720×1280 和自定义尺寸可靠贯穿生成与导出。

**Architecture:** 后端素材索引记录来源、媒体信息、分类和项目引用；前端素材中心提供筛选、复用和送入工作流。尺寸使用目标像素与模型比例分离的数据结构，导出阶段进行等比适配。

**Tech Stack:** Python 3、FFprobe、FFmpeg、Vue 3、Pinia、pytest、Node test。

---

### Task 1: 尺寸契约

**Files:**
- Create: `src/config/videoSizes.js`
- Create: `src/utils/videoSize.js`
- Create: `tests/videoSize.test.mjs`
- Modify: `src/config/models.js`

- [ ] 写失败测试，覆盖 1280×720、720×1280、自定义偶数尺寸、越界和比例映射。
- [ ] 实现常用尺寸卡、自定义宽高校验和模型比例适配。
- [ ] 保留广告批量尺寸原逻辑，禁止混用。

### Task 2: 后端适配导出

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_video_resize.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_video_resize.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 写失败测试，锁定 contain/cover 两种等比策略和 FFmpeg 参数。
- [ ] 实现目标尺寸转码，不拉伸人物，不覆盖源文件。
- [ ] 用 ffprobe 验证两个默认尺寸的真实输出。

### Task 3: 素材索引

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_asset_library.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_asset_library.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 写失败测试，覆盖上传、生成来源、人物/场景/品牌分类、项目引用和隐私默认值。
- [ ] 增加素材列表、导入、更新分类和读取详情 API。
- [ ] 素材记录生成参数和父素材，但不记录密钥。

### Task 4: 素材中心 UI

**Files:**
- Create: `src/components/video-studio/AssetLibraryPanel.vue`
- Create: `src/api/studioAssets.js`

- [ ] 实现上传进度、图片/视频/文档筛选、项目文件夹和网格/列表视图。
- [ ] 实现“用于文生图、用于视频、用于小说人物、送入画布、下载”。
- [ ] 保留现有 DSP 素材库入口，业务素材与创作素材可互相引用但不混淆字段。

### Task 5: 回归和公网验收

- [ ] 跑全套前后端测试和生产构建。
- [ ] 验证两个默认尺寸、自定义尺寸、素材上传、复用、下载和旧画布打开。
