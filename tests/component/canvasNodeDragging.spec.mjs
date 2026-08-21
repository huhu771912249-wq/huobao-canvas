/**
 * Replaces tests/canvasNodeDragging.test.mjs.
 *
 * Contract (unchanged): every canvas node must be draggable by its visible shell.
 * PR #36 broke this for every node except H3 — "进画板后除 H3 外所有节点都点不动" — and #41
 * fixed it. The old guard read each node's source file, pulled the first `class="…"`
 * literal that contained a hand-maintained signature string, and asserted the word
 * `nodrag` was absent from it. That locked ten class-attribute literals in place and
 * still could not tell whether a drag actually moved anything.
 *
 * Here the same contract is exercised end to end: each node is mounted inside a real
 * `<VueFlow>`, a real pointer drag is dispatched at its rendered shell, and the node's
 * position in the vue-flow store must change. The `.nodrag` control regions are the
 * negative control — dragging those must leave the node where it is, which is what
 * proves the positive assertions are not vacuous.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { dragFrom, mountCanvas } from './helpers/canvasHarness.mjs'

import DspCreativeLibraryNode from '../../src/components/nodes/DspCreativeLibraryNode.vue'
import DspCreativeTaskCenterNode from '../../src/components/nodes/DspCreativeTaskCenterNode.vue'
import LLMConfigNode from '../../src/components/nodes/LLMConfigNode.vue'
import MaterialExportNode from '../../src/components/nodes/MaterialExportNode.vue'
import MaterialInputNode from '../../src/components/nodes/MaterialInputNode.vue'
import MaterialVariationNode from '../../src/components/nodes/MaterialVariationNode.vue'
import TextOverlayNode from '../../src/components/nodes/TextOverlayNode.vue'
import VideoConfigNode from '../../src/components/nodes/VideoConfigNode.vue'
import VideoGifNode from '../../src/components/nodes/VideoGifNode.vue'
import WatermarkEditorNode from '../../src/components/nodes/WatermarkEditorNode.vue'

// Node types as Canvas.vue registers them. Nothing here is a class name: the shell is
// located structurally (see `visibleShell`), so splitting or restyling a node component
// does not touch this test.
const DRAGGABLE_NODES = [
  ['videoConfig', VideoConfigNode],
  ['videoGif', VideoGifNode],
  ['textOverlay', TextOverlayNode],
  ['watermarkEditor', WatermarkEditorNode],
  ['materialExport', MaterialExportNode],
  ['materialInput', MaterialInputNode],
  ['llmConfig', LLMConfigNode],
  ['dspCreativeLibrary', DspCreativeLibraryNode],
  ['dspCreativeTaskCenter', DspCreativeTaskCenterNode],
  ['materialVariation', MaterialVariationNode]
]

/**
 * Every canvas node renders `<div class="… relative">` (the hover host for the handle
 * menu) wrapping the box the user actually sees and grabs. That box is the shell.
 */
const visibleShell = nodeElement => nodeElement?.firstElementChild?.firstElementChild

describe('canvas nodes are draggable by their visible shell', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  for (const [type, component] of DRAGGABLE_NODES) {
    it(`${type} moves when its shell is dragged`, async () => {
      const canvas = await mountCanvas({
        nodeTypes: { [type]: component },
        nodes: [{ id: 'n1', type, position: { x: 0, y: 0 }, data: { label: type } }]
      })

      const nodeElement = canvas.nodeElement('n1')
      expect(nodeElement, `${type} must render a vue-flow node wrapper`).toBeTruthy()
      expect(nodeElement.className).toContain('draggable')

      const shell = visibleShell(nodeElement)
      expect(shell, `${type} must render a visible node shell`).toBeTruthy()

      const before = { ...canvas.flow.findNode('n1').position }
      dragFrom(shell, { from: { x: 200, y: 200 }, to: { x: 320, y: 280 } })
      await flushPromises()
      const after = { ...canvas.flow.findNode('n1').position }

      expect(after.x, `${type} must move horizontally when its shell is dragged`).toBeGreaterThan(before.x)
      expect(after.y, `${type} must move vertically when its shell is dragged`).toBeGreaterThan(before.y)

      canvas.unmount()
    })

    it(`${type} stays put when a nodrag control is dragged`, async () => {
      const canvas = await mountCanvas({
        nodeTypes: { [type]: component },
        nodes: [{ id: 'n1', type, position: { x: 0, y: 0 }, data: { label: type } }]
      })

      const control = canvas.nodeElement('n1')?.querySelector('.nodrag')
      // Not every node opts a region out of dragging; only assert where one exists.
      if (control) {
        const before = { ...canvas.flow.findNode('n1').position }
        dragFrom(control, { from: { x: 200, y: 200 }, to: { x: 320, y: 280 } })
        await flushPromises()
        expect(
          { ...canvas.flow.findNode('n1').position },
          `${type} must not drag the whole node from a nodrag control`
        ).toEqual(before)
      }

      canvas.unmount()
    })
  }
})
