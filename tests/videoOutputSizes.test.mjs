import assert from 'node:assert/strict'
import {
  VIDEO_OUTPUT_PRESETS,
  normalizeVideoOutputSize
} from '../src/utils/videoOutputSizes.js'

assert.deepEqual(VIDEO_OUTPUT_PRESETS.map(({ width, height }) => [width, height]), [
  [1280, 720],
  [720, 1280],
  [1920, 1080],
  [1080, 1920],
  [1080, 1080]
])

assert.deepEqual(normalizeVideoOutputSize({ ratio: '9:16' }), {
  width: 1080,
  height: 1920,
  preset: 'portrait-1080p'
})
assert.deepEqual(normalizeVideoOutputSize({ output_width: 1280, output_height: 720 }), {
  width: 1280,
  height: 720,
  preset: 'landscape-720p'
})

for (const value of [
  { output_width: 255, output_height: 720 },
  { output_width: 721, output_height: 1280 },
  { output_width: 1920 }
]) {
  assert.throws(() => normalizeVideoOutputSize(value))
}

console.log('videoOutputSizes.test.mjs passed')
