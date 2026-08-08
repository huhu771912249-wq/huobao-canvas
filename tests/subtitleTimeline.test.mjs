import assert from 'node:assert/strict'
import { buildSubtitleSegments, validateSubtitleText } from '../src/utils/subtitleTimeline.js'

assert.deepEqual(buildSubtitleSegments('第一句\n第二句', 4), [
  { start: 0, end: 2, text: '第一句' },
  { start: 2, end: 4, text: '第二句' }
])
assert.equal(validateSubtitleText('  '), false)
assert.equal(validateSubtitleText('可以生成'), true)
console.log('subtitleTimeline.test.mjs passed')
