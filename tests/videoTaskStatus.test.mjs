import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildVideoTaskStatusUrl, extractVideoCompletionMetadata, getVideoTaskPollingState, isVerifiedTargetOutput } from '../src/utils/videoTaskStatus.js'

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
