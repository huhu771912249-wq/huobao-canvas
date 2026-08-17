import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIF_TEXT_STYLE_PRESETS,
  buildGifEditorTextTracks,
  createWatermarkEditorProjectForSource,
  createDefaultWatermarkEditorProject,
  isWatermarkEditorJobTerminal,
  restoreWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'

const project = createDefaultWatermarkEditorProject({ title: '品牌角标工程' })
assert.equal(project.title, '品牌角标工程')
assert.equal(project.clips.length, 0, '独立页不得伪造三段示例素材')
assert.equal(project.textTracks.length, 0)
assert.equal(project.watermarkLibrary.length, 0)

const linkedProject = createWatermarkEditorProjectForSource({
  title: '真实上游',
  url: '/public-assets/source.gif',
  mime: 'image/gif',
  label: '上游 GIF',
  duration: 6.4
})
assert.equal(linkedProject.clips.length, 1)
assert.equal(linkedProject.clips[0].url, '/public-assets/source.gif')
assert.equal(linkedProject.clips[0].kind, 'gif')
assert.equal(linkedProject.clips[0].duration, 6.4)

const sanitized = sanitizeWatermarkEditorProject({
  ...project,
  imageTracks: [
    { id: 'saved', name: 'logo.png', url: '/public-assets/logo.png', saved: true },
    { id: 'temporary', name: 'draft.png', url: 'blob:http://localhost/draft', saved: true }
  ]
})
assert.equal(sanitized.imageTracks[0].url, '/public-assets/logo.png')
assert.equal(sanitized.imageTracks.length, 1, '不得持久化 blob 临时水印')
assert.equal(sanitizeWatermarkEditorProject({ clips: [{ name: '假素材.mp4' }] }).clips.length, 0)

const textOnlyTracks = buildGifEditorTextTracks([{
  text: '  真实静态文字  ',
  start: 0.5,
  end: 2.5,
  x: 45,
  y: 70,
  fontSize: 36,
  style: '字幕黑底'
}], 3)
assert.deepEqual(textOnlyTracks, [{
  text: '真实静态文字',
  start: 0.5,
  end: 2.5,
  x: 45,
  y: 70,
  font_size: 36,
  color: '#ffffff',
  stroke_color: '#111111',
  stroke_width: 0,
  background: true,
  background_color: '#000000',
  background_opacity: 0.72,
  align: 'center'
}])
assert.equal(Object.hasOwn(GIF_TEXT_STYLE_PRESETS, '品牌渐变'), false)
assert.throws(() => buildGifEditorTextTracks([{ text: '   ', start: 0, end: 1 }], 3), /文案不能为空/)
assert.throws(() => buildGifEditorTextTracks([{ text: '越界', start: 2, end: 4 }], 3), /时间范围无效/)
assert.throws(() => buildGifEditorTextTracks(
  Array.from({ length: 9 }, (_, index) => ({ text: `文字 ${index + 1}`, start: 0, end: 1 })),
  3
), /最多 8 条/)

const sanitizedTextProject = sanitizeWatermarkEditorProject({
  ...project,
  textTracks: Array.from({ length: 9 }, (_, index) => ({
    id: `legacy-${index}`,
    text: `旧文字 ${index + 1}`,
    start: 0,
    end: 2,
    x: 50,
    y: 50,
    fontSize: 32,
    style: '品牌渐变',
    effect: 'slide'
  }))
})
assert.equal(sanitizedTextProject.textTracks.length, 8)
assert.equal(sanitizedTextProject.textTracks[0].style, '爆款白字')
assert.equal(Object.hasOwn(sanitizedTextProject.textTracks[0], 'effect'), false)

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const node = readFileSync(new URL('../src/components/nodes/WatermarkEditorNode.vue', import.meta.url), 'utf8')
const exportNode = readFileSync(new URL('../src/components/nodes/MaterialExportNode.vue', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../src/views/GifAdEditor.vue', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')

const nodeSyncSource = node.match(
  /const resolveWatermarkNodeSync = ([\s\S]*?)\n\nwatch\(/
)?.[1] || ''
assert.ok(nodeSyncSource, '水印节点必须区分挂载同步和用户真实修改')
const { default: resolveWatermarkNodeSync } = await import(
  `data:text/javascript,${encodeURIComponent(`export default ${nodeSyncSource}`)}`
)
const completedNodeData = {
  sourceUrl: '/public-assets/source-b.gif',
  sourceMime: 'image/gif',
  editorProject: {
    clips: [{ url: '/public-assets/source-b.gif' }],
    result: {
      jobId: 'resize-completed',
      status: 'completed',
      progress: 100,
      outputUrl: '/public-assets/completed.gif',
      error: '',
      metadata: { watermarkApplied: true }
    }
  },
  editorStatus: 'completed',
  compositionReady: true,
  outputJobId: 'resize-completed',
  outputUrl: '/public-assets/completed.gif',
  outputMetadata: { watermarkApplied: true },
  url: '/public-assets/completed.gif',
  gifUrl: '/public-assets/completed.gif'
}
const currentNodeState = {
  quickSettings: { watermarkId: 'logo', position: 'custom', size: 22, opacity: 92 },
  sourceUrl: '/public-assets/source-b.gif',
  sourceMime: 'image/gif',
  sourceLabel: '上游 B'
}
const mountedCompleted = resolveWatermarkNodeSync({
  data: completedNodeData,
  current: currentNodeState,
  previous: null
})
const afterUnrelatedSave = resolveWatermarkNodeSync({
  data: { ...completedNodeData, ...mountedCompleted },
  current: currentNodeState,
  previous: { ...currentNodeState, sourceMime: '' }
})
for (const state of [mountedCompleted, afterUnrelatedSave]) {
  assert.equal(state.editorStatus, 'completed')
  assert.equal(state.compositionReady, true)
  assert.equal(state.outputJobId, 'resize-completed')
  assert.equal(state.outputUrl, '/public-assets/completed.gif')
  assert.equal(state.url, '/public-assets/completed.gif')
  assert.equal(state.gifUrl, '/public-assets/completed.gif')
}

const recoveredFromProjectResult = resolveWatermarkNodeSync({
  data: {
    ...completedNodeData,
    editorStatus: 'draft',
    compositionReady: false,
    outputJobId: '',
    outputUrl: '',
    outputMetadata: {},
    url: '',
    gifUrl: ''
  },
  current: currentNodeState,
  previous: null
})
assert.equal(recoveredFromProjectResult.compositionReady, true)
assert.equal(recoveredFromProjectResult.outputJobId, 'resize-completed')
assert.equal(recoveredFromProjectResult.outputUrl, '/public-assets/completed.gif')

const replacedUpstream = resolveWatermarkNodeSync({
  data: completedNodeData,
  current: { ...currentNodeState, sourceUrl: '/public-assets/source-c.gif' },
  previous: currentNodeState
})
assert.equal(replacedUpstream.compositionReady, false)
assert.equal(replacedUpstream.outputJobId, '')
assert.equal(replacedUpstream.outputUrl, '')
assert.equal(replacedUpstream.editorProject.result.status, '')

const changedWatermarkSettings = resolveWatermarkNodeSync({
  data: completedNodeData,
  current: {
    ...currentNodeState,
    quickSettings: { ...currentNodeState.quickSettings, position: 'center' }
  },
  previous: currentNodeState
})
assert.equal(changedWatermarkSettings.compositionReady, false)
assert.equal(changedWatermarkSettings.outputJobId, '')
assert.equal(changedWatermarkSettings.editorProject.result.status, '')

const upstreamA = createWatermarkEditorProjectForSource({
  title: 'A 工程',
  url: '/public-assets/upstream-a.gif',
  mime: 'image/gif',
  label: '上游 A'
})
upstreamA.result = {
  jobId: 'job-a',
  status: 'completed',
  progress: 100,
  outputUrl: '/public-assets/output-a.gif',
  error: '',
  metadata: { watermarkApplied: true }
}
const upstreamB = createWatermarkEditorProjectForSource({
  title: 'A 工程',
  url: '/public-assets/upstream-b.gif',
  mime: 'image/gif',
  label: '上游 B'
})
const reconciled = restoreWatermarkEditorProject({
  savedProject: upstreamA,
  sourceProject: upstreamB,
  nodeData: { sourceUrl: '/public-assets/upstream-b.gif', editorStatus: 'completed', compositionReady: true }
})
assert.equal(reconciled.sourceChanged, true)
assert.equal(reconciled.project.clips[0].url, '/public-assets/upstream-b.gif')
assert.deepEqual(reconciled.project.result, {
  jobId: '',
  status: '',
  progress: 0,
  outputUrl: '',
  error: '',
  metadata: {}
})

const completedProject = sanitizeWatermarkEditorProject({
  ...upstreamB,
  imageTracks: [{
    id: 'custom-watermark',
    name: 'logo.png',
    url: '/public-assets/logo.png',
    saved: true,
    start: 0,
    end: 3,
    x: 25,
    y: 75,
    size: 22,
    opacity: 92
  }],
  quickSettings: { watermarkId: 'custom-watermark', position: 'top-right', size: 22, opacity: 92 },
  result: {
    jobId: 'resize-completed',
    status: 'completed',
    progress: 100,
    outputUrl: '/public-assets/completed.gif',
    error: '',
    metadata: { watermarkApplied: true }
  }
})
const restoredCompleted = restoreWatermarkEditorProject({
  savedProject: completedProject,
  sourceProject: upstreamB,
  nodeData: {
    sourceUrl: '/public-assets/upstream-b.gif',
    quickSettings: completedProject.quickSettings,
    editorStatus: 'completed',
    compositionReady: true,
    outputJobId: 'resize-completed',
    outputUrl: '/public-assets/completed.gif',
    outputMetadata: { watermarkApplied: true }
  }
})
assert.equal(restoredCompleted.sourceChanged, false)
assert.equal(restoredCompleted.compositionReady, true)
assert.equal(restoredCompleted.project.result.jobId, 'resize-completed')
assert.equal(restoredCompleted.project.result.outputUrl, '/public-assets/completed.gif')
assert.equal(restoredCompleted.project.result.status, 'completed')
assert.equal(isWatermarkEditorJobTerminal(restoredCompleted.project.result.status), true)
assert.deepEqual(
  { x: restoredCompleted.project.imageTracks[0].x, y: restoredCompleted.project.imageTracks[0].y },
  { x: 25, y: 75 }
)

assert.match(canvas, /watermarkEditor:\s*markRaw\(WatermarkEditorNode\)/)
assert.match(node, /水印与素材编辑/)
assert.match(node, /进入详情编辑/)
assert.match(node, /compositionReady/)
assert.match(node, /outputUrl/)
assert.match(node, /previousValues\?\.length === values\.length/)
assert.match(node, /Position\.Left/)
assert.match(node, /Position\.Right/)
assert.match(editor, /保存到水印库/)
assert.match(editor, /保存并返回画板/)
assert.match(editor, /watermarkLibrary/)
assert.match(editor, /createGifEditorJob/)
assert.match(editor, /getGifEditorJob/)
assert.match(editor, /暂无可编辑素材/)
assert.doesNotMatch(editor, /当前为交互原型/)
assert.doesNotMatch(editor, /下一阶段再接真实/)
assert.match(editor, /const compositionReady = Boolean/)
assert.match(editor, /outputJobId/)
assert.match(editor, /outputUrl/)
assert.match(editor, /outputMetadata/)
assert.match(editor, /uploadGifEditorAsset/)
assert.match(editor, /probeGifEditorMediaDuration/)
assert.match(editor, /startAssetDownload/)
assert.match(editor, /@click="downloadExportResult"/)
assert.doesNotMatch(editor, /:href="exportResultUrl"\s+download/)
assert.match(editor, /text_tracks/)
assert.doesNotMatch(editor, /弹入|淡入|上滑|品牌渐变/)
assert.match(editor, /实时进度/)
assert.match(editor, /restoreWatermarkEditorProject\(/)
assert.match(editor, /if \(sourceChanged\) persistLinkedProject\(\)/)
assert.match(editor, /await nextTick\(\)[\s\S]*linkedReady\.value = true/)
const mountedStart = editor.indexOf('onMounted(async')
const mountedEnd = editor.indexOf('\nonBeforeUnmount(', mountedStart)
assert.ok(mountedStart >= 0 && mountedEnd > mountedStart)
assert.doesNotMatch(editor.slice(mountedStart, mountedEnd), /createGifEditorJob/)
assert.match(exportNode, /compositionReady/)
assert.match(exportNode, /outputJobId/)
assert.match(exportNode, /outputUrl/)
assert.match(home, /gifEditor/)
assert.match(entries, /flow:\s*'gifEditor'/)

const apiSource = readFileSync(new URL('../src/api/gifEditor.js', import.meta.url), 'utf8')
  .replace(/^import request from ['"][^'"]+['"]\s*/m, 'const request = globalThis.__gifEditorRequestSpy\n')
  .replace(
    /^import \{ buildGifEditorTextTracks \} from ['"][^'"]+['"]\s*/m,
    'const buildGifEditorTextTracks = globalThis.__buildGifEditorTextTracks\n'
  )
const apiCalls = []
globalThis.__buildGifEditorTextTracks = buildGifEditorTextTracks
globalThis.__gifEditorRequestSpy = config => {
  apiCalls.push(config)
  return Promise.resolve(config)
}
const gifEditorApi = await import(`data:text/javascript,${encodeURIComponent(apiSource)}#${Date.now()}`)
const twoSecondGif = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0,
  33, 249, 4, 0, 100, 0, 0, 0,
  44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0,
  33, 249, 4, 0, 100, 0, 0, 0,
  44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0,
  59
])
assert.equal(gifEditorApi.getGifDurationFromBytes(twoSecondGif), 2)
assert.equal(await gifEditorApi.probeGifEditorMediaDuration({
  name: 'source.gif',
  type: 'image/gif',
  arrayBuffer: async () => twoSecondGif.buffer
}), 2)
assert.equal(gifEditorApi.getGifEditorJobDuration({ results: [{ duration: 2.25 }] }), 2.25)
assert.deepEqual(gifEditorApi.buildGifEditorJobPayload({
  source_url: '/public-assets/source.gif',
  text_tracks: [{ text: '纯文字导出', start: 0, end: 2, x: 50, y: 50, fontSize: 32, style: '高亮黄字' }],
  duration: 2,
  output: { width: 720, height: 1280 }
}), {
  source_url: '/public-assets/source.gif',
  text_tracks: [{
    text: '纯文字导出', start: 0, end: 2, x: 50, y: 50, font_size: 32,
    color: '#fde047', stroke_color: '#111111', stroke_width: 3,
    background: false, background_color: '#000000', background_opacity: 0, align: 'center'
  }],
  output: { width: 720, height: 1280 }
})
assert.throws(() => gifEditorApi.buildGifEditorJobPayload({
  source_url: '/public-assets/source.gif', text_tracks: [], duration: 2, output: {}
}), /至少添加一条文字或一张图片水印/)
await gifEditorApi.uploadGifEditorAsset('data:image/png;base64,AAAA')
await gifEditorApi.uploadGifEditorMedia({ source_name: 'source.gif', source_base64: 'AAAA' })
await gifEditorApi.createGifEditorJob({ source_url: reconciled.project.clips[0].url })
await gifEditorApi.getGifEditorJob('job /1')
assert.deepEqual(apiCalls, [
  { url: '/v1/assets/images', method: 'post', data: { image: 'data:image/png;base64,AAAA' } },
  { url: '/v1/material-inputs', method: 'post', data: { source_name: 'source.gif', source_base64: 'AAAA' }, timeout: 15 * 60 * 1000 },
  { url: '/v1/media/gif-watermarks', method: 'post', data: { source_url: '/public-assets/upstream-b.gif' } },
  { url: '/v1/video-resize/jobs/job%20%2F1', method: 'get' }
])
assert.throws(() => gifEditorApi.getGifEditorJob(''), /jobId is required/)
delete globalThis.__gifEditorRequestSpy
delete globalThis.__buildGifEditorTextTracks

console.log('watermarkEditorWorkflow.test.mjs passed')
