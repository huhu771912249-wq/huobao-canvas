import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/stores/canvas.js', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')
const launcher = readFileSync(new URL('../src/components/home/CreationLauncher.vue', import.meta.url), 'utf8')
const workspaceLaunch = readFileSync(new URL('../src/config/workspaceLaunch.js', import.meta.url), 'utf8')

assert.match(router, /\/canvas\/:id\?/)
assert.match(router, /\/video-studio/)
for (const nodeType of ['text', 'imageConfig', 'videoConfig', 'video', 'videoBatch', 'materialVariation', 'dspCreativeLibrary', 'dspCreativeTaskCenter', 'image', 'textOverlay', 'llmConfig']) {
  assert.match(canvas, new RegExp(`['"]${nodeType}['"]`), `missing legacy node ${nodeType}`)
}
for (const entry of ['快速创作', '小说成片', '素材库', '任务中心', '视频尺寸工作台']) {
  assert.match(home + entries, new RegExp(entry), `missing standalone entry ${entry}`)
}
for (const entry of ['54DSP 优秀素材', '批量广告尺寸', '背景替换', '素材裂变']) {
  assert.match(launcher + workspaceLaunch, new RegExp(entry), `missing canvas entry ${entry}`)
}
console.log('legacyFeatureContract.test.mjs passed')
