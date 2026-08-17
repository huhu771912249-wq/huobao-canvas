import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nextTick, ref, watch } from 'vue'

const imageSource = readFileSync(new URL('../src/components/nodes/ImageConfigNode.vue', import.meta.url), 'utf8')
const videoSource = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
const h3DirectorSource = readFileSync(new URL('../src/components/video/H3DirectorPromptEditor.vue', import.meta.url), 'utf8')

for (const testId of ['image-model-select', 'image-quality-select', 'image-size-select']) {
  assert.match(imageSource, new RegExp(`data-testid="${testId}"`), `${testId} must be a directly clickable in-node control`)
}

for (const testId of ['video-model-select', 'video-ratio-select', 'video-duration-select']) {
  assert.match(videoSource, new RegExp(`data-testid="${testId}"`), `${testId} must be a directly clickable in-node control`)
}

assert.match(imageSource, /@change="handleModelSelect\(\$event\.target\.value\)"/)
assert.match(imageSource, /@change="handleQualitySelect\(\$event\.target\.value\)"/)
assert.match(imageSource, /@change="handleSizeSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleModelSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleRatioSelect\(\$event\.target\.value\)"/)
assert.match(videoSource, /@change="handleDurationSelect\(Number\(\$event\.target\.value\)\)"/)
assert.match(imageSource, /modelStore\.setProvider\(supportedProviders\[0\]\)/, 'cross-provider image models must switch their API provider')
assert.match(imageSource, /modelStore\.allImageModels/, 'saved image models must not be reset just because another node changed provider')
assert.match(videoSource, /modelStore\.allVideoModels/, 'saved video models must not be reset just because another node changed provider')
assert.match(videoSource, /modelStore\.allVideoModelOptions/, 'mixed-provider workflows must keep every configured video model selectable')
assert.match(videoSource, /activateModelProvider\(localModel\.value\)/, 'video generation must activate its own model provider')
assert.match(imageSource, /activateModelProvider\(localModel\.value\)/, 'image generation must activate its own model provider')
assert.match(videoSource, /data-testid="video-node-expand-toggle"/, 'the video node must expose a one-click expand control')
const videoHeaderSource = videoSource.match(
  /<div[^>]*data-testid="video-config-sticky-header"[^>]*>[\s\S]*?<\/div>\s*<\/div>/
)?.[0] || ''
assert.ok(videoHeaderSource, 'the video node header must expose its real sticky scroll-shell boundary')
assert.match(videoHeaderSource, /class="[^"]*\bsticky\b[^"]*"/, 'the video node header must remain fixed while its root scroll shell moves')
assert.match(videoHeaderSource, /class="[^"]*\btop-0\b[^"]*"/, 'the sticky video node header must stay at the shell top')
assert.match(videoHeaderSource, /class="[^"]*\bz-\d+\b[^"]*"/, 'the sticky video node header must paint above scrolled controls')
assert.match(videoHeaderSource, /class="[^"]*\bshrink-0\b[^"]*"/, 'the sticky video node header must keep an operable control height')
assert.match(videoHeaderSource, /class="[^"]*bg-\[var\(--bg-secondary\)\][^"]*"/, 'the sticky video node header must have an opaque node background')
assert.match(videoHeaderSource, /data-testid="video-node-expand-toggle"/, 'the expand/collapse toggle must remain inside the sticky header')
const expandedViewportHelpersSource = videoSource.match(
  /(const VIDEO_NODE_VIEWPORT_BOTTOM_GAP = [\s\S]*?const createExpandedVideoNodeViewportLifecycle = [\s\S]*?\n})\n\n\/\/ 使用 Pinia/
)?.[1] || ''
assert.ok(expandedViewportHelpersSource, 'video nodes must expose executable viewport sizing helpers')
const {
  getExpandedVideoNodeMaxHeight,
  getExpandedVideoNodeViewportLayout,
  createExpandedVideoNodeViewportLifecycle,
  createExpandedVideoNodeZoomLifecycle,
  createExpandedVideoNodeRestoreLifecycle
} = await import(
  `data:text/javascript,${encodeURIComponent(`${expandedViewportHelpersSource}\nexport { getExpandedVideoNodeMaxHeight, getExpandedVideoNodeViewportLayout, createExpandedVideoNodeViewportLifecycle, createExpandedVideoNodeZoomLifecycle, createExpandedVideoNodeRestoreLifecycle }`)}`
)
assert.equal(
  getExpandedVideoNodeMaxHeight({ nodeTop: 100, viewportHeight: 900 }),
  776,
  'an upper node must use the viewport space below its real screen top'
)
assert.equal(
  getExpandedVideoNodeMaxHeight({ nodeTop: 700, viewportHeight: 900 }),
  176,
  'a lower node must shrink its internal scroll shell to the remaining viewport space'
)
assert.equal(
  getExpandedVideoNodeMaxHeight({ nodeTop: 876, viewportHeight: 900 }),
  160,
  'a node at the bottom safety line must retain an operable expanded scroll shell'
)
for (const nodeTop of [850, 875, 876, 900]) {
  const layout = getExpandedVideoNodeViewportLayout({ nodeTop, viewportHeight: 900 })
  assert.equal(layout.maxHeight, 160, `extreme lower node at ${nodeTop}px must keep the operable shell height`)
  assert.ok(layout.screenOffsetY < 0, `extreme lower node at ${nodeTop}px must move through real canvas coordinates`)
  assert.ok(layout.resolvedNodeTop >= 0, `extreme lower node at ${nodeTop}px must remain inside the viewport top`)
  assert.ok(layout.viewportBottom <= 876, `extreme lower node at ${nodeTop}px must preserve the 24px bottom safety gap`)
}
const zoomHeightCases = new Map([
  [0.8, 200],
  [1, 160],
  [1.25, 128],
  [2, 80]
])
for (const [zoom, expectedCssHeight] of zoomHeightCases) {
  const layout = getExpandedVideoNodeViewportLayout({ nodeTop: 875, viewportHeight: 900, zoom })
  const renderedHeight = layout.maxHeight * zoom
  const renderedBottom = 875 + layout.screenOffsetY + renderedHeight
  assert.equal(layout.maxHeight, expectedCssHeight, `zoom ${zoom} must convert the 160px screen shell into flow/CSS units`)
  assert.ok(renderedHeight >= 160, `zoom ${zoom} rendered shell must remain at least 160px tall`)
  assert.ok(renderedBottom <= 876, `zoom ${zoom} rendered shell must preserve the bottom safety gap`)
}
assert.equal(getExpandedVideoNodeViewportLayout({ nodeTop: 875, viewportHeight: 900, zoom: 0 }).effectiveZoom, 1)
assert.equal(getExpandedVideoNodeViewportLayout({ nodeTop: 875, viewportHeight: 900, zoom: -1 }).effectiveZoom, 1)
assert.equal(getExpandedVideoNodeViewportLayout({ nodeTop: 875, viewportHeight: 900, zoom: Number.NaN }).effectiveZoom, 1)

let measuredNodeTop = 100
let measuredViewportHeight = 900
let measuredZoom = 0.8
let resizeHandler = null
let resizeAdds = 0
let resizeRemoves = 0
const appliedMaxHeights = []
const appliedViewportMoves = []
const expandedViewportLifecycle = createExpandedVideoNodeViewportLifecycle({
  getNodeTop: () => measuredNodeTop,
  getViewportHeight: () => measuredViewportHeight,
  getZoom: () => measuredZoom,
  setMaxHeight: value => appliedMaxHeights.push(value),
  moveNodeByScreenOffset: (screenOffsetY, effectiveZoom) => appliedViewportMoves.push({ screenOffsetY, effectiveZoom }),
  addResizeListener: handler => {
    resizeAdds += 1
    resizeHandler = handler
  },
  removeResizeListener: handler => {
    assert.equal(handler, resizeHandler, 'cleanup must remove the exact registered resize handler')
    resizeRemoves += 1
    resizeHandler = null
  }
})
expandedViewportLifecycle.start()
expandedViewportLifecycle.start()
assert.equal(resizeAdds, 1, 'repeated expanded lifecycle starts must register one resize listener')
assert.equal(appliedMaxHeights.at(-1), 970)
measuredNodeTop = 700
resizeHandler()
assert.equal(appliedMaxHeights.at(-1), 220, 'resize must recalculate screen height into flow/CSS units')
measuredNodeTop = 875
resizeHandler()
assert.equal(appliedMaxHeights.at(-1), 200, 'extreme lower resize must retain 160 rendered pixels at 0.8 zoom')
assert.deepEqual(appliedViewportMoves.at(-1), { screenOffsetY: -159, effectiveZoom: 0.8 }, 'extreme lower resize must pass the screen move with its effective zoom')
assert.equal(appliedViewportMoves.at(-1).screenOffsetY / appliedViewportMoves.at(-1).effectiveZoom, -198.75, 'screen movement must convert to flow coordinates')
measuredNodeTop = 716
measuredZoom = 2
resizeHandler()
assert.equal(appliedMaxHeights.at(-1), 80, 'resize must recalculate CSS height when zoom changes')
assert.equal(appliedViewportMoves.length, 1, 'the resolved viewport position must not keep moving upward')
expandedViewportLifecycle.stop()
expandedViewportLifecycle.stop()
assert.equal(resizeRemoves, 1, 'collapse and unmount cleanup must be idempotent')
assert.equal(resizeHandler, null)

let restoredExpanded = true
let restoredNodeTop = 0
let restoredResizeAdds = 0
let restoredResizeRemoves = 0
let restoredFrameSequence = 0
let restoredFrameCancels = 0
const restoredMaxHeights = []
const restoredPendingFrames = new Map()
const restoredViewportLifecycle = createExpandedVideoNodeViewportLifecycle({
  getNodeTop: () => restoredNodeTop,
  getViewportHeight: () => 900,
  getZoom: () => 0.8,
  setMaxHeight: value => restoredMaxHeights.push(value),
  moveNodeByScreenOffset: () => {},
  addResizeListener: () => { restoredResizeAdds += 1 },
  removeResizeListener: () => { restoredResizeRemoves += 1 }
})
const restoredZoomLifecycle = createExpandedVideoNodeZoomLifecycle({
  isExpanded: () => restoredExpanded,
  afterRender: () => nextTick(),
  requestFrame: callback => {
    const frameId = ++restoredFrameSequence
    restoredPendingFrames.set(frameId, callback)
    return frameId
  },
  cancelFrame: frameId => {
    if (restoredPendingFrames.delete(frameId)) restoredFrameCancels += 1
  },
  recalculate: () => restoredViewportLifecycle.recalculate()
})
const restoredExpandedValues = []
const restoredLifecycle = createExpandedVideoNodeRestoreLifecycle({
  setExpanded: value => {
    restoredExpanded = value
    restoredExpandedValues.push(value)
  },
  startViewport: () => restoredViewportLifecycle.start(),
  stopViewport: () => restoredViewportLifecycle.stop(),
  scheduleStableRecalculation: () => restoredZoomLifecycle.handleZoomChange(),
  cancelStableRecalculation: () => restoredZoomLifecycle.cancel()
})
restoredLifecycle.sync(true)
assert.equal(restoredMaxHeights.length, 1, 'mounted expanded nodes must take the existing early measurement')
assert.equal(restoredResizeAdds, 1, 'mounted expanded nodes must start resize tracking once')
restoredNodeTop = 700
await nextTick()
assert.equal(restoredPendingFrames.size, 1, 'mounted expanded nodes must schedule one post-layout frame')
const [restoredFrameId, restoredFrameCallback] = restoredPendingFrames.entries().next().value
restoredPendingFrames.delete(restoredFrameId)
restoredFrameCallback()
const restoredCssHeight = restoredMaxHeights.at(-1)
assert.equal(restoredMaxHeights.length, 2, 'the stable frame must measure the real restored rect again')
assert.ok(restoredCssHeight * 0.8 >= 160, '80% restored nodes must retain at least 160 rendered pixels')
assert.ok(restoredNodeTop + restoredCssHeight * 0.8 <= 876, '80% restored nodes must preserve the viewport bottom gap')
restoredLifecycle.sync(true)
await nextTick()
assert.equal(restoredResizeAdds, 1, 'repeated true restores must not register another resize listener')
assert.equal(restoredPendingFrames.size, 0, 'repeated true restores must not schedule another position adjustment')
restoredLifecycle.sync(false)
assert.equal(restoredExpandedValues.at(-1), false, 'external collapsed state must synchronize local expanded state')
assert.equal(restoredResizeRemoves, 1, 'external collapse must stop resize tracking')
restoredLifecycle.sync(true)
assert.equal(restoredExpandedValues.at(-1), true, 'external expanded state must synchronize local expanded state')
restoredLifecycle.sync(false)
await nextTick()
assert.equal(restoredPendingFrames.size, 0, 'collapse before the stable frame must cancel delayed restore work')
restoredLifecycle.sync(true)
await nextTick()
assert.equal(restoredPendingFrames.size, 1, 'a restored expanded node must keep one cancellable stable frame')
restoredLifecycle.dispose()
assert.equal(restoredFrameCancels, 1, 'unmount must cancel the pending restored-layout frame')
assert.equal(restoredPendingFrames.size, 0)

const dynamicZoom = ref(1)
let zoomExpanded = true
let zoomNodeTop = 875
let frameSequence = 0
let cancelledFrames = 0
const pendingFrames = new Map()
const dynamicZoomLayouts = []
const expandedZoomLifecycle = createExpandedVideoNodeZoomLifecycle({
  isExpanded: () => zoomExpanded,
  afterRender: () => nextTick(),
  requestFrame: callback => {
    const frameId = ++frameSequence
    pendingFrames.set(frameId, callback)
    return frameId
  },
  cancelFrame: frameId => {
    if (pendingFrames.delete(frameId)) cancelledFrames += 1
  },
  recalculate: () => {
    const layout = getExpandedVideoNodeViewportLayout({ nodeTop: zoomNodeTop, viewportHeight: 900, zoom: dynamicZoom.value })
    zoomNodeTop += layout.screenOffsetY
    dynamicZoomLayouts.push(layout)
  }
})
const stopDynamicZoomWatch = watch(dynamicZoom, () => expandedZoomLifecycle.handleZoomChange())
const flushDynamicZoom = async zoom => {
  dynamicZoom.value = zoom
  await nextTick()
  await nextTick()
  assert.equal(pendingFrames.size, 1, `zoom ${zoom} must schedule one post-transform frame`)
  const [frameId, callback] = pendingFrames.entries().next().value
  pendingFrames.delete(frameId)
  callback()
  return dynamicZoomLayouts.at(-1)
}
for (const zoom of [0.8, 1.25, 2]) {
  const layout = await flushDynamicZoom(zoom)
  const renderedHeight = layout.maxHeight * zoom
  assert.ok(renderedHeight >= 160, `dynamic zoom ${zoom} must keep at least 160 rendered pixels`)
  assert.ok(zoomNodeTop + renderedHeight <= 876, `dynamic zoom ${zoom} must preserve the bottom safety gap`)
}
const dynamicRecalculationsBeforeCollapse = dynamicZoomLayouts.length
zoomExpanded = false
dynamicZoom.value = 1
await nextTick()
await nextTick()
assert.equal(pendingFrames.size, 0, 'collapsed nodes must not schedule zoom recalculation')
assert.equal(dynamicZoomLayouts.length, dynamicRecalculationsBeforeCollapse, 'collapsed nodes must ignore zoom changes')

zoomExpanded = true
dynamicZoom.value = 0.8
await nextTick()
await nextTick()
assert.equal(pendingFrames.size, 1, 'expanded zoom change must leave one pending post-transform frame')
expandedZoomLifecycle.cancel()
assert.equal(cancelledFrames, 1, 'collapse or unmount must cancel the pending frame')
assert.equal(pendingFrames.size, 0)
stopDynamicZoomWatch()
assert.match(videoSource, /ref="nodeRootRef"/, 'viewport sizing must measure the rendered node root')
assert.match(videoSource, /:style="expandedNodeStyle"/, 'expanded max height must be applied to the node scroll shell')
assert.match(videoSource, /overflowY:\s*'auto'/, 'expanded video nodes must make every setting reachable by scrolling')
assert.doesNotMatch(videoSource, /calc\(100vh - 96px\)/, 'fixed viewport height must not remain the sizing solution')
assert.match(videoSource, /const toggleExpanded = \(\) => \{[\s\S]*?expandedRestoreLifecycle\.sync\(nextExpanded\)/, 'click expand and collapse must use the shared restored viewport lifecycle')
assert.match(videoSource, /watch\(\(\) => viewport\.value\.zoom,[\s\S]*?expandedZoomLifecycle\.handleZoomChange\(\)/, 'the expanded node must react to Vue Flow zoom changes')
assert.match(videoSource, /onMounted\([\s\S]*?expandedRestoreLifecycle\.sync\(Boolean\(props\.data\?\.expanded\)\)/, 'mount must restore expanded viewport state through the stable-layout lifecycle')
assert.match(videoSource, /watch\(\(\) => props\.data\?\.expanded,[\s\S]*?expandedRestoreLifecycle\.sync\(value\)/, 'external expanded state must use the same stable-layout lifecycle')
assert.match(videoSource, /onBeforeUnmount\([\s\S]*?expandedRestoreLifecycle\.dispose\(\)[\s\S]*?\)/, 'unmount must clean up resize and pending stable-layout work')
assert.match(videoSource, /updateNodePositions\(\[\{[\s\S]*?screenOffsetY \/ effectiveZoom[\s\S]*?}], true, false\)/, 'viewport relief must update real Vue Flow coordinates instead of using a visual transform')
assert.match(videoSource, /updateNodeInternals\(props\.id\)/, 'the video node must refresh its Vue Flow bounds after resizing')
assert.match(videoSource, /w-\[560px\]\s+max-w-\[560px\]/, 'long prompts must not widen the video node')
assert.match(h3DirectorSource, /overflow-wrap:anywhere/, 'compiled H3 prompts must wrap long tokens inside the node')
const canvasSource = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const globalStyleSource = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const connectionLifecycleSource = canvasSource.match(
  /(const createCanvasConnectionLifecycle = [\s\S]*?)\n\nconst connectionLifecycle =/
)?.[1] || ''
assert.ok(connectionLifecycleSource, 'canvas must expose an executable connection lifecycle')
const { createCanvasConnectionLifecycle } = await import(
  `data:text/javascript,${encodeURIComponent(`${connectionLifecycleSource}\nexport { createCanvasConnectionLifecycle }`)}`
)
let connectionActive = false
let cancelledClickCount = 0
const connectionLifecycle = createCanvasConnectionLifecycle({
  setConnectionInProgress: active => { connectionActive = active },
  resetClickConnection: () => { cancelledClickCount += 1 }
})

connectionLifecycle.handleClickConnectionStart()
assert.equal(connectionActive, true, 'click-connect start must activate the dock lifecycle')
connectionLifecycle.handleConnectionKeydown({ key: 'Escape' })
assert.equal(connectionActive, false, 'Escape must cancel click-connect and restore the dock')
assert.equal(cancelledClickCount, 1, 'Escape cancellation must reset Vue Flow click-connect state once')

connectionLifecycle.handleClickConnectionStart()
connectionLifecycle.cancelClickConnection({ type: 'pane-click' })
assert.equal(connectionActive, false, 'blank pane click must cancel click-connect and restore the dock')
assert.equal(cancelledClickCount, 2, 'pane cancellation must reset Vue Flow click-connect state once')

connectionLifecycle.handleClickConnectionStart()
connectionLifecycle.handleClickConnectionEnd()
assert.equal(connectionActive, false, 'a valid click target must finish the lifecycle')
assert.equal(cancelledClickCount, 2, 'successful click-connect must not run the cancellation path')

connectionLifecycle.handleConnectionStart()
assert.equal(connectionActive, true, 'drag-connect start must still activate the dock lifecycle')
connectionLifecycle.handleConnectionKeydown({ key: 'Escape' })
assert.equal(connectionActive, true, 'click cancellation must not interrupt an active drag connection')
connectionLifecycle.handleConnectionEnd()
assert.equal(connectionActive, false, 'drag-connect end must still restore the dock')

connectionLifecycle.handleClickConnectionStart()
connectionLifecycle.handleConnectionStart()
connectionLifecycle.handleConnectionEnd()
assert.equal(connectionActive, true, 'drag-connect end must not hide the dock while click-connect remains active')
const resetsBeforeInterleavedCancel = cancelledClickCount
connectionLifecycle.cancelClickConnection({ type: 'pane-click' })
assert.equal(cancelledClickCount, resetsBeforeInterleavedCancel + 1, 'interleaved click-connect must reset exactly once when cancelled')
assert.equal(connectionActive, false, 'cancelling the remaining click-connect must restore the dock')
const connectionIdentitySource = canvasSource.match(
  /(const getCanvasConnectionId = [\s\S]*?const isDuplicateCanvasConnection = [\s\S]*?)\n\nconst onConnect/
)?.[1] || ''
assert.ok(connectionIdentitySource, 'canvas connections must expose executable stable ID and idempotency helpers')
const { getCanvasConnectionId, isDuplicateCanvasConnection } = await import(
  `data:text/javascript,${encodeURIComponent(`${connectionIdentitySource}\nexport { getCanvasConnectionId, isDuplicateCanvasConnection }`)}`
)
const connection = { source: 'node_0', target: 'node_1', sourceHandle: 'right', targetHandle: 'left' }
let persistedConnections = []
const receiveConnectionEvent = params => {
  const connectionWithId = { ...params, id: getCanvasConnectionId(params) }
  if (isDuplicateCanvasConnection(persistedConnections, connectionWithId)) return
  persistedConnections = [...persistedConnections, connectionWithId]
}
receiveConnectionEvent(connection) // drag connect
receiveConnectionEvent({ ...connection }) // duplicate drag connect
receiveConnectionEvent({ ...connection, id: getCanvasConnectionId(connection) }) // interleaved click connect
assert.equal(persistedConnections.length, 1, 'duplicate drag/click events must persist one unique edge')
const alternateHandleConnection = { ...connection, sourceHandle: 'alternate-right' }
receiveConnectionEvent(alternateHandleConnection)
assert.equal(persistedConnections.length, 2, 'the same nodes must keep a legal connection from a different handle')
assert.notEqual(persistedConnections[0].id, persistedConnections[1].id, 'different handle tuples need collision-free stable IDs')
receiveConnectionEvent({ ...alternateHandleConnection })
assert.equal(persistedConnections.length, 2, 'duplicate events for the alternate handle must remain idempotent')
receiveConnectionEvent({ ...connection, target: 'node_2' })
assert.equal(persistedConnections.length, 3, 'a different endpoint must remain connectable')
assert.match(canvasSource, /const connectionParams = \{ \.\.\.params, id: getCanvasConnectionId\(params\) \}/, 'Canvas must pass the stable ID to its existing addEdge path')
const collapsedDockCss = canvasSource.match(/\.canvas-prompt-dock--collapsed\s*\{[\s\S]*?\}/)?.[0] || ''
assert.match(collapsedDockCss, /max-width:\s*180px/, 'collapsed H3 director must stay compact')
assert.match(collapsedDockCss, /left:\s*180px/, 'collapsed H3 director must leave the center connection area clear')
assert.match(imageSource, /class="image-config-node canvas-node-scroll-shell nowheel/, 'the image node shell must remain draggable')
assert.match(imageSource, /data-testid="image-config-drag-handle"/, 'the image node must expose a clear drag area')
assert.match(imageSource, /class="image-config-node__controls nodrag/, 'interactive controls must not start a node drag')
assert.match(imageSource, /Handle type="target"[^>]+width: 12px; height: 12px;/, 'the image input handle must be easy to grab')
assert.match(imageSource, /NodeHandleMenu[^>]+nodeType="imageConfig"/, 'the image node must keep its draggable output handle')
assert.match(canvasSource, /:connection-radius="44"/, 'connections must snap before the pointer reaches a tiny handle')
assert.match(canvasSource, /:connect-on-click="true"/, 'users must be able to connect by clicking two handles')
assert.match(canvasSource, /:auto-pan-on-connect="true"/, 'long connections must keep panning at the canvas edge')
assert.match(globalStyleSource, /\.canvas-flow \.vue-flow__handle::after\s*\{[\s\S]*?inset:\s*-10px/, 'handles must expose a forgiving pointer hit area')
assert.match(globalStyleSource, /\.canvas-flow \.vue-flow__handle\.connecting/, 'click-to-connect must visibly mark the selected start handle')
assert.match(globalStyleSource, /\.canvas-flow \.vue-flow__handle\.vue-flow__handle-valid/, 'valid connection targets must be visually highlighted')
assert.match(globalStyleSource, /\.canvas-flow \.vue-flow__connection-path/, 'the active connection line must stay visible while dragging')

const connectionEventHandlers = {
  'connect-start': 'handleConnectionStart',
  'connect-end': 'handleConnectionEnd',
  'click-connect-start': 'handleClickConnectionStart',
  'click-connect-end': 'handleClickConnectionEnd'
}
for (const [eventName, handlerName] of Object.entries(connectionEventHandlers)) {
  assert.match(canvasSource, new RegExp(`@${eventName}="${handlerName}"`), `${eventName} must participate in the dock lifecycle`)
}
assert.match(canvasSource, /'canvas-prompt-dock--connection-active': connectionInProgress && promptDockExpanded/, 'only an expanded H3 dock should move aside during a connection')
assert.match(canvasSource, /const connectionInProgress = ref\(false\)/)
assert.match(canvasSource, /setConnectionInProgress:\s*active => \{ connectionInProgress\.value = active \}/)
assert.match(canvasSource, /resetClickConnection:\s*\(\) => endConnection\(undefined, true\)/, 'click cancellation must clear Vue Flow public connection state without passing an incompatible event')
assert.match(canvasSource, /window\.addEventListener\('keydown', handleConnectionKeydown\)/, 'Escape cancellation must work regardless of canvas focus')
assert.match(canvasSource, /window\.removeEventListener\('keydown', handleConnectionKeydown\)/, 'the global cancellation listener must be cleaned up')
assert.doesNotMatch(connectionLifecycleSource, /promptDockExpanded\.value\s*=|chatInput\.value\s*=|directorPlan\.value\s*=/, 'connection lifecycle must preserve H3 expansion, input, and plan state')
const activeConnectionDockCss = canvasSource.match(/\.canvas-prompt-dock--connection-active\s*\{[\s\S]*?\}/)?.[0] || ''
assert.match(activeConnectionDockCss, /pointer-events:\s*none/, 'the H3 dock must stop intercepting connection targets temporarily')
assert.match(activeConnectionDockCss, /opacity:\s*0/, 'the H3 dock must visibly move aside without unmounting its content')

console.log('canvasNativeSelectors.test.mjs passed')
