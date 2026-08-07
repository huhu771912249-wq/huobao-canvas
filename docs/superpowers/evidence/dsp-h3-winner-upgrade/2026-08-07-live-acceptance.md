# DSP H3 winner upgrade and video text overlay live acceptance

## Deployment

- Frontend branch head: `e2d3720`
- Backend branch head: `a0e54a4`
- Service: `guanxi-canvas.service`
- Live root: `/opt/guanxi-canvas/current`
- Rollback package: `/opt/guanxi-canvas/deployments/dsp-h3-20260807T162355`
- Health after restart: HTTP 200, `ok: true`

## Automated verification

- Frontend: `npm test` passed; `npm run build` passed.
- Added source-contract and timeline parser tests passed.
- Backend feature suites: 296 tests passed.
- Repository-wide backend discovery ran 1306 tests with 10 unrelated missing-fixture errors in the isolated worktree. Missing artifacts included robot service/config/timer files outside this feature scope; no feature-suite assertion failed.

## Public UI and API verification

- Public app loaded at `https://canvas-45-207-228-25.nip.io/huobao-canvas/`.
- Deployed TextOverlay bundle contains `上传需要叠字的视频` and `1920×1080 横屏`.
- Deployed DSP bundle contains `用 H3 生成获胜视频`.
- Browser console after live reload: no error or warning entries.
- Non-ready H3 group rejected with HTTP 400 and `experiment winner is not ready`.

## Real text-overlay media acceptance

- Endpoint: `POST /v1/media/text-overlays`
- Result URL: `https://canvas-45-207-228-25.nip.io/public-assets/story-389a0c20ca434d4eae6d22aeb4d551e5-captioned.mp4`
- `ffprobe`: H.264, 1920x1080, duration 2.005 seconds.

## Remaining H3 acceptance gate

The current 17 production DSP jobs contain zero experiment groups with a server-confirmed winner at the 1000-impression threshold. Therefore a paid real H3 winner job was not fabricated or forced. Full production evidence for `cloud_generate -> upscaling -> composing -> completed` remains `未确认/需复核` until a genuine ready A-E group exists.
