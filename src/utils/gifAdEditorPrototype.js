export const GIF_OUTPUT_PRESETS = {
  vertical: { width: 720, height: 1280, label: '720 × 1280', scene: '常用竖版' },
  story: { width: 1080, height: 1920, label: '1080 × 1920', scene: 'Reels / Story' },
  square: { width: 1080, height: 1080, label: '1080 × 1080', scene: '社媒方图' },
  landscape: { width: 1280, height: 720, label: '1280 × 720', scene: '横版广告' }
}

export const detectEditorMediaKind = (file = {}) => {
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif'
  if (type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(name)) return 'video'
  if (type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name)) return 'image'
  return 'unknown'
}

export const clampCornerRadius = value => Math.min(50, Math.max(0, Number(value) || 0))

export const formatTimelineTime = value => {
  const total = Math.max(0, Number(value) || 0)
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

export const calculateTimelineDuration = clips => Math.max(
  1,
  (Array.isArray(clips) ? clips : []).reduce((total, clip) => total + Math.max(0, Number(clip?.duration) || 0), 0)
)

export const timelineRangeStyle = (start, end, duration) => {
  const safeDuration = Math.max(1, Number(duration) || 1)
  const left = Math.min(safeDuration, Math.max(0, Number(start) || 0))
  const right = Math.min(safeDuration, Math.max(left + 0.1, Number(end) || safeDuration))
  return { left: `${left / safeDuration * 100}%`, width: `${(right - left) / safeDuration * 100}%` }
}
