import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const imageSource = readFileSync(new URL('../src/components/nodes/ImageConfigNode.vue', import.meta.url), 'utf8')
const videoSource = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')

for (const testId of ['image-model-select', 'image-quality-select', 'image-size-select']) {
  assert.match(imageSource, new RegExp(`data-testid="${testId}"`), `${testId} must be a directly clickable in-node control`)
}

for (const testId of ['video-model-select', 'video-ratio-select', 'video-duration-select']) {
  assert.match(videoSource, new RegExp(`data-testid="${testId}"`), `${testId} must be a directly clickable in-node control`)
}

assert.match(imageSource, /@change="handleModelSelect\(\$event\.target\.value\)"/)
assert.match(imageSource, /@change="handleQualitySelect\(\$event\.target\.value\)"/)
assert.match(imageSource, /@change="handleSizeSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleModelSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleRatioSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleDurationSelect\(Number\(\$event\.target\.value\)\)"/)

console.log('canvasNativeSelectors.test.mjs passed')
