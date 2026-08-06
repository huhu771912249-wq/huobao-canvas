import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { H3_DIRECTOR_MODEL, H3_DIRECTOR_SYSTEM_PROMPT } from '../src/config/h3DirectorPrompt.js'

assert.equal(H3_DIRECTOR_MODEL, 'gemma4-31b-heretic')
for (const section of ['# Role', '# Profile', '# Goals', '# Constraints', '# Skills', '# Workflow', '# Examples', '# OutputFormat', '# Initialization']) {
  assert.match(H3_DIRECTOR_SYSTEM_PROMPT, new RegExp(section.replace('#', '\\#')))
}
assert.ok((H3_DIRECTOR_SYSTEM_PROMPT.match(/## Example/g) || []).length >= 3)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /单一连续镜头/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /1000/)

const orchestrator = readFileSync(new URL('../src/hooks/useWorkflowOrchestrator.js', import.meta.url), 'utf8')
assert.match(orchestrator, /H3_DIRECTOR_SYSTEM_PROMPT/)
assert.match(orchestrator, /H3_DIRECTOR_MODEL/)
assert.match(orchestrator, /parseDirectorResponse/)
assert.doesNotMatch(orchestrator, /model:\s*['"]gpt-4o['"]/)

console.log('h3DirectorWiring.test.mjs passed')
