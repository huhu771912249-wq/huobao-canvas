import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mapNovelJobToTask, mergeRecentTasks } from '../src/utils/workspaceUi.js'

const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')
const studio = readFileSync(new URL('../src/views/VideoStudio.vue', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/studio/NovelVideoWorkspace.vue', import.meta.url), 'utf8')
const novel = mapNovelJobToTask({ job_id: 'nvj-1', title: '家缘万事兴', status: 'generating', shot_summary: { completed: 3, failed: 1, total: 10 } })

assert.deepEqual(novel, { id: 'novel:nvj-1', source: 'novel', source_id: 'nvj-1', name: '家缘万事兴', status: 'running', progress: 30, success_count: 3, failure_count: 1 })
assert.deepEqual(mergeRecentTasks([{ id: 'material-1' }], [novel]).map(item => item.id), ['novel:nvj-1', 'material-1'])
assert.match(home, /listTaskCenterTasks\(\{ limit: 100/)
assert.match(home, /recentTasks\.value = result\.tasks/)
assert.match(home, /@details="openTask"/)
assert.match(home, /:error="taskLoadError"/)
assert.match(home, /暂时无法读取后端任务/)
assert.match(home, /query: \{ tab: 'novel', job: task\.source_id \}/)
assert.match(studio, /:initial-job-id="activeNovelJobId"/)
assert.match(studio, /activeNovelJobId = computed\(\(\) => String\(route\.query\.job \|\| ''\)\)/)
assert.match(workspace, /initialJobId/)
assert.match(workspace, /restoreJob\(props\.initialJobId\)/)
console.log('novelTaskCenter.test.mjs passed')
