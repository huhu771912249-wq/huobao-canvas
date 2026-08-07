import {
  buildDspCreativeCancelUrl,
  buildDspCreativeCleanupUrl,
  buildDspCreativeConfirmUrl,
  buildDspCreativeCopyUrl,
  buildDspCreativeDeleteUrl,
  buildDspCreativeAutoRefreshUrl,
  buildDspCreativeImportUrl,
  buildDspCreativeJobUrl,
  buildDspCreativeJobsUrl,
  buildDspCreativeOpenFolderUrl,
  buildDspCreativeExperimentBindingsUrl,
  buildDspCreativeExperimentRefreshUrl,
  buildDspCreativePreviewUrl,
  buildDspCreativeRetryUrl,
  buildDspH3UpgradeUrl,
  buildDspH3UpgradeActionUrl,
  sanitizeDspCreativeAutoRefreshStatus,
  validateDspCreativeIdentifier
} from '../utils/dspCreativeLibrary.js'

const formatDetail = (detail) => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(formatDetail).filter(Boolean).join('；')
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg
    if (typeof detail.message === 'string') return detail.message
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return ''
}

const readResponse = async (response) => {
  if (response.status === 204) return {}
  const contentType = response.headers?.get?.('content-type') || ''
  let payload = {}
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      payload = {}
    }
  } else {
    const text = await response.text()
    payload = text ? { message: text } : {}
  }
  if (!response.ok) {
    const message = (
      (typeof payload?.error === 'string' ? payload.error : payload?.error?.message)
      || formatDetail(payload?.detail)
      || payload?.message
      || `请求失败 (${response.status})`
    )
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

const requestJson = async (url, { method = 'GET', data, signal } = {}) => {
  const options = {
    method,
    headers: { Accept: 'application/json' },
    signal
  }
  if (data !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(data)
  }
  return readResponse(await fetch(url, options))
}

const DSP_PREVIEW_RETRYABLE_STATUSES = new Set([500, 502, 503, 504])
const DSP_PREVIEW_MAX_ATTEMPTS = 2
const DSP_PREVIEW_RETRY_DELAY_MS = 1200

const previewAbortError = () => {
  const error = new Error('预览请求已取消')
  error.name = 'AbortError'
  return error
}

const waitForPreviewRetry = (delayMs, signal) => {
  if (signal?.aborted) return Promise.reject(previewAbortError())
  const delay = Math.max(0, Number(delayMs) || 0)
  if (delay === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, delay)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      reject(previewAbortError())
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

const isRetryablePreviewError = (error) => {
  if (error?.name === 'AbortError') return false
  const status = Number(error?.status)
  return !Number.isFinite(status) || DSP_PREVIEW_RETRYABLE_STATUSES.has(status)
}

export const previewDspCreatives = async (data, options = {}) => {
  const retryDelayMs = options.retryDelayMs ?? DSP_PREVIEW_RETRY_DELAY_MS
  let lastError
  for (let attempt = 1; attempt <= DSP_PREVIEW_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestJson(
        buildDspCreativePreviewUrl(),
        { method: 'POST', data, signal: options.signal }
      )
    } catch (error) {
      lastError = error
      if (
        attempt >= DSP_PREVIEW_MAX_ATTEMPTS
        || !isRetryablePreviewError(error)
      ) {
        throw error
      }
      await waitForPreviewRetry(retryDelayMs, options.signal)
    }
  }
  throw lastError
}

export const importDspCreatives = (data, options = {}) => requestJson(
  buildDspCreativeImportUrl(),
  { method: 'POST', data, signal: options.signal }
)

export const getDspCreativeAutoRefreshStatus = async (options = {}) => {
  try {
    return sanitizeDspCreativeAutoRefreshStatus(
      await requestJson(
        buildDspCreativeAutoRefreshUrl(),
        { signal: options.signal }
      )
    )
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return sanitizeDspCreativeAutoRefreshStatus({
      enabled: false,
      status: 'error',
      error: error?.message || '自动更新状态读取失败'
    })
  }
}

export const listDspCreativeJobs = (filters = {}, options = {}) => requestJson(
  buildDspCreativeJobsUrl(filters),
  { signal: options.signal }
)

export const getDspCreativeJob = (jobId, options = {}) => requestJson(
  buildDspCreativeJobUrl(jobId),
  { signal: options.signal }
)

export const createDspH3Upgrade = (jobId, data = {}, options = {}) => requestJson(
  buildDspH3UpgradeUrl(jobId),
  { method: 'POST', data, signal: options.signal }
)

export const retryDspH3Upgrade = (jobId, upgradeId, data = {}, options = {}) => requestJson(
  buildDspH3UpgradeActionUrl(jobId, upgradeId, 'retry'),
  { method: 'POST', data, signal: options.signal }
)

export const cancelDspH3Upgrade = (jobId, upgradeId, options = {}) => requestJson(
  buildDspH3UpgradeActionUrl(jobId, upgradeId, 'cancel'),
  { method: 'POST', data: {}, signal: options.signal }
)

export const confirmDspCreativeJob = (jobId, data = {}, options = {}) => requestJson(
  buildDspCreativeConfirmUrl(jobId),
  { method: 'POST', data, signal: options.signal }
)

export const updateDspCreativeCopy = (jobId, data = {}, options = {}) => requestJson(
  buildDspCreativeCopyUrl(jobId),
  { method: 'POST', data, signal: options.signal }
)

export const cancelDspCreativeJob = (jobId, options = {}) => requestJson(
  buildDspCreativeCancelUrl(jobId),
  { method: 'POST', data: {}, signal: options.signal }
)

export const retryDspCreativeJob = (jobId, options = {}) => requestJson(
  buildDspCreativeRetryUrl(jobId),
  { method: 'POST', data: {}, signal: options.signal }
)

export const openDspCreativeDownloadFolder = (jobId, options = {}) => requestJson(
  buildDspCreativeOpenFolderUrl(jobId),
  { method: 'POST', data: {}, signal: options.signal }
)

export const bindDspCreativeExperiment = (jobId, data = {}, options = {}) => requestJson(
  buildDspCreativeExperimentBindingsUrl(jobId),
  { method: 'POST', data, signal: options.signal }
)

export const refreshDspCreativeExperiment = (jobId, data = {}, options = {}) => requestJson(
  buildDspCreativeExperimentRefreshUrl(jobId),
  { method: 'POST', data, signal: options.signal }
)

export const cleanupDspCreativePublicFiles = (jobId, options = {}) => requestJson(
  buildDspCreativeCleanupUrl(),
  {
    method: 'POST',
    data: { job_id: validateDspCreativeIdentifier(jobId, '任务标识') },
    signal: options.signal
  }
)

export const deleteDspCreativeJob = (jobId, options = {}) => requestJson(
  buildDspCreativeDeleteUrl(jobId),
  { method: 'DELETE', data: {}, signal: options.signal }
)
