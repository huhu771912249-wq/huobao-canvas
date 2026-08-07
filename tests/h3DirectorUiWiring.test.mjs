import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const video = read('../src/components/nodes/VideoConfigNode.vue')
const editor = read('../src/components/video/H3DirectorPromptEditor.vue')
const multiView = read('../src/components/video/MultiViewReferencePanel.vue')
const dspH3 = read('../src/components/dsp/DspH3UpgradeCard.vue')

assert.match(video, /H3DirectorPromptEditor/)
assert.match(video, /MultiViewReferencePanel/)
assert.match(video, /compiledDirectorPrompt/)
assert.match(video, /confirmedMultiViewReference/)
assert.match(editor, /subject_definitions/)
assert.match(editor, /detailed_description/)
assert.match(editor, /compileH3DirectorPrompt/)
assert.match(multiView, /generateImage/)
assert.match(multiView, /正面、侧面、背面、全身/)
assert.match(multiView, /确认作为 H3 参考/)
assert.match(dspH3, /VideoOutputSizePicker/)
assert.match(dspH3, /output_width/)
assert.match(dspH3, /output_height/)

console.log('h3DirectorUiWiring.test.mjs passed')
