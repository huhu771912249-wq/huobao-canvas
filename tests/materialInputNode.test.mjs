import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const node = readFileSync(new URL('../src/components/nodes/MaterialInputNode.vue', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/api/materialInput.js', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../src/components/VisualTextOverlayEditor.vue', import.meta.url), 'utf8')

for (const copy of ['复制的视频链接', '上传素材 / ZIP', 'Facebook / Instagram', 'MP4 / MOV / WebM / GIF / ZIP', '导入并预览']) {
  assert.match(node, new RegExp(copy))
}
for (const contract of ['createMaterialInput', 'assetName', 'selectedIndex', 'type="source"']) assert.match(node, new RegExp(contract))
assert.match(api, /\/v1\/material-inputs/)
assert.match(canvas, /materialInput: markRaw\(MaterialInputNode\)/)
assert.match(canvas, /name: '素材导入'/)
for (const contract of ['pointerdown', 'pointermove', 'update:style-config', 'stageStyle', '拖动文字调整位置']) assert.match(editor, new RegExp(contract))

console.log('materialInputNode.test.mjs passed')
