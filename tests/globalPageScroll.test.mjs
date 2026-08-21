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
  'LLMConfigNode.vue',
  'TextOverlayNode.vue',
  'MaterialInputNode.vue',
  'MaterialVariationNode.vue',
  'DspCreativeLibraryNode.vue',
  'DspCreativeTaskCenterNode.vue'
]) {
  assert.match(read(`../src/components/nodes/${component}`), /canvas-node-scroll-shell/)
}

// H3 节点自身的滚动布局契约（根壳可拖拽、根壳不自己滚、只有 config 内容行滚动且带
// nowheel、全节点只有一个纵向滚动区）已经搬进 tests/component/canvasNodeOcclusion.spec.mjs
// 和 tests/component/canvasNodeDragging.spec.mjs，改成对渲染后的 DOM 断言。
// 这里原来那句 `overflow-y-auto 全文恰好出现 1 次` 是对 1600 行源文件的字符串计数，
// 组件级拆分会无故变红；新断言数的是渲染树里的滚动区，拆文件不受影响。

console.log('globalPageScroll.test.mjs passed')
