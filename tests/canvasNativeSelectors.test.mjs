import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
assert.match(videoSource, /maxHeight:\s*'calc\(100vh - 96px\)'/, 'expanded video nodes must stay inside the viewport')
assert.match(videoSource, /overflowY:\s*'auto'/, 'expanded video nodes must make every setting reachable by scrolling')
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
const cancelledClickEvents = []
const connectionLifecycle = createCanvasConnectionLifecycle({
  setConnectionInProgress: active => { connectionActive = active },
  resetClickConnection: event => { cancelledClickEvents.push(event.type || event.key) }
})

connectionLifecycle.handleClickConnectionStart()
assert.equal(connectionActive, true, 'click-connect start must activate the dock lifecycle')
connectionLifecycle.handleConnectionKeydown({ key: 'Escape' })
assert.equal(connectionActive, false, 'Escape must cancel click-connect and restore the dock')
assert.deepEqual(cancelledClickEvents, ['Escape'], 'Escape cancellation must reset Vue Flow click-connect state once')

connectionLifecycle.handleClickConnectionStart()
connectionLifecycle.cancelClickConnection({ type: 'pane-click' })
assert.equal(connectionActive, false, 'blank pane click must cancel click-connect and restore the dock')
assert.deepEqual(cancelledClickEvents, ['Escape', 'pane-click'], 'pane cancellation must reset Vue Flow click-connect state once')

connectionLifecycle.handleClickConnectionStart()
connectionLifecycle.handleClickConnectionEnd()
assert.equal(connectionActive, false, 'a valid click target must finish the lifecycle')
assert.equal(cancelledClickEvents.length, 2, 'successful click-connect must not run the cancellation path')

connectionLifecycle.handleConnectionStart()
assert.equal(connectionActive, true, 'drag-connect start must still activate the dock lifecycle')
connectionLifecycle.handleConnectionKeydown({ key: 'Escape' })
assert.equal(connectionActive, true, 'click cancellation must not interrupt an active drag connection')
connectionLifecycle.handleConnectionEnd()
assert.equal(connectionActive, false, 'drag-connect end must still restore the dock')
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
assert.match(canvasSource, /resetClickConnection:\s*event => endConnection\(event, true\)/, 'click cancellation must clear Vue Flow public connection state')
assert.match(canvasSource, /window\.addEventListener\('keydown', handleConnectionKeydown\)/, 'Escape cancellation must work regardless of canvas focus')
assert.match(canvasSource, /window\.removeEventListener\('keydown', handleConnectionKeydown\)/, 'the global cancellation listener must be cleaned up')
assert.doesNotMatch(connectionLifecycleSource, /promptDockExpanded\.value\s*=|chatInput\.value\s*=|directorPlan\.value\s*=/, 'connection lifecycle must preserve H3 expansion, input, and plan state')
const activeConnectionDockCss = canvasSource.match(/\.canvas-prompt-dock--connection-active\s*\{[\s\S]*?\}/)?.[0] || ''
assert.match(activeConnectionDockCss, /pointer-events:\s*none/, 'the H3 dock must stop intercepting connection targets temporarily')
assert.match(activeConnectionDockCss, /opacity:\s*0/, 'the H3 dock must visibly move aside without unmounting its content')

console.log('canvasNativeSelectors.test.mjs passed')
