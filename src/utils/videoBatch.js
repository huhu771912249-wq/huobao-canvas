export const VIDEO_BATCH_SIZES = Object.freeze([
  '300x100',
  '300x250',
  '720x240',
  '200x200'
])

export const DEFAULT_VIDEO_BATCH_FORMATS = Object.freeze(['mp4', 'gif'])

const BATCH_MODELS = new Set(['scail2-action-transfer', 'frw-video'])

export const supportsVideoBatch = (model) => BATCH_MODELS.has(String(model || '').trim())

export const normalizeVideoBatchSizes = (sizes = []) => {
  const requested = new Set(Array.isArray(sizes) ? sizes : [])
  const normalized = VIDEO_BATCH_SIZES.filter(size => requested.has(size))
  return normalized.length > 0 ? normalized : [...VIDEO_BATCH_SIZES]
}

export const normalizeVideoBatchFormats = (formats = []) => {
  const requested = new Set(Array.isArray(formats) ? formats.map(value => String(value).toLowerCase()) : [])
  if (requested.size === 0) return [...DEFAULT_VIDEO_BATCH_FORMATS]
  return requested.has('gif') ? ['mp4', 'gif'] : ['mp4']
}

export const buildVideoBatchRetryUrl = (videoEndpoint, taskId) => {
  const endpoint = String(videoEndpoint || '/v1/video/generations').replace(/\/$/, '')
  const baseUrl = endpoint.replace(/\/(?:v1\/)?video\/generations$/, '')
  return `${baseUrl}/v1/video/batch/${encodeURIComponent(String(taskId || '').trim())}/retry`
}
