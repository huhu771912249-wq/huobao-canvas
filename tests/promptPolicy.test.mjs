import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')

const textNode = read('src/components/nodes/TextNode.vue')
const orchestrator = read('src/hooks/useWorkflowOrchestrator.js')
const workflows = read('src/config/workflows.js')

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
