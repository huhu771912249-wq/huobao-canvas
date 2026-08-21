/**
 * Mount canvas node components the way the app mounts them: inside a real `<VueFlow>`
 * with real node types, so the node wrapper, the `nodrag` drag filter and the vue-flow
 * store all behave exactly as they do in the browser.
 *
 * Node components cannot be mounted standalone — `<Handle>` looks itself up in the
 * vue-flow node store and throws without it.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { createPinia } from 'pinia'
import { defineComponent, h, markRaw, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { NODE_FOOTPRINTS } from '../../../src/utils/canvasLayout.js'
import { setViewport } from './cssBox.mjs'

let harnessCounter = 0

const Blank = { render: () => h('div') }

/** Nodes that navigate (detail pages, task centre) need a router to inject. */
export const createTestRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'catch-all', component: Blank }]
})

/** jsdom never lays out, so hand an element the box the browser would give it. */
export const stubRect = (element, { width, height, left = 0, top = 0 }) => {
  element.getBoundingClientRect = () => ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON () { return this }
  })
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true })
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true })
}

/**
 * jsdom refuses `new MouseEvent(..., { view: window })` because vitest's global `window`
 * is not the branded jsdom Window. d3-drag only needs `event.view` to be something it can
 * attach listeners to, and `globalThis` proxies the real window's `addEventListener`.
 */
const mouseEvent = (type, { x, y, button = 0 }) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button })
  Object.defineProperty(event, 'view', { value: globalThis, configurable: true })
  return event
}

/**
 * Drive a real pointer drag through d3-drag. vue-flow's default `nodeDragThreshold` is 1,
 * so the first move only arms the gesture — a second move is what actually drags. That is
 * browser behaviour, not a test artefact.
 */
export const dragFrom = (element, { from = { x: 200, y: 200 }, to = { x: 320, y: 280 } } = {}) => {
  element.dispatchEvent(mouseEvent('mousedown', from))
  document.dispatchEvent(mouseEvent('mousemove', { x: from.x + 2, y: from.y + 2 }))
  document.dispatchEvent(mouseEvent('mousemove', to))
  document.dispatchEvent(mouseEvent('mouseup', to))
}

/**
 * @param {object} options
 * @param {Record<string, object>} options.nodeTypes node type -> component
 * @param {Array<object>} options.nodes vue-flow node descriptors
 * @param {{width: number, height: number}} [options.viewport] browser viewport to emulate
 */
export const mountCanvas = async ({ nodeTypes, nodes, viewport } = {}) => {
  const resolvedViewport = setViewport(viewport)
  const flowId = `test-flow-${harnessCounter += 1}`
  const registry = Object.fromEntries(
    Object.entries(nodeTypes).map(([type, component]) => [type, markRaw(component)])
  )

  let flow
  const Harness = defineComponent({
    name: 'CanvasHarness',
    setup () {
      flow = useVueFlow(flowId)
      return () => h(VueFlow, { id: flowId, nodeTypes: registry, modelValue: nodes })
    }
  })

  const router = createTestRouter()
  await router.push('/')
  await router.isReady()

  const wrapper = mount(Harness, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router] }
  })
  await flushPromises()

  const root = wrapper.element.querySelector('.vue-flow') ?? wrapper.element
  stubRect(root, { width: resolvedViewport.width, height: resolvedViewport.height })

  // Scoped to this canvas, never `document`: a spec that fails before unmounting would
  // otherwise leave a node behind for the next spec to find.
  const nodeElement = id => root.querySelector(`.vue-flow__node[data-id="${id}"]`)

  // Give every node the footprint the auto-layout reserves for its type, then let
  // vue-flow ingest those dimensions the way a ResizeObserver would in a browser.
  for (const node of nodes) {
    const element = nodeElement(node.id)
    if (!element) continue
    const footprint = NODE_FOOTPRINTS[node.type] ?? { width: 420, height: 360 }
    stubRect(element, {
      width: footprint.width,
      height: footprint.height,
      left: node.position?.x ?? 0,
      top: node.position?.y ?? 0
    })
  }
  flow.updateNodeInternals(nodes.map(node => node.id))
  await nextTick()

  return {
    wrapper,
    flow,
    viewport: resolvedViewport,
    nodeElement,
    /** The component's own visible shell inside the vue-flow node wrapper. */
    nodeShell: (id, selector) => nodeElement(id)?.querySelector(selector),
    unmount: () => wrapper.unmount()
  }
}
