import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/views/VideoStudio.vue', import.meta.url), 'utf8')
assert.match(source, /MiniMax H3/)
assert.match(source, /LTX 2\.3/)
assert.match(source, /selectedVideoModel/)
assert.match(source, /buildStudioCanvas/)
assert.match(source, /createProject/)
assert.match(source, /updateProject/)
assert.match(source, /router\.push\(`\/canvas\//)
assert.doesNotMatch(source, /工作流已准备/)
console.log('videoStudioWiring.test.mjs passed')
