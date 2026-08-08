import assert from 'node:assert/strict'
import { STUDIO_ENTRIES } from '../src/config/studioEntries.js'
import {
  buildCanvasLaunch,
  normalizeStudioTab,
  resolveLegacyCanvasRoute,
  resolveWorkspaceNavigationTarget
} from '../src/config/workspaceLaunch.js'

assert.deepEqual(STUDIO_ENTRIES.map((entry) => entry.key), [
  'quick',
  'novel',
  'assets',
  'tasks',
  'resize'
])
assert.ok(STUDIO_ENTRIES.every((entry) => entry.route || entry.action === 'tasks'))
assert.equal(STUDIO_ENTRIES.find((entry) => entry.key === 'tasks').action, 'tasks')

assert.deepEqual(resolveWorkspaceNavigationTarget('video'), {
  path: '/',
  query: { launch: 'video' }
})
assert.deepEqual(resolveWorkspaceNavigationTarget('tasks'), {
  path: '/',
  query: { panel: 'tasks' }
})
assert.deepEqual(resolveWorkspaceNavigationTarget('recent'), { path: '/recent-generations' })
assert.deepEqual(resolveWorkspaceNavigationTarget('projects'), {
  path: '/',
  query: { section: 'projects' }
})
assert.deepEqual(resolveLegacyCanvasRoute({ id: 'new', flow: 'background' }), {
  path: '/',
  query: { launch: 'background' }
})
assert.deepEqual(resolveLegacyCanvasRoute({ id: 'new', panel: 'tasks' }), {
  path: '/',
  query: { panel: 'tasks' }
})
assert.equal(resolveLegacyCanvasRoute({ id: 'existing', flow: 'video' }), null)
assert.equal(normalizeStudioTab('novel'), 'novel')
assert.equal(normalizeStudioTab('wrong'), 'quick')

const imageCanvas = buildCanvasLaunch('image', { prompt: '' })
assert.deepEqual(imageCanvas.nodes.map((node) => node.type), ['text', 'imageConfig', 'image'])

const backgroundCanvas = buildCanvasLaunch('background')
assert.deepEqual(backgroundCanvas.nodes.map((node) => node.type), ['imageConfig', 'image'])
assert.equal(backgroundCanvas.nodes[0].data.editMode, 'background_replace')

const batchCanvas = buildCanvasLaunch('batch')
assert.deepEqual(batchCanvas.nodes.map((node) => node.type), ['text', 'videoConfig', 'videoBatch'])

const dspCanvas = buildCanvasLaunch('dsp')
assert.deepEqual(dspCanvas.nodes.map((node) => node.type), ['dspCreativeLibrary', 'dspCreativeTaskCenter'])
