import { buildMaterialApiUrl } from './apiBase.js'

export const DSP_CREATIVE_API_BASE = buildMaterialApiUrl('/v1/dsp-creatives')
export const DSP_CREATIVE_TIMEZONE = 'Asia/Shanghai'
export const DSP_CREATIVE_POLL_INTERVAL = 2000
export const DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL = 60_000
export const MAX_DSP_SELECTED_IDS = 50
export const MAX_DSP_IDENTIFIER_LENGTH = 512
export const DSP_GIF_VARIANTS = Object.freeze(['A', 'B', 'C', 'D', 'E'])

const MAX_DSP_ACCOUNT_LENGTH = 256
const MAX_DSP_QUERY_LENGTH = 100
const MAX_DSP_JOB_IDS = 200
const MAX_DSP_DIMENSIONS = 50
const MAX_DSP_LABEL_LENGTH = 100
const MAX_DSP_TIMESTAMP_LENGTH = 40
const MAX_DSP_PREVIEW_SIGNATURE_LENGTH = 4096
const MAX_DSP_AUTO_REFRESH_COUNT = 1_000_000
const MAX_DSP_AUTO_REFRESH_ERROR_LENGTH = 160
const DSP_AUTO_REFRESH_STATUSES = new Set([
  'disabled',
  'stopping',
  'error',
  'idle',
  'running',
  'standby'
])
const DSP_AUTO_REFRESH_BUSY_JOB_STATUSES = new Set([
  'queued',
  'downloading',
  'reversing',
  'confirmed',
  'generating',
  'packaging',
  'running'
])
const DSP_AUTO_REFRESH_SENSITIVE_TEXT = /(?:[a-z][a-z0-9+.-]*:\/\/|[a-z]:[\\/]|\\\\\S+|\/(?:Users|home|var|tmp|etc|opt|private|Volumes|Applications|Library)\/\S+|(?:^|[\s"'(\[])\.{1,2}[\\/]\S+|(?:^|[\s"'(\[])(?:(?:\d{1,3}\.){3}\d{1,3}|localhost)(?::\d{1,5})?\/\S+|(?:^|[\s"'(\[])(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::\d{1,5})?\/\S+|(?:^|[\s"'(\[])(?:[a-z0-9_.-]+\/)+[a-z0-9_.-]+\.[a-z0-9]{1,10}(?=$|[\s"'),;；，\]])|(?:^|[\s:：=＝]|路径|目录|文件|path)[\\/]\S+|\?[^\s#]*=|\b(?:bearer|password|passwd|pwd|credential|authorization)\b|(?:api|access|client)[_\s-]*key|refresh[_\s-]*token|client[_\s-]*secret|\b(?:token|secret)\b|sk-[a-z0-9_-]+)/iu

export const DEFAULT_DSP_MEDIA_TYPES = Object.freeze(['BANNER', 'NATIVE', 'VIDEO'])
export const DEFAULT_DSP_DIMENSIONS = Object.freeze(['300x100', '300x250', '720x240', '200x200'])
export const DEFAULT_DSP_THRESHOLDS = Object.freeze({
  minImpressions: 1000,
  minClicks: 20,
  topN: 10
})

const TERMINAL_JOB_STATUSES = new Set([
  'completed',
  'completed_with_errors',
  'partial',
  'failed',
  'cancelled'
])
const ACTIVE_JOB_STATUSES = new Set([
  'queued',
  'downloading',
  'reversing',
  'awaiting_confirmation',
  'confirmed',
  'generating',
  'packaging',
  'running'
])
const POLLABLE_JOB_STATUSES = new Set([
  'queued',
  'downloading',
  'reversing',
  'confirmed',
  'generating',
  'packaging',
  'running'
])
const RETRYABLE_JOB_STATUSES = new Set([
  'failed',
  'partial',
  'completed_with_errors',
  'cancelled'
])

const boundedString = (value, maxLength) => String(value || '').trim().slice(0, maxLength)
const normalizeDateOnly = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ''
}

const safeDspAutoRefreshCount = (value) => (
  Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_DSP_AUTO_REFRESH_COUNT)
    : 0
)

const safeDspAutoRefreshTimestamp = (value) => {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > 64
    || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) return ''
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  const year = parsed.getUTCFullYear()
  return year >= 2000 && year <= 2100 ? value : ''
}

const safeDspAutoRefreshError = (value) => {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (!text) return ''
  if (DSP_AUTO_REFRESH_SENSITIVE_TEXT.test(text)) {
    return '自动更新状态异常（敏感详情已隐藏）'
  }
  return text.slice(0, MAX_DSP_AUTO_REFRESH_ERROR_LENGTH)
}

export const sanitizeDspCreativeAutoRefreshStatus = (value = {}) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const status = typeof source.status === 'string' && DSP_AUTO_REFRESH_STATUSES.has(source.status)
    ? source.status
    : 'error'
  return {
    enabled: source.enabled === true,
    status,
    timezone: DSP_CREATIVE_TIMEZONE,
    lastStarted: safeDspAutoRefreshTimestamp(source.last_started),
    lastFinished: safeDspAutoRefreshTimestamp(source.last_finished),
    lastSuccess: safeDspAutoRefreshTimestamp(source.last_success),
    nextRun: safeDspAutoRefreshTimestamp(source.next_run),
    retryCount: safeDspAutoRefreshCount(source.retry_count),
    catalogSize: safeDspAutoRefreshCount(source.catalog_size),
    candidateCount: safeDspAutoRefreshCount(source.candidate_count),
    addedCount: safeDspAutoRefreshCount(source.added_count),
    updatedCount: safeDspAutoRefreshCount(source.updated_count),
    unchangedCount: safeDspAutoRefreshCount(source.unchanged_count),
    analysisReusedCount: safeDspAutoRefreshCount(source.analysis_reused_count),
    analysisGeneratedCount: safeDspAutoRefreshCount(source.analysis_generated_count),
    failedCount: safeDspAutoRefreshCount(source.failed_count),
    error: safeDspAutoRefreshError(source.error)
  }
}

export const shouldPauseDspAutoRefreshStatus = ({
  mounted = false,
  requestInFlight = false,
  previewing = false,
  importing = false,
  confirming = false,
  actionBusy = '',
  jobStatus = ''
} = {}) => (
  !mounted
  || requestInFlight
  || previewing
  || importing
  || confirming
  || Boolean(actionBusy)
  || DSP_AUTO_REFRESH_BUSY_JOB_STATUSES.has(String(jobStatus || '').toLowerCase())
)

export const formatDspAutoRefreshShanghaiTime = (value, fallback = '未记录') => {
  const timestamp = safeDspAutoRefreshTimestamp(value)
  if (!timestamp) return fallback
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: DSP_CREATIVE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(timestamp))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.year}年${fields.month}月${fields.day}日 ${fields.hour}:${fields.minute}`
}

export const validateDspCreativeIdentifier = (value, label = '任务标识') => {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new TypeError(`${label}必须是字符串`)
  }
  const normalized = value.trim()
  if (normalized.length > MAX_DSP_IDENTIFIER_LENGTH) {
    throw new RangeError(`${label}不能超过 ${MAX_DSP_IDENTIFIER_LENGTH} 个字符`)
  }
  return normalized
}

const safeDspCreativeIdentifier = (value, label) => {
  try {
    return validateDspCreativeIdentifier(value, label)
  } catch {
    return ''
  }
}

const datePartsInShanghai = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DSP_CREATIVE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  }
}

const formatDateOnly = (date) => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0')
].join('-')

export const getDefaultShanghaiDateRange = (now = new Date()) => {
  const { year, month, day } = datePartsInShanghai(now)
  const end = new Date(Date.UTC(year, month - 1, day))
  const start = new Date(end.getTime() - (7 * 24 * 60 * 60 * 1000))
  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
    timezone: DSP_CREATIVE_TIMEZONE
  }
}

export const normalizeDspMediaTypes = (mediaTypes) => {
  if (mediaTypes === undefined || mediaTypes === null) {
    return [...DEFAULT_DSP_MEDIA_TYPES]
  }
  const requested = new Set(
    (Array.isArray(mediaTypes) ? mediaTypes : [])
      .map((value) => String(value || '').trim().toUpperCase())
  )
  return DEFAULT_DSP_MEDIA_TYPES.filter((type) => requested.has(type))
}

export const normalizeDspDimensions = (dimensions) => {
  const seen = new Set()
  return (Array.isArray(dimensions) ? dimensions : [])
    .map((value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ''))
    .filter((value) => /^\d{2,5}x\d{2,5}$/.test(value))
    .filter((value) => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .slice(0, MAX_DSP_DIMENSIONS)
}

export const resolveDspDimensionSelection = (dimensions) => {
  const normalized = normalizeDspDimensions(dimensions)
  return normalized.length ? normalized : [...DEFAULT_DSP_DIMENSIONS]
}

const finiteInteger = (value, fallback, min, max) => {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

export const buildDspCreativePreviewPayload = (filters = {}) => {
  const requestedStart = normalizeDateOnly(filters.startDate)
  const requestedEnd = normalizeDateOnly(filters.endDate)
  const range = requestedStart && requestedEnd
    ? {
        startDate: requestedStart,
        endDate: requestedEnd,
        timezone: DSP_CREATIVE_TIMEZONE
      }
    : getDefaultShanghaiDateRange(filters.now || new Date())

  const dimensions = normalizeDspDimensions(filters.dimensions)
  const payload = {
    start: range.startDate,
    end: range.endDate,
    media_types: normalizeDspMediaTypes(filters.mediaTypes),
    account_id: boundedString(filters.account, MAX_DSP_ACCOUNT_LENGTH),
    min_impressions: finiteInteger(
      filters.minImpressions,
      DEFAULT_DSP_THRESHOLDS.minImpressions,
      0,
      1_000_000_000
    ),
    min_clicks: finiteInteger(
      filters.minClicks,
      DEFAULT_DSP_THRESHOLDS.minClicks,
      0,
      1_000_000_000
    ),
    top_per_group: finiteInteger(filters.topN, DEFAULT_DSP_THRESHOLDS.topN, 1, 50)
  }
  if (dimensions.length) payload.dimensions = dimensions

  return payload
}

export const buildDspPreviewFilterSignature = (filters = {}) => JSON.stringify({
  startDate: normalizeDateOnly(filters.startDate),
  endDate: normalizeDateOnly(filters.endDate),
  mediaTypes: normalizeDspMediaTypes(filters.mediaTypes),
  dimensions: normalizeDspDimensions(filters.dimensions),
  account: boundedString(filters.account, MAX_DSP_ACCOUNT_LENGTH),
  minImpressions: finiteInteger(
    filters.minImpressions,
    DEFAULT_DSP_THRESHOLDS.minImpressions,
    0,
    1_000_000_000
  ),
  minClicks: finiteInteger(
    filters.minClicks,
    DEFAULT_DSP_THRESHOLDS.minClicks,
    0,
    1_000_000_000
  ),
  topN: finiteInteger(filters.topN, DEFAULT_DSP_THRESHOLDS.topN, 1, 50)
})

export const clearDspCreativePreviewState = () => ({
  previewRef: '',
  previewSignature: '',
  candidates: [],
  selectedIds: []
})

export const isDspPreviewResponseCurrent = ({
  requestSequence,
  latestSequence,
  requestSignature,
  currentSignature
} = {}) => (
  Number.isInteger(requestSequence)
  && requestSequence === latestSequence
  && typeof requestSignature === 'string'
  && requestSignature.length > 0
  && requestSignature === currentSignature
)

export const canImportDspPreview = ({
  previewRef,
  previewSignature,
  currentSignature
} = {}) => (
  Boolean(safeDspCreativeIdentifier(previewRef, '预览标识'))
  && typeof previewSignature === 'string'
  && previewSignature.length > 0
  && previewSignature === currentSignature
)

export const getSampleRiskWarning = ({
  minImpressions = DEFAULT_DSP_THRESHOLDS.minImpressions,
  minClicks = DEFAULT_DSP_THRESHOLDS.minClicks
} = {}) => (
  Number(minImpressions) < DEFAULT_DSP_THRESHOLDS.minImpressions
    || Number(minClicks) < DEFAULT_DSP_THRESHOLDS.minClicks
    ? '当前门槛低于默认值，存在小样本风险'
    : ''
)

export const buildFrwCostSummary = ({
  selectedCreatives = 0,
  sizes = DEFAULT_DSP_DIMENSIONS
} = {}) => {
  const sourceCount = Math.max(0, finiteInteger(selectedCreatives, 0, 0, 10_000))
  const normalizedSizes = normalizeDspDimensions(sizes)
  const sizeCount = normalizedSizes.length
  const ratios = [...new Set(normalizedSizes.map((size) => {
    const [width, height] = size.split('x').map(Number)
    const gcd = (left, right) => (right ? gcd(right, left % right) : left)
    const divisor = gcd(width, height)
    return `${width / divisor}:${height / divisor}`
  }))]
  const normalizedGroups = [...DSP_GIF_VARIANTS]
  const ratioGroupCount = ratios.length
  const experimentGroupCount = normalizedGroups.length
  const callsPerSource = ratioGroupCount * experimentGroupCount
  return {
    sourceCount,
    sizeCount,
    ratioGroupCount,
    ratios,
    experimentGroupCount,
    groups: normalizedGroups,
    callsPerSource,
    totalCalls: sourceCount * callsPerSource
  }
}

export const resolveDspFrwCostSummary = (job = {}, fallback = {}) => {
  const fallbackSummary = buildFrwCostSummary({
    ...fallback,
    groups: DSP_GIF_VARIANTS
  })
  const fallbackSizes = normalizeDspDimensions(fallback.sizes)
  const fallbackResult = {
    ...fallbackSummary,
    sizes: fallbackSizes,
    fromPersistedEstimate: false,
    invalidPersistedEstimate: false
  }
  const hasDirectEstimate = (
    job
    && typeof job === 'object'
    && Object.prototype.hasOwnProperty.call(job, 'cost_estimate')
  )
  const nestedJob = job?.result
  const hasNestedEstimate = (
    nestedJob
    && typeof nestedJob === 'object'
    && Object.prototype.hasOwnProperty.call(nestedJob, 'cost_estimate')
  )
  const hasPersistedEstimate = hasDirectEstimate || hasNestedEstimate
  const estimate = hasDirectEstimate
    ? job.cost_estimate
    : nestedJob?.cost_estimate
  if (estimate && typeof estimate === 'object' && !Array.isArray(estimate)) {
    const sizes = normalizeDspDimensions(estimate.sizes)
    const ratios = Array.isArray(estimate.ratios)
      ? [...new Set(
          estimate.ratios
            .map((ratio) => String(ratio || '').trim())
            .filter((ratio) => /^\d{1,5}:\d{1,5}$/.test(ratio))
        )]
      : []
    const sourceCount = estimate.source_count
    const sourceSetCount = (
      estimate.source_set_count
      ?? estimate.sourceSetCount
      ?? sourceCount
    )
    const sizeCount = estimate.size_count
    const ratioGroupCount = estimate.ratio_group_count
    const experimentGroupCount = estimate.experiment_groups
    const localTextSafe = (
      String(job?.generation_mode || nestedJob?.generation_mode || '')
        === 'local_text_safe'
    )
    const totalCalls = localTextSafe
      ? estimate.local_gif_jobs
      : estimate.frw_video_calls
    const sameValues = (left, right) => (
      left.length === right.length
      && [...left].sort().every((value, index) => value === [...right].sort()[index])
    )
    if (
      Number.isInteger(sourceCount)
      && sourceCount > 0
      && Number.isInteger(sourceSetCount)
      && sourceSetCount > 0
      && Number.isInteger(sizeCount)
      && Number.isInteger(ratioGroupCount)
      && Number.isInteger(experimentGroupCount)
      && Number.isInteger(totalCalls)
      && sizes.length === sizeCount
      && ratios.length === ratioGroupCount
      && sameValues(sizes, fallbackSizes)
      && sameValues(ratios, fallbackSummary.ratios)
      && experimentGroupCount === DSP_GIF_VARIANTS.length
      && totalCalls === sourceSetCount * ratioGroupCount * experimentGroupCount
      && totalCalls > 0
      && totalCalls <= 300
      && estimate.pipeline_version === 'gif-only-v1'
      && estimate.output_format === 'gif'
      && estimate.generation_kind === 'img2video'
      && estimate.requires_confirmation === true
    ) {
      return {
        sourceCount,
        sourceSetCount,
        sourceStrategy: estimate.source_strategy || estimate.sourceStrategy || '',
        sizeCount,
        ratioGroupCount,
        ratios,
        experimentGroupCount,
        groups: [...DSP_GIF_VARIANTS],
        sizes,
        callsPerSource: ratioGroupCount * experimentGroupCount,
        totalCalls,
        localTextSafe,
        frwCalls: localTextSafe ? 0 : totalCalls,
        fromPersistedEstimate: true,
        invalidPersistedEstimate: false
      }
    }
  }
  if (hasPersistedEstimate) {
    return {
      ...fallbackResult,
      callsPerSource: 0,
      totalCalls: 0,
      invalidPersistedEstimate: true
    }
  }
  return fallbackResult
}

const encodedJobId = (jobId) => encodeURIComponent(
  validateDspCreativeIdentifier(jobId, '任务标识')
)

export const buildDspCreativePreviewUrl = () => `${DSP_CREATIVE_API_BASE}/preview`
export const buildDspCreativeImportUrl = () => `${DSP_CREATIVE_API_BASE}/import`
export const buildDspCreativeAutoRefreshUrl = () => `${DSP_CREATIVE_API_BASE}/auto-refresh`

export const buildDspCreativeJobsUrl = (filters = {}) => {
  const params = new URLSearchParams()
  const status = String(filters.status || '').trim()
  const mediaType = String(filters.mediaType || '').trim().toUpperCase()
  const query = String(filters.query || '').trim()
  if (status) params.set('status', status)
  if (DEFAULT_DSP_MEDIA_TYPES.includes(mediaType)) params.set('media_type', mediaType)
  if (query) params.set('query', query.slice(0, MAX_DSP_QUERY_LENGTH))
  const suffix = params.toString()
  return `${DSP_CREATIVE_API_BASE}/jobs${suffix ? `?${suffix}` : ''}`
}

export const buildDspCreativeJobUrl = (jobId) => (
  `${DSP_CREATIVE_API_BASE}/jobs/${encodedJobId(jobId)}`
)
export const buildDspCreativeConfirmUrl = (jobId) => `${buildDspCreativeJobUrl(jobId)}/confirm`
export const buildDspCreativeCopyUrl = (jobId) => `${buildDspCreativeJobUrl(jobId)}/copy`
export const buildDspCreativeCancelUrl = (jobId) => `${buildDspCreativeJobUrl(jobId)}/cancel`
export const buildDspCreativeRetryUrl = (jobId) => `${buildDspCreativeJobUrl(jobId)}/retry`
export const buildDspCreativeOpenFolderUrl = (jobId) => `${buildDspCreativeJobUrl(jobId)}/open-folder`
export const buildDspCreativeExperimentBindingsUrl = (jobId) => (
  `${buildDspCreativeJobUrl(jobId)}/experiment-bindings`
)
export const buildDspCreativeExperimentRefreshUrl = (jobId) => (
  `${buildDspCreativeJobUrl(jobId)}/experiment-refresh`
)
export const buildDspCreativeCleanupUrl = () => `${DSP_CREATIVE_API_BASE}/public-assets/cleanup`
export const buildDspCreativeDeleteUrl = (jobId) => buildDspCreativeJobUrl(jobId)

export const unwrapDspCreativePayload = (result = {}) => {
  if (result?.data !== undefined) return result.data
  return result || {}
}

export const getDspCreativeCandidates = (result = {}) => {
  const payload = unwrapDspCreativePayload(result)
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const candidates = payload.result?.creatives
    || payload.candidates
    || payload.creatives
    || payload.items
    || payload.rows
    || []
  return Array.isArray(candidates)
    ? candidates.filter((candidate) => (
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ))
    : []
}

export const getDspCreativeCandidateId = (candidate = {}) => (
  safeDspCreativeIdentifier(
    candidate.candidate_key
    || candidate.candidateKey
    || candidate.creative_id
    || candidate.creativeId,
    '候选标识'
  )
)

export const buildSelectableDspCandidateRows = (candidates = []) => {
  const source = Array.isArray(candidates)
    ? candidates.filter((candidate) => (
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ))
    : []
  const idCounts = new Map()
  source.forEach((candidate) => {
    const id = getDspCreativeCandidateId(candidate)
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1)
  })
  const rows = []
  for (const candidate of source) {
    const id = getDspCreativeCandidateId(candidate)
    if (id && idCounts.get(id) === 1) {
      rows.push({ id, candidate })
      if (rows.length > MAX_DSP_SELECTED_IDS) break
    }
  }
  return rows
}

export const formatDspCandidateCtrPercent = (candidate = {}) => {
  const impressions = Number(
    candidate.impressions ?? candidate.imps ?? 0
  )
  const clicks = Number(candidate.clicks ?? 0)
  const rawCtr = Number(candidate.ctr ?? 0)
  const percentage = (
    Number.isFinite(impressions)
    && impressions > 0
    && Number.isFinite(clicks)
  )
    ? (clicks / impressions) * 100
    : (Number.isFinite(rawCtr) ? rawCtr : 0)
  return `${Math.max(0, percentage).toFixed(2)}%`
}

const candidateSortValue = (row, key) => {
  const candidate = row?.candidate || {}
  if (key === 'creative') return String(row?.id || '')
  if (key === 'type') {
    const mediaType = String(
      candidate.media_type || candidate.mediaType || candidate.type || ''
    ).toUpperCase()
    const dimension = String(
      candidate.dimension
      || candidate.dimensions
      || candidate.size
      || (
        candidate.width && candidate.height
          ? `${candidate.width}x${candidate.height}`
          : ''
      )
    )
    return `${mediaType}/${dimension}`
  }
  const valueByKey = {
    impressions: candidate.impressions ?? candidate.imps,
    clicks: candidate.clicks,
    ctr: candidate.ctr,
    spend: candidate.spend,
    wilson: (
      candidate.wilson_ctr
      ?? candidate.wilson_lower_bound
      ?? candidate.wilsonScore
      ?? candidate.wilson
    )
  }
  const number = Number(valueByKey[key] ?? 0)
  return Number.isFinite(number) ? number : 0
}

export const sortSelectableDspCandidateRows = (
  rows = [],
  key = '',
  direction = 'desc'
) => {
  const source = Array.isArray(rows) ? rows : []
  const normalizedKey = String(key || '').trim()
  if (![
    'creative',
    'type',
    'impressions',
    'clicks',
    'ctr',
    'spend',
    'wilson'
  ].includes(normalizedKey)) {
    return [...source]
  }
  const multiplier = direction === 'asc' ? 1 : -1
  return source
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = candidateSortValue(left.row, normalizedKey)
      const rightValue = candidateSortValue(right.row, normalizedKey)
      const compared = (
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), 'zh-CN')
      )
      return compared === 0
        ? left.index - right.index
        : compared * multiplier
    })
    .map(({ row }) => row)
}

export const getDspCreativeJobs = (result = {}) => {
  const payload = unwrapDspCreativePayload(result)
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const jobs = payload.result?.jobs || payload.jobs || payload.items || []
  return Array.isArray(jobs)
    ? jobs.filter((job) => job && typeof job === 'object' && !Array.isArray(job))
    : []
}

export const getDspCreativeJobId = (job = {}) => safeDspCreativeIdentifier(
  job.job_id || job.jobId || job.id,
  '任务标识'
)

const getSelectedCreatives = (job = {}) => {
  const selected = (
    job.selected_creatives
    || job.selectedCreatives
    || job.result?.selected_creatives
    || job.result?.selectedCreatives
    || []
  )
  return Array.isArray(selected)
    ? selected
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .slice(0, MAX_DSP_SELECTED_IDS)
    : []
}

export const getDspCreativeJobMediaTypes = (job = {}) => {
  const mediaTypes = [
    job.media_type,
    job.mediaType,
    ...getSelectedCreatives(job).map((item) => (
      item.media_type || item.mediaType || item.type
    ))
  ]
  return [...new Set(
    mediaTypes
      .map((value) => String(value || '').trim().toUpperCase())
      .filter((value) => DEFAULT_DSP_MEDIA_TYPES.includes(value))
  )]
}

export const getDspCreativeJobSearchText = (job = {}) => {
  const values = [
    getDspCreativeJobId(job),
    job.creative_id,
    job.creativeId,
    job.current_step,
    job.currentStep
  ]
  getSelectedCreatives(job).forEach((item) => {
    values.push(
      item.candidate_key,
      item.candidateKey,
      item.creative_id,
      item.creativeId,
      item.name,
      item.media_type,
      item.mediaType,
      item.dimension,
      item.size
    )
  })
  return values
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).slice(0, MAX_DSP_IDENTIFIER_LENGTH))
    .join(' ')
}

export const getDspCreativeProgress = (job = {}) => {
  const status = String(job.status || '').toLowerCase()
  if (TERMINAL_JOB_STATUSES.has(status)) return 100

  const canonical = Number(job.progress_percent ?? job.progressPercent)
  if (Number.isFinite(canonical)) {
    return Math.max(0, Math.min(99, Math.round(canonical)))
  }

  if (ACTIVE_JOB_STATUSES.has(status)) {
    const fixedStageProgress = {
      queued: 5,
      downloading: 15,
      reversing: 30,
      awaiting_confirmation: 40,
      packaging: 90
    }[status]
    if (Number.isFinite(fixedStageProgress)) return fixedStageProgress

    const sourceCount = Number(job.source_count ?? job.sourceCount)
    const confirmationCalls = Number(
      job.confirmation?.expected_calls ?? job.confirmation?.expectedCalls
    )
    const planCalls = Array.isArray(job.generation_plan) ? job.generation_plan.length : 0
    const expected = planCalls > 0
      ? planCalls
      : Number.isFinite(confirmationCalls) && confirmationCalls > 0
        ? confirmationCalls
        : Number.isFinite(sourceCount) && sourceCount > 0
          ? sourceCount * 5
          : 0
    const finishedKeys = new Set()
    let anonymousFinished = 0
    const markFinished = (entry = {}, requireStatus = true) => {
      const terminal = new Set(['completed', 'partial', 'failed', 'cancelled', 'skipped'])
      if (requireStatus && !terminal.has(String(entry.status || '').toLowerCase())) return
      const callKey = String(entry.call_key || entry.callKey || '').trim()
      if (callKey) finishedKeys.add(callKey)
      else anonymousFinished += 1
    }
    if (Array.isArray(job.generations)) job.generations.forEach(entry => markFinished(entry))
    if (Array.isArray(job.generation_failures)) {
      job.generation_failures.forEach(entry => markFinished(entry, false))
    }
    const finished = finishedKeys.size + anonymousFinished
    const inferred = expected > 0
      ? 40 + Math.round((50 * Math.min(finished, expected)) / expected)
      : 40
    return Math.min(90, inferred)
  }

  const raw = Number(job.progress)
  if (Number.isFinite(raw)) {
    return Math.max(0, Math.min(99, Math.round(raw <= 1 ? raw * 100 : raw)))
  }
  const nested = (
    (job.progress && typeof job.progress === 'object' ? job.progress : null)
    || job.result?.progress
    || job.result
    || {}
  )
  const completed = Number(
    nested.completed_creatives
    ?? nested.completed_count
    ?? nested.completedCount
    ?? job.completed_creatives
    ?? job.completed_count
    ?? job.completedCount
  )
  const total = Number(
    nested.total_creatives
    ?? nested.total_count
    ?? nested.totalCount
    ?? job.total_creatives
    ?? job.total_count
    ?? job.totalCount
  )
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(99, Math.round((completed / total) * 100)))
  }
  return 0
}

export const getDspCreativeStepLabel = (job = {}) => {
  const explicit = String(job.current_step || job.currentStep || '').trim()
  if (explicit) return explicit

  return ({
    queued: '等待开始',
    downloading: '正在下载素材',
    reversing: '正在进行 GMI 反向',
    awaiting_confirmation: '等待确认生成',
    generating: '正在生成五套素材',
    packaging: '正在打包结果',
    completed: '任务已完成',
    completed_with_errors: '部分完成，请检查失败项',
    partial: '部分完成，请检查失败项',
    failed: '任务失败',
    cancelled: '任务已取消'
  }[String(job.status || '').toLowerCase()] || '等待任务状态')
}

export const isDspCreativeQualityBlocked = (job = {}) => {
  const payload = unwrapDspCreativePayload(job)
  const task = (
    payload?.job
    && typeof payload.job === 'object'
    && !Array.isArray(payload.job)
  ) ? payload.job : payload
  const gate = task?.quality_gate
  return (
    (
      gate
      && typeof gate === 'object'
      && !Array.isArray(gate)
      && gate.passed === false
      && gate.reason === 'source_text_redraw_risk'
    )
    || String(task?.frw_status || '').toLowerCase() === 'blocked'
  )
}

export const isDspCreativeJobTerminal = (status) => (
  TERMINAL_JOB_STATUSES.has(String(status || '').toLowerCase())
)

export const isDspCreativeJobActive = (status) => (
  ACTIVE_JOB_STATUSES.has(String(status || '').toLowerCase())
)

export const shouldPollDspCreativeJob = (status) => (
  POLLABLE_JOB_STATUSES.has(String(status || '').toLowerCase())
)

export const canConfirmDspCreativeJob = (status, busy = false) => (
  !busy && String(status || '').toLowerCase() === 'awaiting_confirmation'
)

export const canCancelDspCreativeJob = (status, busy = false) => (
  !busy && isDspCreativeJobActive(status)
)

export const canRetryDspCreativeJob = (status, busy = false) => (
  !busy && RETRYABLE_JOB_STATUSES.has(String(status || '').toLowerCase())
)

export const canCleanupDspCreativeJob = (job = {}, busy = false) => (
  !busy
  && String(job.status || '').toLowerCase() === 'completed'
  && Boolean(
    job.zip_url
    || job.zipUrl
    || job.download_url
    || job.downloadUrl
    || job.result?.zip_url
    || job.result?.download_url
  )
)

export const matchesDspJobStatusFilter = (filterStatus, jobStatus) => {
  const filter = String(filterStatus || '').toLowerCase()
  const status = String(jobStatus || '').toLowerCase()
  if (!filter) return true
  if (filter === 'running') return isDspCreativeJobActive(status)
  return filter === status
}

const safeDspPublicAssetUrl = (raw, expectedExtension) => {
  if (typeof raw !== 'string' || !raw) return ''
  const extension = String(expectedExtension || '').toLowerCase()
  if (!['.gif', '.zip'].includes(extension)) return ''
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    const pathSegments = url.pathname.split('/')
    if (
      url.username
      || url.password
      || url.search
      || url.hash
      || !url.pathname.startsWith('/public-assets/')
      || url.pathname.includes('%')
      || url.pathname.includes('\\')
      || pathSegments.some((segment) => segment === '.' || segment === '..')
      || !url.pathname.toLowerCase().endsWith(extension)
    ) return ''
    const trustedOrigins = new Set([
      buildMaterialApiUrl('').replace(/\/$/, ''),
      'http://127.0.0.1:8788',
      'https://127.0.0.1:8788',
      'http://localhost:8788',
      'https://localhost:8788'
    ])
    if (typeof window !== 'undefined' && window.location?.origin) {
      trustedOrigins.add(window.location.origin)
    }
    if (!trustedOrigins.has(url.origin)) return ''

    const loopbackOrigins = new Set([
      'http://127.0.0.1:8788',
      'https://127.0.0.1:8788',
      'http://localhost:8788',
      'https://localhost:8788'
    ])
    if (loopbackOrigins.has(url.origin)) {
      return buildMaterialApiUrl(url.pathname)
    }
    return url.toString()
  } catch {
    return ''
  }
}

export const getDspCreativeExpectedGifCount = (job = {}) => {
  const payload = unwrapDspCreativePayload(job)
  const estimate = payload?.cost_estimate || payload?.costEstimate
  if (!estimate || typeof estimate !== 'object' || Array.isArray(estimate)) return 0
  const boundedCount = (value, maximum) => {
    const number = Number(value)
    return Number.isInteger(number) && number >= 0 && number <= maximum ? number : 0
  }
  const directCount = boundedCount(
    estimate.local_gif_jobs
    ?? estimate.localGifJobs
    ?? estimate.frw_video_calls
    ?? estimate.frwVideoCalls
    ?? estimate.frw_calls
    ?? estimate.frwCalls,
    300
  )
  if (directCount > 0) return directCount
  return (
    boundedCount(
      estimate.source_set_count
      ?? estimate.sourceSetCount
      ?? estimate.source_count
      ?? estimate.sourceCount,
      1000
    )
    * boundedCount(estimate.ratio_group_count ?? estimate.ratioGroupCount, 100)
    * boundedCount(estimate.experiment_groups ?? estimate.experimentGroups, 20)
  )
}

export const getDspCreativeDownloadUrl = (job = {}) => safeDspPublicAssetUrl(
  job.zip_url
  || job.zipUrl
  || job.download_url
  || job.downloadUrl
  || job.result?.zip_url
  || job.result?.download_url
  || '',
  '.zip'
)

export const getDspCreativeGifDownloads = (result = {}) => {
  if (result.visualAuditPassed === false) return []
  const downloads = []
  const seen = new Set()
  const addDownload = (rawUrl, label) => {
    const gifUrl = safeDspPublicAssetUrl(rawUrl, '.gif')
    if (!gifUrl || seen.has(gifUrl)) return
    seen.add(gifUrl)
    downloads.push({ gifUrl, label })
  }

  addDownload(result.gifUrl || result.gif_url, '下载该 GIF')
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files.slice(0, 50)) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) continue
    if (file.qualityPassed !== true) continue
    const size = String(file.size || '').trim()
    addDownload(
      file.gifUrl || file.gif_url,
      /^\d{2,5}x\d{2,5}$/.test(size)
        ? `下载 ${size} GIF`
        : '下载 GIF'
    )
  }
  return downloads
}

const safeResultText = (value) => boundedString(value, 2000)
const safeResultNumber = (value) => (
  Number.isInteger(value) && value >= 0 ? value : 0
)
const safeNonnegativeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

export const getDspCreativeGenerationResults = (job = {}) => {
  const payload = unwrapDspCreativePayload(job)
  const generated = payload?.generation_results || payload?.result?.generation_results
  const source = Array.isArray(generated) ? generated : []
  if (source.length > 0) {
    const normalized = source
      .filter((result) => result && typeof result === 'object' && !Array.isArray(result))
      .map((result) => {
        const copy = result.copy && typeof result.copy === 'object' ? result.copy : {}
        const sourceMetrics = (
          result.source_metrics
          && typeof result.source_metrics === 'object'
          && !Array.isArray(result.source_metrics)
        ) ? result.source_metrics : null
        const visualAudit = (
          result.visual_audit
          && typeof result.visual_audit === 'object'
          && !Array.isArray(result.visual_audit)
        ) ? result.visual_audit : null
        const files = Array.isArray(result.files) ? result.files : []
        const normalizedFiles = files
          .filter((file) => file && typeof file === 'object' && !Array.isArray(file))
          .slice(0, 50)
          .map((file) => {
            const width = safeResultNumber(file.width)
            const height = safeResultNumber(file.height)
            const explicitSize = safeResultText(file.size)
            return {
              size: explicitSize || (
                width > 0 && height > 0 ? `${width}x${height}` : ''
              ),
              width,
              height,
              bytes: safeResultNumber(file.bytes),
              sha256: /^[a-f0-9]{64}$/i.test(String(file.sha256 || ''))
                ? String(file.sha256).toLowerCase()
                : '',
              qualityPassed: file.quality?.passed === true,
              gifUrl: safeDspPublicAssetUrl(
                file.gif_url || file.gifUrl || file.url,
                '.gif'
              )
            }
          })
        return {
          candidateKey: safeResultText(
            result.candidate_key || result.candidateKey
          ),
          creativeId: safeResultText(
            result.creative_id || result.creativeId
          ),
          variant: safeResultText(result.variant),
          category: safeResultText(result.category),
          headline: safeResultText(result.headline ?? copy.headline),
          body: safeResultText(result.body ?? copy.body),
          cta: safeResultText(result.cta ?? copy.cta),
          motionPrompt: safeResultText(result.motion_prompt ?? copy.motion_prompt),
          ...(result.experiment_axis || result.experiment_label
            ? {
                experimentAxis: safeResultText(result.experiment_axis),
                experimentLabel: safeResultText(result.experiment_label)
              }
            : {}),
          ...(visualAudit
            ? {
                visualAuditPassed: visualAudit.passed === true,
                visualAuditReason: safeResultText(visualAudit.reason)
              }
            : {}),
          ...(sourceMetrics
            ? {
                sourceMetrics: {
                  impressions: safeNonnegativeNumber(sourceMetrics.impressions),
                  clicks: safeNonnegativeNumber(sourceMetrics.clicks),
                  ctr: safeNonnegativeNumber(sourceMetrics.ctr),
                  spend: safeNonnegativeNumber(sourceMetrics.spend),
                  wilsonCtr: safeNonnegativeNumber(sourceMetrics.wilson_ctr)
                }
              }
            : {}),
          gifUrl: safeDspPublicAssetUrl(
            result.gif_url || result.gifUrl || result.url,
            '.gif'
          ),
          files: normalizedFiles
        }
      })
      .filter((result) => DSP_GIF_VARIANTS.includes(result.variant))
    const merged = new Map()
    for (const result of normalized) {
      const key = [
        result.candidateKey,
        result.creativeId,
        result.variant
      ].join('\u0000')
      if (!merged.has(key)) {
        merged.set(key, {
          ...result,
          files: []
        })
      }
      const current = merged.get(key)
      if (!current.gifUrl && result.gifUrl) current.gifUrl = result.gifUrl
      const knownFiles = new Set(
        current.files.map((file) => (
          file.gifUrl || `${file.size}\u0000${file.sha256}`
        ))
      )
      for (const file of result.files) {
        const fileKey = file.gifUrl || `${file.size}\u0000${file.sha256}`
        if (knownFiles.has(fileKey)) continue
        knownFiles.add(fileKey)
        current.files.push(file)
      }
    }
    return [...merged.values()]
  }

  const reverseResults = payload?.reverse_results || payload?.result?.reverse_results
  return (Array.isArray(reverseResults) ? reverseResults : [])
    .filter((result) => result && typeof result === 'object' && !Array.isArray(result))
    .flatMap((result) => (
      Array.isArray(result.variants)
        ? result.variants.map((variant) => ({
            candidateKey: safeResultText(
              result.candidate_key || result.candidateKey
            ),
            creativeId: safeResultText(
              result.creative_id || result.creativeId
            ),
            variant: safeResultText(variant?.variant),
            category: safeResultText(result.category),
            headline: safeResultText(variant?.headline),
            body: safeResultText(variant?.body),
            cta: safeResultText(variant?.cta),
            motionPrompt: safeResultText(variant?.motion_prompt),
            gifUrl: '',
            files: []
          }))
        : []
    ))
    .filter((result) => DSP_GIF_VARIANTS.includes(result.variant))
}

const DSP_GIF_SIZE_ORDER = new Map(
  ['300x100', '300x250', '720x240', '200x200']
    .map((size, index) => [size, index])
)

export const buildDspGifPreviewCatalog = (job = {}) => {
  const catalog = []
  for (const result of getDspCreativeGenerationResults(job)) {
    if (result.visualAuditPassed === false) continue
    for (const file of result.files) {
      if (!file.gifUrl || !file.size || !file.qualityPassed) continue
      catalog.push({
        key: [
          result.candidateKey,
          result.variant,
          file.size
        ].join('\u0000'),
        candidateKey: result.candidateKey,
        creativeId: result.creativeId,
        category: result.category,
        variant: result.variant,
        size: file.size,
        width: file.width,
        height: file.height,
        gifUrl: file.gifUrl,
        headline: result.headline,
        body: result.body,
        cta: result.cta,
        experimentAxis: result.experimentAxis || '',
        experimentLabel: result.experimentLabel || '',
        visualAuditPassed: result.visualAuditPassed,
        visualAuditReason: result.visualAuditReason || '',
        sourceMetrics: result.sourceMetrics || null
      })
    }
  }
  return catalog.sort((left, right) => {
    const sourceOrder = (
      left.candidateKey.localeCompare(right.candidateKey)
    )
    if (sourceOrder !== 0) return sourceOrder
    const variantOrder = (
      DSP_GIF_VARIANTS.indexOf(left.variant)
      - DSP_GIF_VARIANTS.indexOf(right.variant)
    )
    if (variantOrder !== 0) return variantOrder
    return (
      (DSP_GIF_SIZE_ORDER.get(left.size) ?? 99)
      - (DSP_GIF_SIZE_ORDER.get(right.size) ?? 99)
    )
  })
}

export const buildDspCreativeLibraryPersistence = (state = {}) => ({
  startDate: normalizeDateOnly(state.startDate),
  endDate: normalizeDateOnly(state.endDate),
  mediaTypes: normalizeDspMediaTypes(state.mediaTypes),
  dimensions: normalizeDspDimensions(state.dimensions),
  account: boundedString(state.account, MAX_DSP_ACCOUNT_LENGTH),
  minImpressions: finiteInteger(
    state.minImpressions,
    DEFAULT_DSP_THRESHOLDS.minImpressions,
    0,
    1_000_000_000
  ),
  minClicks: finiteInteger(
    state.minClicks,
    DEFAULT_DSP_THRESHOLDS.minClicks,
    0,
    1_000_000_000
  ),
  topN: finiteInteger(state.topN, DEFAULT_DSP_THRESHOLDS.topN, 1, 50),
  selectedIds: (() => {
    if (Array.isArray(state.selectedIds) && state.selectedIds.length > MAX_DSP_SELECTED_IDS) {
      throw new RangeError(`最多选择 ${MAX_DSP_SELECTED_IDS} 条候选素材`)
    }
    const selectedIds = [...new Set(
      (Array.isArray(state.selectedIds) ? state.selectedIds : [])
        .map((id) => validateDspCreativeIdentifier(id, '候选标识'))
        .filter(Boolean)
    )]
    if (selectedIds.length > MAX_DSP_SELECTED_IDS) {
      throw new RangeError(`最多选择 ${MAX_DSP_SELECTED_IDS} 条候选素材`)
    }
    return selectedIds
  })(),
  previewRef: validateDspCreativeIdentifier(state.previewRef, '预览标识'),
  previewSignature: (() => {
    const signature = typeof state.previewSignature === 'string'
      ? state.previewSignature
      : ''
    if (signature.length > MAX_DSP_PREVIEW_SIGNATURE_LENGTH) {
      throw new RangeError(
        `预览签名不能超过 ${MAX_DSP_PREVIEW_SIGNATURE_LENGTH} 个字符`
      )
    }
    return signature
  })(),
  jobId: validateDspCreativeIdentifier(state.jobId, '任务标识')
})

export const sanitizeDspCreativeCanvasNodeData = (type, data = {}) => {
  const metadata = {}
  if (typeof data.label === 'string') {
    metadata.label = data.label.slice(0, MAX_DSP_LABEL_LENGTH)
  }
  for (const key of ['createdAt', 'updatedAt']) {
    const value = data[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      metadata[key] = value
    } else if (typeof value === 'string' && value.length <= MAX_DSP_TIMESTAMP_LENGTH) {
      metadata[key] = value
    }
  }

  if (type === 'dspCreativeLibrary') {
    let safeLibraryData
    try {
      safeLibraryData = buildDspCreativeLibraryPersistence(data)
    } catch {
      safeLibraryData = buildDspCreativeLibraryPersistence({
        ...data,
        selectedIds: [],
        previewRef: '',
        previewSignature: '',
        jobId: ''
      })
    }
    return {
      ...metadata,
      ...safeLibraryData
    }
  }
  if (type === 'dspCreativeTaskCenter') {
    let safe
    try {
      safe = sanitizeTaskCenterPersistence({
        jobIds: data.jobIds,
        filters: data.uiPrefs
      })
    } catch {
      safe = sanitizeTaskCenterPersistence({
        jobIds: [],
        filters: data.uiPrefs
      })
    }
    return {
      ...metadata,
      jobIds: safe.jobIds,
      uiPrefs: safe.filters
    }
  }
  return data
}

export const sanitizeTaskCenterPersistence = (state = {}) => {
  const jobIds = [...new Set(
    (Array.isArray(state.jobIds) ? state.jobIds : [])
      .slice(0, MAX_DSP_JOB_IDS)
      .map((id) => validateDspCreativeIdentifier(id, '任务标识'))
      .filter(Boolean)
  )]

  const filters = state.filters || {}
  const status = boundedString(filters.status, 64)
  const mediaType = String(filters.mediaType || '').trim().toUpperCase()
  const query = boundedString(filters.query, MAX_DSP_QUERY_LENGTH)
  return {
    jobIds,
    filters: {
      status,
      mediaType: DEFAULT_DSP_MEDIA_TYPES.includes(mediaType) ? mediaType : '',
      query
    }
  }
}

export const resolveTaskCenterPreferences = (nodePrefs = {}, persistedPrefs = {}) => {
  const normalizedNode = sanitizeTaskCenterPersistence({ filters: nodePrefs }).filters
  const hasNodePreference = Object.values(normalizedNode).some(Boolean)
  return hasNodePreference
    ? normalizedNode
    : sanitizeTaskCenterPersistence({ filters: persistedPrefs }).filters
}

export const readPersistedTaskCenterState = (storage, key = 'dsp-creative-task-center') => {
  try {
    const raw = storage?.getItem?.(key)
    return sanitizeTaskCenterPersistence(raw ? JSON.parse(raw) : {})
  } catch {
    return sanitizeTaskCenterPersistence({})
  }
}

export const persistTaskCenterState = (storage, state, key = 'dsp-creative-task-center') => {
  const safe = sanitizeTaskCenterPersistence(state)
  storage?.setItem?.(key, JSON.stringify(safe))
  return safe
}
