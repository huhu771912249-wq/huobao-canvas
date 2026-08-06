# 冠希小说成片与全链路 1080p Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将故事板变成可续跑的批量分镜、SeedVR2 超分、拼接、字幕校对及 1080p 成片工作流，并给全部视频入口提供快速与高质量两个档位。

**Architecture:** 前端用项目级 job API 驱动状态机；后端把单镜生成、SeedVR2、FFmpeg 标准化、拼接和字幕合成拆成可恢复阶段。GPU 密集阶段由单一文件锁串行执行，任务和产物以 JSON/文件持久化，前端轮询真实状态。

**Tech Stack:** Vue 3、Naive UI、Python HTTP API、ComfyUI、SeedVR2 3B FP16、FFmpeg/ffprobe、Node/Python tests。

---

### Task 1: 固化清晰度档位和小说项目数据契约

**Files:**
- Create: `src/utils/videoQualityProfile.js`
- Create: `src/api/novelVideo.js`
- Modify: `src/api/mediaComposition.js`
- Test: `tests/videoQualityProfile.test.mjs`
- Test: `tests/novelVideoApi.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
assert.deepEqual(getVideoQualityProfile('quality', '16:9'), {
  mode: 'quality', width: 1920, height: 1080,
  upscaler: 'seedvr2-3b-fp16', label: '高质量 1080p'
})
assert.deepEqual(getVideoQualityProfile('fast', '9:16'), {
  mode: 'fast', width: 1080, height: 1920,
  upscaler: null, label: '快速导出'
})
assert.match(apiSource, /\/v1\/studio\/novel-video\/jobs/)
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node tests/videoQualityProfile.test.mjs && node tests/novelVideoApi.test.mjs`

- [ ] **Step 3: 实现数据契约**

```js
export const getVideoQualityProfile = (mode = 'quality', ratio = '16:9') => {
  const portrait = ratio === '9:16'
  return {
    mode,
    width: portrait ? 1080 : 1920,
    height: portrait ? 1920 : 1080,
    upscaler: mode === 'quality' ? 'seedvr2-3b-fp16' : null,
    label: mode === 'quality' ? '高质量 1080p' : '快速导出'
  }
}
```

API 至少提供 `createNovelVideoJob`、`getNovelVideoJob`、`retryNovelVideoShot`、`updateNovelSubtitles`、`finalizeNovelVideoJob`。

- [ ] **Step 4: 运行新增测试和全量前端测试**

Run: `node tests/videoQualityProfile.test.mjs && node tests/novelVideoApi.test.mjs && npm test`

- [ ] **Step 5: 提交**

```bash
git add src/api src/utils tests package.json
git commit -m "feat: define 1080p novel video job contract"
```

### Task 2: 实现后端可恢复任务状态机

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_novel_video.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_novel_video.py`

- [ ] **Step 1: 写失败测试**

```python
def test_job_state_can_resume_from_failed_shot(tmp_path):
    store = NovelVideoJobStore(tmp_path)
    job = store.create({"shots": [{"id": "s1"}, {"id": "s2"}]})
    store.update_shot(job["id"], "s1", status="completed", video_url="/s1.mp4")
    store.update_shot(job["id"], "s2", status="failed", error="oom")
    assert store.resume_plan(job["id"]) == ["s2"]
```

- [ ] **Step 2: 运行并确认失败**

Run: `cd /Users/diaodeyi/tg-clockin && python3 -m unittest test_huobao_novel_video.py -v`

- [ ] **Step 3: 实现原子 JSON 存储和状态转换**

状态只允许：`queued → generating → upscaling → composing → subtitling → completed`；任一运行态可进入 `failed` 或 `cancelled`。写入使用临时文件加 `os.replace`，镜头成功产物不得被整单重试覆盖。

- [ ] **Step 4: 加入 API 路由**

```text
POST /v1/studio/novel-video/jobs
GET  /v1/studio/novel-video/jobs/{id}
POST /v1/studio/novel-video/jobs/{id}/shots/{shot_id}/retry
PUT  /v1/studio/novel-video/jobs/{id}/subtitles
POST /v1/studio/novel-video/jobs/{id}/finalize
```

- [ ] **Step 5: 运行后端单测**

Run: `cd /Users/diaodeyi/tg-clockin && python3 -m unittest test_huobao_novel_video.py test_material_generation_api.py -v`

### Task 3: 安装并验证 SeedVR2 3B FP16

**Files:**
- Create on server: `/opt/ai/ComfyUI/custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/`
- Create on server: `/opt/ai/ComfyUI/models/seedvr2/seedvr2_ema_3b_fp16.safetensors`
- Create: `/Users/diaodeyi/tg-clockin/seedvr2_adapter.py`
- Create: `/Users/diaodeyi/tg-clockin/test_seedvr2_adapter.py`

- [ ] **Step 1: 写适配器失败测试**

```python
def test_seedvr2_request_targets_exact_1080_dimensions():
    request = build_seedvr2_request("input.mp4", ratio="16:9")
    assert request["resolution"] == 1080
    assert request["output_width"] == 1920
    assert request["output_height"] == 1080
```

- [ ] **Step 2: 服务器备份 ComfyUI custom_nodes 清单和 Python 依赖**

Run: `ssh ... 'pip freeze > /opt/guanxi-canvas/backups/seedvr2-preinstall-pip.txt && find /opt/ai/ComfyUI/custom_nodes -maxdepth 1 -type d > /opt/guanxi-canvas/backups/seedvr2-preinstall-nodes.txt'`

- [ ] **Step 3: 从官方仓库安装节点和 3B FP16 权重**

来源固定为 `https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler` 及其 README 指向的官方权重；校验文件存在、大小和 SHA256，禁止使用第三方打包模型。

- [ ] **Step 4: 重启 ComfyUI 并检查节点注册**

Run: `curl -fsS http://127.0.0.1:8188/object_info | python3 -c 'import json,sys; d=json.load(sys.stdin); assert any("SeedVR2" in k for k in d)'`

- [ ] **Step 5: 用 608×352 测试片生成 1920×1080 输出**

Run: `ffprobe -v error -show_entries stream=width,height -of csv=p=0 seedvr2-smoke.mp4`

Expected: `1920,1080`

### Task 4: GPU 排队、卸载和超分阶段接入

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/huobao_gpu_queue.py`
- Modify: `/Users/diaodeyi/tg-clockin/huobao_novel_video.py`
- Create: `/Users/diaodeyi/tg-clockin/test_huobao_gpu_queue.py`

- [ ] **Step 1: 写锁和阶段续跑失败测试**

```python
def test_gpu_queue_never_runs_generate_and_upscale_together(tmp_path):
    queue = GpuJobQueue(tmp_path / "gpu.lock")
    with queue.acquire("generate"):
        with pytest.raises(GpuBusyError):
            queue.acquire_nowait("upscale")
```

- [ ] **Step 2: 实现跨进程文件锁**

使用 `fcntl.flock`；锁记录 job、阶段、PID、开始时间。进入 SeedVR2 前调用 ComfyUI `/free` 卸载模型，阶段结束后释放锁。

- [ ] **Step 3: OOM 重试策略**

第一次 OOM：清缓存后重试；第二次：降低 batch 并启用 VAE tiling；再次失败则保持原镜头并标记 `upscale_failed`，不伪装为高质量完成。

- [ ] **Step 4: 运行测试**

Run: `cd /Users/diaodeyi/tg-clockin && python3 -m unittest test_huobao_gpu_queue.py test_huobao_novel_video.py -v`

### Task 5: 标准化、拼接与双版本字幕合成

**Files:**
- Modify: `/Users/diaodeyi/tg-clockin/huobao_media_compose.py`
- Modify: `/Users/diaodeyi/tg-clockin/test_huobao_media_compose.py`

- [ ] **Step 1: 写三段视频拼接失败测试**

```python
def test_compose_story_outputs_clean_captioned_and_srt(tmp_path):
    result = compose_story(shots, ratio="16:9", subtitles=segments, output_dir=tmp_path)
    assert result.clean_video.exists()
    assert result.captioned_video.exists()
    assert result.subtitle_file.suffix == ".srt"
```

- [ ] **Step 2: 实现镜头标准化**

每段统一为 1920×1080 或 1080×1920、`yuv420p`、30fps、统一 timebase；无音轨时添加 AAC 静音轨。使用等比缩放和居中裁切/填充，禁止拉伸。

- [ ] **Step 3: 实现 concat 和字幕烧录**

先生成无字幕 MP4，再从镜头文案生成 SRT/ASS，最后烧录字幕生成第二个 MP4。字幕文件独立保留并返回 URL。

- [ ] **Step 4: ffprobe 硬校验**

输出必须匹配目标尺寸、有视频流、时长大于零；带音频需求时必须有音轨，否则 API 返回失败。

- [ ] **Step 5: 运行单测和真实 FFmpeg 集成测试**

Run: `cd /Users/diaodeyi/tg-clockin && python3 -m unittest test_huobao_media_compose.py -v`

### Task 6: 完成小说成片前端工作区

**Files:**
- Create: `src/components/studio/NovelVideoWorkspace.vue`
- Create: `src/components/studio/NovelShotCard.vue`
- Create: `src/components/studio/SubtitleEditor.vue`
- Modify: `src/views/VideoStudio.vue`
- Test: `tests/novelVideoWorkspace.test.mjs`

- [ ] **Step 1: 写失败的 UI 契约测试**

```js
assert.match(workspaceSource, /生成全部镜头/)
assert.match(workspaceSource, /生成最终成片/)
assert.match(workspaceSource, /高质量 1080p/)
assert.match(workspaceSource, /仅重试此镜头/)
assert.match(workspaceSource, /字幕校对/)
```

- [ ] **Step 2: 故事板改为可编辑镜头卡**

镜头卡编辑 source text、image prompt、motion prompt、subtitle 和 duration；保存后再提交 job。

- [ ] **Step 3: 加清晰度档位和真实进度**

默认 `quality`；展示原生、AI 超分、最终输出三种分辨率。轮询 job API，按后端状态渲染，不用前端假进度。

- [ ] **Step 4: 加字幕校对和结果下载**

支持字幕文本和起止时间编辑；完成后展示无字幕 MP4、带字幕 MP4、SRT 三个下载入口。

- [ ] **Step 5: 运行测试和构建**

Run: `node tests/novelVideoWorkspace.test.mjs && npm test && npm run build`

- [ ] **Step 6: 提交**

```bash
git add src tests package.json
git commit -m "feat: complete novel video production workspace"
```

### Task 7: 给全部入口统一清晰度选择

**Files:**
- Modify: `src/views/VideoStudio.vue`
- Modify: `src/components/nodes/VideoConfigNode.vue`
- Modify: `src/components/nodes/MaterialVariationNode.vue`
- Modify: `src/config/studioProjectFlow.js`
- Test: `tests/global1080Quality.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
for (const file of [studio, videoNode, materialNode]) {
  assert.match(file, /快速导出/)
  assert.match(file, /高质量 1080p/)
}
assert.match(videoNode, /原生分辨率/)
assert.match(videoNode, /最终输出/)
```

- [ ] **Step 2: 接入统一 profile**

文生图、文生视频、素材再创作和画布视频节点复用 `getVideoQualityProfile`；高质量产物由后端返回真实 `upscale_status` 和尺寸。

- [ ] **Step 3: 保留旧工作流**

现有拖线、首帧上传、H3/LTX 能力提示、尺寸选择和素材功能不得删除；运行 `legacyFeatureContract` 与 `videoInputActions` 回归测试。

- [ ] **Step 4: 全量验证并提交**

Run: `npm test && npm run build`

### Task 8: 部署与真实验收

**Files:**
- Deploy frontend dist to: `/opt/guanxi-canvas/current/frontend/huobao-canvas/dist`
- Deploy backend files to: `/opt/guanxi-canvas/current/`

- [ ] **Step 1: 备份线上前端、API、systemd 配置和当前模型清单**

备份目录使用 `/opt/guanxi-canvas/backups/20260806-novel-video-1080p/`，保证可回滚。

- [ ] **Step 2: 部署并重启服务**

重启 `guanxi-canvas` 和 ComfyUI；确认 8788、8188 健康，页面资源 hash 已变化。

- [ ] **Step 3: 运行三镜头真实短片**

使用非敏感测试故事生成至少 3 个镜头，依次验证生成、SeedVR2、拼接、字幕和下载。

- [ ] **Step 4: 验证产物**

```bash
ffprobe -v error -show_entries stream=codec_type,width,height -show_entries format=duration -of json final-captioned.mp4
```

横屏必须为 1920×1080、时长大于零、包含视频和音频；SRT 可下载且字幕时间不越界。

- [ ] **Step 5: 浏览器验收**

确认快速/高质量档位、逐镜进度、失败重试、字幕校对、三种下载入口和 H3/LTX 能力提示均可交互。

- [ ] **Step 6: 合并并清理工作区**

只有自动测试、构建、后端测试、线上健康检查和真实短片全部通过后，才快进合并 `feature/novel-video-1080p` 并删除工作树。
