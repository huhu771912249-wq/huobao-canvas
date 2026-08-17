import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIF_TEXT_STYLE_PRESETS,
  buildGifEditorTextTracks,
  createGifEditorTrackTimeDraftStore,
  createWatermarkEditorProjectForSource,
  createDefaultWatermarkEditorProject,
  formatGifEditorTrackTime,
  isGifEditorTrackActive,
  isWatermarkEditorJobTerminal,
  normalizeGifEditorTrackRange,
  restoreWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'
import { timelineRangeStyle } from '../src/utils/gifAdEditorPrototype.js'

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

for (const invalidTime of ['', Number.NaN, undefined]) {
  assert.doesNotThrow(() => formatGifEditorTrackTime(invalidTime))
  assert.equal(formatGifEditorTrackTime(invalidTime), '—')
  assert.doesNotThrow(() => isGifEditorTrackActive({ start: invalidTime, end: '' }, 0.5, 2))
  const safeRange = normalizeGifEditorTrackRange({ start: invalidTime, end: '' }, 2)
  const rangeStyle = timelineRangeStyle(safeRange.start, safeRange.end, 2)
  assert.doesNotMatch(`${rangeStyle.left} ${rangeStyle.width}`, /NaN|Infinity/)
}
assert.equal(formatGifEditorTrackTime('0.3'), '0.3')
assert.deepEqual(normalizeGifEditorTrackRange({ start: 0, end: 2 }, 2, { start: '' }), { start: 0, end: 2 })
assert.deepEqual(normalizeGifEditorTrackRange({ start: 0, end: 2 }, 2, { start: '0.3' }), { start: 0.3, end: 2 })
assert.deepEqual(normalizeGifEditorTrackRange({ start: 0.3, end: 2 }, 2, { start: Number.NaN }), { start: 0.3, end: 2 })
assert.deepEqual(normalizeGifEditorTrackRange({ start: 0.3, end: 2 }, 2, { end: '' }), { start: 0.3, end: 2 })
assert.deepEqual(normalizeGifEditorTrackRange({ start: 0, end: 2 }, 2, { end: 8 }), { start: 0, end: 2 })
const reversedStartRange = normalizeGifEditorTrackRange({ start: 0, end: 2 }, 2, { start: 2 })
assert.ok(reversedStartRange.start >= 0 && reversedStartRange.start < reversedStartRange.end && reversedStartRange.end <= 2)
const reversedEndRange = normalizeGifEditorTrackRange({ start: 1.5, end: 2 }, 2, { end: 1 })
assert.ok(reversedEndRange.start >= 0 && reversedEndRange.start < reversedEndRange.end && reversedEndRange.end <= 2)
const tinyLegacyRange = normalizeGifEditorTrackRange({ start: 0, end: 0.0001 }, 2)
assert.ok(tinyLegacyRange.start >= 0 && tinyLegacyRange.start < tinyLegacyRange.end && tinyLegacyRange.end <= 2)

const sanitizedTrackTimes = sanitizeWatermarkEditorProject({
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  textTracks: [{ id: 'text-time', text: '小数时间', start: '0.3', end: '' }],
  imageTracks: [{ id: 'image-time', name: 'logo', url: '/public-assets/logo.png', start: Number.NaN, end: 8 }]
})
assert.deepEqual(
  { start: sanitizedTrackTimes.textTracks[0].start, end: sanitizedTrackTimes.textTracks[0].end },
  { start: 0.3, end: 2 },
  '文字轨道持久化必须保留合法小数并清理空中间态'
)
assert.deepEqual(
  { start: sanitizedTrackTimes.imageTracks[0].start, end: sanitizedTrackTimes.imageTracks[0].end },
  { start: 0, end: 2 },
  '图片轨道持久化必须清理 NaN 和超时长值'
)
assert.doesNotThrow(() => buildGifEditorTextTracks(sanitizedTrackTimes.textTracks, 2), '归一化后的文字轨道应可继续导出')

const sharedTextTrack = { id: 'shared-track', start: 0, end: 2 }
const sharedImageTrack = { id: 'shared-track', start: 1, end: 2 }
const timeDraftStore = createGifEditorTrackTimeDraftStore()
timeDraftStore.set('text', sharedTextTrack, 'start', '0.3')
timeDraftStore.set('image', sharedImageTrack, 'start', '1.2')
assert.equal(timeDraftStore.get('text', sharedTextTrack, 'start'), '0.3', '文字和图片同 ID 不得共用 draft')
assert.equal(timeDraftStore.get('image', sharedImageTrack, 'start'), '1.2', '图片轨道必须读取自己的 draft')
timeDraftStore.clearTrack('text', sharedTextTrack)
assert.equal(timeDraftStore.get('text', sharedTextTrack, 'start'), 0, '删除文字轨道应清理其 draft')
assert.equal(timeDraftStore.get('image', sharedImageTrack, 'start'), '1.2', '删除文字轨道不得清理同 ID 图片 draft')

const missingIdTrackA = { start: 0, end: 2 }
const missingIdTrackB = { start: 1, end: 2 }
timeDraftStore.set('text', missingIdTrackA, 'start', '0.4')
timeDraftStore.set('text', missingIdTrackB, 'start', '1.4')
assert.equal(timeDraftStore.get('text', missingIdTrackA, 'start'), '0.4', '缺 ID 轨道不得坍缩到共享 key')
assert.equal(timeDraftStore.get('text', missingIdTrackB, 'start'), '1.4')

const switchTrackA = { id: 'switch-a', start: 0, end: 2 }
const switchTrackB = { id: 'switch-b', start: 1, end: 2 }
timeDraftStore.set('text', switchTrackA, 'start', '0.3')
assert.equal(timeDraftStore.get('text', switchTrackB, 'start'), 1, '切到 B 不得显示 A draft')
timeDraftStore.set('text', switchTrackB, 'start', '1.3')
assert.equal(timeDraftStore.get('text', switchTrackA, 'start'), '0.3', '回到 A 应继续显示 A 未提交 draft')

timeDraftStore.clearAll()
const restoredOwnTrack = { id: 'shared-track', start: 1, end: 2 }
assert.equal(timeDraftStore.get('image', restoredOwnTrack, 'start'), 1, '恢复工程后必须显示新轨道自有值')
assert.deepEqual(
  normalizeGifEditorTrackRange(restoredOwnTrack, 2, { start: timeDraftStore.get('image', restoredOwnTrack, 'start') }),
  { start: 1, end: 2 },
  '恢复工程后失焦提交仍应保留自有 start=1'
)

const legacyTracksWithoutIds = {
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  textTracks: [
    { text: '旧文字', start: 0, end: 2 },
    { text: '第二条旧文字', start: 1, end: 2 }
  ],
  imageTracks: [{ name: '旧图片', url: '/public-assets/logo.png', start: 1, end: 2 }]
}
const firstLegacySanitize = sanitizeWatermarkEditorProject(legacyTracksWithoutIds)
const secondLegacySanitize = sanitizeWatermarkEditorProject(legacyTracksWithoutIds)
assert.match(firstLegacySanitize.textTracks[0].id, /^legacy-text-/)
assert.match(firstLegacySanitize.imageTracks[0].id, /^legacy-image-/)
assert.notEqual(firstLegacySanitize.textTracks[0].id, firstLegacySanitize.imageTracks[0].id)
assert.notEqual(firstLegacySanitize.textTracks[0].id, firstLegacySanitize.textTracks[1].id, '缺 ID 同类轨道必须获得唯一 ID')
assert.equal(firstLegacySanitize.textTracks[0].id, secondLegacySanitize.textTracks[0].id, '旧文字轨道 ID 必须稳定')
assert.equal(firstLegacySanitize.imageTracks[0].id, secondLegacySanitize.imageTracks[0].id, '旧图片轨道 ID 必须稳定')

const reservedReferenceProject = {
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  imageTracks: [
    { name: 'missing-first', url: '/public-assets/missing-first.png', start: 0, end: 2 },
    { id: 'legacy-image-1', name: 'referenced-logo', url: '/public-assets/referenced-logo.png', start: 0, end: 2 }
  ],
  quickSettings: { watermarkId: 'legacy-image-1' }
}
const sanitizedReservedReference = sanitizeWatermarkEditorProject(reservedReferenceProject)
assert.equal(sanitizedReservedReference.imageTracks[1].id, 'legacy-image-1', '后续显式 ID 必须优先保留')
assert.equal(
  sanitizedReservedReference.imageTracks.find(item => item.id === sanitizedReservedReference.quickSettings.watermarkId)?.name,
  'referenced-logo',
  'quickSettings 引用必须继续指向原显式目标'
)
assert.notEqual(sanitizedReservedReference.imageTracks[0].id, 'legacy-image-1', '缺 ID 轨道不得抢占预留 ID')

const allReservedIdsProject = {
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  imageTracks: [
    { name: 'missing-one', url: '/public-assets/missing-one.png' },
    { name: 'missing-two', url: '/public-assets/missing-two.png' },
    { id: 'legacy-image-1', name: 'reserved-one', url: '/public-assets/reserved-one.png' },
    { id: 'legacy-image-2', name: 'reserved-two', url: '/public-assets/reserved-two.png' },
    { id: 'legacy-image-1-2', name: 'reserved-derived', url: '/public-assets/reserved-derived.png' }
  ]
}
const sanitizedAllReservedIds = sanitizeWatermarkEditorProject(allReservedIdsProject)
assert.deepEqual(
  sanitizedAllReservedIds.imageTracks.slice(0, 2).map(item => item.id),
  ['legacy-image-1-3', 'legacy-image-2-2'],
  '多个缺 ID 轨道补位时必须跳过全部显式预留 ID'
)
assert.deepEqual(
  sanitizedAllReservedIds.imageTracks.slice(2).map(item => item.id),
  ['legacy-image-1', 'legacy-image-2', 'legacy-image-1-2'],
  '显式 ID 不得因前置补位而漂移'
)

const duplicateExplicitProject = {
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  imageTracks: [
    { id: 'duplicate-logo', name: 'first-owner', url: '/public-assets/first-owner.png' },
    { id: 'duplicate-logo', name: 'duplicate-owner', url: '/public-assets/duplicate-owner.png' },
    { id: 'duplicate-logo-2', name: 'reserved-suffix', url: '/public-assets/reserved-suffix.png' }
  ],
  quickSettings: { watermarkId: 'duplicate-logo' }
}
const sanitizedDuplicates = sanitizeWatermarkEditorProject(duplicateExplicitProject)
assert.deepEqual(
  sanitizedDuplicates.imageTracks.map(item => item.id),
  ['duplicate-logo', 'duplicate-logo-3', 'duplicate-logo-2'],
  '重复显式 ID 仅第一合法拥有者保留，后续获得稳定非冲突派生 ID'
)
assert.equal(
  sanitizedDuplicates.imageTracks.find(item => item.id === sanitizedDuplicates.quickSettings.watermarkId)?.name,
  'first-owner',
  '重复 ID 的既有引用语义必须保持指向第一合法拥有者'
)

const typedReservedIds = sanitizeWatermarkEditorProject({
  clips: [{ url: '/public-assets/source.mp4', duration: 2 }],
  textTracks: [
    { text: 'missing text' },
    { id: 'legacy-text-1', text: 'explicit text' },
    { id: 'shared-explicit', text: 'shared text' }
  ],
  imageTracks: [
    { name: 'missing image', url: '/public-assets/missing-image.png' },
    { id: 'legacy-image-1', name: 'explicit image', url: '/public-assets/explicit-image.png' },
    { id: 'shared-explicit', name: 'shared image', url: '/public-assets/shared-image.png' }
  ],
  quickSettings: { watermarkId: 'shared-explicit' }
})
assert.equal(typedReservedIds.textTracks[1].id, 'legacy-text-1', '文字轨道必须独立预留显式 ID')
assert.equal(typedReservedIds.imageTracks[1].id, 'legacy-image-1', '图片轨道必须独立预留显式 ID')
assert.equal(typedReservedIds.textTracks[2].id, 'shared-explicit', '同一显式 ID 可分别存在于文字类型')
assert.equal(typedReservedIds.imageTracks[2].id, 'shared-explicit', '同一显式 ID 可分别存在于图片类型')
assert.equal(
  typedReservedIds.imageTracks.find(item => item.id === typedReservedIds.quickSettings.watermarkId)?.name,
  'shared image',
  '跨类型同 ID 不得破坏图片 quickSettings 引用'
)

const sanitizedDuplicatesTwice = sanitizeWatermarkEditorProject(sanitizedDuplicates)
assert.deepEqual(
  sanitizedDuplicatesTwice.imageTracks.map(item => item.id),
  sanitizedDuplicates.imageTracks.map(item => item.id),
  'sanitize(sanitize(project)) 的 ID 必须完全稳定'
)
assert.deepEqual(sanitizedDuplicatesTwice.quickSettings, sanitizedDuplicates.quickSettings)
const restoredStableIds = restoreWatermarkEditorProject({
  savedProject: sanitizedDuplicates,
  sourceProject: { clips: sanitizedDuplicates.clips },
  nodeData: { editorStatus: 'draft', quickSettings: sanitizedDuplicates.quickSettings }
}).project
const sanitizedAfterRestore = sanitizeWatermarkEditorProject(restoredStableIds)
assert.deepEqual(
  sanitizedAfterRestore.imageTracks.map(item => item.id),
  sanitizedDuplicates.imageTracks.map(item => item.id),
  'restore 后再次 sanitize 的 ID 不得漂移'
)
assert.deepEqual(sanitizedAfterRestore.quickSettings, sanitizedDuplicates.quickSettings, 'restore 后引用不得漂移')

const legacyRestoreDraftStore = createGifEditorTrackTimeDraftStore()
legacyRestoreDraftStore.set('text', legacyTracksWithoutIds.textTracks[0], 'start', '0.7')
legacyRestoreDraftStore.clearAll()
assert.equal(
  legacyRestoreDraftStore.get('text', firstLegacySanitize.textTracks[0], 'start'),
  0,
  '缺 ID 旧轨道恢复后不得继承恢复前 draft'
)

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

const normalizeTextTracksAppliedSource = editor.match(
  /const normalizeTextTracksApplied = ([\s\S]*?)\nconst completeExport/
)?.[1] || ''
assert.ok(normalizeTextTracksAppliedSource, '完成态必须按本次提交的文字轨道数校验后端结果')
const { default: normalizeTextTracksApplied } = await import(
  `data:text/javascript,${encodeURIComponent(`export default ${normalizeTextTracksAppliedSource}`)}`
)
assert.equal(normalizeTextTracksApplied(1, 1), 1)
assert.equal(normalizeTextTracksApplied(2, 2), 2)
assert.throws(() => normalizeTextTracksApplied(1, 2), /文字轨道实际合成数量不足/)
assert.equal(normalizeTextTracksApplied(undefined, 0), 0, '无文字任务不应要求返回应用数量')

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
assert.doesNotMatch(editor, /item\.(?:start|end)\.toFixed\(/, '模板不得直接格式化未验证的轨道时间')
assert.doesNotMatch(editor, /v-model\.number="selected(?:Text|Image)\.(?:start|end)"/, '时间输入中间态不得直接写入自动保存对象')
assert.match(editor, /trackTimeDrafts/)
assert.match(editor, /commitTrackTimeInput/)
assert.match(editor, /trackTimeDrafts\.clearAll\(\)[\s\S]*?sanitizeWatermarkEditorProject\(value\)/, '恢复工程前必须清空所有 draft')
assert.match(editor, /trackTimeDrafts\.clearTrack\(selectedType\.value, selectedItem\.value\)/, '删除轨道必须定向清理 draft')
assert.match(editor, /safeTimelineRangeStyle/)
const editorAutoSaveWatch = editor.match(
  /watch\(\s*\[clips, textTracks, imageTracks,[\s\S]*?\{ deep: true \}\s*\)/
)?.[0] || ''
assert.ok(editorAutoSaveWatch, '必须保留编辑工程自动保存')
assert.doesNotMatch(editorAutoSaveWatch, /trackTimeDrafts/, '输入中间态不得触发工程自动保存')
assert.match(editor, /const normalizedTextTracks = textTracks\.value\.map\(item => \(\{ \.\.\.item, \.\.\.normalizedTrackRange\(item\) \}\)\)/)
assert.match(editor, /const watermarkRange = watermark \? normalizedTrackRange\(watermark\) : null/)
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
