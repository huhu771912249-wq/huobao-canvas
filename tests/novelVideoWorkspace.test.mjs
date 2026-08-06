import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const workspace = read('../src/components/studio/NovelVideoWorkspace.vue')
const shotCard = read('../src/components/studio/NovelShotCard.vue')
const subtitleEditor = read('../src/components/studio/SubtitleEditor.vue')
const studio = read('../src/views/VideoStudio.vue')

for (const path of [
  '../src/components/studio/NovelVideoWorkspace.vue',
  '../src/components/studio/NovelShotCard.vue',
  '../src/components/studio/SubtitleEditor.vue'
]) assert.equal(existsSync(new URL(path, import.meta.url)), true)

for (const label of ['生成全部镜头', '生成最终成片', '高质量 1080p', '快速导出', '字幕校对']) assert.match(workspace, new RegExp(label))
assert.match(shotCard, /仅重试此镜头/)
assert.match(shotCard, /任务已提交，修改需新建任务/)
assert.match(shotCard, /:disabled="!editable"/)
assert.match(shotCard, /重试中/)
for (const field of ['source_text', 'image_prompt', 'motion_prompt', 'subtitle', 'duration_seconds']) assert.match(shotCard, new RegExp(field))
assert.match(subtitleEditor, /speaker/)
assert.match(subtitleEditor, /start/)
assert.match(subtitleEditor, /end/)
assert.match(subtitleEditor, /:disabled="saving"/)
assert.match(workspace, /getNovelVideoJob/)
assert.match(workspace, /retryNovelVideoShot/)
assert.match(workspace, /updateNovelSubtitles/)
assert.match(workspace, /finalizeNovelVideoJob/)
assert.match(workspace, /cancelNovelVideoJob/)
assert.match(workspace, /取消任务/)
assert.match(workspace, /暂停状态刷新/)
assert.match(workspace, /clearTimeout/)
assert.match(workspace, /stopPolling[\s\S]*loading\.value = false/)
assert.match(workspace, /AI 超分[\s\S]*(1920|1080)/)
assert.doesNotMatch(workspace, /progress\s*\+=|setInterval/)
assert.match(studio, /NovelVideoWorkspace/)
assert.match(studio, /activeTab === 'quick'/)
assert.match(studio, /key: 'assets', label: '素材再创作'/)
assert.match(studio, /原 DSP 素材库继续保留独立入口/)
assert.match(studio, /buildStudioCanvas/)

const helperScript = workspace.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
assert.ok(helperScript, 'workspace must expose testable behavior helpers')
const helpers = await import(`data:text/javascript,${encodeURIComponent(helperScript)}`)

assert.deepEqual(helpers.validateSubtitleTimeline([
  { start: 0, end: 1.5, text: '第一句' },
  { start: 1.5, end: 3, text: '第二句' }
], 3), { valid: true, message: '' })
assert.equal(helpers.validateSubtitleTimeline([{ start: 1, end: 0.5, text: '错' }], 3).valid, false)
assert.equal(helpers.validateSubtitleTimeline([{ start: 0, end: 4, text: '越界' }], 3).valid, false)
assert.equal(helpers.validateSubtitleTimeline([{ start: 0, end: 1, text: '一句', speaker: '人'.repeat(201) }], 3).valid, false)
assert.equal(helpers.validateSubtitleTimeline([{ start: 0, end: 2, text: '一' }, { start: 1.9, end: 3, text: '二' }], 3).valid, false)

assert.equal(helpers.safeDownloadUrl('/v1/assets/video.mp4'), '/v1/assets/video.mp4')
assert.equal(helpers.safeDownloadUrl('https://cdn.example.com/video.mp4'), 'https://cdn.example.com/video.mp4')
assert.equal(helpers.safeDownloadUrl('javascript:alert(1)'), '')
assert.equal(helpers.safeDownloadUrl('//evil.example/video.mp4'), '')
assert.equal(helpers.shouldPollNovelJob({ status: 'generating' }), true)
assert.equal(helpers.shouldPollNovelJob({ status: 'completed' }), false)
assert.equal(helpers.shouldPollNovelJob({ status: 'failed' }), false)
assert.equal(helpers.shouldPollNovelJob({ status: 'cancelled' }), false)
const readyToFinalize = { status: 'upscaling', shots: [{ status: 'completed' }, { status: 'completed' }] }
assert.equal(helpers.isNovelJobReadyForFinalize(readyToFinalize), true)
assert.equal(helpers.shouldPollNovelJob(readyToFinalize), false)
assert.equal(helpers.isNovelJobReadyForFinalize({ status: 'upscaling', shots: [{ status: 'upscaling' }] }), false)
assert.equal(helpers.shouldPollNovelJob({ status: 'upscaling', shots: [{ status: 'upscaling' }] }), true)
assert.match(workspace, /镜头已就绪，待字幕校对与成片/)
assert.equal(helpers.shouldClearPollingLoading(2, 2, true), true)
assert.equal(helpers.shouldClearPollingLoading(2, 3, false), true)
assert.equal(helpers.shouldClearPollingLoading(2, 3, true), false)
assert.equal(helpers.shouldAcceptSubtitleSave(4, 4), true)
assert.equal(helpers.shouldAcceptSubtitleSave(4, 5), false)
const retrying = new Set(['shot-1'])
assert.equal(helpers.canStartShotRetry(retrying, 'shot-1'), false)
assert.equal(helpers.canStartShotRetry(retrying, 'shot-2'), true)
assert.equal(helpers.canStartJobCancel(false, { status: 'queued' }), true)
assert.equal(helpers.canStartJobCancel(true, { status: 'queued' }), false)
assert.equal(helpers.canStartJobCancel(false, { status: 'failed' }), false)
assert.equal(helpers.canStartJobCancel(false, { status: 'completed' }), false)
assert.deepEqual(helpers.buildSubtitlesFromShots([
  { id: 's1', subtitle: '第一句', duration_seconds: 2 },
  { id: 's2', source_text: '第二句', duration_seconds: 3 }
]), [
  { id: 'subtitle-s1', start: 0, end: 2, text: '第一句', speaker: '' },
  { id: 'subtitle-s2', start: 2, end: 5, text: '第二句', speaker: '' }
])

console.log('novelVideoWorkspace.test.mjs passed')
