/**
 * Replaces tests/canvasNodeOcclusion.test.mjs, and takes over the two H3 shell
 * assertions that tests/globalPageScroll.test.mjs used to make by counting substrings.
 *
 * Contract (unchanged): canvas nodes are absolutely positioned siblings inside
 * `.vue-flow__nodes` and the store never assigns a z-index, so an opaque node that
 * outgrows the viewport swallows the pointer events of every node it covers. Every node
 * shell must therefore stay inside the viewport in every state. The H3 video config node
 * opts out of the shared `.canvas-node-scroll-shell` class (it owns a header + scroll
 * body flex layout) and must supply the same bound itself — collapsed and expanded.
 * Regression #36: a collapsed H3 node with no bound grew to ~1370px and made every node
 * beneath it unclickable; #41 restored the guard rail.
 *
 * The old guard could only approximate that. It regex-sliced `expandedNodeStyle` out of
 * VideoConfigNode.vue, split the ternary on `\n : `, and compared two source constants to
 * each other — so `VIDEO_NODE_COLLAPSED_MAX_HEIGHT = 'calc(100vh - 10px)'` plus the same
 * edit in style.css would have passed while shipping the bug back. It also asserted that
 * the string `overflow-y-auto` appeared in the file exactly once, which pinned a 1600-line
 * component against ever being split.
 *
 * This spec asserts the box instead: mount the node, read the `max-height` the browser
 * would actually apply (inline style or cascaded stylesheet), resolve it against a real
 * viewport, and check the painted box against the neighbour the production auto-layout
 * puts underneath it — using the production overlap predicate.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mountCanvas } from './helpers/canvasHarness.mjs'
import { effectiveMaxHeight, loadCanvasStyles, paintedHeight } from './helpers/cssBox.mjs'
import { NODE_FOOTPRINTS, findOpenNodePosition, getNodeBounds, rectanglesOverlap } from '../../src/utils/canvasLayout.js'
import VideoConfigNode from '../../src/components/nodes/VideoConfigNode.vue'
import LLMConfigNode from '../../src/components/nodes/LLMConfigNode.vue'

const VIEWPORT = { width: 1440, height: 900 }

// The height the H3 config form reaches when nothing bounds it — the ~1370px measured in
// the #36 regression. Every assertion below asks: given content this tall, what does the
// browser actually paint?
const UNBOUNDED_CONTENT_HEIGHT = 1370

// `findOpenNodePosition`'s default gap between two auto-placed nodes.
const AUTO_LAYOUT_GAP = 60

const mountH3 = (data = {}) => mountCanvas({
  nodeTypes: { videoConfig: VideoConfigNode },
  nodes: [{ id: 'h3', type: 'videoConfig', position: { x: 0, y: 0 }, data: { label: '视频生成', ...data } }],
  viewport: VIEWPORT
})

/** The visible box: the shell inside the node component's hover wrapper. */
const shellOf = nodeElement => nodeElement.firstElementChild.firstElementChild

describe('canvas node occlusion guard rails', () => {
  beforeAll(async () => { await loadCanvasStyles() })
  beforeEach(() => { setActivePinia(createPinia()) })

  it('bounds a collapsed H3 node to the viewport', async () => {
    const canvas = await mountH3()
    const shell = shellOf(canvas.nodeElement('h3'))

    const bound = effectiveMaxHeight(shell, VIEWPORT)
    expect(bound, 'a collapsed H3 node must still declare a max-height').not.toBeNull()

    const height = paintedHeight(shell, { contentHeight: UNBOUNDED_CONTENT_HEIGHT, viewport: VIEWPORT })
    expect(height).toBeGreaterThan(0)
    expect(height, 'a collapsed H3 node must not grow past the viewport').toBeLessThanOrEqual(VIEWPORT.height)

    canvas.unmount()
  })

  it('bounds an expanded H3 node to the live viewport', async () => {
    const canvas = await mountH3({ expanded: true })
    const shell = shellOf(canvas.nodeElement('h3'))

    const bound = effectiveMaxHeight(shell, VIEWPORT)
    expect(bound, 'an expanded H3 node must still declare a max-height').not.toBeNull()
    // #36's behaviour: an expanded node fits itself to the live viewport rather than
    // falling back to a fixed number.
    expect(bound).toBeGreaterThan(VIEWPORT.height / 2)
    expect(bound, 'an expanded H3 node must not grow past the viewport').toBeLessThanOrEqual(VIEWPORT.height)

    canvas.unmount()
  })

  it('bounds nodes that use the shared scroll shell to the same rail', async () => {
    const canvas = await mountCanvas({
      nodeTypes: { llmConfig: LLMConfigNode },
      nodes: [{ id: 'llm', type: 'llmConfig', position: { x: 0, y: 0 }, data: { label: 'LLM' } }],
      viewport: VIEWPORT
    })
    const sharedShell = shellOf(canvas.nodeElement('llm'))
    const sharedBound = effectiveMaxHeight(sharedShell, VIEWPORT)
    expect(sharedBound, 'the shared node shell must publish a viewport-bound max-height').not.toBeNull()
    expect(sharedBound).toBeLessThanOrEqual(VIEWPORT.height)
    expect(window.getComputedStyle(sharedShell).overflowY, 'a bounded shell must scroll its own content').toBe('auto')
    canvas.unmount()

    const h3Canvas = await mountH3()
    const h3Bound = effectiveMaxHeight(shellOf(h3Canvas.nodeElement('h3')), VIEWPORT)
    expect(
      h3Bound,
      'the collapsed H3 bound must match the shared canvas-node-scroll-shell guard rail'
    ).toBe(sharedBound)
    h3Canvas.unmount()
  })

  it('never lets a collapsed H3 node cover the node the layout puts beneath it', async () => {
    const h3Node = { id: 'h3', type: 'videoConfig', position: { x: 0, y: 0 } }
    // Where the production auto-layout drops the next node when the column below is free.
    const neighbourPosition = findOpenNodePosition(
      [h3Node],
      { x: 0, y: getNodeBounds(h3Node).bottom + AUTO_LAYOUT_GAP },
      'llmConfig'
    )
    const neighbourBounds = getNodeBounds({ type: 'llmConfig', position: neighbourPosition })

    const canvas = await mountCanvas({
      nodeTypes: { videoConfig: VideoConfigNode, llmConfig: LLMConfigNode },
      nodes: [
        { ...h3Node, data: { label: '视频生成' } },
        { id: 'llm', type: 'llmConfig', position: neighbourPosition, data: { label: 'LLM' } }
      ],
      viewport: VIEWPORT
    })

    const shell = shellOf(canvas.nodeElement('h3'))
    const height = paintedHeight(shell, { contentHeight: UNBOUNDED_CONTENT_HEIGHT, viewport: VIEWPORT })
    const paintedBounds = {
      left: 0,
      right: NODE_FOOTPRINTS.videoConfig.width,
      top: 0,
      bottom: height
    }

    expect(
      rectanglesOverlap(paintedBounds, neighbourBounds),
      `a collapsed H3 node painted ${height}px tall reaches into the node the layout placed at y=${neighbourBounds.top}, `
        + 'so every pointer event meant for that node lands on the H3 node instead'
    ).toBe(false)

    canvas.unmount()
  })

  it('gives the H3 node exactly one scroll region, and it is the content row', async () => {
    const canvas = await mountH3()
    const nodeElement = canvas.nodeElement('h3')

    const scrollRegions = [...nodeElement.querySelectorAll('*')]
      .filter(element => window.getComputedStyle(element).overflowY === 'auto')

    expect(
      scrollRegions.map(element => element.dataset.testid ?? element.className),
      'a bounded H3 node must own exactly one internal vertical scroll region'
    ).toEqual(['video-config-scroll-content'])

    const [content] = scrollRegions
    expect(
      content.classList.contains('nowheel'),
      'scrolling the H3 config must not zoom the canvas underneath it'
    ).toBe(true)
    expect(
      window.getComputedStyle(content).minHeight,
      'the bounded shell needs a shrinkable content row, otherwise the flex child refuses to scroll'
    ).toBe('0px')
    expect(
      window.getComputedStyle(shellOf(nodeElement)).overflowY,
      'the H3 shell itself must not scroll — the content row owns the scrolling'
    ).not.toBe('auto')

    canvas.unmount()
  })
})
