import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Canvas nodes are absolutely positioned siblings inside `.vue-flow__nodes` and the
 * store never assigns an explicit z-index, so an opaque node that outgrows the
 * viewport swallows the pointer events of every node it covers. `.canvas-node-scroll-shell`
 * is the shared guard rail that keeps every node shell inside the viewport.
 *
 * The H3 video config node opts out of that shared class because it owns a
 * header + scroll-content flex layout, so it must supply the same bound itself in
 * BOTH states. Regression: a collapsed H3 node with no bound grew to ~1370px and
 * made every node beneath it unclickable, leaving the H3 node the only draggable
 * element on the canvas.
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const videoConfig = read('../src/components/nodes/VideoConfigNode.vue')
const styles = read('../src/style.css')

const sharedShellMaxHeight = styles.match(
  /\.canvas-node-scroll-shell\s*\{[^}]*max-height:\s*(calc\([^)]*\))/s
)?.[1]
assert.ok(sharedShellMaxHeight, 'the shared node shell must publish a viewport-bound max-height')

const nodeStyleBinding = videoConfig.match(
  /const expandedNodeStyle = computed\(\(\) => \(?([\s\S]*?)\)\)\n/
)?.[1] || ''
assert.ok(nodeStyleBinding, 'the H3 node must bind an inline shell style')

// The collapsed branch is the `:` arm of the ternary. It must not be `undefined`.
const collapsedBranch = nodeStyleBinding.split(/\n\s*:\s*/)[1] || ''
assert.ok(collapsedBranch, 'the H3 shell style must cover the collapsed state')
assert.doesNotMatch(
  collapsedBranch,
  /^undefined/,
  'a collapsed H3 node must still be bounded, otherwise it covers and blocks neighbouring nodes'
)
assert.match(
  collapsedBranch,
  /maxHeight/,
  'the collapsed H3 shell must declare a max-height'
)

// The collapsed bound must be the same viewport-relative guard rail the shared shell uses.
const collapsedMaxHeight = videoConfig.match(
  /const VIDEO_NODE_COLLAPSED_MAX_HEIGHT = '([^']+)'/
)?.[1]
assert.ok(collapsedMaxHeight, 'the collapsed bound must be a named constant')
assert.equal(
  collapsedMaxHeight.replace(/\s+/g, ''),
  sharedShellMaxHeight.replace(/\s+/g, ''),
  'the collapsed H3 bound must match the shared canvas-node-scroll-shell guard rail'
)
assert.match(
  collapsedBranch,
  /VIDEO_NODE_COLLAPSED_MAX_HEIGHT/,
  'the collapsed branch must use the shared guard rail constant'
)

// The expanded branch must keep #36's viewport-fitting behaviour.
const expandedBranch = nodeStyleBinding.split(/\n\s*:\s*/)[0] || ''
assert.match(
  expandedBranch,
  /expandedNodeMaxHeight/,
  'an expanded H3 node must still fit itself to the live viewport'
)

// The bounded shell only works if the inner content owns the scrolling.
const scrollContentTag = videoConfig.match(
  /<div[^>]*data-testid="video-config-scroll-content"[^>]*>/
)?.[0] || ''
assert.match(
  scrollContentTag,
  /class="[^"]*\bmin-h-0\b[^"]*"/,
  'the bounded shell needs a shrinkable content row'
)
assert.match(
  scrollContentTag,
  /class="[^"]*\boverflow-y-auto\b[^"]*"/,
  'a bounded H3 node must scroll its content instead of growing past the viewport'
)

console.log('canvasNodeOcclusion.test.mjs passed')
