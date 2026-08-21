import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildVideoTaskStatusUrl, extractVideoCompletionMetadata, extractVideoTaskProgress, getVideoTaskPollingState, isVerifiedTargetOutput } from '../src/utils/videoTaskStatus.js'

assert.deepEqual(extractVideoTaskProgress({ status: 'upscaling', upscale_status: 'running', progress: 0.72 }), {
  status: 'upscaling', stage: 'SeedVR2 AI 超分中', percent: 72, progressLabel: '任务真实进度', progress_scope: '', current_step: '', upscale_status: 'running'
})
assert.deepEqual(extractVideoTaskProgress({ data: { status: 'cloud_generate', current_step: '云端模型采样' } }), {
  status: 'cloud_generate', stage: '云端模型采样', percent: null, progressLabel: '任务真实进度', progress_scope: '', current_step: '云端模型采样', upscale_status: ''
})
assert.equal(extractVideoTaskProgress({ status: 'cloud_generate', progress: 0.37, progress_scope: 'cloud_generation' }).progressLabel, '云端生成真实进度')
assert.equal(extractVideoTaskProgress({ status: 'running' }).percent, null)

assert.deepEqual(extractVideoCompletionMetadata({ data: {
  status: 'completed', upscale_status: 'completed', actual_width: 1920, actual_height: 1080
} }), { status: 'completed', upscale_status: 'completed', actual_width: 1920, actual_height: 1080 })
assert.deepEqual(extractVideoCompletionMetadata({ data: {
  status: 'completed', upscale_status: 'completed', actual_width: '1920', actual_height: 1080
} }), { status: 'completed', upscale_status: 'completed', actual_width: null, actual_height: null })
assert.deepEqual(extractVideoCompletionMetadata({ status: 'done', upscale_status: 'invented', actual_width: -1, actual_height: 1080 }), {
  status: 'done', upscale_status: '', actual_width: null, actual_height: null
})
assert.equal(isVerifiedTargetOutput({ upscale_status: 'completed', actual_width: 1920, actual_height: 1080 }, { width: 1920, height: 1080 }), true)
assert.equal(isVerifiedTargetOutput({ upscale_status: 'running', actual_width: 1920, actual_height: 1080 }, { width: 1920, height: 1080 }), false)
const videoNodeSource = readFileSync(new URL('../src/components/nodes/VideoNode.vue', import.meta.url), 'utf8')
for (const key of ['status', 'upscale_status', 'actual_width', 'actual_height']) {
  assert.match(videoNodeSource, new RegExp(`${key}:\\s*completion\\.${key}`))
}
assert.match(videoNodeSource, /isVerifiedTargetOutput\(completion/)
assert.doesNotMatch(videoNodeSource, /预计等待 1 分钟/)
assert.match(videoNodeSource, /taskStage/)
assert.match(videoNodeSource, /data\.progress !== null/)
assert.match(videoNodeSource, /progressLabel/)

// Long-running video tasks must stay recoverable: the poll loop may not cut
// them off after a handful of minutes. It must still terminate though, so the
// contract is "a generous bound", not "no bound" — the bound itself is checked
// in pollingBudget.test.mjs.
// 长任务必须可恢复，轮询不能几分钟就放弃；但也必须有终点，所以契约是"上限足够宽"
// 而不是"没有上限"，具体数值由 pollingBudget.test.mjs 校验。
const useApiSource = readFileSync(new URL('../src/hooks/useApi.js', import.meta.url), 'utf8')
assert.doesNotMatch(useApiSource, /const maxAttempts = 120/)
assert.match(useApiSource, /createPollingBudget\(/)
const { POLL_TIMEOUT_MS } = await import('../src/utils/pollingBudget.js')
assert.ok(POLL_TIMEOUT_MS >= 60 * 60 * 1000, '视频任务轮询上限必须远宽于十分钟')

const pollingStart = videoNodeSource.indexOf('const startPolling = async')
const pollingCatch = videoNodeSource.indexOf('} catch (err) {', pollingStart)
const pollingFinally = videoNodeSource.indexOf('} finally {', pollingCatch)
const pollingCatchSource = videoNodeSource.slice(pollingCatch, pollingFinally)
assert.doesNotMatch(pollingCatchSource, /taskId:\s*null/)
assert.match(pollingCatchSource, /taskId/)
assert.match(pollingCatchSource, /任务仍在后台运行/)

const videoConfigSource = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
assert.match(videoConfigSource, /progress:\s*result\?\.progress\s*\?\?\s*null/)
assert.doesNotMatch(videoConfigSource, /progress:\s*result\?\.progress\s*\|\|\s*0/)

const submittedWithData = getVideoTaskPollingState({
  status: 'submitted',
  data: {
    task_id: 'task-1',
    status: 'submitted'
  }
})

assert.equal(submittedWithData.state, 'pending')
assert.equal(submittedWithData.url, '')

const completedWithUrl = getVideoTaskPollingState({
  status: 'completed',
  data: {
    url: 'https://example.com/video.mp4'
  }
})

assert.equal(completedWithUrl.state, 'completed')
assert.equal(completedWithUrl.url, 'https://example.com/video.mp4')

const completedWithoutUrl = getVideoTaskPollingState({
  status: 'completed',
  data: {
    task_id: 'task-2'
  }
})

assert.equal(completedWithoutUrl.state, 'missing_url')
assert.equal(completedWithoutUrl.url, '')

const partialBatch = getVideoTaskPollingState({
  status: 'partial',
  assets: [
    { size: '300x100', status: 'completed', mp4_url: 'https://example.com/300x100.mp4' },
    { size: '300x250', status: 'failed', error: 'upstream failed' }
  ]
})

assert.equal(partialBatch.state, 'partial')
assert.equal(partialBatch.url, 'https://example.com/300x100.mp4')

assert.equal(
  buildVideoTaskStatusUrl('http://127.0.0.1:8788/v1/video/task/{taskId}', 'task 1'),
  'http://127.0.0.1:8788/v1/video/task/task%201'
)

assert.equal(
  buildVideoTaskStatusUrl('http://127.0.0.1:8788/v1/video/task/task-1', 'task-1'),
  'http://127.0.0.1:8788/v1/video/task/task-1'
)

assert.equal(
  buildVideoTaskStatusUrl('/videos', 'task-1'),
  '/videos/task-1'
)
