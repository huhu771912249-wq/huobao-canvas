import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildCanvasStarterActions,
  buildCreativeCardView,
  buildTaskSummary,
  buildWorkspaceNavigation,
  normalizeServiceIncident,
  normalizeTaskTone,
  resolvePromptDockExpanded
} from '../src/utils/workspaceUi.js'
import { STUDIO_ENTRIES } from '../src/config/studioEntries.js'

// 侧栏只放「地点」（你的东西在哪），动作（做什么）一律归首页目录。
// 改造前 image / video / variation / dsp 四个动作挂在导航栏里，导致同一个
// 能力同时出现在侧栏、顶部卡片、常用工作流和快捷操作四处。
assert.deepEqual(buildWorkspaceNavigation().map((item) => item.id), [
  'home',
  'projects',
  'recent',
  'tasks'
])
// 反向锁：任何一个首页目录里的动作都不许再溜回侧栏。
const navIds = new Set(buildWorkspaceNavigation().map((item) => item.id))
for (const entry of STUDIO_ENTRIES) {
  assert.ok(
    !navIds.has(entry.key),
    `能力「${entry.title}」同时出现在侧栏和首页目录，这正是要消掉的重复`
  )
}
// 侧栏每一项都必须真的指向一个地点，不能是 ?launch= 这种动作参数。
for (const item of buildWorkspaceNavigation()) {
  assert.doesNotMatch(item.to, /[?&]launch=/, `侧栏「${item.label}」是动作不是地点，应该归首页目录`)
}

assert.equal(
  buildWorkspaceNavigation().find((item) => item.id === 'tasks')?.to,
  '/tasks',
  '任务中心不应通过新画布打开'
)
// 任务中心从首页目录搬到了侧栏（它是地点不是动作）。契约照旧：必须可达，
// 且只能有一处入口 —— 改造前它同时在侧栏、顶栏按钮和首页目录里出现。
assert.equal(
  buildWorkspaceNavigation().filter((item) => item.id === 'tasks').length,
  1,
  '任务中心必须可达，且只有一个入口'
)
assert.ok(
  !STUDIO_ENTRIES.some((entry) => entry.key === 'tasks'),
  '任务中心不该再出现在首页动作目录里'
)
// 原来这里锁「任务中心不应创建 DSP 项目」。任务中心搬到侧栏后，等价保障是
// 上面那条「侧栏每一项都不许带 ?launch=」—— 它对所有侧栏项一起生效，比只盯
// 任务中心一个更严。

assert.deepEqual(
  normalizeServiceIncident(
    'static DSP API token expired and refresh script did not provide a new token'
  ),
  {
    code: 'dsp_token_expired',
    title: 'DSP 授权已过期',
    message: '当前授权无法读取最新素材，请重新验证 DSP 连接。',
    actions: ['reauthorize', 'settings', 'details'],
    tone: 'danger'
  }
)

assert.deepEqual(
  normalizeServiceIncident(
    'material AI request failed: The read operation timed out'
  ),
  {
    code: 'material_ai_timeout',
    title: '素材分析部分超时',
    message: '已保留成功结果，可以只重试失败素材。',
    actions: ['retry_failed', 'details'],
    tone: 'warning'
  }
)

assert.equal(normalizeServiceIncident(''), null)
assert.equal(normalizeTaskTone('partial'), 'warning')
assert.equal(normalizeTaskTone('completed'), 'success')
assert.equal(resolvePromptDockExpanded({ nodeCount: 0, userPreference: null }), false)
assert.equal(resolvePromptDockExpanded({ nodeCount: 2, userPreference: null }), false)
assert.equal(resolvePromptDockExpanded({ nodeCount: 2, userPreference: true }), true)
assert.deepEqual(
  buildCanvasStarterActions().map((item) => item.id),
  ['dsp', 'variation', 'background']
)

assert.deepEqual(
  buildCreativeCardView({
    creative_id: 'creative-1',
    media_type: 'BANNER',
    width: 300,
    height: 250,
    impressions: 35169,
    clicks: 513,
    ctr: 1.45867,
    wilson_ctr: 0.01338,
    spend: 7.0338
  }),
  {
    id: 'creative-1',
    type: 'BANNER',
    size: '300×250',
    impressions: '35,169',
    clicks: '513',
    ctr: '1.46%',
    wilson: '1.34%',
    spend: '$7.03'
  }
)

assert.deepEqual(
  buildTaskSummary({
    status: 'partial',
    success_count: 20,
    failure_count: 9
  }),
  {
    title: '部分完成',
    tone: 'warning',
    detail: '成功 20 · 失败 9',
    actions: ['retry_failed', 'view_results', 'details']
  }
)

const canvasSource = readFileSync(
  new URL('../src/views/Canvas.vue', import.meta.url),
  'utf8'
)
assert.match(canvasSource, /defineAsyncComponent/)
for (const component of [
  'MaterialVariationNode',
  'DspCreativeLibraryNode',
  'DspCreativeTaskCenterNode',
  'VideoBatchNode',
  'TextOverlayNode'
]) {
  assert.match(
    canvasSource,
    new RegExp(`const ${component} = defineAsyncComponent`)
  )
}

const workspaceShellSource = readFileSync(
  new URL('../src/components/workspace/WorkspaceShell.vue', import.meta.url),
  'utf8'
)
assert.match(
  workspaceShellSource,
  /grid-template-columns:\s*100px minmax\(0, 1fr\)/,
  'desktop workspace must reserve the full sidebar width before main content'
)
assert.match(
  workspaceShellSource,
  /\.workspace-sidebar\s*\{[^}]*margin:\s*12px;/s,
  'desktop sidebar must keep an outer gap on every side'
)

console.log('workspaceUi.test.mjs passed')
