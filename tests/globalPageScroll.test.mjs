import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const workspace = read('../src/components/workspace/WorkspaceShell.vue')
const studio = read('../src/views/VideoStudio.vue')
const resize = read('../src/views/VideoResizeWorkbench.vue')
const login = read('../src/views/Login.vue')
const styles = read('../src/style.css')

assert.match(workspace, /@wheel="forwardWheelToStage"/)
assert.match(workspace, /ref="stageRef"/)
assert.match(workspace, /stageRef\.value\.scrollBy/)
assert.match(workspace, /stageRef\.value\?\.scrollTo/)

for (const [name, source] of [['视频创作中心', studio], ['视频尺寸工作台', resize]]) {
  assert.match(
    source,
    /<main class="[^"]*h-screen[^"]*overflow-y-auto[^"]*"/,
    `${name}必须在全局滚动锁定下提供页面级滚动容器`
  )
}

assert.match(login, /\.login-shell\{[^}]*height:100%[^}]*overflow-y:auto/s)
assert.match(styles, /\.canvas-node-scroll-shell\s*\{[^}]*max-height:\s*calc\(100vh - 120px\)[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s)

for (const component of [
  'ImageConfigNode.vue',
  'VideoConfigNode.vue',
  'LLMConfigNode.vue',
  'TextOverlayNode.vue',
  'MaterialInputNode.vue',
  'MaterialVariationNode.vue',
  'DspCreativeLibraryNode.vue',
  'DspCreativeTaskCenterNode.vue'
]) {
  assert.match(read(`../src/components/nodes/${component}`), /canvas-node-scroll-shell/)
}

console.log('globalPageScroll.test.mjs passed')
