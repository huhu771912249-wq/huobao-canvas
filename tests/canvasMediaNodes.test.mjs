import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const canvas = read('src/views/Canvas.vue')
const store = read('src/stores/canvas.js')
const gifNode = read('src/components/nodes/VideoGifNode.vue')
const overlayNode = read('src/components/nodes/TextOverlayNode.vue')
const exportNode = read('src/components/nodes/MaterialExportNode.vue')

for (const type of ['videoGif', 'materialExport']) {
  assert.match(canvas, new RegExp(`${type}:\\s*markRaw`))
  assert.match(canvas, new RegExp(`addNewNode\\('${type}'\\)`))
  assert.match(store, new RegExp(`case\\s+'${type}'`))
}

assert.match(gifNode, /createVideoResizeJob/)
assert.match(gifNode, /getVideoResizeJob/)
assert.match(gifNode, /gif_options/)
assert.match(gifNode, /fps/)
assert.match(gifNode, /colors/)
assert.match(gifNode, /Handle type="target"/)
assert.match(gifNode, /Handle type="source"/)
assert.match(overlayNode, /videoGif/)
assert.match(exportNode, /startAssetDownload/)
assert.match(exportNode, /Handle type="target"/)
assert.match(exportNode, /Handle type="source"/)
assert.match(canvas, /class="canvas-tool-rail__button/)
assert.match(canvas, /class="canvas-tool-rail__tooltip"[^>]*>\{\{ tool\.name \}\}<\/span>/)

console.log('canvasMediaNodes.test.mjs passed')
