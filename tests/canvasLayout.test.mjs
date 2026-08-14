import assert from 'node:assert/strict'
import {
  findOpenNodePosition,
  getNodeBounds,
  placeWorkflowWithoutOverlap,
  rectanglesOverlap
} from '../src/utils/canvasLayout.js'
import { buildH3AdGifWorkflow } from '../src/config/h3AdGifWorkflow.js'

const occupied = [{ id: 'existing', type: 'videoConfig', position: { x: 520, y: 360 } }]
const first = findOpenNodePosition(occupied, { x: 520, y: 360 }, 'videoGif')
const second = findOpenNodePosition(
  [...occupied, { id: 'first', type: 'videoGif', position: first }],
  { x: 520, y: 360 },
  'textOverlay'
)
assert.equal(rectanglesOverlap(
  getNodeBounds(occupied[0]),
  getNodeBounds({ type: 'videoGif', position: first })
), false, 'new nodes must move away from an occupied viewport center')
assert.notDeepEqual(second, first, 'successive toolbar nodes must not stack at the same coordinates')

const template = buildH3AdGifWorkflow({ x: 400, y: 200 })
const shifted = placeWorkflowWithoutOverlap(
  [{ id: 'wide-existing', type: 'dspCreativeLibrary', position: { x: 200, y: 100 } }],
  template.nodes
)
for (const nextNode of shifted) {
  assert.equal(rectanglesOverlap(
    getNodeBounds({ type: 'dspCreativeLibrary', position: { x: 200, y: 100 } }),
    getNodeBounds(nextNode)
  ), false, `workflow node ${nextNode.data.label} must not cover an existing node`)
}

const mainlineTypes = ['text', 'imageConfig', 'image', 'videoConfig', 'video', 'videoGif', 'textOverlay', 'watermarkEditor', 'materialExport']
const mainline = template.nodes.filter(node => mainlineTypes.includes(node.type) && !['04 H3 动作与声音', '08 广告文案'].includes(node.data.label))
for (let index = 1; index < mainline.length; index += 1) {
  const previous = getNodeBounds(mainline[index - 1])
  const current = getNodeBounds(mainline[index])
  assert.ok(
    current.left >= previous.right + 60,
    `${mainline[index - 1].data.label} and ${mainline[index].data.label} need a usable handle gap`
  )
}

console.log('canvasLayout.test.mjs passed')
