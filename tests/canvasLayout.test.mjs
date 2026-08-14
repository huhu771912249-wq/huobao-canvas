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
const h3ObservedFootprints = [
  { qaId: 'node_3', node: template.nodes[1], width: 478, height: 575 },
  { qaId: 'node_4', node: template.nodes[2], width: 330, height: 319 },
  { qaId: 'node_5', node: template.nodes[3], width: 400, height: 191 },
  { qaId: 'node_6', node: template.nodes[4], width: 560, height: 800 }
]
const insufficientH3Gaps = []
for (let firstIndex = 0; firstIndex < h3ObservedFootprints.length; firstIndex += 1) {
  for (let secondIndex = firstIndex + 1; secondIndex < h3ObservedFootprints.length; secondIndex += 1) {
    const firstNode = h3ObservedFootprints[firstIndex]
    const secondNode = h3ObservedFootprints[secondIndex]
    const firstBounds = {
      left: firstNode.node.position.x,
      top: firstNode.node.position.y,
      right: firstNode.node.position.x + firstNode.width,
      bottom: firstNode.node.position.y + firstNode.height
    }
    const secondBounds = {
      left: secondNode.node.position.x,
      top: secondNode.node.position.y,
      right: secondNode.node.position.x + secondNode.width,
      bottom: secondNode.node.position.y + secondNode.height
    }
    const hasMinimumGap = firstBounds.right + 48 <= secondBounds.left ||
      secondBounds.right + 48 <= firstBounds.left ||
      firstBounds.bottom + 48 <= secondBounds.top ||
      secondBounds.bottom + 48 <= firstBounds.top
    if (!hasMinimumGap) insufficientH3Gaps.push(`${firstNode.qaId}↔${secondNode.qaId}`)
  }
}
assert.deepEqual(insufficientH3Gaps, [], 'H3 template nodes must preserve a 48px gap using their observed DOM footprints')

const qaZoom = 0.8
const observedMotionPromptWidth = 408
const motionPrompt = template.nodes[3]
const videoConfig = template.nodes[4]
const visibleMotionToVideoGap = (
  videoConfig.position.x - motionPrompt.position.x - observedMotionPromptWidth
) * qaZoom
assert.ok(
  visibleMotionToVideoGap >= 48,
  `node_5↔node_6 need a 48px visible gap at ${qaZoom} zoom; received ${visibleMotionToVideoGap}px`
)

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
