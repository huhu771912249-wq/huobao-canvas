/**
 * Video queue visibility | 视频队列可见性
 *
 * 队列位置、预计时间、任务耗时和参数摘要的纯函数层。UI 只负责渲染，判断全部在这里，
 * 这样「后端字段缺失时优雅降级」可以被直接单测覆盖，而不用起浏览器。
 *
 * 后端契约（另一侧仍在实现，合并前这些字段全部拿不到）：
 *   GET /v1/compute/status → video_queue / video_workers / queue_estimate_seconds
 *   GET /v1/video/task/{id} → queue_position (0 = 正在跑) / eta_seconds
 * 缺失即为「不知道」：一律返回 null，调用方据此隐藏对应文案，绝不显示 NaN 或 0。
 */

/** 只接受有限数字，其余（undefined / null / '' / 'abc' / NaN / Infinity）一律当作未知。 */
const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** 非负整数计数；负数是后端 bug，同样当作未知而不是显示 -1。 */
const countOrNull = (value) => {
  const number = finiteOrNull(value)
  if (number === null || number < 0) return null
  return Math.floor(number)
}

/** 依次尝试多个字段名，取第一个能读出数字的。 */
const pickCount = (sources, keys) => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of keys) {
      const parsed = countOrNull(source[key])
      if (parsed !== null) return parsed
    }
  }
  return null
}

const asObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null)

/**
 * 顶栏算力条要的队列快照。
 * `video_queue` 是新契约字段；没有它就退回今天已经在用的 `queues.total_waiting`，
 * 所以后端合并之前顶栏也不是空的。
 */
export const readComputeQueueSnapshot = (status) => {
  const data = asObject(status) || {}
  const queues = asObject(data.queues) || {}
  return {
    waiting: pickCount([data, queues], ['video_queue', 'total_waiting']),
    workers: pickCount([data, queues], ['video_workers']),
    estimateSeconds: pickCount([data, queues], ['queue_estimate_seconds'])
  }
}

/**
 * 单个视频任务的队列状态。
 * queue_position === 0 表示已经轮到它了（正在跑），大于 0 才是排队。
 * 字段缺失时返回 null，节点据此退回「生成中」，不会假装知道排在第几位。
 */
export const readVideoTaskQueueState = (result, adaptedResult) => {
  const raw = asObject(result) || {}
  const nested = asObject(raw.data) || {}
  const adapted = asObject(adaptedResult) || {}
  const sources = [raw, nested, adapted]
  return {
    queuePosition: pickCount(sources, ['queue_position']),
    etaSeconds: pickCount(sources, ['eta_seconds']),
    currentSegment: pickCount(sources, ['current_segment', 'segment_index']),
    totalSegments: pickCount(sources, ['total_segments', 'segment_count'])
  }
}

/** 「6 分 12 秒」/「42 秒」/「1 小时 2 分」。未知或 0 返回空串，调用方直接不渲染。 */
export const formatDurationLabel = (seconds) => {
  const total = countOrNull(seconds)
  if (total === null || total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours) return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
  if (minutes) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`
  return `${rest} 秒`
}

/** 「预计 4 分钟后开始」。eta_seconds 缺失就返回空串——不显示比瞎猜好。 */
export const formatEtaLabel = (seconds) => {
  const total = countOrNull(seconds)
  if (total === null) return ''
  if (total <= 0) return '即将开始'
  if (total < 60) return `预计 ${total} 秒后开始`
  return `预计 ${Math.max(1, Math.round(total / 60))} 分钟后开始`
}

/** 顶栏「队列 2 个等待」。没有队列信号时返回空串。 */
export const formatQueueWaitingLabel = (waiting) => {
  const total = countOrNull(waiting)
  if (total === null) return ''
  return `队列 ${total} 个等待`
}

/** 顶栏队列徽章后缀「约 4 分钟」。queue_estimate_seconds 为 null 时不显示。 */
export const formatQueueEstimateLabel = (seconds) => {
  const total = countOrNull(seconds)
  if (total === null) return ''
  if (total < 60) return `约 ${total} 秒`
  return `约 ${Math.max(1, Math.round(total / 60))} 分钟`
}

const MODEL_LABELS = {
  'minimax-h3': 'H3',
  'ltx-2.3': 'LTX 2.3'
}

const SAMPLING_LABELS = {
  turbo4: '4 步 turbo',
  standard20: '20 步标准'
}

const validSize = (width, height) => {
  const w = countOrNull(width)
  const h = countOrNull(height)
  return w && h ? `${w}×${h}` : ''
}

/**
 * 参数摘要，例如「H3 · 4 步 turbo · 720×1280」。
 * 完成态优先用后端回报的 actual_width/actual_height（生效参数），
 * 其次是提交时的 output_width/output_height，最后是清晰度档位的目标分辨率。
 * 任何一段读不出来就整段省略，不会出现「H3 · undefined」。
 */
export const formatVideoParamsSummary = (data) => {
  const node = asObject(data) || {}
  const model = String(node.model || '').trim()
  const parts = []
  if (model) parts.push(MODEL_LABELS[model] || model)

  const sampling = String(node.samplingMode || node.sampling_mode || '').trim()
  if (sampling) parts.push(SAMPLING_LABELS[sampling] || sampling)

  const profile = asObject(node.qualityProfile) || {}
  const size = validSize(node.actual_width, node.actual_height)
    || validSize(node.output_width, node.output_height)
    || validSize(profile.width, profile.height)
  if (size) parts.push(size)

  return parts.join(' · ')
}

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled'])

const normalize = value => String(value ?? '').trim().toLowerCase()

/**
 * 把节点 data 归纳成画布节点要渲染的一种状态。
 * 顺序很重要：已取消要压过失败（后端把取消也算 failed 状态），
 * 有结果 URL 要压过 taskId 残留。
 */
export const describeVideoNodeTask = (data) => {
  const node = asObject(data) || {}
  const status = normalize(node.status)
  const cancelled = CANCELLED_STATUSES.has(status) || Boolean(node.cancelledAt)
  const hasUrl = Boolean(node.url)
  const queuePosition = countOrNull(node.queuePosition)
  const etaSeconds = countOrNull(node.etaSeconds)
  const progress = finiteOrNull(node.progress)
  const paramsSummary = formatVideoParamsSummary(node)

  const base = {
    state: 'idle',
    badgeLabel: '',
    aheadLabel: '',
    etaLabel: '',
    segmentLabel: '',
    stepLabel: String(node.currentStep || '').trim(),
    progressPercent: 0,
    showProgress: false,
    paramsSummary,
    durationLabel: '',
    errorText: '',
    canCancel: false,
    canRetry: false
  }

  if (cancelled && !hasUrl) {
    return { ...base, state: 'cancelled', badgeLabel: '已取消', canRetry: true }
  }

  if (node.error) {
    return {
      ...base,
      state: 'failed',
      badgeLabel: '失败',
      errorText: String(node.error),
      canRetry: true
    }
  }

  if (hasUrl) {
    // 手动上传的视频节点同样有 url，但它没跑过任务，不该顶着「完成」徽章和 100% 进度条。
    // startedAt 由配置节点在提交那一刻写下，是「这个节点跑过一次生成」的唯一凭据。
    if (finiteOrNull(node.startedAt) === null) return base
    return {
      ...base,
      state: 'completed',
      badgeLabel: '完成',
      progressPercent: 100,
      showProgress: true,
      durationLabel: formatDurationLabel(node.durationSeconds)
    }
  }

  const waitingInQueue = queuePosition !== null && queuePosition > 0
  const running = Boolean(node.taskId) || Boolean(node.loading)
  if (!running) return base

  if (waitingInQueue) {
    return {
      ...base,
      state: 'queued',
      badgeLabel: '排队中',
      aheadLabel: `前面还有 ${queuePosition} 个`,
      etaLabel: formatEtaLabel(etaSeconds),
      progressPercent: 0,
      showProgress: true,
      canCancel: Boolean(node.taskId)
    }
  }

  const current = countOrNull(node.currentSegment)
  const total = countOrNull(node.totalSegments)
  return {
    ...base,
    state: 'generating',
    badgeLabel: '生成中',
    segmentLabel: current !== null && total ? `第 ${current} / ${total} 段` : '',
    progressPercent: progress === null ? 0 : Math.max(0, Math.min(100, Math.round(progress))),
    showProgress: progress !== null,
    canCancel: Boolean(node.taskId)
  }
}
