import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')

const textNode = read('src/components/nodes/TextNode.vue')
const orchestrator = read('src/hooks/useWorkflowOrchestrator.js')
const workflows = read('src/config/workflows.js')

assert.match(orchestrator, /所有用户可见的字符串值必须使用简体中文/)
assert.match(orchestrator, /JSON 的键名保持现有英文协议/)
assert.match(orchestrator, /禁止输出整段英文提示词/)
for (const field of [
  'image_prompt',
  'video_prompt',
  'shots[].prompt',
  'multi_angle.character_description',
  'picture_book.pages[].illustration_prompt'
]) {
  assert.ok(orchestrator.includes(field), `中文输出协议缺少 ${field}`)
}

assert.doesNotMatch(workflows, /欧美人优先/)
for (const [name, source] of [
  ['TextNode', textNode],
  ['useWorkflowOrchestrator', orchestrator],
  ['workflows', workflows]
]) {
  assert.match(source, /中国人或东亚面孔/, `${name} 缺少东亚人物默认约束`)
  assert.match(source, /10%安全边距/, `${name} 缺少安全构图约束`)
}

console.log('promptPolicy.test.mjs passed')
