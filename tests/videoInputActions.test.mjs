import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
for (const role of ['prompt', 'first_frame_image', 'last_frame_image', 'input_reference']) assert.match(source, new RegExp(`handleInputAction\\('${role}'\\)`))
assert.match(source, /firstFrameInputRef/)
assert.match(source, /lastFrameInputRef/)
assert.match(source, /referenceInputRef/)
assert.match(source, /handleImageInputSelect/)
assert.match(source, /当前模型只支持提示词和单张首帧/)
console.log('videoInputActions.test.mjs passed')
