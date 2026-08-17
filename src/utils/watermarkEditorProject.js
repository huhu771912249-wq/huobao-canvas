const safeAssetUrl = value => {
  const url = String(value || '').trim()
  return /^(?:https?:\/\/|\/public-assets\/)/i.test(url) ? url : ''
}

const cloneList = value => Array.isArray(value) ? value.map(item => ({ ...item })) : []
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, finiteNumber(value, fallback)))
const finiteTrackTime = (value, fallback) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const clampTrackTime = (value, min, max, fallback) => Math.min(max, Math.max(min, finiteTrackTime(value, fallback)))
const roundTrackTime = value => Number(value.toFixed(3))

export const formatGifEditorTrackTime = value => {
  const time = finiteTrackTime(value, Number.NaN)
  return Number.isFinite(time) ? time.toFixed(1) : '—'
}

export const normalizeGifEditorTrackRange = (track = {}, sourceDuration, updates = {}) => {
  const duration = clampTrackTime(sourceDuration, 0.1, 3600, 3)
  const hasStartUpdate = Object.hasOwn(updates, 'start')
  const hasEndUpdate = Object.hasOwn(updates, 'end')
  const currentStart = clampTrackTime(track.start, 0, duration, 0)
  const currentEnd = clampTrackTime(track.end, 0, duration, duration)
  let start = clampTrackTime(hasStartUpdate ? updates.start : track.start, 0, duration, currentStart)
  let end = clampTrackTime(hasEndUpdate ? updates.end : track.end, 0, duration, currentEnd)
  const minimumGap = Math.min(0.1, duration)

  if (end - start < minimumGap) {
    if (hasStartUpdate && !hasEndUpdate) {
      start = Math.max(0, end - minimumGap)
    } else {
      end = Math.min(duration, start + minimumGap)
      if (end - start < minimumGap) {
        end = duration
        start = Math.max(0, end - minimumGap)
      }
    }
  }

  return { start: roundTrackTime(start), end: roundTrackTime(end) }
}

export const isGifEditorTrackActive = (track, playhead, sourceDuration) => {
  const currentTime = finiteTrackTime(playhead, -1)
  const range = normalizeGifEditorTrackRange(track, sourceDuration)
  return currentTime >= range.start && currentTime <= range.end
}

const sourceKind = (url, mime) => (
  String(mime || '').toLowerCase() === 'image/gif' || /\.gif(?:$|\?)/i.test(url) ? 'gif' : 'video'
)

export const GIF_TEXT_STYLE_PRESETS = Object.freeze({
  '爆款白字': Object.freeze({
    color: '#ffffff', strokeColor: '#111111', strokeWidth: 4,
    background: false, backgroundColor: '#000000', backgroundOpacity: 0
  }),
  '高亮黄字': Object.freeze({
    color: '#fde047', strokeColor: '#111111', strokeWidth: 3,
    background: false, backgroundColor: '#000000', backgroundOpacity: 0
  }),
  '字幕黑底': Object.freeze({
    color: '#ffffff', strokeColor: '#111111', strokeWidth: 0,
    background: true, backgroundColor: '#000000', backgroundOpacity: 0.72
  })
})

const DEFAULT_TEXT_STYLE = '爆款白字'

const sanitizeTextTracks = (value, sourceDuration) => cloneList(value).slice(0, 8).map(item => {
  const track = { ...item }
  const range = normalizeGifEditorTrackRange(item, sourceDuration)
  delete track.effect
  return {
    ...track,
    text: String(item.text || '').slice(0, 80),
    ...range,
    x: clamp(item.x, 0, 100, 50),
    y: clamp(item.y, 0, 100, 50),
    fontSize: clamp(item.fontSize, 8, 200, 32),
    style: Object.hasOwn(GIF_TEXT_STYLE_PRESETS, item.style) ? item.style : DEFAULT_TEXT_STYLE
  }
})

export const buildGifEditorTextTracks = (value, sourceDuration) => {
  const tracks = cloneList(value)
  if (tracks.length > 8) throw new TypeError('文字轨道最多 8 条')
  const duration = Number(sourceDuration)
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('源素材时长无效')

  return tracks.map((item, index) => {
    const text = String(item.text || '').trim()
    if (!text) throw new TypeError(`第 ${index + 1} 条文字文案不能为空`)
    const start = Number(item.start)
    const end = Number(item.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 0.001) {
      throw new TypeError(`第 ${index + 1} 条文字时间范围无效`)
    }
    const style = GIF_TEXT_STYLE_PRESETS[item.style] || GIF_TEXT_STYLE_PRESETS[DEFAULT_TEXT_STYLE]
    return {
      text,
      start,
      end,
      x: clamp(item.x, 0, 100, 50),
      y: clamp(item.y, 0, 100, 50),
      font_size: clamp(item.fontSize, 8, 200, 32),
      color: style.color,
      stroke_color: style.strokeColor,
      stroke_width: style.strokeWidth,
      background: style.background,
      background_color: style.backgroundColor,
      background_opacity: style.backgroundOpacity,
      align: 'center'
    }
  })
}

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
  const sourceDuration = clips.reduce((total, clip) => total + clip.duration, 0) || 3
  const imageTracks = cloneList(value?.imageTracks).map(item => {
    const range = normalizeGifEditorTrackRange(item, sourceDuration)
    return {
      ...item,
      url: safeAssetUrl(item.url),
      ...range,
      size: clamp(item.size, 1, 100, 22),
      opacity: clamp(item.opacity, 0, 100, 100),
      x: clamp(item.x, 0, 100, 82),
      y: clamp(item.y, 0, 100, 12)
    }
  }).filter(item => item.url)
  const textTracks = sanitizeTextTracks(value?.textTracks, sourceDuration)
  const watermarkLibrary = imageTracks
    .filter(item => item.saved)
    .map(item => ({ id: item.id, name: item.name, kind: 'image', url: item.url }))
  const result = value?.result || {}

  return {
    version: 2,
    title: String(value?.title || fallback.title).slice(0, 80),
    clips,
    textTracks,
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
