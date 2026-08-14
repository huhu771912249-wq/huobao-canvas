const safeAssetUrl = value => {
  const url = String(value || '').trim()
  return /^(?:https?:\/\/|\/public-assets\/)/i.test(url) ? url : ''
}

const cloneList = value => Array.isArray(value) ? value.map(item => ({ ...item })) : []
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, finiteNumber(value, fallback)))

const sourceKind = (url, mime) => (
  String(mime || '').toLowerCase() === 'image/gif' || /\.gif(?:$|\?)/i.test(url) ? 'gif' : 'video'
)

export const createDefaultWatermarkEditorProject = ({ title = 'GIF 水印工程' } = {}) => ({
  version: 2,
  title,
  clips: [],
  textTracks: [],
  imageTracks: [],
  watermarkLibrary: [],
  output: { presetKey: 'vertical', cornerRadius: 0, fps: 12, colors: 128, loop: 'forever' },
  quickSettings: { watermarkId: '', position: 'top-right', size: 22, opacity: 92 },
  result: { jobId: '', status: '', progress: 0, outputUrl: '', error: '', metadata: {} }
})

export const createWatermarkEditorProjectForSource = ({
  title,
  url,
  mime,
  label,
  duration,
  width,
  height
} = {}) => {
  const project = createDefaultWatermarkEditorProject({ title })
  const sourceUrl = safeAssetUrl(url)
  if (!sourceUrl) return project
  project.clips = [{
    id: 'source-clip',
    name: String(label || sourceUrl.split('/').pop() || '上游素材').slice(0, 120),
    kind: sourceKind(sourceUrl, mime),
    duration: clamp(duration, 0.1, 3600, 3),
    transition: '无',
    url: sourceUrl,
    mime: String(mime || ''),
    width: Math.max(0, Math.round(finiteNumber(width, 0))),
    height: Math.max(0, Math.round(finiteNumber(height, 0)))
  }]
  return project
}

export const sanitizeWatermarkEditorProject = value => {
  const fallback = createDefaultWatermarkEditorProject({ title: value?.title })
  const clips = cloneList(value?.clips)
    .map(clip => ({
      ...clip,
      url: safeAssetUrl(clip.url),
      kind: sourceKind(clip.url, clip.mime),
      duration: clamp(clip.duration, 0.1, 3600, 3)
    }))
    .filter(clip => clip.url)
    .slice(0, 1)
  const imageTracks = cloneList(value?.imageTracks).map(item => ({
    ...item,
    url: safeAssetUrl(item.url),
    start: clamp(item.start, 0, 3600, 0),
    end: clamp(item.end, 0.1, 3600, 3),
    size: clamp(item.size, 1, 100, 22),
    opacity: clamp(item.opacity, 0, 100, 100),
    x: clamp(item.x, 0, 100, 82),
    y: clamp(item.y, 0, 100, 12)
  })).filter(item => item.url)
  const watermarkLibrary = imageTracks
    .filter(item => item.saved)
    .map(item => ({ id: item.id, name: item.name, kind: 'image', url: item.url }))
  const result = value?.result || {}

  return {
    version: 2,
    title: String(value?.title || fallback.title).slice(0, 80),
    clips,
    textTracks: cloneList(value?.textTracks),
    imageTracks,
    watermarkLibrary,
    output: {
      ...fallback.output,
      ...(value?.output || {}),
      cornerRadius: clamp(value?.output?.cornerRadius, 0, 50, fallback.output.cornerRadius),
      fps: clamp(value?.output?.fps, 1, 60, fallback.output.fps),
      colors: clamp(value?.output?.colors, 2, 256, fallback.output.colors)
    },
    quickSettings: { ...fallback.quickSettings, ...(value?.quickSettings || {}) },
    result: {
      jobId: String(result.jobId || ''),
      status: String(result.status || ''),
      progress: clamp(result.progress, 0, 100, 0),
      outputUrl: safeAssetUrl(result.outputUrl),
      error: String(result.error || '').slice(0, 500),
      metadata: result.metadata && typeof result.metadata === 'object' ? { ...result.metadata } : {}
    }
  }
}

const emptyEditorResult = () => ({
  jobId: '', status: '', progress: 0, outputUrl: '', error: '', metadata: {}
})

const quickSettingPositions = {
  'top-left': [18, 12],
  'top-right': [82, 12],
  'bottom-left': [18, 88],
  'bottom-right': [82, 88],
  center: [50, 50]
}

const mergeNodeQuickSettings = (project, nodeQuickSettings) => {
  const incoming = nodeQuickSettings && typeof nodeQuickSettings === 'object' ? nodeQuickSettings : {}
  const quickSettings = { ...project.quickSettings, ...incoming }
  const changedKeys = new Set(['watermarkId', 'position', 'size', 'opacity'].filter(key => (
    Object.prototype.hasOwnProperty.call(incoming, key)
    && incoming[key] !== project.quickSettings[key]
  )))
  if (!changedKeys.size) return { ...project, quickSettings }

  const coordinates = quickSettingPositions[quickSettings.position]
  return {
    ...project,
    quickSettings,
    imageTracks: project.imageTracks.map(item => item.id === quickSettings.watermarkId
      ? {
          ...item,
          ...(coordinates && (changedKeys.has('position') || changedKeys.has('watermarkId'))
            ? { x: coordinates[0], y: coordinates[1] }
            : {}),
          ...(changedKeys.has('size') || changedKeys.has('watermarkId')
            ? { size: Number(quickSettings.size || item.size || 22) }
            : {}),
          ...(changedKeys.has('opacity') || changedKeys.has('watermarkId')
            ? { opacity: Number(quickSettings.opacity ?? item.opacity ?? 92) }
            : {})
        }
      : item)
  }
}

export const restoreWatermarkEditorProject = ({ savedProject, sourceProject, nodeData = {} } = {}) => {
  const saved = sanitizeWatermarkEditorProject(savedProject)
  const currentSource = sanitizeWatermarkEditorProject(sourceProject)
  const savedSourceUrl = String(saved.clips[0]?.url || '')
  const currentSourceUrl = String(currentSource.clips[0]?.url || '')
  const sourceChanged = Boolean(savedSourceUrl && currentSourceUrl && savedSourceUrl !== currentSourceUrl)
  const sourceAligned = mergeNodeQuickSettings({
    ...saved,
    clips: sourceChanged || !saved.clips.length ? currentSource.clips : saved.clips,
    result: sourceChanged ? emptyEditorResult() : saved.result
  }, nodeData.quickSettings)
  const canRestoreResult = !sourceChanged && nodeData.editorStatus !== 'draft'
  const storedResult = canRestoreResult ? sourceAligned.result : emptyEditorResult()
  const result = {
    ...storedResult,
    jobId: canRestoreResult ? String(nodeData.outputJobId || storedResult.jobId || '') : '',
    status: canRestoreResult ? String(nodeData.editorStatus || storedResult.status || '') : '',
    outputUrl: canRestoreResult && nodeData.compositionReady
      ? String(nodeData.outputUrl || storedResult.outputUrl || '')
      : '',
    metadata: canRestoreResult && nodeData.compositionReady
      ? { ...(nodeData.outputMetadata || storedResult.metadata || {}) }
      : {}
  }
  const project = sanitizeWatermarkEditorProject({ ...sourceAligned, result })
  return {
    project,
    sourceChanged,
    compositionReady: Boolean(
      project.result.status === 'completed'
      && project.result.jobId
      && project.result.outputUrl
    )
  }
}

export const getWatermarkEditorSource = project => sanitizeWatermarkEditorProject(project).clips[0] || null

export const isWatermarkEditorJobTerminal = status => ['completed', 'failed', 'cancelled'].includes(String(status || '').toLowerCase())
