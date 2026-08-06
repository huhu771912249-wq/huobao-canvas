const COMPLETE_STATUSES = new Set(['completed', 'succeeded', 'success', 'done'])
const FAILED_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled'])

const normalizeStatus = (status) => String(status || '').trim().toLowerCase()
const UPSCALE_STATUSES = new Set(['queued', 'running', 'completed', 'failed'])

export const extractVideoCompletionMetadata = (result = {}, adaptedResult = {}) => {
  const nested = result?.data
  const nestedHasContract = nested && typeof nested === 'object' && !Array.isArray(nested) && (
    'upscale_status' in nested || 'actual_width' in nested || 'actual_height' in nested
  )
  const source = nestedHasContract ? nested : result
  const status = normalizeStatus(source?.status || adaptedResult?.status)
  const upscaleStatus = normalizeStatus(source?.upscale_status)
  const width = source?.actual_width
  const height = source?.actual_height
  const validDimensions = Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
  return {
    status,
    upscale_status: UPSCALE_STATUSES.has(upscaleStatus) ? upscaleStatus : '',
    actual_width: validDimensions ? width : null,
    actual_height: validDimensions ? height : null
  }
}

export const isVerifiedTargetOutput = (metadata = {}, target = {}) => (
  metadata.upscale_status === 'completed'
  && Number.isInteger(metadata.actual_width)
  && Number.isInteger(metadata.actual_height)
  && metadata.actual_width === target.width
  && metadata.actual_height === target.height
  && ((target.width === 1920 && target.height === 1080) || (target.width === 1080 && target.height === 1920))
)

export const buildVideoTaskStatusUrl = (endpoint = '/videos', taskId = '') => {
  const task = String(taskId || '').trim()
  if (!task) return endpoint

  const encodedTask = encodeURIComponent(task)
  if (endpoint.includes('{taskId}')) {
    return endpoint.replace('{taskId}', encodedTask)
  }

  const normalizedEndpoint = endpoint.replace(/\/$/, '')
  if (normalizedEndpoint.endsWith(`/${task}`) || normalizedEndpoint.endsWith(`/${encodedTask}`)) {
    return endpoint
  }

  return `${normalizedEndpoint}/${encodedTask}`
}

export const extractVideoUrl = (result = {}, adaptedResult = {}) => {
  const data = result?.data
  const firstDataItem = Array.isArray(data) ? data[0] : null
  const assets = result?.assets || data?.assets || adaptedResult?.assets || []
  const firstCompletedAsset = Array.isArray(assets)
    ? assets.find(asset => asset?.status === 'completed' && (asset?.mp4_url || asset?.url))
    : null

  return (
    adaptedResult?.url ||
    data?.url ||
    firstDataItem?.url ||
    result?.url ||
    result?.content?.video_url ||
    result?.video_url ||
    result?.urls?.[0] ||
    data?.urls?.[0] ||
    firstDataItem?.urls?.[0] ||
    firstCompletedAsset?.mp4_url ||
    firstCompletedAsset?.url ||
    ''
  )
}

export const getVideoTaskPollingState = (result = {}, adaptedResult = {}) => {
  const status = normalizeStatus(result?.status || result?.data?.status || adaptedResult?.status)
  const url = extractVideoUrl(result, adaptedResult)

  if (FAILED_STATUSES.has(status)) {
    return { state: 'failed', url, status }
  }

  if (status === 'partial') {
    return { state: 'partial', url, status }
  }

  if (url) {
    return { state: 'completed', url, status }
  }

  if (COMPLETE_STATUSES.has(status)) {
    return { state: 'missing_url', url: '', status }
  }

  return { state: 'pending', url: '', status }
}
