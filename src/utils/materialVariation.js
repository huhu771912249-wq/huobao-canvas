import { buildMaterialApiUrl } from './apiBase.js'

export const MATERIAL_VARIATION_API_BASE = buildMaterialApiUrl('/v1/material/variations')
export const MATERIAL_VARIATION_POLL_INTERVAL = 2000
export const DEFAULT_MATERIAL_VARIATION_COUNT = 10
export const MAX_MATERIAL_VARIATION_FILE_BYTES = 100 * 1024 * 1024

export const DEFAULT_MATERIAL_VARIATION_SIZES = Object.freeze([
  '300x100',
  '300x250',
  '720x240',
  '200x200'
])

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const QUALITY_MODES = new Set(['fast', 'high_quality'])
const VARIATION_STRENGTHS = new Set(['subtle', 'moderate', 'strong'])
const VARIATION_ACTIONS = new Set(['reverse', 'generate', 'compare_masters'])
const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed'])

const extensionOf = (name = '') => {
  const parts = String(name).toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

export const normalizeMaterialVariationCount = (value) => {
  const count = Number.parseInt(value, 10)
  if (!Number.isFinite(count)) return DEFAULT_MATERIAL_VARIATION_COUNT
  return Math.max(2, Math.min(20, count))
}

export const normalizeMaterialVariationSizes = (sizes = []) => {
  const requested = new Set(Array.isArray(sizes) ? sizes : [])
  const normalized = DEFAULT_MATERIAL_VARIATION_SIZES.filter((size) => requested.has(size))
  return normalized.length ? normalized : [...DEFAULT_MATERIAL_VARIATION_SIZES]
}

export const normalizeMaterialVariationQuality = (value) => (
  QUALITY_MODES.has(String(value || '')) ? String(value) : 'high_quality'
)

export const normalizeMaterialVariationStrength = (value) => (
  VARIATION_STRENGTHS.has(String(value || '')) ? String(value) : 'moderate'
)

export const validateMaterialVariationFile = (file) => {
  if (!file?.name) {
    return { valid: false, kind: '', message: '请选择单张图片或 ZIP' }
  }

  const size = Number(file.size || 0)
  if (size <= 0) {
    return { valid: false, kind: '', message: '文件为空，无法处理' }
  }
  if (size > MAX_MATERIAL_VARIATION_FILE_BYTES) {
    return { valid: false, kind: '', message: '文件不能超过 100MB' }
  }

  const extension = extensionOf(file.name)
  if (extension === 'zip') {
    return { valid: true, kind: 'zip', message: '' }
  }
  if (SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return { valid: true, kind: 'image', message: '' }
  }
  return { valid: false, kind: '', message: '仅支持 JPG、PNG、WebP 或 ZIP' }
}

export const readMaterialVariationFile = (file) => new Promise((resolve, reject) => {
  const validation = validateMaterialVariationFile(file)
  if (!validation.valid) {
    reject(new Error(validation.message))
    return
  }

  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('读取素材失败，请重新选择'))
  reader.readAsDataURL(file)
})

export const buildMaterialVariationPayload = ({
  fileName,
  fileData,
  sourceJobId,
  count,
  sizes,
  qualityMode,
  strength,
  action
}) => {
  const payload = {
    count: normalizeMaterialVariationCount(count),
    sizes: normalizeMaterialVariationSizes(sizes),
    quality_mode: normalizeMaterialVariationQuality(qualityMode),
    strength: normalizeMaterialVariationStrength(strength),
    action: VARIATION_ACTIONS.has(action) ? action : 'generate'
  }
  const normalizedFileData = String(fileData || '')
  if (normalizedFileData) {
    payload.file_name = String(fileName || '').trim()
    payload.file_data = normalizedFileData
  } else {
    const normalizedSourceJobId = String(sourceJobId || '').trim()
    if (normalizedSourceJobId) payload.source_job_id = normalizedSourceJobId
  }
  return payload
}

const encodedJobId = (jobId) => encodeURIComponent(String(jobId || '').trim())

export const buildMaterialVariationTaskUrl = (jobId) => (
  `${MATERIAL_VARIATION_API_BASE}/${encodedJobId(jobId)}`
)

export const buildMaterialVariationRetryUrl = (jobId) => (
  `${buildMaterialVariationTaskUrl(jobId)}/retry`
)

export const buildMaterialVariationSecondWaveUrl = (jobId) => (
  `${buildMaterialVariationTaskUrl(jobId)}/second-wave`
)

export const isMaterialVariationTerminal = (status) => (
  TERMINAL_STATUSES.has(String(status || '').toLowerCase())
)

export const unwrapMaterialVariationTask = (result = {}) => {
  if (result?.data?.job_id || result?.data?.jobId) return result.data
  if (result?.task?.job_id || result?.task?.jobId) return result.task
  return result || {}
}

export const getMaterialVariationProgress = (task = {}) => {
  const raw = Number(task.progress)
  if (Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)))
  }

  const completed = Number(task.completed_count ?? task.completedCount)
  const total = Number(task.total_count ?? task.totalCount)
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  }
  return 0
}

const creativeIdOf = (asset, index) => (
  asset?.creative_id || asset?.creativeId || asset?.concept_id || asset?.conceptId || `creative-${index + 1}`
)

const assetSizeOf = (asset) => String(asset?.size || asset?.dimensions || '')

export const assetUrlOf = (asset = {}) => (
  asset.url || asset.image_url || asset.imageUrl || asset.asset_url || asset.assetUrl || asset.public_url || ''
)

export const getPrimaryCreativeAssets = (assets = [], preferredSizes = DEFAULT_MATERIAL_VARIATION_SIZES) => {
  const source = Array.isArray(assets) ? assets.filter((asset) => assetUrlOf(asset)) : []
  const sizeOrder = normalizeMaterialVariationSizes(preferredSizes)
  const groups = new Map()

  source.forEach((asset, index) => {
    const creativeId = creativeIdOf(asset, index)
    if (!groups.has(creativeId)) groups.set(creativeId, [])
    groups.get(creativeId).push(asset)
  })

  return [...groups.values()].map((group) => (
    sizeOrder.map((size) => group.find((asset) => assetSizeOf(asset) === size)).find(Boolean) || group[0]
  ))
}

export const buildSecondWavePayload = ({
  asset,
  ctr,
  count,
  sizes,
  qualityMode,
  strength
}) => {
  const payload = {
    winner_asset: asset,
    count: normalizeMaterialVariationCount(count),
    sizes: normalizeMaterialVariationSizes(sizes),
    quality_mode: normalizeMaterialVariationQuality(qualityMode),
    strength: normalizeMaterialVariationStrength(strength)
  }
  const ctrValue = Number.parseFloat(ctr)
  if (Number.isFinite(ctrValue)) payload.ctr = ctrValue
  return payload
}
