import assert from 'node:assert/strict'
import { ENTRY_GROUPS, STUDIO_ENTRIES, entriesByGroup } from '../src/config/studioEntries.js'
import {
  buildCanvasLaunch,
  normalizeStudioTab,
  resolveLegacyCanvasRoute,
  resolveWorkspaceNavigationTarget
} from '../src/config/workspaceLaunch.js'

// 入口按「点下去会发生什么」分三组，声明顺序即首页呈现顺序。
// 分组之前这些入口挤在一个网格里：有的跳独立页面、有的在画布里生成节点，
// 长得一模一样，用户点之前无法预判。所以这里锁的不只是顺序，还有归属。
assert.deepEqual(ENTRY_GROUPS.map((group) => group.key), ['tool', 'workflow'])
assert.deepEqual(STUDIO_ENTRIES.map((entry) => entry.key), [
  'gif-editor',
  'resize',
  'quick',
  'novel',
  'test-assets',
  'blank',
  'image',
  'image-to-video',
  'video',
  'batch',
  'background',
  'variation',
  'dsp'
])
// 每个入口都要落在已声明的分组里，否则首页渲染不出来。
const declaredGroups = new Set(ENTRY_GROUPS.map((group) => group.key))
for (const entry of STUDIO_ENTRIES) {
  assert.ok(declaredGroups.has(entry.group), `入口 ${entry.key} 的分组 ${entry.group} 没有声明`)
}
// 分组视图必须不重不漏地覆盖整份目录。
assert.equal(
  ENTRY_GROUPS.reduce((total, group) => total + entriesByGroup(group.key).length, 0),
  STUDIO_ENTRIES.length
)
// 分组语义要立得住：tool 一律跳独立页面，workflow 一律进画布（空白画板除外）。
for (const entry of entriesByGroup('tool')) {
  assert.ok(entry.route || entry.flow === 'gifEditor', `快捷工具「${entry.title}」必须通向一个独立页面`)
}
for (const entry of entriesByGroup('workflow')) {
  assert.ok(entry.flow || entry.key === 'blank', `画板工作流「${entry.title}」必须是画布模板`)
}
// 想自由发挥时必须有一个不预设节点的入口。
assert.equal(STUDIO_ENTRIES.find((entry) => entry.key === 'blank').route, '/canvas')
assert.ok(STUDIO_ENTRIES.every((entry) => entry.route || entry.flow))
// 任务中心已移出动作目录，其可达性由 workspaceUi.test.mjs 锁在侧栏上。
assert.equal(STUDIO_ENTRIES.find((entry) => entry.key === 'batch').flow, 'batch')
assert.equal(STUDIO_ENTRIES.find((entry) => entry.key === 'background').flow, 'background')

assert.deepEqual(resolveWorkspaceNavigationTarget('video'), {
  path: '/',
  query: { launch: 'video' }
})
assert.deepEqual(resolveWorkspaceNavigationTarget('tasks'), {
  path: '/tasks'
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
  path: '/tasks'
})
assert.equal(resolveLegacyCanvasRoute({ id: 'existing', flow: 'video' }), null)
assert.equal(normalizeStudioTab('novel'), 'novel')
assert.equal(normalizeStudioTab('wrong'), 'quick')
// 'assets'（素材再创作）从来没有渲染分支，点进去是白屏，已随首页改版一并移除。
// 存量书签/外链带着 ?tab=assets 进来时必须回落到快速创作，而不是空白页。
assert.equal(normalizeStudioTab('assets'), 'quick', '已移除的 tab 必须优雅回落')

const imageCanvas = buildCanvasLaunch('image', { prompt: '' })
assert.deepEqual(imageCanvas.nodes.map((node) => node.type), ['text', 'imageConfig', 'image'])

const backgroundCanvas = buildCanvasLaunch('background')
assert.deepEqual(backgroundCanvas.nodes.map((node) => node.type), ['imageConfig', 'image'])
assert.equal(backgroundCanvas.nodes[0].data.editMode, 'background_replace')

const batchCanvas = buildCanvasLaunch('batch')
assert.deepEqual(batchCanvas.nodes.map((node) => node.type), ['text', 'videoConfig', 'videoBatch'])

const dspCanvas = buildCanvasLaunch('dsp')
assert.deepEqual(dspCanvas.nodes.map((node) => node.type), ['dspCreativeLibrary', 'dspCreativeTaskCenter'])
