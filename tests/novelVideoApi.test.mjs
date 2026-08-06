import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loadApiWithRequestSpy = async (relativePath) => {
  const sourceUrl = new URL(relativePath, import.meta.url)
  const source = readFileSync(sourceUrl, 'utf8')
    .replace(/^import request from ['"][^'"]+['"]\s*/m, 'const request = globalThis.__novelVideoRequestSpy\n')
  const calls = []
  globalThis.__novelVideoRequestSpy = config => {
    calls.push(config)
    return Promise.resolve(config)
  }
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`)
  return { module, calls }
}

const { module: novelVideo, calls } = await loadApiWithRequestSpy('../src/api/novelVideo.js')

await novelVideo.createNovelVideoJob({ title: '冠希小说', quality_mode: 'quality' })
await novelVideo.getNovelVideoJob('job /1')
await novelVideo.retryNovelVideoShot('job /1', 'shot #2')
await novelVideo.updateNovelSubtitles('job /1', [{ id: 'subtitle-1', text: '第一句' }])
await novelVideo.finalizeNovelVideoJob('job /1', { format: 'mp4' })

assert.deepEqual(calls, [
  {
    url: '/v1/studio/novel-video/jobs',
    method: 'post',
    data: { title: '冠希小说', quality_mode: 'quality' }
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
    data: { subtitles: [{ id: 'subtitle-1', text: '第一句' }] }
  },
  {
    url: '/v1/studio/novel-video/jobs/job%20%2F1/finalize',
    method: 'post',
    data: { format: 'mp4' }
  }
])

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
