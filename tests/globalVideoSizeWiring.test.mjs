import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const picker = read('../src/components/VideoOutputSizePicker.vue')
assert.match(picker, /VIDEO_OUTPUT_PRESETS/)
assert.match(picker, /outputWidth/)
assert.match(picker, /outputHeight/)

for (const path of [
  '../src/components/nodes/VideoConfigNode.vue',
  '../src/views/VideoStudio.vue',
  '../src/components/nodes/TextOverlayNode.vue'
]) {
  const source = read(path)
  assert.match(source, /VideoOutputSizePicker/)
  assert.match(source, /outputWidth/)
  assert.match(source, /outputHeight/)
}
assert.doesNotMatch(read('../src/components/nodes/VideoConfigNode.vue'), /handleQualitySelect\('fast'\)/)

console.log('globalVideoSizeWiring.test.mjs passed')
