import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/stores/canvas.js', import.meta.url), 'utf8')
const recent = readFileSync(new URL('../src/components/home/RecentProjects.vue', import.meta.url), 'utf8')
const globalStyles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

assert.doesNotMatch(store, /watch\(\[nodes, edges\][\s\S]*deep:\s*true/)
assert.match(store, /export const scheduleCanvasSave/)
assert.match(canvas, /@node-drag-stop="handleNodeDragStop"/)
assert.match(recent, /INITIAL_VISIBLE_PROJECTS/)
assert.match(recent, /visibleProjects/)
assert.match(globalStyles, /\.workspace-panel[\s\S]*background:\s*var\(--panel-strong/)
assert.doesNotMatch(globalStyles, /\.workspace-panel\s*\{[\s\S]*?backdrop-filter/)

console.log('canvasPerformance.test.mjs passed')
