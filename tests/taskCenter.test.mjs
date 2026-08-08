import assert from 'node:assert/strict'
import {
  buildTaskCategoryTabs,
  filterTaskCenterTasks
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
assert.deepEqual(
  buildTaskSummary({ status: 'failed', actions: ['details'] }).actions,
  ['details']
)

console.log('taskCenter.test.mjs passed')
