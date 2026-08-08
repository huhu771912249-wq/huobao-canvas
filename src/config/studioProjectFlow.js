import { getVideoQualityProfile } from '../utils/videoQualityProfile.js'

const edge = (source, target, extra = {}) => ({
  id: `edge_${source}_${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  ...extra
})

const ratioForSize = (size) => {
  const [width, height] = String(size).toLowerCase().split('x').map(Number)
  return Number.isFinite(width) && Number.isFinite(height) && height > width ? '9:16' : '16:9'
}

export const getModelNativeVideoSize = (model = 'minimax-h3', ratio = '16:9') => {
  const portrait = ratio === '9:16'
  const landscape = model === 'ltx-2.3'
    ? { width: 512, height: 320 }
    : { width: 608, height: 352 }
  return portrait
    ? { width: landscape.height, height: landscape.width }
    : landscape
}

export const getAspectRatioForSize = (size) => {
  const [width, height] = String(size).toLowerCase().split('x').map(Number)
  return Number.isFinite(width) && Number.isFinite(height) && height > width ? '9:16' : '16:9'
}

export const buildQualityProfilesBySize = (sizes = [], mode = 'quality') => Object.fromEntries(
  (Array.isArray(sizes) ? sizes : []).map(size => {
    const ratio = getAspectRatioForSize(size)
    return [String(size), {
      quality_profile: getVideoQualityProfile(mode, ratio),
      image_alignment: getImageAlignmentSpec('minimax-h3', ratio)
    }]
  })
)

export const getImageAlignmentSpec = (model = 'minimax-h3', ratio = '16:9') => ({
  mode: 'crop_or_pad',
  ...getModelNativeVideoSize(model, ratio),
  preserve_aspect_ratio: true,
  allow_stretch: false
})

const positiveDimension = value => {
  const dimension = Number.parseInt(value, 10)
  return Number.isFinite(dimension) && dimension > 0 ? dimension : null
}

export const normalizeVideoQualityRequestProfile = (profile) => {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null
  const mode = profile.mode === 'fast' ? 'fast' : 'quality'
  const width = positiveDimension(profile.width)
  const height = positiveDimension(profile.height)
  if (!width || !height) return null
  return {
    mode,
    width,
    height,
    upscaler: mode === 'quality' && typeof profile.upscaler === 'string' ? profile.upscaler : null,
    label: String(profile.label || (mode === 'quality' ? '高质量 1080p' : '快速导出'))
  }
}

export const normalizeVideoImageAlignmentRequest = (alignment) => {
  if (!alignment || typeof alignment !== 'object' || Array.isArray(alignment)) return null
  const width = positiveDimension(alignment.width)
  const height = positiveDimension(alignment.height)
  if (!width || !height) return null
  return {
    mode: 'crop_or_pad',
    width,
    height,
    preserve_aspect_ratio: true,
    allow_stretch: false
  }
}

export const buildStudioCanvas = ({ mode, prompt = '', size = '1280x720', videoModel = 'minimax-h3', qualityMode = 'quality' }) => {
  const ratio = ratioForSize(size)
  const qualityProfile = getVideoQualityProfile(qualityMode, ratio)
  const imagePrompt = { id: 'studio_image_prompt', type: 'text', position: { x: 80, y: 140 }, data: { content: prompt, label: '画面提示词' } }
  const imageConfig = { id: 'studio_image_config', type: 'imageConfig', position: { x: 440, y: 140 }, data: { label: '文生图', model: 'frw-qianwen', size, qualityMode: qualityProfile.mode, qualityProfile } }
  const imageResult = { id: 'studio_image_result', type: 'image', position: { x: 800, y: 140 }, data: { url: '', label: '首帧结果' } }
  const imageEdges = [
    edge(imagePrompt.id, imageConfig.id, { type: 'promptOrder', data: { promptOrder: 1 } }),
    edge(imageConfig.id, imageResult.id)
  ]
  if (mode === 'text-to-image') return { nodes: [imagePrompt, imageConfig, imageResult], edges: imageEdges, viewport: { x: 60, y: 80, zoom: 0.78 } }

  const motionPrompt = { id: 'studio_motion_prompt', type: 'text', position: { x: 800, y: 430 }, data: { content: prompt, label: '动态与运镜提示词' } }
  const videoConfig = { id: 'studio_video_config', type: 'videoConfig', position: { x: 1160, y: 220 }, data: { label: '云端视频', mode: 'image_to_video', model: videoModel, ratio, dur: 5, targetResolution: '1080p', qualityMode: qualityProfile.mode, qualityProfile, imageAlignment: getImageAlignmentSpec(videoModel, ratio) } }
  const videoResult = { id: 'studio_video_result', type: 'video', position: { x: 1540, y: 220 }, data: { url: '', label: '视频结果', targetResolution: '1080p', actualResolution: null, qualityProfile } }
  return {
    nodes: [imagePrompt, imageConfig, imageResult, motionPrompt, videoConfig, videoResult],
    edges: [
      ...imageEdges,
      edge(imageResult.id, videoConfig.id, { type: 'imageRole', data: { imageRole: 'first_frame_image' } }),
      edge(motionPrompt.id, videoConfig.id, { type: 'promptOrder', data: { promptOrder: 1 } }),
      edge(videoConfig.id, videoResult.id)
    ],
    viewport: { x: 30, y: 60, zoom: 0.62 }
  }
}
