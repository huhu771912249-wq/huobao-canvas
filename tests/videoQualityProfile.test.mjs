import assert from 'node:assert/strict'
import { getVideoQualityProfile } from '../src/utils/videoQualityProfile.js'

assert.deepEqual(getVideoQualityProfile('quality', '16:9'), {
  mode: 'quality',
  width: 1920,
  height: 1080,
  upscaler: 'seedvr2-3b-fp16',
  label: '高质量 1080p'
})

assert.deepEqual(getVideoQualityProfile('fast', '9:16'), {
  mode: 'fast',
  width: 1080,
  height: 1920,
  upscaler: null,
  label: '快速导出'
})

assert.deepEqual(getVideoQualityProfile('auto', '16:9'), {
  mode: 'auto',
  width: 1920,
  height: 1080,
  upscaler: 'seedvr2-3b-fp16',
  label: '智能判断'
})

assert.deepEqual(
  getVideoQualityProfile(' QUALITY ', ' 9:16 '),
  {
    mode: 'quality',
    width: 1080,
    height: 1920,
    upscaler: 'seedvr2-3b-fp16',
    label: '高质量 1080p'
  }
)

assert.deepEqual(getVideoQualityProfile('unsupported', '1:1'), getVideoQualityProfile())

console.log('videoQualityProfile.test.mjs passed')
