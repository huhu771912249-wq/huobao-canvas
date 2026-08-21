/**
 * Video queue visibility | 视频队列可见性
 *
 * 队列位置、预计时间、任务耗时和参数摘要的纯函数层。UI 只负责渲染，判断全部在这里，
 * 这样「后端字段缺失时优雅降级」可以被直接单测覆盖，而不用起浏览器。
 *
 * 后端契约（已对着 material_generation_api.py + queue_visibility.py 逐字核过）：
 *   GET /health、/worker/status（顶层）
 *     video_quality_workers / video_quality_running / video_quality_queue
 *     queue_estimate_seconds / duration_samples
 *   GET /v1/compute/status（在 queues 下）
 *     video_quality_waiting / video_quality_workers / queue_estimate_seconds
 *   GET /v1/video/task/{id}（顶层与 data 各一份）
 *     queue_position (0 = 正在跑) / eta_seconds (多久后开始) / eta_completion_seconds (多久后完成)
 *
 * 注意不要读 video_queue / video_workers：那是 #34 之后只负责收请求转手的 HTTP 提交池
 * （video_executor，不占 GPU），几乎恒为 0。真正在 GPU 前面排队的是
 * VideoQualityOrchestrator 的池 + GpuJobQueue 独占锁，也就是 video_quality_* 这组。
 * 同样不要退回 queues.total_waiting：它是把 comfyui / resize / 提交池全加起来的和，
 * 拿它当视频队列长度会显示一个偏大的错数。
 *
 * 缺失即为「不知道」：一律返回 null，调用方据此隐藏对应文案，绝不显示 NaN。
 * 但 0 是有意义的值（队列空 = 现在就能开始），不能和 null 混为一谈。
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
 * /health、/worker/status 把这组字段放顶层，/v1/compute/status 放在 queues 下，
 * 所以两处都读。读不到就是 null —— 宁可不显示，也不拿另一个池的数字冒充。
 */
export const readComputeQueueSnapshot = (status) => {
  const data = asObject(status) || {}
  const queues = asObject(data.queues) || {}
  const sources = [data, queues]
  return {
    waiting: pickCount(sources, ['video_quality_queue', 'video_quality_waiting']),
    workers: pickCount(sources, ['video_quality_workers']),
    estimateSeconds: pickCount(sources, ['queue_estimate_seconds'])
  }
}

/**
 * 单个视频任务的队列状态。
 * queue_position === 0 表示已经轮到它了（正在跑），大于 0 才是排队。
 * eta_seconds 是「多久后开始」，eta_completion_seconds 是「多久后完成」——
 * 后者会随正在跑的任务已耗时递减，是生成中那一态真正该显示的数字。
 * 字段缺失时返回 null，节点据此退回「生成中」，不会假装知道排在第几位。
 *
 * currentSegment / totalSegments：只读 total_segments，**不要**回退到 segment_count。
 * 两者同值，但 segment_count 是给既有调用方保留的旧名，而 total_segments 是后端
 * 专门为「是不是时间分段任务」这个判断而恒定输出的字段（无分段概念时为 null）。
 * 批量母版任务按画幅比例迭代（「母版 1/2」），后端特意不把它伪装成分段 ——
 * 前端再从别名里把它捞回来就等于把这个决定推翻了。
 */
export const readVideoTaskQueueState = (result, adaptedResult) => {
  const raw = asObject(result) || {}
  const nested = asObject(raw.data) || {}
  const adapted = asObject(adaptedResult) || {}
  const sources = [raw, nested, adapted]
  return {
    queuePosition: pickCount(sources, ['queue_position']),
    etaSeconds: pickCount(sources, ['eta_seconds']),
    etaCompletionSeconds: pickCount(sources, ['eta_completion_seconds']),
    currentSegment: pickCount(sources, ['current_segment']),
    totalSegments: pickCount(sources, ['total_segments'])
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

/**
 * 顶栏队列徽章后缀「约 4 分钟」。
 * queue_estimate_seconds 为 null（冷启动，没有任何同形状任务跑完过）时不显示；
 * 为 0 是有意义的值（队列空 / 前面那个已经超时），说成「即将开始」而不是「约 0 秒」。
 */
export const formatQueueEstimateLabel = (seconds) => {
  const total = countOrNull(seconds)
  if (total === null) return ''
  if (total === 0) return '即将开始'
  if (total < 60) return `约 ${total} 秒`
  return `约 ${Math.max(1, Math.round(total / 60))} 分钟`
}

/** 生成中那一态的「预计还需 4 分钟」，来自 eta_completion_seconds。 */
export const formatCompletionEtaLabel = (seconds) => {
  const total = countOrNull(seconds)
  if (total === null) return ''
  if (total === 0) return '即将完成'
  if (total < 60) return `预计还需 ${total} 秒`
  return `预计还需 ${Math.max(1, Math.round(total / 60))} 分钟`
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
const COMPLETE_STATUSES = new Set(['completed', 'succeeded', 'success', 'done'])

const normalize = value => String(value ?? '').trim().toLowerCase()

/**
 * 后端取消的真实语义（huobao_video_quality_pipeline.py:VideoQualityStore.cancel）：
 * 已经 completed 的任务会被原样返回、状态不变，但 HTTP 仍然是 200。
 * 所以「2xx = 取消成功」是错的，必须看返回体里的 status。
 *
 * 取消成功时 cancel_disposition 会说明后端到底做了什么：
 * 两种取值都表示「正在跑的活不会被打断」，只是被打断的对象不同。
 * 任务被 cancel_latched 之后 publish_if_owner 会拒绝发布，所以结果确实会被丢弃 ——
 * 但机器不会立刻空出来，这一点必须如实告诉用户，不能只说一句「已取消」。
 */
const CANCEL_DISPOSITION_NOTES = {
  running_not_interrupted: '已取消：正在跑的这一段不会被打断，但结果会被丢弃',
  cloud_not_cancelled: '已取消：云端任务不会被打断，但结果会被丢弃'
}

export const readCancelOutcome = (response) => {
  const raw = asObject(response) || {}
  const nested = asObject(raw.data) || {}
  const status = normalize(raw.status || nested.status)
  const disposition = String(raw.cancel_disposition || nested.cancel_disposition || '').trim()
  const latched = raw.cancel_latched === true || nested.cancel_latched === true

  if (COMPLETE_STATUSES.has(status)) {
    return {
      cancelled: false,
      alreadyFinished: true,
      message: '任务在取消前已经生成完了，结果照常保留'
    }
  }
  if (CANCELLED_STATUSES.has(status) || latched) {
    return {
      cancelled: true,
      alreadyFinished: false,
      message: CANCEL_DISPOSITION_NOTES[disposition] || '任务已取消'
    }
  }
  return {
    cancelled: false,
    alreadyFinished: false,
    message: '后端没有确认取消，请稍后在任务中心核对任务状态'
  }
}

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
    completionEtaLabel: '',
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

  // total_segments 是「单段 / 多段」的权威判断依据（契约 §分段进度）；
  // 生成中这一态要同时撑住三种组合：
  //   local-cloud-compose → 有段数 + 有时间
  //   frw-compose        → 有段数，时间恒为 null（段跑在云端，本机中位数估不了）
  //   单段任务            → 没段数，只有时间
  const total = countOrNull(node.totalSegments)
  const current = countOrNull(node.currentSegment)
  return {
    ...base,
    state: 'generating',
    badgeLabel: '生成中',
    // 排队时问的是「还要等多久才开始」，跑起来之后问的是「还要多久出片」，
    // 所以这一态用 eta_completion_seconds 而不是 eta_seconds（后者此时恒为 0）。
    completionEtaLabel: formatCompletionEtaLabel(node.etaCompletionSeconds),
    segmentLabel: total && current !== null ? `第 ${current} / ${total} 段` : '',
    progressPercent: progress === null ? 0 : Math.max(0, Math.min(100, Math.round(progress))),
    showProgress: progress !== null,
    canCancel: Boolean(node.taskId)
  }
}
