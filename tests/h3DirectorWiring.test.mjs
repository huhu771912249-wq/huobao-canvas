import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { H3_DIRECTOR_MODEL, H3_DIRECTOR_SYSTEM_PROMPT } from '../src/config/h3DirectorPrompt.js'
import { buildH3DirectorWorkflow } from '../src/utils/h3DirectorWorkflow.js'
import { buildFallbackH3DirectorPlan } from '../src/utils/h3DirectorPlan.js'

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
assert.match(orchestrator, /getMaterialApiBase/)
assert.match(orchestrator, /endpoint:\s*['"]\/v1\/chat\/completions['"]/)
assert.match(orchestrator, /parseDirectorResponse/)
assert.doesNotMatch(orchestrator, /model:\s*['"]gpt-4o['"]/) 

const directFlow = buildH3DirectorWorkflow(buildFallbackH3DirectorPlan('雨夜重庆街道，出租车驶过'), { x: 100, y: 200 }, true)
const directConfig = directFlow.nodes.find(node => node.type === 'videoConfig')
assert.equal(directConfig.data.model, 'minimax-h3')
assert.equal(directConfig.data.ratio, '16:9')
assert.equal(directConfig.data.dur, 5)
assert.equal(directConfig.data.qualityMode, 'quality')
assert.equal(directConfig.data.autoExecute, true)
assert.ok(directFlow.edges.some(edge => edge.targetKey === directConfig.key && edge.type === 'promptOrder'))

const keyframePlan = { ...buildFallbackH3DirectorPlan('同一个女主角展示新产品'), requires_keyframe: true }
const keyframeFlow = buildH3DirectorWorkflow(keyframePlan, { x: 0, y: 0 }, true)
const imageConfig = keyframeFlow.nodes.find(node => node.type === 'imageConfig')
const imageOutput = keyframeFlow.nodes.find(node => node.type === 'image')
const keyframeVideo = keyframeFlow.nodes.find(node => node.type === 'videoConfig')
assert.equal(imageConfig.data.autoExecute, true)
assert.equal(keyframeVideo.data.autoExecute, false)
assert.ok(keyframeFlow.edges.some(edge => edge.sourceKey === imageOutput.key && edge.targetKey === keyframeVideo.key && edge.type === 'imageRole'))
assert.match(orchestrator, /executeH3Video/)

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
for (const copy of ['冠希 H3 导演', '景别与镜头', '地点与布景', '动作时间线', '声音设计', '只应用到画布', '生成 H3 视频', '本地 Gemma', '专业规则补全']) {
  assert.match(canvas, new RegExp(copy))
}
assert.match(canvas, /directorPlan/)
assert.match(canvas, /executeWorkflow\(directorPlan\.value/)
assert.doesNotMatch(canvas, /使用默认文生图工作流/)
assert.doesNotMatch(canvas, /gpt-4o-mini/)

const videoConfig = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
const multiView = readFileSync(new URL('../src/components/video/MultiViewReferencePanel.vue', import.meta.url), 'utf8')
const directorEditor = readFileSync(new URL('../src/components/video/H3DirectorPromptEditor.vue', import.meta.url), 'utf8')
assert.match(videoConfig, /:source-image="connectedFirstFrameSource"/)
assert.match(videoConfig, /:source-prompt="connectedPrompt"/)
assert.match(multiView, /watch\(\(\) => props\.sourceImage/)
assert.match(directorEditor, /AI 生成六段式 H3 导演提示词/)
assert.match(directorEditor, /没有参考图也可以直接生成文生视频/)
assert.match(directorEditor, /streamChatCompletions/)
assert.match(directorEditor, /endpoint: '\/v1\/chat\/completions'/)
for (const field of ['subject_definitions', 'summary', 'retention_analysis', 'detailed_description', 'overall_soundscape', 'non_diegetic_music']) {
  assert.match(directorEditor, new RegExp(field))
}

console.log('h3DirectorWiring.test.mjs passed')
