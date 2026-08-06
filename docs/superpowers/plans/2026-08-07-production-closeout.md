# Guanxi Production Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified frontend, place the production backend under safe version control, connect novel jobs to the global task center, repair the remaining test/CORS gaps, and enable only GPU cache settings proven safe by A/B evidence.

**Architecture:** Keep the public frontend repository and the private backend repository separate so operational scripts, credentials, logs, backups, state, and generated media cannot leak into the public repository. Treat the existing live deployment and rollback bundle as the production source of truth while adding test-first task aggregation and reproducible GPU benchmark evidence.

**Tech Stack:** Vue 3, Vite, Node contract tests, Python unittest/pytest, Git/GitHub, systemd, ComfyUI, MiniMax H3, LTX 2.3, SeedVR2, ffprobe, SSIM/LPIPS.

---

### Task 1: Publish the verified frontend safely

**Files:**
- Modify: `.gitignore`
- Test: existing `tests/*.mjs`

- [ ] **Step 1: Verify the tracked-file boundary**

Run `git status -sb && git ls-files | rg '(\.env|secret|credential|password|\.bak)'` and require no credential or backup files.

- [ ] **Step 2: Verify the final branch**

Run `npm test && npm run build && git diff --check`; expect exit code 0.

- [ ] **Step 3: Push without force**

Run `git push origin main`; never force-push. Read back `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` and require equality.

### Task 2: Create a private backend Git baseline

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/.gitignore`
- Create: `/Users/diaodeyi/tg-clockin/BACKEND_REPOSITORY.md`

- [ ] **Step 1: Write the secret-scan failure gate**

Build an explicit candidate file list that excludes `.env*`, `*.bak*`, logs, databases, state, media, caches, credentials, service-private environment files, node_modules, and frontend repositories. Run secret-pattern checks before `git add`.

- [ ] **Step 2: Initialize locally only**

Run `git init -b main`, add the reviewed source/tests/docs/service templates only, and inspect `git diff --cached --stat` plus `git diff --cached` before committing.

- [ ] **Step 3: Commit the baseline**

Commit locally with `chore: establish private backend baseline`. Do not create or push a remote without an explicit private-repository destination.

### Task 3: Add novel jobs to the global task center

**Files:**
- Modify: `src/components` or `src/views` task-center component selected by `rg "任务中心" src`
- Modify: `src/api/novelVideo.js`
- Test: `tests/novelTaskCenter.test.mjs`

- [ ] **Step 1: Write a failing aggregation test**

Assert the task center requests the bounded recent novel-job API, renders status/title/shot progress, opens a selected novel job, and preserves existing material tasks.

- [ ] **Step 2: Run RED**

Run `node tests/novelTaskCenter.test.mjs`; expect failure because aggregation is absent.

- [ ] **Step 3: Implement the minimal aggregation**

Reuse the authoritative backend recent-job list. Keep pagination bounded, show loading/error/empty states, and route a selected job to the novel workspace without duplicating job state in the task center.

- [ ] **Step 4: Run GREEN and regression**

Run `node tests/novelTaskCenter.test.mjs && npm test && npm run build`.

### Task 4: Repair the remaining test fixture and CORS contract

**Files:**
- Modify: `/Users/diaodeyi/tg-clockin/test_material_generation_api.py`
- Modify: `/Users/diaodeyi/tg-clockin/material_generation_api.py`

- [ ] **Step 1: Replace the fake MP4 fixture test-first**

Generate a deterministic tiny valid MP4 with ffmpeg in the test temporary directory. Verify the old `b"video-result"` fixture fails ffprobe, then switch the fixture and require the full suite to pass.

- [ ] **Step 2: Add the failing CORS test**

For a trusted configured Origin, preflight with `Access-Control-Request-Headers: X-API-Key, Content-Type`; expect `Access-Control-Allow-Headers` to contain both names.

- [ ] **Step 3: Implement the allow-header response**

Add `X-API-Key` to the allow-header response without loosening origin authentication or `/v1` authorization.

- [ ] **Step 4: Run complete backend verification**

Run all novel, document, GPU, media compose, SeedVR2, video-quality, pipeline, Scail2, and material API tests plus `py_compile`.

### Task 5: Benchmark GPU cache modes and keep fail-safe defaults

**Files:**
- Create: `/Users/diaodeyi/tg-clockin/benchmarks/video_cache_ab_20260807.json`
- Create: `/Users/diaodeyi/tg-clockin/benchmarks/video_cache_ab_20260807.md`
- Modify only after evidence: versioned H3/LTX workflow configuration used by the live service

- [ ] **Step 1: Capture the baseline**

Use the same non-sensitive prompt, seed, dimensions, duration, and source image for H3 and LTX. Record wall time, GPU peak, output SHA, ffprobe data, SSIM/LPIPS, and temporal flicker.

- [ ] **Step 2: Run one cache at a time**

Benchmark KJ/TeaCache/EasyCache independently where the installed node graph supports it. Never combine caches before single-cache evidence exists.

- [ ] **Step 3: Apply acceptance gates**

Enable a cache only if it improves median runtime by at least 15%, does not increase peak VRAM, keeps SSIM at least 0.97, LPIPS at most 0.05, and does not worsen flicker by more than 5%. Otherwise retain disabled defaults.

- [ ] **Step 4: Deploy with rollback**

Back up the exact live workflow, verify the queue is empty, deploy the winning configuration, run one real generation, and roll back automatically if health, output validation, or quality gates fail.
