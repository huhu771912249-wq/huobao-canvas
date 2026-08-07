import assert from 'node:assert/strict'
import { parseSubtitleTimeline, validateOverlayVideoFile } from '../src/utils/videoTextOverlay.js'

assert.deepEqual(parseSubtitleTimeline('0-2 | 第一行\n2-5.5 | 第二行'), [
  { start: 0, end: 2, text: '第一行' },
  { start: 2, end: 5.5, text: '第二行' }
])
assert.throws(() => parseSubtitleTimeline('第一行'), /时间轴格式/)
assert.throws(() => parseSubtitleTimeline('2-1 | 倒序'), /时间范围/)
assert.equal(validateOverlayVideoFile({ type: 'video/mp4', size: 1024 }), '')
assert.match(validateOverlayVideoFile({ type: 'image/png', size: 1024 }), /MP4、MOV 或 WebM/)
assert.match(validateOverlayVideoFile({ type: 'video/mp4', size: 101 * 1024 * 1024 }), /100MB/)

console.log('videoTextOverlay.test.mjs passed')
