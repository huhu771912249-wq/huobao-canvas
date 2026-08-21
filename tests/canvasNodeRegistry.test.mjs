import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NODE_FOOTPRINTS } from '../src/utils/canvasLayout.js'

const canvasSource = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')

const readBlock = (declaration) => {
  const start = canvasSource.indexOf(declaration)
  assert.notEqual(start, -1, `Canvas.vue 必须仍然声明 ${declaration}`)
  const end = canvasSource.indexOf('\n]', start)
  assert.notEqual(end, -1, `${declaration} 必须是一个数组字面量`)
  return canvasSource.slice(start, end)
}

const collect = (block, pattern) => [...block.matchAll(pattern)].map((match) => match[1])

const toolIds = collect(readBlock('const tools = ['), /\{\s*id:\s*'([^']+)'/g)
const menuTypes = collect(readBlock('const nodeTypeOptions = ['), /\{\s*type:\s*'([^']+)'/g)
const registeredTypes = collect(
  readBlock('const nodeTypes = {').replace('const nodeTypes = {', ''),
  /^\s{2}([A-Za-z]+):\s*markRaw/gm
)

assert.ok(registeredTypes.length > 0, 'Canvas.vue 必须注册节点组件')

// The reported bug: videoBatch could only appear from a template, never by hand.
assert.ok(
  toolIds.includes('videoBatch'),
  'videoBatch 必须出现在画布工具栏，否则用户手动加不出批量视频结果节点'
)
assert.ok(
  menuTypes.includes('videoBatch'),
  'videoBatch 必须出现在节点类型菜单，否则用户手动加不出批量视频结果节点'
)

// Drift guards for the hand-maintained duplicate lists (no unified registry yet).
const editorActions = toolIds.filter((id) => !['undo', 'redo'].includes(id))
for (const id of editorActions) {
  assert.ok(menuTypes.includes(id), `工具栏项 ${id} 在节点类型菜单里缺失，两份清单已经漂移`)
}
for (const type of menuTypes) {
  assert.ok(registeredTypes.includes(type), `节点类型菜单项 ${type} 没有注册组件，点击会渲染空节点`)
}

assert.deepEqual(
  NODE_FOOTPRINTS.videoBatch,
  { width: 520, height: 560 },
  'videoBatch 需要真实尺寸，否则自动排布会让它压住相邻节点'
)

console.log('canvasNodeRegistry.test.mjs passed')
