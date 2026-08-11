import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/views/VideoStudio.vue', import.meta.url), 'utf8')

assert.match(source, /const storyboardKey = ref\(0\)/)
assert.match(source, /const planningMode = ref\(''\)/)
assert.match(source, /:key="`\$\{storyboardKey\}:\$\{activeNovelJobId\}`"/)
assert.match(source, /storyboardKey\.value \+= 1/)
assert.match(source, /planningMode\.value = mode/)
assert.match(source, /planningMode\.value = ''/)
assert.match(source, /故事板已生成，可以编辑镜头并继续生成视频/)
assert.match(source, /id="storyboard-workspace"/)

console.log('storyboardReset.test.mjs passed')
