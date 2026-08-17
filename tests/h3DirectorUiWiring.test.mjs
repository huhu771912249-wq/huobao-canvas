import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compileH3DirectorPrompt, normalizeH3DirectorPrompt } from '../src/utils/h3DirectorPrompt.js'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const video = read('../src/components/nodes/VideoConfigNode.vue')
const editor = read('../src/components/video/H3DirectorPromptEditor.vue')
const multiView = read('../src/components/video/MultiViewReferencePanel.vue')
const dspH3 = read('../src/components/dsp/DspH3UpgradeCard.vue')

const editorStateHelpersSource = editor.match(
  /(const createH3DirectorEditorPlan = [\s\S]*?const buildH3DirectorEditorState = [\s\S]*?\n})\n\nconst props =/
)?.[1] || ''
assert.ok(editorStateHelpersSource, 'H3 editor must expose executable restore and atomic state helpers')
globalThis.__normalizeH3DirectorPrompt = normalizeH3DirectorPrompt
globalThis.__compileH3DirectorPrompt = compileH3DirectorPrompt
const { createH3DirectorEditorPlan, buildH3DirectorEditorState } = await import(
  `data:text/javascript,${encodeURIComponent(`
    const normalizeH3DirectorPrompt = globalThis.__normalizeH3DirectorPrompt
    const compileH3DirectorPrompt = globalThis.__compileH3DirectorPrompt
    ${editorStateHelpersSource}
    export { createH3DirectorEditorPlan, buildH3DirectorEditorState }
  `)}`
)

const savedDirectorPlan = normalizeH3DirectorPrompt({
  subject_definitions: 'QA-H3-ZOOM-KEEP 主体',
  summary: 'QA-H3-ZOOM-KEEP 摘要',
  dialogue: '保留台词',
  retention_analysis: { required: ['人物'], flexible: ['机位'] },
  detailed_description: [{ start: 0, end: 5, action: '展示产品', camera: '[Tracking shot]' }],
  overall_soundscape: '现场声',
  non_diegetic_music: '轻音乐'
})
const restoredEditorPlan = createH3DirectorEditorPlan(savedDirectorPlan, 5)
assert.equal(restoredEditorPlan.subject_definitions, savedDirectorPlan.subject_definitions, 'existing subject must render on remount')
assert.equal(restoredEditorPlan.summary, savedDirectorPlan.summary, 'existing summary must render on remount')
assert.equal(restoredEditorPlan.required, '人物')
assert.deepEqual(restoredEditorPlan.detailed_description, savedDirectorPlan.detailed_description)

const emptyEditorPlan = createH3DirectorEditorPlan(null, 5)
emptyEditorPlan.subject_definitions = '新主体'
emptyEditorPlan.summary = '新摘要'
const editedState = buildH3DirectorEditorState(emptyEditorPlan, [])
assert.equal(editedState.directorPlan.subject_definitions, '新主体')
assert.equal(editedState.directorPlan.summary, '新摘要')
assert.equal(editedState.compiledDirectorPrompt, compileH3DirectorPrompt(editedState.directorPlan), 'one editor state must contain the matching compiled prompt and plan')

const switchedEditorPlan = createH3DirectorEditorPlan({
  subject_definitions: '另一个节点主体',
  summary: '另一个节点摘要',
  retention_analysis: { required: [], flexible: [] },
  detailed_description: []
}, 3)
assert.equal(switchedEditorPlan.subject_definitions, '另一个节点主体')
assert.doesNotMatch(JSON.stringify(switchedEditorPlan), /QA-H3-ZOOM-KEEP/, 'restoring another node must not retain the previous plan')

const nodeStateControllerSource = video.match(
  /(const normalizeH3DirectorNodeState = [\s\S]*?const createH3DirectorNodeStateController = [\s\S]*?\n})\n\n\/\/ 使用 Pinia/
)?.[1] || ''
assert.ok(nodeStateControllerSource, 'video node must expose an executable atomic persistence controller')
const { createH3DirectorNodeStateController } = await import(
  `data:text/javascript,${encodeURIComponent(`${nodeStateControllerSource}\nexport { createH3DirectorNodeStateController }`)}`
)
let localDirectorState = null
const persistedDirectorStates = []
const directorStateController = createH3DirectorNodeStateController({
  setLocalState: state => { localDirectorState = state },
  persistState: state => persistedDirectorStates.push(state)
})
directorStateController.restore({})
assert.equal(persistedDirectorStates.length, 0, 'empty node mount must not persist defaults')
directorStateController.restore({
  directorPlan: savedDirectorPlan,
  compiledDirectorPrompt: compileH3DirectorPrompt(savedDirectorPlan)
})
assert.equal(persistedDirectorStates.length, 0, 'restoring an existing plan must not write an empty or duplicate state')
assert.equal(localDirectorState.directorPlan.subject_definitions, 'QA-H3-ZOOM-KEEP 主体')

directorStateController.handleEditorState(editedState)
assert.equal(persistedDirectorStates.length, 1, 'one user edit must persist exactly once')
assert.deepEqual(persistedDirectorStates[0], editedState, 'the single node update must contain both matching fields')
assert.deepEqual(localDirectorState, editedState)
const stateBeforeViewportUiChanges = structuredClone(localDirectorState)
assert.deepEqual(localDirectorState, stateBeforeViewportUiChanges, 'folding or zooming without an editor event must preserve director state')

directorStateController.restore(persistedDirectorStates[0])
assert.equal(persistedDirectorStates.length, 1, 'refresh restore must not emit a persistence loop')
assert.equal(localDirectorState.compiledDirectorPrompt, compileH3DirectorPrompt(localDirectorState.directorPlan))

assert.match(video, /H3DirectorPromptEditor/)
assert.match(video, /MultiViewReferencePanel/)
assert.match(video, /compiledDirectorPrompt/)
assert.match(video, /confirmedMultiViewReference/)
assert.match(video, /connectedH3Reference/)
assert.match(video, /activeH3References/)
assert.match(video, /bindH3ImagePrompt/)
assert.match(video, /directorPlan\.value && compiledDirectorPrompt\.value/)
assert.match(video, /:director-plan="directorPlan"/)
assert.match(video, /@update:state="handleDirectorStateUpdate"/)
assert.doesNotMatch(video, /window\.\$message\?\.error\(message \|\| '视频生成失败'\)/)
assert.match(editor, /subject_definitions/)
assert.match(editor, /detailed_description/)
assert.match(editor, /compileH3DirectorPrompt/)
assert.match(editor, /insertReference/)
assert.match(editor, /引用素材/)
assert.match(editor, /台词\/口播/)
assert.match(editor, /实际提交格式/)
assert.match(editor, /文生视频/)
assert.doesNotMatch(editor, /!references\.length \|\| aiLoading/)
assert.match(editor, /detailed_description: plan\.detailed_description\.filter/)
assert.match(editor, /directorPlan:\s*\{ type: Object/)
assert.match(editor, /defineEmits\(\['update:state'\]\)/)
assert.doesNotMatch(editor, /immediate:\s*true/, 'mounting must not emit an empty default plan')
assert.match(multiView, /generateImage/)
assert.match(multiView, /正面、侧面、背面、全身/)
assert.match(multiView, /确认作为 H3 参考/)
assert.match(dspH3, /VideoOutputSizePicker/)
assert.match(dspH3, /output_width/)
assert.match(dspH3, /output_height/)

console.log('h3DirectorUiWiring.test.mjs passed')
