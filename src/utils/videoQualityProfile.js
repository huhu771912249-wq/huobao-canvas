import { isPortraitRatio } from './videoAspectRatio.js'

const normalizeMode = mode => {
  const normalized = String(mode ?? '').trim().toLowerCase()
  return ['fast', 'auto', 'quality'].includes(normalized) ? normalized : 'quality'
}

export const getVideoQualityProfile = (mode = 'quality', aspectRatio = '16:9') => {
  const normalizedMode = normalizeMode(mode)
  const portrait = isPortraitRatio(aspectRatio)

  return {
    mode: normalizedMode,
    width: portrait ? 1080 : 1920,
    height: portrait ? 1920 : 1080,
    upscaler: normalizedMode === 'fast' ? null : 'seedvr2-3b-fp16',
    label: normalizedMode === 'quality' ? '高质量 1080p' : normalizedMode === 'auto' ? '智能判断' : '快速导出'
  }
}
