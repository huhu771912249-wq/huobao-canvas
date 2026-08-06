import assert from 'node:assert/strict'
import { COMMON_VIDEO_SIZES, normalizeVideoSize, ratioForVideoSize } from '../src/config/videoSizes.js'

assert.deepEqual(COMMON_VIDEO_SIZES.map(item => item.key), ['1280x720', '720x1280'])
assert.deepEqual(normalizeVideoSize(1280, 720), { width: 1280, height: 720, key: '1280x720' })
assert.throws(() => normalizeVideoSize(1279, 720), /偶数/)
assert.throws(() => normalizeVideoSize(10000, 720), /范围/)
assert.equal(ratioForVideoSize(1280, 720), '16:9')
assert.equal(ratioForVideoSize(720, 1280), '9:16')
console.log('videoSize.test.mjs passed')
