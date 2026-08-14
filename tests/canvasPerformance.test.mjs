import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/stores/canvas.js', import.meta.url), 'utf8')
const recent = readFileSync(new URL('../src/components/home/RecentProjects.vue', import.meta.url), 'utf8')
const globalStyles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const dspTaskCenter = readFileSync(new URL('../src/components/nodes/DspCreativeTaskCenterNode.vue', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')

assert.doesNotMatch(store, /watch\(\[nodes, edges\][\s\S]*deep:\s*true/)
assert.match(store, /export const scheduleCanvasSave/)
assert.match(canvas, /@node-drag-stop="handleNodeDragStop"/)
assert.match(recent, /INITIAL_VISIBLE_PROJECTS/)
assert.match(recent, /visibleProjects/)
assert.match(globalStyles, /\.workspace-panel[\s\S]*background:\s*var\(--panel-strong/)
assert.doesNotMatch(globalStyles, /\.workspace-panel\s*\{[\s\S]*?backdrop-filter/)
assert.match(dspTaskCenter, /hasTaskCenterPersistenceChanged/, 'DSP polling must compare stable persistence before updating the canvas node')
assert.match(dspTaskCenter, /if \(hasTaskCenterPersistenceChanged\(props\.data, safe\)\)\s*\{\s*updateNode/, 'unchanged DSP poll results must not schedule a project PUT')
assert.match(home, /projectsLoading/, 'home must distinguish loading from a genuinely empty project list')
assert.match(home, /正在读取最近项目/)

console.log('canvasPerformance.test.mjs passed')
