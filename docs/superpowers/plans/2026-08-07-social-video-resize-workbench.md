# Social Video Resize Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Guanxi video resize workbench that imports authorized public Facebook/Instagram videos or local uploads and produces exact multi-size MP4/GIF deliverables with truthful SeedVR2 usage, subtitles, progress, retry, library save, and canvas handoff.

**Architecture:** A focused Vue workbench talks to a new backend resize-job API. The backend normalizes uploads and public URLs into a local source, probes media, runs safe FFmpeg transforms and conditional SeedVR2 through the existing shared GPU queue, persists per-output receipts, and exposes resumable status. Existing canvas, H3, LTX, novel, DSP, and overlay paths remain untouched except for entry and handoff integration.

**Tech Stack:** Vue 3, Vue Router, Axios, Python 3 stdlib HTTP server, yt-dlp, FFmpeg/FFprobe, existing SeedVR2/ComfyUI executor, unittest, Node assertion tests, Vite.

---

## File map

- Create `src/views/VideoResizeWorkbench.vue`: standalone operator UI.
- Create `src/api/videoResize.js`: create/status/cancel/retry/save/handoff API calls.
- Create `src/utils/videoResize.js`: frontend validation and display helpers.
- Modify `src/router/index.js`: `/video-resize` route.
- Modify `src/config/studioEntries.js` and `src/views/Home.vue`: visible entry without removing legacy entries.
- Create `tests/videoResizeWorkbench.test.mjs`: frontend contract and helper tests.
- Create `social_video_import.py`: URL policy, yt-dlp invocation, upload normalization and probing boundary.
- Create `video_resize_jobs.py`: job store, request validation, output state and recovery.
- Create `video_resize_pipeline.py`: framing, conditional SeedVR2, FFmpeg progress and output receipts.
- Modify `material_generation_api.py`: API construction and routes only.
- Create `test_social_video_import.py`, `test_video_resize_jobs.py`, `test_video_resize_pipeline.py`, `test_video_resize_api.py`: backend behavior and security tests.

### Task 1: Frontend request model and entry contract

**Files:**
- Create: `src/utils/videoResize.js`
- Create: `src/api/videoResize.js`
- Create: `tests/videoResizeWorkbench.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing helper tests**

```js
import assert from 'node:assert/strict'
import { normalizeResizeTargets, validateSocialVideoUrl } from '../src/utils/videoResize.js'

assert.deepEqual(normalizeResizeTargets(['720x1280', '1080x1080']), [
  { width: 720, height: 1280 }, { width: 1080, height: 1080 }
])
assert.equal(validateSocialVideoUrl('https://www.instagram.com/reel/abc/').ok, true)
assert.equal(validateSocialVideoUrl('http://127.0.0.1/private').ok, false)
```

- [ ] **Step 2: Run the test and verify module-not-found failure**

Run: `node tests/videoResizeWorkbench.test.mjs`

Expected: FAIL because `src/utils/videoResize.js` does not exist.

- [ ] **Step 3: Implement validation and API helpers**

```js
export const RESIZE_PRESETS = ['720x1280', '1080x1920', '1080x1080', '1280x720', '1920x1080']

export function normalizeResizeTargets(values) {
  return [...new Set(values)].map(value => {
    const [width, height] = String(value).toLowerCase().split('x').map(Number)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || height < 256 || width > 4096 || height > 4096 || width % 2 || height % 2) throw new Error('输出尺寸必须是 256–4096 的偶数')
    return { width, height }
  })
}
```

`src/api/videoResize.js` must call `/v1/video-resize/jobs`, `/status`, `/cancel`, `/retry`, `/save`, and `/handoff` through the existing `request` helper.

- [ ] **Step 4: Run the helper test**

Run: `node tests/videoResizeWorkbench.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/videoResize.js src/api/videoResize.js tests/videoResizeWorkbench.test.mjs package.json
git commit -m "feat: define video resize workbench contract"
```

### Task 2: Public social-video import security boundary

**Files:**
- Create: `social_video_import.py`
- Create: `test_social_video_import.py`

- [ ] **Step 1: Write failing URL-policy tests**

```python
def test_public_social_url_policy_rejects_private_networks_and_credentials(self):
    self.assertEqual(validate_social_url("https://www.instagram.com/reel/abc/").host, "www.instagram.com")
    for url in ("http://127.0.0.1/x", "http://169.254.169.254/x", "https://user:pass@facebook.com/x"):
        with self.subTest(url=url), self.assertRaises(SocialImportRejected):
            validate_social_url(url)
```

Also cover DNS resolving to private IP, redirects to private IP, non-Facebook/Instagram hosts, oversized downloads, non-video output and command timeout.

- [ ] **Step 2: Run tests and verify import failure**

Run: `python3 -m unittest test_social_video_import.py -v`

Expected: FAIL because `social_video_import` does not exist.

- [ ] **Step 3: Implement the importer**

```python
ALLOWED_SOCIAL_HOSTS = {"facebook.com", "www.facebook.com", "fb.watch", "instagram.com", "www.instagram.com"}

def import_public_video(url: str, target: Path, *, max_bytes: int, runner=subprocess.run) -> Path:
    safe = validate_social_url(url)
    command = ["yt-dlp", "--no-playlist", "--max-filesize", str(max_bytes), "--merge-output-format", "mp4", "-o", str(target), safe.url]
    completed = runner(command, capture_output=True, text=True, timeout=900, check=False)
    if completed.returncode:
        raise SocialImportError(sanitize_import_error(completed.stderr))
    return require_safe_video_file(target, max_bytes=max_bytes)
```

The implementation must resolve every redirect target, reject local/private/link-local/reserved addresses, run without cookies, and return sanitized errors only.

- [ ] **Step 4: Run importer tests**

Run: `python3 -m unittest test_social_video_import.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add social_video_import.py test_social_video_import.py
git commit -m "feat: safely import public social videos"
```

### Task 3: Persistent resize jobs and exact request validation

**Files:**
- Create: `video_resize_jobs.py`
- Create: `test_video_resize_jobs.py`

- [ ] **Step 1: Write failing state-machine tests**

```python
def test_resize_job_persists_multiple_targets_and_terminal_receipts(tmp_path):
    store = VideoResizeJobStore(tmp_path)
    job = store.create({"targets": [{"width": 720, "height": 1280}, {"width": 1080, "height": 1080}], "fit_mode": "blur"})
    assert store.get(job["job_id"])["status"] == "queued"
    store.transition(job["job_id"], "probing", progress=12)
    assert store.get(job["job_id"])["current_step"] == "读取视频信息"
```

Cover duplicate targets, partial/odd/out-of-range dimensions, unsupported fit/output modes, cancel terminality, retry attempt increments, restart recovery and path containment.

- [ ] **Step 2: Run tests and confirm failure**

Run: `python3 -m unittest test_video_resize_jobs.py -v`

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement atomic JSON job storage**

Define statuses `queued/importing/probing/framing/upscaling/composing/encoding/completed/failed/cancelled`, per-target result records, monotonic progress, atomic temp-file replacement, capacity limits, owned-root path validation and recovery that requeues safe pre-processing states but marks interrupted encoder/GPU work retryable.

- [ ] **Step 4: Run store tests**

Run: `python3 -m unittest test_video_resize_jobs.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add video_resize_jobs.py test_video_resize_jobs.py
git commit -m "feat: persist video resize jobs"
```

### Task 4: FFmpeg framing, conditional SeedVR2 and truthful receipts

**Files:**
- Create: `video_resize_pipeline.py`
- Create: `test_video_resize_pipeline.py`
- Reuse: `huobao_video_quality_pipeline.py`

- [ ] **Step 1: Write failing pipeline tests**

```python
def test_low_resolution_source_uses_seedvr2_before_exact_delivery(tmp_path):
    pipeline = make_pipeline(tmp_path, source_size=(360, 640), fake_upscaler=True)
    result = pipeline.run_target(target={"width": 1080, "height": 1920}, fit_mode="smart", force_ai=False)
    assert result["upscale_method"] == "seedvr2"
    assert (result["actual_width"], result["actual_height"]) == (1080, 1920)

def test_large_source_skips_seedvr2_unless_forced(tmp_path):
    result = make_pipeline(tmp_path, source_size=(2160, 3840)).run_target(target={"width": 1080, "height": 1920}, fit_mode="center", force_ai=False)
    assert result["upscale_status"] == "skipped"
    assert result["upscale_skip_reason"] == "source_meets_target"
```

Also test blur-background filters, smart crop fallback, subtitles, text overlay escaping, GIF creation, cancellation, one-target failure isolation and FFprobe receipt validation.

- [ ] **Step 2: Run tests and verify failure**

Run: `python3 -m unittest test_video_resize_pipeline.py -v`

Expected: FAIL because `VideoResizePipeline` does not exist.

- [ ] **Step 3: Implement pipeline boundaries**

Use injected `runner`, `probe`, `upscaler`, `store`, and `gpu_queue`. Read FFmpeg `-progress pipe:1`; never invent progress. Generate MP4 H.264/yuv420p and optional palette-based GIF. Validate every result with FFprobe and write `requested_width`, `requested_height`, `actual_width`, `actual_height`, `upscale_method`, codec, duration, bytes and URLs.

- [ ] **Step 4: Run pipeline tests**

Run: `python3 -m unittest test_video_resize_pipeline.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add video_resize_pipeline.py test_video_resize_pipeline.py
git commit -m "feat: process exact multi-size video outputs"
```

### Task 5: Backend API routes and recovery scheduler

**Files:**
- Modify: `material_generation_api.py`
- Create: `test_video_resize_api.py`

- [ ] **Step 1: Write failing HTTP contract tests**

Test JSON URL import and multipart upload creation, GET status, POST cancel/retry/save/handoff, missing job 404, invalid payload 400, capacity 429 and sanitized server failures.

```python
def test_create_resize_job_route_returns_persistent_task(api_client):
    response = api_client.post("/v1/video-resize/jobs", {"source_url": "https://www.instagram.com/reel/abc/", "targets": [{"width": 720, "height": 1280}], "fit_mode": "blur", "outputs": ["mp4"]})
    assert response.status == 202
    assert response.json["status"] == "queued"
```

- [ ] **Step 2: Run API tests and verify 404/failure**

Run: `python3 -m unittest test_video_resize_api.py -v`

Expected: FAIL because routes are absent.

- [ ] **Step 3: Wire API components**

Construct the store, importer and pipeline in `MaterialGenerationApi.__init__`, reuse `shared_seedvr2_executor` and `novel_video_gpu_queue`, schedule bounded workers, recover persisted jobs, and close workers in lifecycle shutdown. Route bodies must use existing bounded-body and multipart controls.

- [ ] **Step 4: Run API and regression tests**

Run: `python3 -m unittest test_video_resize_api.py test_material_generation_api.py test_huobao_video_quality_pipeline.py -q`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit**

```bash
git add material_generation_api.py test_video_resize_api.py
git commit -m "feat: expose video resize job API"
```

### Task 6: Standalone workbench UI and real task controls

**Files:**
- Create: `src/views/VideoResizeWorkbench.vue`
- Modify: `src/router/index.js`
- Modify: `src/config/studioEntries.js`
- Modify: `src/views/Home.vue`
- Modify: `tests/videoResizeWorkbench.test.mjs`

- [ ] **Step 1: Extend failing UI contract tests**

Assert route `/video-resize`, entry title `视频尺寸工作台`, source URL/upload controls, five presets/custom dimensions, three fit modes, subtitles/text/GIF, force-AI toggle, real stage labels, cancel/retry, save, download and canvas handoff.

- [ ] **Step 2: Run UI test and verify failure**

Run: `node tests/videoResizeWorkbench.test.mjs`

Expected: FAIL because route and view are absent.

- [ ] **Step 3: Implement the page**

Use a four-part layout: source and probe summary; multi-size/fit settings; preview and subtitle/text controls; task/result grid. Poll only active jobs, stop polling when hidden, and derive progress exclusively from server fields. Display per-output requested/actual dimensions and truthful `SeedVR2 AI 超分` or `高质量重构` labels.

- [ ] **Step 4: Run frontend tests and build**

Run: `npm test && node tests/videoResizeWorkbench.test.mjs && npm run build`

Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/views/VideoResizeWorkbench.vue src/router/index.js src/config/studioEntries.js src/views/Home.vue tests/videoResizeWorkbench.test.mjs
git commit -m "feat: add video resize workbench UI"
```

### Task 7: End-to-end acceptance, deployment and rollback evidence

**Files:**
- Create: `docs/verification/2026-08-07-video-resize-workbench.md`
- Modify only if defects are found: files from Tasks 1–6.

- [ ] **Step 1: Verify runtime dependencies on the GPU server**

Run read-only checks for `yt-dlp --version`, `ffmpeg -version`, `ffprobe -version`, ComfyUI/SeedVR2 health, free disk and `guanxi-canvas.service`. Install only missing authorized packages through the system package boundary, recording versions without secrets.

- [ ] **Step 2: Run complete local verification**

Frontend: `npm test && node tests/h3DirectorPrompt.test.mjs && node tests/videoResizeWorkbench.test.mjs && npm run build`

Backend: `python3 -m unittest test_social_video_import.py test_video_resize_jobs.py test_video_resize_pipeline.py test_video_resize_api.py test_material_generation_api.py test_huobao_video_quality_pipeline.py test_huobao_novel_pipeline.py test_dsp_creative_service.py -q`

Expected: zero failures.

- [ ] **Step 3: Deploy recoverably**

Create a timestamped backup under `/opt/guanxi-canvas/deployments/`, stage exact runtime files and frontend `dist`, compile Python, switch/copy through the existing Guanxi deployment boundary, restart only `guanxi-canvas.service`, and verify local plus public health endpoints. Never print secret files.

- [ ] **Step 4: Perform real browser acceptance**

Verify one authorized public social link and one local upload. Produce 720×1280, 1080×1080 and 1920×1080 outputs; verify exact dimensions with FFprobe, play/download MP4, preview/download GIF, subtitles/text, cancel/retry, page refresh persistence, save to library and canvas handoff. Also test a restricted/invalid link for the upload fallback message.

- [ ] **Step 5: Record evidence and commit**

The verification document must separate local tests, deployed source, public health, actual output receipts and browser acceptance. Any missing layer is `未确认/需复核`.

```bash
git add docs/verification/2026-08-07-video-resize-workbench.md
git commit -m "docs: verify video resize workbench"
```
