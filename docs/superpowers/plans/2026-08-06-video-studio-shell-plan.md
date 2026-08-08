# 视频创作中心与兼容入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立视频创作中心并重组首页入口，同时保留所有现有画布节点和业务功能。

**Architecture:** 新增 `/video-studio` 路由与轻量工作台状态；首页只做导航重组，画布数据结构不迁移。新页面通过现有 API 和 Pinia store 创建任务，并可生成兼容的画布项目数据。

**Tech Stack:** Vue 3、Vue Router、Pinia、Naive UI、Node test、Vite。

---

### Task 1: 兼容契约

**Files:**
- Create: `tests/legacyFeatureContract.test.mjs`
- Modify: `package.json`

- [ ] 写失败测试，断言 `/canvas/:id?`、全部现有节点类型、H3/LTX/FRW、DSP 素材库、任务中心、素材变化和批量视频入口仍存在。
- [ ] 运行测试确认新首页入口契约尚未满足。
- [ ] 增加新入口后运行全套测试。

### Task 2: 顶层导航和路由

**Files:**
- Create: `src/views/VideoStudio.vue`
- Create: `src/components/video-studio/StudioNav.vue`
- Modify: `src/router/index.js`
- Modify: `src/components/AppHeader.vue`

- [ ] 写失败测试，断言 `/video-studio` 受登录保护且顶层导航可达。
- [ ] 增加路由、页面壳和快速创作/小说成片/素材再创作标签。
- [ ] 保留首页、画布和所有现有路由。
- [ ] 运行路由契约测试和构建。

### Task 3: 首页业务入口重组

**Files:**
- Modify: `src/views/Home.vue`
- Create: `src/config/studioEntries.js`
- Create: `tests/studioEntries.test.mjs`

- [ ] 写失败测试，锁定快速创作、小说成片、素材库、DSP 素材库、任务中心、批量尺寸、背景替换、素材变化和最近项目九类入口。
- [ ] 用配置驱动卡片重组首页，现有功能跳转到原画布工作流，新功能进入视频中心。
- [ ] 浏览器检查桌面和窄屏布局。

### Task 4: 快速创作

**Files:**
- Create: `src/components/video-studio/QuickCreatePanel.vue`
- Create: `src/utils/studioIntent.js`
- Create: `tests/studioIntent.test.mjs`

- [ ] 写失败测试，覆盖文生图、文生图加视频和上传素材三种意图。
- [ ] 实现附件拖放、提示词、工作流自动判断和模型推荐摘要。
- [ ] 文生图加视频先生成可确认首帧，再允许提交视频，避免盲目连续消耗。
- [ ] 结果支持下载、重试、保存素材和送入画布。

### Task 5: 公网验收

- [ ] 运行 `pnpm test`、`pnpm build` 和敏感信息扫描。
- [ ] 备份远端 dist，部署并重启服务。
- [ ] 公网真实验证登录、首页入口、视频中心、旧画布和旧节点项目读取。

