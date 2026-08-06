# 火宝画布生产收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将火宝画布整理为已版本化、登录安全、支持 LTX 音频字幕合成并完成公网验收的生产版本。

**Architecture:** Vue 前端提供简化设置、字幕编辑和合成任务交互；Python API 提供持久认证、限流与 FFmpeg 合成；Nginx 保持 TLS 和反向代理。所有生成物使用新文件并通过公开素材路由提供。

**Tech Stack:** Vue 3、Pinia、Node test、Python 3、FFmpeg、Nginx、systemd、GitHub。

---

### Task 1: Git 边界与忽略规则

**Files:**
- Modify: `.gitignore`
- Inspect: all modified and untracked files

- [ ] 写一个检查命令，证明 `.DS_Store`、环境文件、Cookie、媒体输出不会进入暂存区。
- [ ] 更新 `.gitignore`，只添加明确的缓存、密钥和生成物规则。
- [ ] 运行检查并确认敏感文件为零。
- [ ] 单独提交忽略规则。

### Task 2: 持久认证和限流

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_auth.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_auth.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 先写失败测试：生产环境缺少密码时拒绝启动、会话可落盘恢复、失败达到阈值返回限流状态。
- [ ] 运行测试确认因功能缺失失败。
- [ ] 实现凭据加载、token 哈希持久化、过期清理和失败窗口。
- [ ] 将 API 登录、会话、退出接入认证模块，并设置 Secure Cookie。
- [ ] 运行认证测试和现有 API 测试。

### Task 3: 字幕和音视频合成后端

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_media_compose.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_media_compose.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] 先写失败测试：字幕时间段生成、SRT 转义、非法路径拒绝、FFmpeg 参数包含音频映射和字幕滤镜。
- [ ] 运行测试确认因模块不存在失败。
- [ ] 实现纯函数并通过单元测试。
- [ ] 增加 `POST /v1/media/compositions` 和任务查询接口，输出文件写入公开素材目录。
- [ ] 使用短测试视频、LTX FLAC 和中文字幕运行真实 FFmpeg 合成，并用 ffprobe 验证视频流和音频流。

### Task 4: 前端字幕合成节点

**Files:**
- Create: `src/api/mediaComposition.js`
- Create: `src/utils/subtitleTimeline.js`
- Create: `tests/subtitleTimeline.test.mjs`
- Modify: `src/components/nodes/VideoConfigNode.vue`
- Modify: `package.json`

- [ ] 先写失败测试：按时长生成字幕段、拒绝空字幕、保留用户编辑时间。
- [ ] 运行测试确认模块缺失。
- [ ] 实现字幕时间线工具和合成 API 客户端。
- [ ] 在 LTX 区域加入源视频、字幕文本、生成最终 MP4、真实进度、预览、下载和重试。
- [ ] 运行前端全套测试。

### Task 5: 简化 API 设置

**Files:**
- Modify: `src/components/ApiSettings.vue`
- Create: `src/utils/apiSettingsVisibility.js`
- Create: `tests/apiSettingsVisibility.test.mjs`

- [ ] 先写失败测试：本地渠道隐藏技术字段，外部渠道默认折叠但可展开。
- [ ] 实现显示策略和“高级设置”开关。
- [ ] 运行测试并构建生产包。

### Task 6: 部署与公网验收

**Files:**
- Modify: remote `/opt/guanxi-canvas/current/*`
- Modify: remote `/etc/systemd/system/guanxi-canvas.service.d/*`

- [ ] 备份远端后端、dist、Nginx 和 systemd 配置。
- [ ] 上传代码和 dist，确认环境密码与状态路径存在但不打印秘密。
- [ ] Python 编译、Nginx 检查、服务重启和健康检查。
- [ ] 公网验证未登录 401、登录、重启后会话、限流、LTX 音频、字幕 MP4、播放和下载。

### Task 7: 整理提交并推送 GitHub

**Files:**
- Stage only reviewed frontend source, tests and docs

- [ ] 审查 `git diff --check`、暂存文件清单和密钥扫描。
- [ ] 运行前端测试和构建。
- [ ] 按功能提交源代码。
- [ ] 推送 `main` 到 `origin`，读取远端提交确认。
