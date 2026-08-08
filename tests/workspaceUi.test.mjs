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

assert.deepEqual(buildWorkspaceNavigation().map((item) => item.id), [
  'home',
  'image',
  'video',
  'variation',
  'dsp',
  'tasks',
  'projects'
])

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
