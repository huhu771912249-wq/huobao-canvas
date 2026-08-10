const normalizeMode = mode => {
  const normalized = String(mode ?? '').trim().toLowerCase()
  return ['fast', 'auto', 'quality'].includes(normalized) ? normalized : 'quality'
}

const normalizeAspectRatio = aspectRatio => String(aspectRatio ?? '').trim() === '9:16' ? '9:16' : '16:9'

export const getVideoQualityProfile = (mode = 'quality', aspectRatio = '16:9') => {
  const normalizedMode = normalizeMode(mode)
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio)
  const portrait = normalizedAspectRatio === '9:16'

  return {
    mode: normalizedMode,
    width: portrait ? 1080 : 1920,
    height: portrait ? 1920 : 1080,
    upscaler: normalizedMode === 'fast' ? null : 'seedvr2-3b-fp16',
    label: normalizedMode === 'quality' ? '高质量 1080p' : normalizedMode === 'auto' ? '智能判断' : '快速导出'
  }
}
