import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loadApiWithRequestSpy = async (relativePath) => {
  const sourceUrl = new URL(relativePath, import.meta.url)
  const source = readFileSync(sourceUrl, 'utf8')
    .replace(/^import request from ['"][^'"]+['"]\s*/m, 'const request = globalThis.__novelVideoRequestSpy\n')
  const calls = []
  const requestPromises = []
  const sentinels = []
  globalThis.__novelVideoRequestSpy = config => {
    calls.push(config)
    const sentinel = { requestNumber: calls.length }
    const requestPromise = Promise.resolve(sentinel)
    sentinels.push(sentinel)
    requestPromises.push(requestPromise)
    return requestPromise
  }
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`)
  return { module, calls, requestPromises, sentinels }
}

const {
  module: novelVideo,
  calls,
  requestPromises,
  sentinels
} = await loadApiWithRequestSpy('../src/api/novelVideo.js')

const apiPromises = [
  novelVideo.createNovelVideoJob({ title: '冠希小说', quality_mode: 'quality' }),
  novelVideo.listNovelVideoJobs({ limit: 20, cursor: 0 }),
  novelVideo.getNovelVideoJob('job /1'),
  novelVideo.retryNovelVideoShot('job /1', 'shot #2'),
  novelVideo.updateNovelSubtitles('job /1', [
    { id: 'subtitle-1', start: 0, end: 2, text: '第一句', speaker: '', localOnly: true },
    { id: 'subtitle-2', start: 2, end: 4, text: '第二句', speaker: '旁白', status: 'draft' }
  ]),
  novelVideo.finalizeNovelVideoJob('job /1', { format: 'mp4' }),
  novelVideo.cancelNovelVideoJob('job /1')
]

for (const [index, apiPromise] of apiPromises.entries()) {
  assert.strictEqual(apiPromise, requestPromises[index])
  assert.strictEqual(await apiPromise, sentinels[index])
}

assert.deepEqual(calls, [
  {
    url: '/v1/studio/novel-video/jobs',
    method: 'post',
    data: { title: '冠希小说', quality_mode: 'quality' }
  },
  {
    url: '/v1/studio/novel-video/jobs?limit=20&cursor=0',
    method: 'get'
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1',
    method: 'get'
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1/shots/shot%20%232/retry',
    method: 'post',
    data: {}
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1/subtitles',
    method: 'put',
    data: { segments: [
      { start: 0, end: 2, text: '第一句' },
      { start: 2, end: 4, text: '第二句', speaker: '旁白' }
    ] }
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1/finalize',
    method: 'post',
    data: { format: 'mp4' }
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1/cancel',
    method: 'post',
    data: {}
  }
])

const callsBeforeInvalidIds = calls.length
const invalidIds = [undefined, null, '', '   ', [], new String('   ')]
const isRequiredIdTypeError = name => error => (
  error instanceof TypeError && error.message === `${name} is required`
)

for (const invalidId of invalidIds) {
  assert.throws(() => novelVideo.getNovelVideoJob(invalidId), isRequiredIdTypeError('jobId'))
  assert.throws(() => novelVideo.retryNovelVideoShot(invalidId, 'shot-1'), isRequiredIdTypeError('jobId'))
  assert.throws(() => novelVideo.retryNovelVideoShot('job-1', invalidId), isRequiredIdTypeError('shotId'))
  assert.throws(() => novelVideo.updateNovelSubtitles(invalidId, []), isRequiredIdTypeError('jobId'))
  assert.throws(() => novelVideo.finalizeNovelVideoJob(invalidId), isRequiredIdTypeError('jobId'))
  assert.throws(() => novelVideo.cancelNovelVideoJob(invalidId), isRequiredIdTypeError('jobId'))
}

assert.equal(calls.length, callsBeforeInvalidIds)

const { module: mediaComposition, calls: compositionCalls } = await loadApiWithRequestSpy('../src/api/mediaComposition.js')
const legacyInput = {
  videoUrl: '/video.mp4',
  audioUrl: '/audio.wav',
  subtitleText: '字幕',
  segments: [{ start: 0, end: 2 }]
}
await mediaComposition.createMediaComposition(legacyInput)
await mediaComposition.createMediaComposition({
  ...legacyInput,
  qualityProfile: {
    mode: 'quality',
    width: 1920,
    height: 1080,
    upscaler: 'seedvr2-3b-fp16',
    label: '高质量 1080p'
  }
})

assert.deepEqual(compositionCalls[0], {
  url: '/v1/media/compositions',
  method: 'post',
  data: {
    video_url: '/video.mp4',
    audio_url: '/audio.wav',
    subtitle_text: '字幕',
    segments: [{ start: 0, end: 2 }]
  },
  timeout: 15 * 60 * 1000
})
assert.deepEqual(compositionCalls[1].data.quality_profile, {
  mode: 'quality',
  width: 1920,
  height: 1080,
  upscaler: 'seedvr2-3b-fp16',
  label: '高质量 1080p'
})

delete globalThis.__novelVideoRequestSpy
console.log('novelVideoApi.test.mjs passed')
