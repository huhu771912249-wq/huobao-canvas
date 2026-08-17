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

for (const eventName of ['connect-start', 'connect-end', 'click-connect-start', 'click-connect-end']) {
  assert.match(canvasSource, new RegExp(`@${eventName}="handleConnection(?:Start|End)"`), `${eventName} must participate in the dock lifecycle`)
}
assert.match(canvasSource, /'canvas-prompt-dock--connection-active': connectionInProgress && promptDockExpanded/, 'only an expanded H3 dock should move aside during a connection')
assert.match(canvasSource, /const connectionInProgress = ref\(false\)/)
const connectionLifecycleSource = canvasSource.match(
  /const handleConnectionStart = \(\) => \{[\s\S]*?const handleConnectionEnd = \(\) => \{[\s\S]*?\n\}/
)?.[0] || ''
assert.match(connectionLifecycleSource, /handleConnectionStart[\s\S]*?connectionInProgress\.value = true/)
assert.match(connectionLifecycleSource, /handleConnectionEnd[\s\S]*?connectionInProgress\.value = false/)
assert.doesNotMatch(connectionLifecycleSource, /promptDockExpanded\.value\s*=|chatInput\.value\s*=|directorPlan\.value\s*=/, 'connection lifecycle must preserve H3 expansion, input, and plan state')
const activeConnectionDockCss = canvasSource.match(/\.canvas-prompt-dock--connection-active\s*\{[\s\S]*?\}/)?.[0] || ''
assert.match(activeConnectionDockCss, /pointer-events:\s*none/, 'the H3 dock must stop intercepting connection targets temporarily')
assert.match(activeConnectionDockCss, /opacity:\s*0/, 'the H3 dock must visibly move aside without unmounting its content')

console.log('canvasNativeSelectors.test.mjs passed')
