# Global Video Output Sizes and Mandatory SeedVR2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every video workflow the same target-size controls and require a verified SeedVR2 quality pass before publishing the exact requested dimensions.

**Architecture:** A shared frontend size catalog owns presets, custom validation, and legacy ratio migration. A matching backend value object revalidates every request; generation or upload produces a source video, SeedVR2 performs the mandatory AI quality pass, and a final aspect-preserving formatter emits and probes the exact delivery size. Existing 54DSP image/GIF sizing remains isolated from the new 54DSP H3 video target.

**Tech Stack:** Vue 3, Pinia, Node test runner, Python 3, dataclasses, unittest/pytest, FFmpeg/ffprobe, ComfyUI SeedVR2, systemd/nginx.

---

## File map

- Frontend `src/utils/videoOutputSizes.js`: canonical presets, validation, legacy migration, request serialization.
- Frontend `src/components/VideoOutputSizePicker.vue`: reusable preset/custom-size control.
- Frontend video entry components: only bind picker state and submit exact dimensions.
- Backend `video_output_sizes.py`: authoritative size parsing and validation.
- Backend `huobao_video_quality_pipeline.py`: mandatory SeedVR2 stage, exact formatter, metadata verification.
- Backend `material_generation_api.py`: accepts dimensions at every video endpoint and preserves them across retry/status responses.
- Backend `huobao_media_compose.py`: subtitle composition at an explicit exact canvas, after SeedVR2.
- DSP image/GIF dimensions remain in `dsp_creative_service.py`; DSP H3 video dimensions live only in the H3 upgrade record.

### Task 1: Canonical frontend target-size contract

**Files:**
- Create: `src/utils/videoOutputSizes.js`
- Create: `tests/videoOutputSizes.test.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
import assert from 'node:assert/strict'
import { VIDEO_OUTPUT_PRESETS, normalizeVideoOutputSize } from '../src/utils/videoOutputSizes.js'

assert.deepEqual(VIDEO_OUTPUT_PRESETS.map(({ width, height }) => [width, height]), [
  [1280, 720], [720, 1280], [1920, 1080], [1080, 1920], [1080, 1080]
])
assert.deepEqual(normalizeVideoOutputSize({ ratio: '9:16' }), { width: 1080, height: 1920, preset: 'portrait-1080p' })
assert.deepEqual(normalizeVideoOutputSize({ output_width: 1280, output_height: 720 }), { width: 1280, height: 720, preset: 'landscape-720p' })
for (const value of [{ output_width: 255, output_height: 720 }, { output_width: 721, output_height: 1280 }, { output_width: 1920 }]) {
  assert.throws(() => normalizeVideoOutputSize(value))
}
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node tests/videoOutputSizes.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the focused utility**

```js
export const VIDEO_OUTPUT_PRESETS = Object.freeze([
  { key: 'landscape-720p', label: '1280 × 720 横屏', width: 1280, height: 720 },
  { key: 'portrait-720p', label: '720 × 1280 竖屏', width: 720, height: 1280 },
  { key: 'landscape-1080p', label: '1920 × 1080 横屏', width: 1920, height: 1080 },
  { key: 'portrait-1080p', label: '1080 × 1920 竖屏', width: 1080, height: 1920 },
  { key: 'square-1080p', label: '1080 × 1080 方形', width: 1080, height: 1080 }
])

const bySize = new Map(VIDEO_OUTPUT_PRESETS.map(item => [`${item.width}x${item.height}`, item]))
const legacy = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] }

export function normalizeVideoOutputSize(input = {}) {
  const migrated = legacy[String(input.ratio || '').replace('x', ':')]
  const width = Number(input.output_width ?? input.width ?? migrated?.[0] ?? 1920)
  const height = Number(input.output_height ?? input.height ?? migrated?.[1] ?? 1080)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || height < 256 || width > 4096 || height > 4096 || width % 2 || height % 2) {
    throw new TypeError('视频输出宽高必须是 256–4096 范围内的正偶数')
  }
  const item = bySize.get(`${width}x${height}`)
  return { width, height, preset: item?.key || 'custom' }
}
```

- [ ] **Step 4: Run the contract test**

Run: `node tests/videoOutputSizes.test.mjs`

Expected: PASS and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/utils/videoOutputSizes.js tests/videoOutputSizes.test.mjs
git commit -m "feat: define canonical video output sizes"
```

### Task 2: Reusable size picker and all frontend video entry points

**Files:**
- Create: `src/components/VideoOutputSizePicker.vue`
- Modify: `src/components/nodes/VideoConfigNode.vue`
- Modify: `src/views/VideoStudio.vue`
- Modify: `src/components/nodes/TextOverlayNode.vue`
- Modify: `src/stores/canvas.js`
- Create: `tests/globalVideoSizeWiring.test.mjs`

- [ ] **Step 1: Write a source-contract test for every entry point**

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const picker = read('../src/components/VideoOutputSizePicker.vue')
assert.match(picker, /VIDEO_OUTPUT_PRESETS/)
assert.match(picker, /output_width/)
assert.match(picker, /output_height/)
for (const path of ['../src/components/nodes/VideoConfigNode.vue', '../src/views/VideoStudio.vue', '../src/components/nodes/TextOverlayNode.vue']) {
  const source = read(path)
  assert.match(source, /VideoOutputSizePicker/)
  assert.match(source, /output_width/)
  assert.match(source, /output_height/)
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/globalVideoSizeWiring.test.mjs`

Expected: FAIL because `VideoOutputSizePicker.vue` does not exist.

- [ ] **Step 3: Add the picker with controlled values and inline validation**

```vue
<script setup>
import { computed } from 'vue'
import { VIDEO_OUTPUT_PRESETS, normalizeVideoOutputSize } from '../utils/videoOutputSizes.js'
const props = defineProps({ outputWidth: Number, outputHeight: Number })
const emit = defineEmits(['update:outputWidth', 'update:outputHeight'])
const selected = computed(() => `${props.outputWidth}x${props.outputHeight}`)
function choose(item) {
  emit('update:outputWidth', item.width)
  emit('update:outputHeight', item.height)
}
function setCustom(key, raw) {
  const next = { output_width: props.outputWidth, output_height: props.outputHeight, [key]: Number(raw) }
  try {
    const valid = normalizeVideoOutputSize(next)
    emit('update:outputWidth', valid.width)
    emit('update:outputHeight', valid.height)
  } catch {}
}
</script>

<template>
  <section aria-label="最终视频尺寸">
    <button v-for="item in VIDEO_OUTPUT_PRESETS" :key="item.key" type="button"
      :aria-pressed="selected === `${item.width}x${item.height}`" @click="choose(item)">{{ item.label }}</button>
    <label>自定义宽<input type="number" min="256" max="4096" step="2" :value="outputWidth" @change="setCustom('output_width', $event.target.value)"></label>
    <label>自定义高<input type="number" min="256" max="4096" step="2" :value="outputHeight" @change="setCustom('output_height', $event.target.value)"></label>
  </section>
</template>
```

- [ ] **Step 4: Wire exact dimensions into each request**

Use the same payload fragment in canvas video generation, Video Studio, and text overlay:

```js
const outputSize = normalizeVideoOutputSize({
  output_width: data.outputWidth,
  output_height: data.outputHeight,
  ratio: data.ratio
})
const payload = {
  ...existingPayload,
  output_width: outputSize.width,
  output_height: outputSize.height
}
```

Initialize new nodes with `outputWidth: 1920, outputHeight: 1080`; saved legacy nodes are normalized from `ratio` without overwriting existing exact values.

- [ ] **Step 5: Run focused and existing frontend tests**

Run: `node tests/videoOutputSizes.test.mjs && node tests/globalVideoSizeWiring.test.mjs && node tests/videoStudioWiring.test.mjs && node tests/videoTextOverlay.test.mjs`

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/VideoOutputSizePicker.vue src/components/nodes/VideoConfigNode.vue src/views/VideoStudio.vue src/components/nodes/TextOverlayNode.vue src/stores/canvas.js tests/globalVideoSizeWiring.test.mjs
git commit -m "feat: add global video size picker"
```

### Task 3: Authoritative backend target-size value object

**Files:**
- Create: `video_output_sizes.py`
- Create: `test_video_output_sizes.py`

- [ ] **Step 1: Write failing unit tests**

```python
import unittest
from video_output_sizes import VideoOutputSize

class VideoOutputSizeTest(unittest.TestCase):
    def test_exact_and_legacy_values(self):
        self.assertEqual(VideoOutputSize.from_payload({'output_width': 720, 'output_height': 1280}).as_dict(), {'output_width': 720, 'output_height': 1280})
        self.assertEqual(VideoOutputSize.from_payload({'ratio': '1:1'}).as_dict(), {'output_width': 1080, 'output_height': 1080})

    def test_rejects_partial_odd_and_out_of_range_values(self):
        for payload in ({'output_width': 1280}, {'output_width': 721, 'output_height': 1280}, {'output_width': 4098, 'output_height': 1080}):
            with self.assertRaises(ValueError):
                VideoOutputSize.from_payload(payload)
```

- [ ] **Step 2: Run and verify the import failure**

Run: `python -m unittest test_video_output_sizes.py -v`

Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement the immutable validator**

```python
from dataclasses import dataclass
from typing import Any, Mapping

@dataclass(frozen=True)
class VideoOutputSize:
    width: int
    height: int

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> 'VideoOutputSize':
        legacy = {'16:9': (1920, 1080), '9:16': (1080, 1920), '1:1': (1080, 1080)}
        has_width, has_height = 'output_width' in payload, 'output_height' in payload
        if has_width != has_height:
            raise ValueError('output_width and output_height must be provided together')
        width, height = (payload['output_width'], payload['output_height']) if has_width else legacy.get(str(payload.get('ratio', '16:9')).replace('x', ':'), (1920, 1080))
        try:
            width, height = int(width), int(height)
        except (TypeError, ValueError) as exc:
            raise ValueError('video output size must be an integer') from exc
        if min(width, height) < 256 or max(width, height) > 4096 or width % 2 or height % 2:
            raise ValueError('video output size must use even values from 256 to 4096')
        return cls(width, height)

    @property
    def ratio(self) -> str:
        return '16:9' if self.width > self.height else ('9:16' if self.height > self.width else '1:1')

    def as_dict(self) -> dict[str, int]:
        return {'output_width': self.width, 'output_height': self.height}
```

- [ ] **Step 4: Run tests**

Run: `python -m unittest test_video_output_sizes.py -v`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add video_output_sizes.py test_video_output_sizes.py
git commit -m "feat: validate exact video output sizes"
```

### Task 4: Mandatory SeedVR2 and exact-size formatting

**Files:**
- Modify: `huobao_video_quality_pipeline.py`
- Modify: `seedvr2_adapter.py`
- Modify: `test_huobao_video_quality_pipeline.py`
- Modify: `test_huobao_video_quality.py`

- [ ] **Step 1: Add failing tests for unconditional upscaling and fail-closed behavior**

```python
def test_every_video_enters_upscaling_even_when_source_is_target_size(self):
    task = self.submit(output_width=1920, output_height=1080, source_size=(1920, 1080))
    self.run_worker(task['task_id'])
    states = self.store.history(task['task_id'])
    self.assertIn('upscaling', [state['status'] for state in states])
    self.assertEqual(self.store.get(task['task_id'])['upscaler'], 'seedvr2-3b-fp16')

def test_seedvr2_failure_does_not_publish_lanczos_fallback(self):
    self.upscaler.error = RuntimeError('SeedVR2 unavailable')
    task = self.submit(output_width=1280, output_height=720)
    self.run_worker(task['task_id'])
    state = self.store.get(task['task_id'])
    self.assertEqual(state['status'], 'failed')
    self.assertNotIn('url', state)
    self.assertIn('SeedVR2 unavailable', state['error'])
```

- [ ] **Step 2: Run the focused tests**

Run: `python -m unittest test_huobao_video_quality_pipeline.py -v`

Expected: FAIL because fast/source-sized work can currently skip SeedVR2 and targets are ratio-fixed.

- [ ] **Step 3: Make quality mode mandatory and pass exact requested dimensions**

Normalize every accepted request as:

```python
target = VideoOutputSize.from_payload(request)
request.update(target.as_dict())
request['quality_profile'] = {
    'mode': 'quality',
    'width': target.width,
    'height': target.height,
    'upscaler': 'seedvr2-3b-fp16',
    'label': 'SeedVR2 AI 超分'
}
```

Replace fixed ratio targets with `(target.width, target.height)`. The worker must persist `status='upscaling'`, `requested_width`, `requested_height`, and `upscaler`; if the executor is missing or raises, store `failed` and retain only `raw_url`.

- [ ] **Step 4: Add exact aspect-preserving delivery formatting**

```python
def format_exact_delivery(source: Path, target: Path, width: int, height: int) -> dict[str, float | int]:
    command = [
        'ffmpeg', '-y', '-i', str(source), '-vf',
        f'scale={width}:{height}:force_original_aspect_ratio=decrease:flags=lanczos,'
        f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1',
        '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-c:a', 'copy', '-movflags', '+faststart', str(target)
    ]
    subprocess.run(command, check=True, capture_output=True)
    metadata = probe_video(target)
    if (metadata['width'], metadata['height']) != (width, height):
        raise RuntimeError('formatted video does not match requested dimensions')
    return metadata
```

This ordinary formatter runs only after successful SeedVR2; it is not presented as the AI upscale stage.

- [ ] **Step 5: Run quality tests**

Run: `python -m unittest test_huobao_video_quality.py test_huobao_video_quality_pipeline.py -v`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add huobao_video_quality_pipeline.py seedvr2_adapter.py test_huobao_video_quality_pipeline.py test_huobao_video_quality.py
git commit -m "feat: require SeedVR2 for every video delivery"
```

### Task 5: API propagation, persistence, retry, and truthful status

**Files:**
- Modify: `material_generation_api.py`
- Modify: `video_batch.py`
- Modify: `huobao_novel_pipeline.py`
- Modify: `test_video_batch.py`
- Modify: `test_huobao_novel_pipeline.py`
- Modify: `test_material_text_overlay.py`

- [ ] **Step 1: Add failing endpoint tests**

```python
def test_video_requests_preserve_exact_target_across_retry(self):
    created = self.api.video_generations({'prompt': 'rain', 'output_width': 720, 'output_height': 1280})
    retried = self.api.retry_video_generation(created['task_id'])
    self.assertEqual((retried['requested_width'], retried['requested_height']), (720, 1280))

def test_status_separates_requested_and_actual_dimensions(self):
    state = self.api.get_video_task(self.completed_task_id)
    self.assertEqual((state['requested_width'], state['requested_height']), (1920, 1080))
    self.assertEqual((state['actual_width'], state['actual_height']), (1920, 1080))
    self.assertEqual(state['upscale_status'], 'completed')
```

- [ ] **Step 2: Run the affected suites**

Run: `python -m unittest test_video_batch.py test_huobao_novel_pipeline.py test_material_text_overlay.py -v`

Expected: FAIL because exact targets are not propagated consistently.

- [ ] **Step 3: Parse once at each public endpoint and persist the normalized target**

```python
target = VideoOutputSize.from_payload(payload)
request = {**payload, **target.as_dict(), 'ratio': target.ratio}
task.update(
    request=request,
    requested_width=target.width,
    requested_height=target.height,
    actual_width=None,
    actual_height=None,
)
```

Retries copy the stored request, never reconstruct dimensions from a ratio. Sanitized task responses expose requested and actual dimensions plus `upscale_status` and `upscaler`.

- [ ] **Step 4: Run the suites again**

Run: `python -m unittest test_video_batch.py test_huobao_novel_pipeline.py test_material_text_overlay.py -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add material_generation_api.py video_batch.py huobao_novel_pipeline.py test_video_batch.py test_huobao_novel_pipeline.py test_material_text_overlay.py
git commit -m "feat: persist exact targets for every video task"
```

### Task 6: Uploaded-video text overlay after SeedVR2

**Files:**
- Modify: `huobao_media_compose.py`
- Modify: `material_generation_api.py`
- Modify: `test_material_text_overlay.py`

- [ ] **Step 1: Add a failing order-and-dimension test**

```python
def test_uploaded_overlay_runs_seedvr2_before_subtitles_and_exact_format(self):
    result = self.api.create_video_text_overlay({
        'video_data_url': self.sample_mp4,
        'subtitle_text': '第一句\n第二句',
        'output_width': 1080,
        'output_height': 1080,
    })
    self.assertEqual(self.calls, ['seedvr2', 'subtitle_compose', 'probe'])
    self.assertEqual((result['actual_width'], result['actual_height']), (1080, 1080))
    self.assertEqual(result['upscale_status'], 'completed')
```

- [ ] **Step 2: Run and verify failure**

Run: `python -m unittest test_material_text_overlay.py -v`

Expected: FAIL because overlay composition currently normalizes directly with FFmpeg.

- [ ] **Step 3: Split composition from AI quality processing**

The endpoint sequence must be:

```python
target = VideoOutputSize.from_payload(payload)
upscaled = self._seedvr2_video_upload(source, target)
result = compose_story(
    [upscaled],
    output_width=target.width,
    output_height=target.height,
    subtitle_text=payload.get('subtitle_text', ''),
    segments=payload.get('segments'),
)
metadata = probe_video(result.path)
if (metadata['width'], metadata['height']) != (target.width, target.height):
    raise RuntimeError('text overlay output size mismatch')
```

Change `compose_story` to accept `output_width` and `output_height`; retain `ratio` only as a legacy adapter.

- [ ] **Step 4: Run the overlay tests**

Run: `python -m unittest test_material_text_overlay.py -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add huobao_media_compose.py material_generation_api.py test_material_text_overlay.py
git commit -m "feat: upscale uploaded videos before text overlay"
```

### Task 7: 54DSP video presets without altering image/GIF sizes

**Files:**
- Modify: `src/components/nodes/DspCreativeLibraryNode.vue`
- Modify: `src/components/dsp/DspH3UpgradeCard.vue`
- Modify: `src/utils/dspCreativeLibrary.js`
- Modify: `tests/dspCreativeLibrary.test.mjs`
- Modify: `material_generation_api.py`
- Modify: `dsp_h3_upgrade.py`
- Modify: `test_dsp_h3_upgrade.py`
- Modify: `test_dsp_creative_service.py`

- [ ] **Step 1: Write frontend isolation tests**

```js
assert.match(libraryNodeSource, /VideoOutputSizePicker/)
assert.match(h3UpgradeCardSource, /output_width/)
assert.match(h3UpgradeCardSource, /output_height/)
assert.deepEqual(normalizeDspDimensions(['300x100', '720x240']), ['300x100', '720x240'])
```

- [ ] **Step 2: Write backend DSP isolation tests**

```python
def test_h3_upgrade_uses_requested_video_target(self):
    task = self.start_upgrade(output_width=1080, output_height=1920)
    self.assertEqual((task['requested_width'], task['requested_height']), (1080, 1920))
    self.assertEqual(task['upscale_status'], 'pending')

def test_existing_gif_dimensions_are_unchanged(self):
    job = self.create_dsp_job(dimensions=['300x100', '720x240'], video_output_width=1920, video_output_height=1080)
    self.assertEqual(job['dimensions'], ['300x100', '720x240'])
```

- [ ] **Step 3: Run focused tests and verify failures**

Run frontend: `node tests/dspCreativeLibrary.test.mjs`

Run backend: `python -m unittest test_dsp_h3_upgrade.py test_dsp_creative_service.py -v`

Expected: new exact-target assertions FAIL; old image/GIF assertions remain PASS.

- [ ] **Step 4: Add separate H3 video target fields and picker**

Use this DSP request boundary:

```js
const payload = {
  dimensions: normalizedDimensions.value,
  video_output_width: videoOutputWidth.value,
  video_output_height: videoOutputHeight.value
}
```

The H3 confirmation card submits:

```js
await createDspH3Upgrade(jobId, candidateId, {
  output_width: videoOutputWidth.value,
  output_height: videoOutputHeight.value
})
```

The backend validates only the H3 fields with `VideoOutputSize`; it must never merge them into `dimensions` used by image/GIF generation.

- [ ] **Step 5: Run focused tests**

Run: `node tests/dspCreativeLibrary.test.mjs && python -m unittest test_dsp_h3_upgrade.py test_dsp_creative_service.py -v`

Expected: all tests PASS.

- [ ] **Step 6: Commit frontend and backend separately**

```bash
git add src/components/nodes/DspCreativeLibraryNode.vue src/components/dsp/DspH3UpgradeCard.vue src/utils/dspCreativeLibrary.js tests/dspCreativeLibrary.test.mjs
git commit -m "feat: add 54DSP H3 video size presets"
```

```bash
git add material_generation_api.py dsp_h3_upgrade.py test_dsp_h3_upgrade.py test_dsp_creative_service.py
git commit -m "feat: preserve 54DSP H3 target dimensions"
```

### Task 8: Full verification, deployment, and real-media acceptance

**Files:**
- Modify: `docs/superpowers/evidence/dsp-h3-winner-upgrade/2026-08-07-live-acceptance.md`

- [ ] **Step 1: Run the complete frontend gate**

Run: `npm test && npm run build`

Expected: exit code 0; production bundle builds without warnings promoted to errors.

- [ ] **Step 2: Run the complete backend feature gate**

Run: `python -m unittest test_video_output_sizes.py test_huobao_video_quality.py test_huobao_video_quality_pipeline.py test_video_batch.py test_huobao_novel_pipeline.py test_material_text_overlay.py test_dsp_h3_upgrade.py test_dsp_creative_service.py -v`

Expected: all tests PASS.

- [ ] **Step 3: Verify both worktrees are clean except planned commits**

Run in each worktree: `git status --short && git log -8 --oneline`

Expected: no uncommitted files; recent commits match Tasks 1–7.

- [ ] **Step 4: Create a recoverable server release**

Inspect before writing:

```bash
ssh -i /Users/diaodeyi/.ssh/id_ed25519_codex_gpu -o IdentitiesOnly=yes -p 22001 root@45.207.228.25 'systemctl cat guanxi-canvas.service; readlink -f /opt/guanxi-canvas/current'
```

Create a timestamped release directory, upload only the tested backend files and frontend `dist`, atomically switch `/opt/guanxi-canvas/current`, restart only `guanxi-canvas.service`, and retain the previous symlink target for rollback.

- [ ] **Step 5: Run service and public smoke checks**

```bash
ssh -i /Users/diaodeyi/.ssh/id_ed25519_codex_gpu -o IdentitiesOnly=yes -p 22001 root@45.207.228.25 'systemctl is-active guanxi-canvas.service && curl -fsS http://127.0.0.1:5173/huobao-canvas/ >/dev/null'
curl -fsS https://canvas-45-207-228-25.nip.io/huobao-canvas/ >/dev/null
```

Expected: service reports `active`; both curl commands exit 0.

- [ ] **Step 6: Produce four real SeedVR2 acceptance videos**

Submit and complete one task for each target: `1280×720`, `720×1280`, `1920×1080`, `1080×1920`. For each task capture the status sequence containing `upscaling`, the reported upscaler `seedvr2-3b-fp16`, and the final public URL.

Verify every file:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json ACCEPTANCE_FILE.mp4
```

Expected: `codec_name` is `h264`; width and height exactly equal the requested pair.

- [ ] **Step 7: Run regression acceptance**

Create a 54DSP image/GIF task using `300x100,720x240` and verify those original dimensions remain. Create a video text-overlay task and verify subtitles are visible, its task contains `upscaling`, and final dimensions match the selected preset. Cancel and retry one video task and verify the original requested dimensions are preserved.

- [ ] **Step 8: Record exact evidence and commit**

Append task IDs, URLs, status transitions, ffprobe JSON, deployed release path, previous release path, and regression outcomes to the evidence file. Mark missing business acceptance as `未确认/需复核` rather than inferred success.

```bash
git add docs/superpowers/evidence/dsp-h3-winner-upgrade/2026-08-07-live-acceptance.md
git commit -m "test: verify global SeedVR2 video delivery"
```

## Self-review result

- Spec coverage: every entry point, exact-size validation, legacy migration, mandatory SeedVR2, `upscaling` status, retry persistence, text overlay, DSP isolation, deployment, and four real outputs map to Tasks 1–8.
- Placeholder scan: no deferred implementation markers are present.
- Type consistency: frontend uses `output_width` / `output_height`; backend stores `requested_width` / `requested_height` and reports separate `actual_width` / `actual_height`; DSP image/GIF keeps `dimensions` separate from its H3 video target.
