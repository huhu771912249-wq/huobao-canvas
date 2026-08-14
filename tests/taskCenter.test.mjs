import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildTaskCenterActions,
  buildTaskCategoryTabs,
  filterTaskCenterTasks,
  resolveTaskDetailsTarget
} from '../src/utils/taskCenter.js'
import { buildTaskSummary } from '../src/utils/workspaceUi.js'

const tasks = [
  { id: 'video:1', category: 'video' },
  { id: 'variation:1', category: 'variation' },
  { id: 'variation:2', category: 'variation' },
  { id: 'dsp:1', category: 'dsp' }
]

const tabs = buildTaskCategoryTabs(tasks)
assert.equal(tabs.find(tab => tab.id === 'all').count, 4)
assert.equal(tabs.find(tab => tab.id === 'variation').count, 2)
assert.equal(tabs.find(tab => tab.id === 'novel').count, 0)
assert.deepEqual(
  filterTaskCenterTasks(tasks, 'variation').map(task => task.id),
  ['variation:1', 'variation:2']
)
assert.deepEqual(filterTaskCenterTasks(tasks, 'all'), tasks)

const detailCases = [
  {
    category: 'video',
    task: { source: 'material', category: 'video', source_id: 'video-1' },
    target: null,
    actions: []
  },
  {
    category: 'novel',
    task: { source: 'novel', category: 'novel', source_id: 'novel-1' },
    target: { path: '/video-studio', query: { tab: 'novel', job: 'novel-1' } },
    actions: ['details']
  },
  {
    category: 'dsp',
    task: { source: 'dsp', category: 'dsp', source_id: 'dsp-1' },
    target: null,
    actions: []
  },
  {
    category: 'variation',
    task: { source: 'material', category: 'variation', source_id: 'variation-1' },
    target: null,
    actions: []
  },
  {
    category: 'resize',
    task: { source: 'resize', category: 'resize', source_id: 'resize-1' },
    target: { path: '/video-resize', query: { job: 'resize-1' } },
    actions: ['details']
  }
]

for (const { category, task, target, actions } of detailCases) {
  assert.deepEqual(resolveTaskDetailsTarget(task), target, `${category} 详情路由应匹配页面恢复能力`)
  assert.deepEqual(buildTaskCenterActions(task), actions, `${category} 只应展示真实可用的动作`)
}

assert.equal(resolveTaskDetailsTarget({ source: 'novel', category: 'novel' }), null)
assert.deepEqual(
  buildTaskCenterActions({ ...detailCases[0].task, download_url: '/public-assets/video.mp4' }),
  ['download']
)
assert.deepEqual(
  buildTaskSummary({ status: 'failed', actions: ['details'] }).actions,
  ['details']
)

const routerSource = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const taskCenterSource = readFileSync(new URL('../src/views/TaskCenter.vue', import.meta.url), 'utf8')
const taskRailSource = readFileSync(
  new URL('../src/components/workspace/TaskRail.vue', import.meta.url),
  'utf8'
)
assert.match(routerSource, /path:\s*['"]\/tasks['"]/)
assert.match(routerSource, /views\/TaskCenter\.vue/)
assert.match(taskCenterSource, /listTaskCenterTasks/)
assert.match(taskCenterSource, /variant="page"/)
assert.match(taskCenterSource, /resolveTaskDetailsTarget\(task\)/)
assert.match(taskRailSource, /task-rail--page/)

console.log('taskCenter.test.mjs passed')
