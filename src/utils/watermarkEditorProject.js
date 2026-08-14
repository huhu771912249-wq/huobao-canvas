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

export const getWatermarkEditorSource = project => sanitizeWatermarkEditorProject(project).clips[0] || null

export const isWatermarkEditorJobTerminal = status => ['completed', 'failed', 'cancelled'].includes(String(status || '').toLowerCase())
