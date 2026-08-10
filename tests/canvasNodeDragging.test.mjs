import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const classNames = source => Array.from(source.matchAll(/class="([^"]+)"/g), match => match[1])

const draggableShells = [
  ['src/components/nodes/VideoConfigNode.vue', 'video-config-node canvas-node-scroll-shell'],
  ['src/components/nodes/VideoGifNode.vue', 'canvas-node-scroll-shell'],
  ['src/components/nodes/TextOverlayNode.vue', 'text-overlay-node canvas-node-scroll-shell'],
  ['src/components/nodes/WatermarkEditorNode.vue', 'w-[410px] overflow-hidden'],
  ['src/components/nodes/MaterialExportNode.vue', 'w-[380px] rounded-xl'],
  ['src/components/nodes/MaterialInputNode.vue', 'canvas-node-scroll-shell'],
  ['src/components/nodes/LLMConfigNode.vue', 'llm-node canvas-node-scroll-shell'],
  ['src/components/nodes/DspCreativeLibraryNode.vue', 'dsp-library-node__shell'],
  ['src/components/nodes/DspCreativeTaskCenterNode.vue', 'dsp-task-center__shell']
]

for (const [path, signature] of draggableShells) {
  const shell = classNames(read(path)).find(value => value.includes(signature))
  assert.ok(shell, `${path} must expose its visible node shell`)
  assert.ok(!shell.split(/\s+/).includes('nodrag'), `${path} must allow dragging from its node shell`)
}

const materialVariationRoot = classNames(read('src/components/nodes/MaterialVariationNode.vue'))[0]
assert.ok(!materialVariationRoot.split(/\s+/).includes('nodrag'), 'MaterialVariationNode root must remain draggable')

console.log('canvasNodeDragging.test.mjs passed')
