# DSP H3 Winner Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the DSP creative job's misleading progress display and let an operator manually upgrade a statistically ready A-E experiment winner into a five-second MiniMax H3 video with a verified 1080p MP4 output, without changing or blocking the existing GMI -> FRW GIF workflow.

**Architecture:** Keep the DSP GIF job as the system of record, add a nested `h3_upgrades` state machine that delegates media generation to the existing `VideoQualityOrchestrator`, and expose separate base-job and H3 progress. The server re-resolves the current winner at every mutation, extracts a safe winner frame, submits MiniMax H3 plus SeedVR2, composes local typography, and persists only safe projected fields. The Vue node polls the existing job endpoint, asks for explicit confirmation, and renders H3 status independently from the GIF experiment.

**Tech Stack:** Python 3.12 standard library/unittest HTTP service, existing MiniMax H3/Scail2 + `VideoQualityOrchestrator` + SeedVR2 pipeline, Vue 3, Vite, Node test runner, ffmpeg/ffprobe, Git worktrees.

---

## Execution boundaries and worktrees

- Frontend worktree: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade`
- Backend worktree: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade`
- Approved design: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/docs/superpowers/specs/2026-08-07-dsp-h3-winner-upgrade-design.md`
- Do not edit or deploy from `/Users/diaodeyi/tg-clockin/frontend/huobao-canvas` or `/Users/diaodeyi/tg-clockin` while implementing this plan.
- The backend repository currently does not track several live Python modules, including `dsp_creative_service.py` and `material_generation_api.py`. The backend worktree contains a verified snapshot of those files and passes 248 baseline tests, but that does **not** prove the parent repository can merge them safely. Before deployment, record the exact tracked/untracked diff and explicitly commit only the feature files. If Git reports an overwrite or untracked-file collision during integration, stop; do not force checkout, reset, or delete the live files.
- Preserve the existing GIF job even when H3 creation, retry, cancellation, SeedVR2, typography composition, or live acceptance fails.
- V1 is manual and single-winner only. It does not automatically generate H3 on winner readiness and does not stitch long videos.

## Required acceptance invariants

1. A DSP job never displays `100%` unless its base GIF workflow is terminal.
2. FRW progress derives from finished generation entries divided by `source_count * 5`; waiting for FRW cannot be 100%.
3. H3 can be requested only when server-side experiment metrics are `ready` and the current winner has at least 1000 impressions.
4. Reusing the same idempotency key returns the same H3 upgrade and never submits a second cloud task.
5. H3 status transitions are visible separately: `queued -> cloud_generate -> upscaling -> composing -> completed` (or `failed/cancelled`).
6. The final H3 output is a playable public MP4, approximately five seconds, exactly `1920x1080`, with locally composed text; source H3 prompts instruct the model not to render copy.
7. An H3 failure does not change the base DSP job's completed state, ZIP, GIF results, or experiment metrics.

### Task 1: Add a canonical backend base-progress model

**Files:**
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/dsp_creative_progress.py`
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_dsp_creative_progress.py`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/material_generation_api.py:809`

- [ ] **Step 1: Write failing progress tests**

```python
class DspCreativeProgressTests(unittest.TestCase):
    def test_waiting_for_frw_is_not_complete(self):
        job = {
            "status": "generating",
            "source_count": 2,
            "frw_status": "submitted",
            "generations": [],
        }
        self.assertEqual(compute_dsp_progress(job), 40)

    def test_frw_progress_counts_terminal_entries(self):
        job = {
            "status": "generating",
            "source_count": 2,
            "generations": [
                *({"status": "completed"} for _ in range(4)),
                {"status": "failed"},
            ],
        }
        self.assertEqual(compute_dsp_progress(job), 65)

    def test_only_terminal_base_job_is_one_hundred(self):
        self.assertEqual(compute_dsp_progress({"status": "completed"}), 100)
        self.assertEqual(compute_dsp_progress({"status": "packaging"}), 90)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
python3 -m unittest test_dsp_creative_progress -v
```

Expected: import failure because `dsp_creative_progress` does not exist.

- [ ] **Step 3: Implement bounded, monotonic base progress**

```python
TERMINAL_JOB_STATUSES = {"completed", "completed_with_errors", "failed", "cancelled"}
TERMINAL_GENERATION_STATUSES = {"completed", "failed", "cancelled", "skipped"}


def compute_dsp_progress(job: Mapping[str, Any]) -> int:
    status = str(job.get("status") or "").lower()
    if status in TERMINAL_JOB_STATUSES:
        return 100
    if status in {"queued", "downloading"}:
        return 10
    if status == "reversing":
        return 30
    if status in {"confirmed", "generating", "running"}:
        source_count = max(0, int(job.get("source_count") or 0))
        expected = source_count * 5
        finished = sum(
            1 for item in job.get("generations") or []
            if isinstance(item, Mapping)
            and str(item.get("status") or "").lower() in TERMINAL_GENERATION_STATUSES
        )
        return 40 if expected <= 0 else min(90, 40 + round(50 * finished / expected))
    if status == "packaging":
        return 90
    return 0
```

Project the value as `progress_percent` in `dsp_creative_job_response`; never forward a stale raw `progress=100` as the canonical base value.

- [ ] **Step 4: Run focused and API projection tests**

Run:

```bash
python3 -m unittest test_dsp_creative_progress test_material_generation_api -v
```

Expected: all tests pass, including a new response test asserting `progress_percent == 40` for a submitted FRW job.

- [ ] **Step 5: Commit the backend progress slice**

```bash
git add dsp_creative_progress.py test_dsp_creative_progress.py material_generation_api.py test_material_generation_api.py
git commit -m "fix: report canonical DSP workflow progress"
```

### Task 2: Make frontend progress consume the canonical value safely

**Files:**
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/utils/dspCreativeLibrary.js:750`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/tests/dspCreativeLibrary.test.mjs`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/components/nodes/DspCreativeLibraryNode.vue`

- [ ] **Step 1: Add regression tests for the screenshot failure**

```js
test('prefers server canonical progress and never promotes a running job to 100', () => {
  assert.equal(getDspCreativeProgress({
    status: 'generating',
    progress_percent: 40,
    progress: 100,
  }), 40)
})

test('legacy FRW progress is inferred from actual terminal generations', () => {
  assert.equal(getDspCreativeProgress({
    status: 'generating',
    source_count: 2,
    generations: [{ status: 'completed' }],
  }), 45)
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --test-name-pattern="progress"
```

Expected: the stale `progress: 100` case fails.

- [ ] **Step 3: Update the compatibility helper**

```js
export function getDspCreativeProgress(job = {}) {
  const status = String(job?.status || '').toLowerCase()
  if (DSP_TERMINAL_STATUSES.has(status)) return 100
  const canonical = Number(job?.progress_percent)
  if (Number.isFinite(canonical)) return Math.max(0, Math.min(99, Math.round(canonical)))
  return inferLegacyDspProgress(job)
}
```

Keep legacy inference bounded to `0..99` for nonterminal jobs. Update the node label so it says `等待 FRW 返回 · 40%` rather than `100%` while FRW is pending.

- [ ] **Step 4: Run frontend tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Vite build succeeds.

- [ ] **Step 5: Commit frontend progress correction**

```bash
git add src/utils/dspCreativeLibrary.js src/components/nodes/DspCreativeLibraryNode.vue tests/dspCreativeLibrary.test.mjs
git commit -m "fix: display actual DSP generation progress"
```

### Task 3: Define H3 winner eligibility, source selection, prompt, and state projection

**Files:**
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/dsp_h3_upgrade.py`
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_dsp_h3_upgrade.py`

- [ ] **Step 1: Write failing pure-domain tests**

Cover these named cases with complete fixtures and assertions:

- `test_resolve_winner_requires_ready_metrics_and_minimum_impressions`
- `test_resolve_winner_uses_server_group_winner_not_client_variant`
- `test_choose_source_prefers_verified_winner_gif_then_snapshot`
- `test_prompt_contains_copy_motion_and_no_text_instruction`
- `test_public_projection_excludes_local_path_and_owner_token`
- `test_h3_progress_maps_pipeline_states_without_affecting_base_job`

The expected projected shape is:

```python
{
    "upgrade_id": "h3up-5d5962f54f1c",
    "candidate_key": "acct-9:campaign-7:creative-4",
    "winner_variant": "B",
    "status": "cloud_generate",
    "progress_percent": 18,
    "task_id": "videoq-f6c3d14f0b5e4a27",
    "url": None,
    "actual_width": None,
    "actual_height": None,
    "duration": None,
    "error": None,
}
```

- [ ] **Step 2: Verify RED**

Run:

```bash
python3 -m unittest test_dsp_h3_upgrade -v
```

Expected: import failure.

- [ ] **Step 3: Implement strict server-side domain helpers**

```python
H3_TERMINAL = {"completed", "failed", "cancelled"}


def resolve_ready_winner(job: Mapping[str, Any], candidate_key: str) -> dict[str, Any]:
    metrics = job.get("experiment_metrics")
    if not isinstance(metrics, Mapping) or metrics.get("status") != "ready":
        raise ValueError("experiment winner is not ready")
    group = next((g for g in metrics.get("groups", []) if g.get("candidate_key") == candidate_key), None)
    if not isinstance(group, Mapping) or not isinstance(group.get("winner"), Mapping):
        raise ValueError("experiment winner is missing")
    winner = dict(group["winner"])
    if int(winner.get("impressions") or 0) < int(metrics.get("min_impressions") or 1000):
        raise ValueError("experiment winner has insufficient exposure")
    return winner
```

Implement `choose_winner_source`, `build_h3_winner_prompt`, `map_video_quality_progress`, and `project_h3_upgrade`. The prompt must contain `do not render text, captions, logos, watermarks, or UI`; the local composer owns copy rendering.

- [ ] **Step 4: Run focused tests**

Run:

```bash
python3 -m unittest test_dsp_h3_upgrade -v
```

Expected: all pure-domain tests pass.

- [ ] **Step 5: Commit domain model**

```bash
git add dsp_h3_upgrade.py test_dsp_h3_upgrade.py
git commit -m "feat: define DSP H3 winner upgrade domain"
```

### Task 4: Persist idempotent H3 upgrade records without mutating the GIF result

**Files:**
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/dsp_creative_service.py:1446`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_dsp_creative_service.py`

- [ ] **Step 1: Add service-level failing tests**

Add complete fixtures and assertions for:

- `test_create_h3_upgrade_persists_server_resolved_winner`
- `test_create_h3_upgrade_reuses_same_idempotency_key`
- `test_same_key_with_changed_candidate_is_rejected`
- `test_failed_h3_record_does_not_change_completed_gif_job`
- `test_retry_creates_new_attempt_linked_to_previous_upgrade`
- `test_cancel_updates_only_the_upgrade_record`

- [ ] **Step 2: Verify RED**

Run:

```bash
python3 -m unittest test_dsp_creative_service.DspCreativeServiceTests.test_create_h3_upgrade_persists_server_resolved_winner -v
```

Expected: missing method failure.

- [ ] **Step 3: Implement atomic service methods**

Add `create_h3_upgrade(job_id, *, candidate_key, idempotency_key, source)`, `attach_h3_quality_task(job_id, upgrade_id, *, task_id)`, `reconcile_h3_upgrade(job_id, upgrade_id, *, quality_task)`, `retry_h3_upgrade(job_id, upgrade_id, *, idempotency_key)`, and `cancel_h3_upgrade(job_id, upgrade_id)`. Use the service's existing lock, `_copy_json`, `_required_job`, `_persist_job`, and `_timestamp` in every mutation.

The record must snapshot the server winner, its metrics, selected source digest/path, prompt inputs, attempt number, and timestamps. It must not overwrite `status`, `frw_status`, `zip_url`, `generations`, or `experiment_metrics` on the base job.

- [ ] **Step 4: Run all DSP service tests**

Run:

```bash
python3 -m unittest test_dsp_creative_service test_dsp_h3_upgrade -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit persistence slice**

```bash
git add dsp_creative_service.py test_dsp_creative_service.py
git commit -m "feat: persist DSP H3 winner upgrade attempts"
```

### Task 5: Connect H3 upgrades to the existing quality pipeline and local typography composer

**Files:**
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/material_generation_api.py:3130`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/huobao_video_quality_pipeline.py:705`
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/dsp_h3_composer.py`
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_dsp_h3_composer.py`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_material_generation_api.py`

- [ ] **Step 1: Write failing orchestration and composition tests**

Add complete fixtures and assertions for:

- `test_start_upgrade_submits_minimax_h3_i2v_five_seconds_quality_1080p`
- `test_upgrade_extracts_first_safe_frame_from_winner_gif`
- `test_upgrade_falls_back_to_verified_source_snapshot`
- `test_composer_escapes_user_copy_for_ffmpeg_filter`
- `test_completed_upgrade_requires_1920_by_1080_mp4`
- `test_quality_failure_marks_upgrade_failed_but_keeps_gif_job_completed`

- [ ] **Step 2: Verify RED**

Run:

```bash
python3 -m unittest test_dsp_h3_composer test_material_generation_api -v
```

Expected: new H3 API methods and composer are missing.

- [ ] **Step 3: Implement safe frame extraction and typography composition**

The composer API should remain small and testable: `extract_video_reference(source: Path, target: Path) -> Path` and `compose_winner_copy(source_mp4: Path, target_mp4: Path, *, headline: str, body: str, cta: str) -> dict[str, Any]`.

Use argument arrays rather than shell strings. Apply local text overlays only after SeedVR2 produces the 1080p video. Probe the result and reject anything not MP4/`1920x1080`/approximately five seconds.

- [ ] **Step 4: Add API orchestration methods**

```python
def start_dsp_h3_upgrade(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    # resolve current winner; create/reuse record; verify/extract source
    request = {
        "model": "minimax-h3",
        "cloud_model": "minimax-h3-i2v",
        "prompt": prompt,
        "ratio": "16:9",
        "frames": 5 * 24,
        "quality_profile": {"mode": "quality", "width": 1920, "height": 1080},
        "image_alignment": {"strategy": "crop_or_pad", "width": 608, "height": 352},
        "reference_path": str(reference_path),
        "postprocess": {"kind": "dsp_winner_typography", "upgrade_id": upgrade_id},
    }
    quality_task = self.video_quality_orchestrator.create(
        request,
        idempotency_key=f"dsp-h3:{job_id}:{idempotency_key}",
    )
    return self.dsp_creative_service.attach_h3_quality_task(
        job_id,
        upgrade_id,
        task_id=quality_task["task_id"],
    )
```

Add `retry_dsp_h3_upgrade`, `cancel_dsp_h3_upgrade`, and reconciliation in `get_dsp_creative_job`. Extend the quality pipeline with an optional postprocessor hook after upscaling and before terminal publication; existing material-generation requests without `postprocess.kind` must follow the unchanged path.

- [ ] **Step 5: Run backend test suite**

Run:

```bash
python3 -m unittest test_dsp_h3_composer test_dsp_h3_upgrade test_dsp_creative_service test_material_generation_api -v
```

Expected: all tests pass; assertions verify one orchestrator create call for repeated idempotent requests.

- [ ] **Step 6: Commit orchestration slice**

```bash
git add material_generation_api.py huobao_video_quality_pipeline.py dsp_h3_composer.py test_dsp_h3_composer.py test_material_generation_api.py
git commit -m "feat: generate 1080p H3 video from DSP winner"
```

### Task 6: Expose authenticated H3 routes and a safe nested response

**Files:**
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/material_generation_api.py:809`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/material_generation_api.py:7360`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_material_generation_api.py`

- [ ] **Step 1: Write failing route and redaction tests**

Test these requests:

```text
POST /v1/dsp-creatives/jobs/{job_id}/h3-upgrades
POST /v1/dsp-creatives/jobs/{job_id}/h3-upgrades/{upgrade_id}/retry
POST /v1/dsp-creatives/jobs/{job_id}/h3-upgrades/{upgrade_id}/cancel
```

Assert rejected origins/auth follow the same policy as existing DSP mutations. Assert the response includes safe `h3_upgrades` but never `local_path`, `reference_path`, raw prompt secrets, `owner_token`, or filesystem roots.

- [ ] **Step 2: Verify RED**

Run:

```bash
python3 -m unittest test_material_generation_api -k h3_upgrade -v
```

Expected: route tests return 404 or method-not-found.

- [ ] **Step 3: Implement explicit routes and safe projection**

Keep H3 routes separate from the existing flat action regex so upgrade IDs are validated independently. Project only:

```python
safe["h3_upgrades"] = [
    project_h3_upgrade(item)
    for item in task.get("h3_upgrades", [])
    if isinstance(item, Mapping)
]
```

POST create requires `candidate_key` and `idempotency_key`. Retry requires a new idempotency key. Cancel is idempotent.

- [ ] **Step 4: Run API and full backend baselines**

Run:

```bash
python3 -m unittest test_material_generation_api test_dsp_creative_service test_dsp_creative_progress test_dsp_h3_upgrade test_dsp_h3_composer -v
python3 -m unittest discover -v
```

Expected: all focused tests pass and discovery has no regression from the 248-test baseline.

- [ ] **Step 5: Commit public API slice**

```bash
git add material_generation_api.py test_material_generation_api.py dsp_h3_upgrade.py
git commit -m "feat: expose safe DSP H3 upgrade API"
```

### Task 7: Add frontend H3 API helpers and pure view-state mapping

**Files:**
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/utils/dspCreativeLibrary.js`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/api/dspCreativeLibrary.js`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/tests/dspCreativeLibrary.test.mjs`

- [ ] **Step 1: Write failing URL and state tests**

```js
test('builds encoded H3 upgrade endpoints', () => {
  assert.equal(
    buildDspH3UpgradeUrl('job/a'),
    '/v1/dsp-creatives/jobs/job%2Fa/h3-upgrades',
  )
})

test('winner is eligible only for a ready server metrics group', () => {
  assert.equal(getDspH3Eligibility(readyJob, 'candidate-1').eligible, true)
  assert.equal(getDspH3Eligibility(waitingJob, 'candidate-1').eligible, false)
})

test('maps H3 task status independently from DSP base progress', () => {
  const state = getDspH3ViewState({
    status: 'upscaling',
    progress_percent: 72,
  })
  assert.deepEqual(state, { label: 'SeedVR2 AI 超分中', progress: 72, terminal: false })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --test-name-pattern="H3"
```

Expected: helper imports fail.

- [ ] **Step 3: Implement helpers and API functions**

```js
export const createDspH3Upgrade = (jobId, payload) => requestJson(
  buildDspH3UpgradeUrl(jobId),
  { method: 'POST', body: payload },
)

export const retryDspH3Upgrade = (jobId, upgradeId, payload) => requestJson(
  buildDspH3UpgradeActionUrl(jobId, upgradeId, 'retry'),
  { method: 'POST', body: payload },
)
export const cancelDspH3Upgrade = (jobId, upgradeId) => requestJson(
  buildDspH3UpgradeActionUrl(jobId, upgradeId, 'cancel'),
  { method: 'POST', body: {} },
)
```

Use `crypto.randomUUID()` when available and a deterministic timestamp/random fallback only in the browser for a fresh idempotency key per operator action.

- [ ] **Step 4: Run frontend tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit frontend data layer**

```bash
git add src/utils/dspCreativeLibrary.js src/api/dspCreativeLibrary.js tests/dspCreativeLibrary.test.mjs
git commit -m "feat: add DSP H3 winner client API"
```

### Task 8: Build the manual confirmation, H3 status, and recovery UI

**Files:**
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/components/dsp/DspH3UpgradeCard.vue`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/src/components/nodes/DspCreativeLibraryNode.vue`
- Modify: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/tests/dspCreativeLibrary.test.mjs`
- Create: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/tests/dspH3UpgradeSourceContract.test.mjs`

- [ ] **Step 1: Write failing source-contract and behavior tests**

Assert the Vue source includes:

```text
用 H3 生成获胜视频
5 秒
1080p
确认后才会消耗 H3/SeedVR2 资源
重试
取消
下载 MP4
```

Add pure behavior assertions for disabled state while exposure is insufficient, duplicate-click suppression, terminal polling stop, and separate `baseProgress`/`h3Progress` labels.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/dspH3UpgradeSourceContract.test.mjs
```

Expected: missing component or missing UI copy.

- [ ] **Step 3: Implement the focused card component**

Component contract:

```vue
<DspH3UpgradeCard
  :job-id="job.id"
  :candidate-key="group.candidate_key"
  :winner="group.winner"
  :upgrade="latestUpgradeFor(group.candidate_key)"
  :busy="h3MutationBusy"
  @create="confirmH3Upgrade"
  @retry="retryH3Upgrade"
  @cancel="cancelH3Upgrade"
/>
```

The confirmation modal must summarize the server winner, exposure, CTR/Wilson evidence, selected source preview, fixed 5-second duration, and 1080p quality. It must not imply that the H3 result is already generated.

- [ ] **Step 4: Add polling and reload recovery**

Reuse the existing job refresh path. Poll every two seconds only while the base job or any H3 upgrade is nonterminal. On reload, derive all H3 UI state from `job.h3_upgrades`; do not rely on component-only state. Stop polling on terminal state and on component unmount.

- [ ] **Step 5: Run frontend tests and production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass; Vite build succeeds; no new console warning beyond the existing informational `__dirname` warning.

- [ ] **Step 6: Commit the UI slice**

```bash
git add src/components/dsp/DspH3UpgradeCard.vue src/components/nodes/DspCreativeLibraryNode.vue tests/dspCreativeLibrary.test.mjs tests/dspH3UpgradeSourceContract.test.mjs
git commit -m "feat: confirm and monitor DSP H3 winner video"
```

### Task 9: Verify end-to-end behavior locally before any deployment

**Files:**
- Modify if needed: `/Users/diaodeyi/.config/superpowers/worktrees/tg-clockin/dsp-h3-winner-upgrade/test_material_generation_api.py`
- Modify if needed: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/tests/dspH3UpgradeSourceContract.test.mjs`

- [ ] **Step 1: Run complete automated checks in both worktrees**

Backend:

```bash
python3 -m unittest discover -v
```

Frontend:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 2: Run a mocked full lifecycle**

Exercise one ready winner through:

```text
create -> cloud_generate -> downloading -> upscaling -> composing -> completed
```

Then exercise failure and cancellation. Verify the base GIF job stays completed and retains its ZIP and A-E results in every case.

- [ ] **Step 3: Inspect Git scope before integration**

Run in both worktrees:

```bash
git status --short
git diff --check
git log --oneline --decorate -8
```

Expected: no whitespace errors; only the planned files are changed/committed. In the frontend worktree, do not add the incidental untracked `package-lock.json` unless the repository owner explicitly decides to adopt it.

- [ ] **Step 4: Request code review before deployment**

Use `superpowers:requesting-code-review`. Review must focus on idempotency, path safety, response redaction, base/H3 state isolation, race conditions, and actual progress semantics. Fix every high-confidence issue and rerun the full checks.

### Task 10: Deploy with rollback and prove live 1080p acceptance

**Files:**
- Deployment targets must be discovered from current service/unit configuration; do not assume a stale path.
- Evidence directory: `/Users/diaodeyi/.config/superpowers/worktrees/huobao-canvas/dsp-h3-winner-upgrade/docs/superpowers/evidence/dsp-h3-winner-upgrade/`

- [ ] **Step 1: Re-read live service and artifact locations**

Record current systemd/service process command, frontend document root or container mount, backend module paths, public asset root, and Git commit hashes. Stop if live paths do not correspond to the reviewed worktree artifacts.

- [ ] **Step 2: Create a recoverable deployment package**

Back up only the exact files being replaced, record checksums, deploy built frontend assets and backend feature files, restart only the relevant services, and preserve the previous package for rollback. Do not touch the 8765 Publisher service or unrelated 8788 services.

- [ ] **Step 3: Run public smoke tests**

Verify:

```text
GET /huobao-canvas/ -> authenticated app loads
GET /v1/dsp-creatives/jobs/{id} -> safe job payload
non-ready group -> H3 action disabled/rejected
ready group -> confirmation visible
duplicate POST with same key -> same upgrade_id/task_id
```

- [ ] **Step 4: Run one real H3 acceptance job**

Capture timestamps and API payload snapshots demonstrating:

```text
cloud_generate -> upscaling -> composing -> completed
```

Do not accept a frontend spinner, HTTP 200 alone, or an output URL alone as completion.

- [ ] **Step 5: Verify the actual media**

Run `ffprobe` against the downloaded public result and record:

```text
codec_name=h264 (or the deployment's approved browser-playable codec)
width=1920
height=1080
duration approximately 5 seconds
```

Open the public HTTPS MP4, verify HTTP 200, playback, winner-source visual continuity, readable local typography, no model-rendered duplicate text, and no duplicate quality task.

- [ ] **Step 6: Verify failure isolation and progress correction in production**

Confirm an active FRW job never shows 100%. Simulate or use a controlled H3 failure and confirm the GIF job, ZIP, A-E cards, experiment metrics, and download remain available.

- [ ] **Step 7: Record acceptance and rollback evidence**

Save API snapshots, ffprobe output, public URL status, screenshots, service health, checksums, and rollback package location under the evidence directory. Mark any missing layer as `未确认/需复核`; do not describe deployment as complete until every required live layer passes.

- [ ] **Step 8: Final commit for test/evidence-only changes**

```bash
git add docs/superpowers/evidence/dsp-h3-winner-upgrade
git commit -m "test: record DSP H3 live acceptance"
```

Only commit evidence that contains no secrets, private credentials, raw tokens, private filesystem paths from API payloads, or restricted media.
