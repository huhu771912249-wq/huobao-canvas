import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 队列可见性 / 任务取消 / 失败重试。
 *
 * 三个可见的缺口：
 *   1. 顶栏算力条只报硬件，队列长度必须展开抽屉才看得到，用户无从判断「要不要等」。
 *   2. 后端 POST /v1/video/task/{id}/cancel 早就实现了，前端一个入口都没有，
 *      排错任务只能干等到超时。
 *   3. 失败的视频节点只有一行红字，重试要回到配置节点重填一遍参数。
 *
 * 字段名对着后端 material_generation_api.py + queue_visibility.py 逐字核过：
 *   /health、/worker/status  → 顶层 video_quality_queue / video_quality_workers /
 *                              video_quality_running / queue_estimate_seconds
 *   /v1/compute/status       → queues.video_quality_waiting / video_quality_workers /
 *                              queue_estimate_seconds
 *   /v1/video/task/{id}      → 顶层与 data 各一份 queue_position / eta_seconds /
 *                              eta_completion_seconds
 *
 * 这里同时把「字段缺失时的降级行为」逐条钉死：一律返回 null 并隐藏对应文案，
 * 绝不允许 NaN、undefined 或凭空捏造的队列位置漏到界面上。
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const {
  describeVideoNodeTask,
  formatCompletionEtaLabel,
  formatDurationLabel,
  formatEtaLabel,
  formatQueueEstimateLabel,
  formatQueueWaitingLabel,
  formatVideoParamsSummary,
  readCancelOutcome,
  readComputeQueueSnapshot,
  readVideoTaskQueueState
} = await import('../src/utils/videoQueueState.js')
const { buildVideoTaskCancelUrl } = await import('../src/utils/videoTaskStatus.js')

// ---------- 算力条队列快照 ----------
// /health 与 /worker/status 的形状：顶层。
assert.deepEqual(
  readComputeQueueSnapshot({
    video_quality_workers: 1, video_quality_running: 1,
    video_quality_queue: 2, queue_estimate_seconds: 240
  }),
  { waiting: 2, workers: 1, estimateSeconds: 240 },
  '/health 顶层的 video_quality_* 必须被直接读出来'
)
// /v1/compute/status 的形状：同一组数字挂在 queues 下，且键名是 video_quality_waiting。
assert.deepEqual(
  readComputeQueueSnapshot({
    queues: {
      video_quality_waiting: 2, video_quality_workers: 1,
      queue_estimate_seconds: 240, comfyui_pending: 4, total_waiting: 9
    }
  }),
  { waiting: 2, workers: 1, estimateSeconds: 240 },
  '/v1/compute/status 的 queues.video_quality_waiting 才是真正在 GPU 前面排队的数量'
)

// —— 反向锁：这两个字段都不是视频队列，读了就会显示错的数 ——
// video_queue 是 #34 之后只负责收请求转手的 HTTP 提交池（不占 GPU），几乎恒为 0。
assert.equal(
  readComputeQueueSnapshot({ video_queue: 7, video_workers: 3 }).waiting,
  null,
  'video_queue 是 HTTP 提交池不是 GPU 队列，读它顶栏会一直显示 0'
)
assert.equal(
  readComputeQueueSnapshot({ video_queue: 7, video_workers: 3 }).workers,
  null,
  'video_workers 同样是提交池的 worker 数，不是编排器池的'
)
// total_waiting 是 comfyui + resize + 提交池 + GPU 队列的总和，拿它当视频队列会偏大。
assert.equal(
  readComputeQueueSnapshot({ queues: { total_waiting: 9, comfyui_pending: 7 } }).waiting,
  null,
  'total_waiting 是各池之和，不能拿来冒充视频队列长度'
)

assert.deepEqual(
  readComputeQueueSnapshot({}),
  { waiting: null, workers: null, estimateSeconds: null },
  '完全没有队列信号时必须是 null，让顶栏整块不渲染'
)
assert.deepEqual(readComputeQueueSnapshot(null), { waiting: null, workers: null, estimateSeconds: null })
assert.equal(
  readComputeQueueSnapshot({ video_quality_queue: 'not-a-number' }).waiting,
  null,
  '脏数据不能变成 NaN 漏进界面'
)
assert.equal(readComputeQueueSnapshot({ video_quality_queue: -1 }).waiting, null, '负数队列长度当作未知')

// queue_estimate_seconds：null = 冷启动没样本（未知），0 = 队列空（现在就能开始）。
// 这两者语义不同，必须区分开。
assert.equal(
  readComputeQueueSnapshot({ video_quality_queue: 0, queue_estimate_seconds: 0 }).estimateSeconds,
  0,
  '队列空时后端返回 0，这是有意义的值，不能当未知'
)
assert.equal(
  readComputeQueueSnapshot({ video_quality_queue: 1, queue_estimate_seconds: null }).estimateSeconds,
  null,
  '没有任何同形状任务跑完过时后端返回 null，必须当未知'
)

// ---------- 单任务队列状态 ----------
// 后端 _with_queue_visibility 把这三个字段同时写到顶层和 data 里，两处都要能读。
assert.deepEqual(
  readVideoTaskQueueState({ queue_position: 2, eta_seconds: 300, eta_completion_seconds: 540 }),
  { queuePosition: 2, etaSeconds: 300, etaCompletionSeconds: 540, currentSegment: null, totalSegments: null }
)
assert.deepEqual(
  readVideoTaskQueueState({ data: { queue_position: 0, eta_seconds: 0, eta_completion_seconds: 260 } }),
  { queuePosition: 0, etaSeconds: 0, etaCompletionSeconds: 260, currentSegment: null, totalSegments: null },
  'queue_position === 0 表示已经轮到它了；此时 eta_seconds 恒为 0，真正有用的是 eta_completion_seconds'
)
assert.deepEqual(
  readVideoTaskQueueState({ status: 'running' }),
  { queuePosition: null, etaSeconds: null, etaCompletionSeconds: null, currentSegment: null, totalSegments: null },
  '字段缺失必须是 null，不能默认成 0 让节点显示「前面还有 0 个」'
)
assert.deepEqual(readVideoTaskQueueState(undefined, undefined), {
  queuePosition: null, etaSeconds: null, etaCompletionSeconds: null, currentSegment: null, totalSegments: null
})
// 分段进度：current_segment / total_segments 顶层与 data 恒定存在，没有分段概念时为 null。
assert.deepEqual(
  readVideoTaskQueueState({ data: { current_segment: 3, total_segments: 5 } }),
  { queuePosition: null, etaSeconds: null, etaCompletionSeconds: null, currentSegment: 3, totalSegments: 5 }
)
assert.deepEqual(
  readVideoTaskQueueState({ queue_position: 0, progress: 0.4 }),
  { queuePosition: 0, etaSeconds: null, etaCompletionSeconds: null, currentSegment: null, totalSegments: null },
  '没有分段字段时必须安静地降级成 null'
)
// 反向锁：segment_count 是给既有调用方保留的旧别名，total_segments 才是判断依据。
// 批量母版任务后端特意让 total_segments 为 null（「母版 1/2」不是时间分段），
// 前端要是从 segment_count 里把它捞回来，就等于把后端这个决定推翻了。
assert.equal(
  readVideoTaskQueueState({ total_segments: null, segment_count: 2, current_segment: null }).totalSegments,
  null,
  'total_segments 为 null 就是「不是分段任务」，不能退回 segment_count 把批量母版伪装成段数'
)

// ---------- 文案格式化 ----------
assert.equal(formatEtaLabel(240), '预计 4 分钟后开始')
assert.equal(formatEtaLabel(45), '预计 45 秒后开始')
assert.equal(formatEtaLabel(0), '即将开始')
assert.equal(formatEtaLabel(null), '', 'eta_seconds 缺失时不显示预计时间')
assert.equal(formatEtaLabel(undefined), '')
assert.equal(formatDurationLabel(372), '6 分 12 秒')
assert.equal(formatDurationLabel(42), '42 秒')
assert.equal(formatDurationLabel(null), '')
assert.equal(formatQueueWaitingLabel(2), '队列 2 个等待')
assert.equal(formatQueueWaitingLabel(null), '')
assert.equal(formatQueueEstimateLabel(240), '约 4 分钟')
assert.equal(formatQueueEstimateLabel(null), '', 'queue_estimate_seconds 无样本时不显示估算')
assert.equal(formatQueueEstimateLabel(0), '即将开始', '0 是「现在就能开始」，不是「约 0 秒」')
assert.equal(formatCompletionEtaLabel(240), '预计还需 4 分钟')
assert.equal(formatCompletionEtaLabel(30), '预计还需 30 秒')
assert.equal(formatCompletionEtaLabel(0), '即将完成')
assert.equal(formatCompletionEtaLabel(null), '', 'eta_completion_seconds 缺失时不显示')

// ---------- 参数摘要 ----------
assert.equal(
  formatVideoParamsSummary({
    model: 'minimax-h3', samplingMode: 'turbo4', output_width: 720, output_height: 1280
  }),
  'H3 · 4 步 turbo · 720×1280'
)
assert.equal(
  formatVideoParamsSummary({
    model: 'minimax-h3', samplingMode: 'turbo4',
    output_width: 720, output_height: 1280,
    actual_width: 1080, actual_height: 1920
  }),
  'H3 · 4 步 turbo · 1080×1920',
  '完成态要展示生效参数，后端回报的实际尺寸优先于提交时的尺寸'
)
assert.equal(
  formatVideoParamsSummary({ model: 'minimax-h3' }),
  'H3',
  '读不出来的段整段省略，不能出现「H3 · undefined」'
)
assert.equal(formatVideoParamsSummary({}), '')

// ---------- 画布节点四态 ----------
const queued = describeVideoNodeTask({ taskId: 't-1', loading: true, queuePosition: 2, etaSeconds: 240 })
assert.equal(queued.state, 'queued')
assert.equal(queued.badgeLabel, '排队中')
assert.equal(queued.aheadLabel, '前面还有 2 个')
assert.equal(queued.etaLabel, '预计 4 分钟后开始')
assert.equal(queued.progressPercent, 0)
assert.equal(queued.canCancel, true, '排队中的任务必须能取消')
assert.equal(queued.canRetry, false)

assert.equal(queued.completionEtaLabel, '', '排队中问的是「多久后开始」，不叠加「还需多久出片」')

const generating = describeVideoNodeTask({
  taskId: 't-2', loading: true, queuePosition: 0, progress: 40,
  etaSeconds: 0, etaCompletionSeconds: 260,
  currentSegment: 3, totalSegments: 5,
  model: 'minimax-h3', samplingMode: 'turbo4', output_width: 720, output_height: 1280
})
assert.equal(generating.state, 'generating')
assert.equal(generating.badgeLabel, '生成中')
assert.equal(generating.segmentLabel, '第 3 / 5 段')
assert.equal(generating.progressPercent, 40)
assert.equal(generating.paramsSummary, 'H3 · 4 步 turbo · 720×1280')
assert.equal(generating.canCancel, true, '生成中的任务必须能取消')
assert.equal(
  generating.completionEtaLabel, '预计还需 4 分钟',
  '跑起来之后要显示 eta_completion_seconds（会随已耗时递减），而不是恒为 0 的 eta_seconds'
)
assert.equal(generating.etaLabel, '', '生成中不显示「多久后开始」')

// 「生成中」必须撑住契约里的三种任务形态（API.md §分段进度）。
// ① FRW 分段拼接：有段数，但 eta_completion_seconds 恒为 null —— 段跑在云端，
//    后端故意不用本机 GPU 中位数去估。前端不许替它编一个时间出来。
const frwCompose = describeVideoNodeTask({
  taskId: 't-frw', loading: true,
  currentSegment: 3, totalSegments: 5, etaCompletionSeconds: null
})
assert.equal(frwCompose.state, 'generating')
assert.equal(frwCompose.segmentLabel, '第 3 / 5 段')
assert.equal(
  frwCompose.completionEtaLabel, '',
  'FRW 分段的 eta_completion_seconds 是 null，只显示段数、不显示时间'
)
// ② 单段任务：没有段数，只有时间。
const singleSegment = describeVideoNodeTask({
  taskId: 't-single', loading: true, queuePosition: 0, progress: 55,
  currentSegment: null, totalSegments: null, etaCompletionSeconds: 260
})
assert.equal(singleSegment.segmentLabel, '', '单段任务不显示段数')
assert.equal(singleSegment.completionEtaLabel, '预计还需 4 分钟')
assert.equal(singleSegment.progressPercent, 55)
// ③ 批量母版任务：两个字段都是 null，不能被还原成段数。
const batchMasters = describeVideoNodeTask({
  taskId: 't-batch', loading: true, progress: 30,
  currentSegment: null, totalSegments: null, etaCompletionSeconds: null
})
assert.equal(batchMasters.segmentLabel, '', '批量母版按画幅迭代，不是分段，不能显示「第 N / M 段」')
assert.equal(batchMasters.completionEtaLabel, '')

// 后端字段全缺时的降级：必须退回「生成中」，而不是崩、不是 NaN、不是假的队列位置。
const degraded = describeVideoNodeTask({ taskId: 't-3', loading: true })
assert.equal(degraded.state, 'generating', '没有 queue_position 就退回「生成中」')
assert.equal(degraded.aheadLabel, '')
assert.equal(degraded.etaLabel, '', '没有 eta_seconds 就不显示预计时间')
assert.equal(degraded.completionEtaLabel, '', '没有 eta_completion_seconds 就不显示还需多久')
assert.equal(degraded.segmentLabel, '')
assert.equal(degraded.showProgress, false)
assert.equal(degraded.progressPercent, 0)
const dirty = describeVideoNodeTask({ taskId: 't-4', loading: true, progress: 'abc', queuePosition: NaN })
assert.equal(Number.isNaN(dirty.progressPercent), false, '脏进度不能变成 NaN')
assert.equal(dirty.aheadLabel, '')

const failed = describeVideoNodeTask({ taskId: 't-5', error: '显存不足，无法启动采样' })
assert.equal(failed.state, 'failed')
assert.equal(failed.badgeLabel, '失败')
assert.equal(failed.errorText, '显存不足，无法启动采样', '失败必须给出具体错误文案')
assert.equal(failed.canRetry, true, '失败的任务必须能一键重试')
assert.equal(failed.canCancel, false, '已经失败的任务没有可取消的东西')

const completed = describeVideoNodeTask({
  url: 'https://example.com/a.mp4', startedAt: 1, durationSeconds: 372
})
assert.equal(completed.state, 'completed')
assert.equal(completed.badgeLabel, '完成')
assert.equal(completed.durationLabel, '6 分 12 秒')
assert.equal(completed.progressPercent, 100)
assert.equal(
  describeVideoNodeTask({ url: 'blob:local-upload' }).state,
  'idle',
  '手动上传的视频没跑过任务，不该顶着「完成」徽章和 100% 进度条'
)
assert.equal(
  describeVideoNodeTask({ url: 'https://example.com/a.mp4', startedAt: 1 }).durationLabel,
  '',
  '没记到耗时就不显示用时'
)

const cancelled = describeVideoNodeTask({ status: 'cancelled', cancelledAt: 1 })
assert.equal(cancelled.state, 'cancelled', '取消后要有自己的终态，不能被当成失败')
assert.equal(cancelled.canRetry, true)
assert.equal(cancelled.canCancel, false)

assert.equal(describeVideoNodeTask({}).state, 'idle')
assert.equal(describeVideoNodeTask(null).state, 'idle')

// ---------- 取消端点 ----------
assert.equal(
  buildVideoTaskCancelUrl('http://127.0.0.1:8788/v1/video/task/{taskId}', 'task 1'),
  'http://127.0.0.1:8788/v1/video/task/task%201/cancel'
)
assert.equal(buildVideoTaskCancelUrl('/videos', 'task-1'), '/videos/task-1/cancel')
assert.equal(buildVideoTaskCancelUrl('/videos', ''), '/videos', '没有任务 ID 时不能拼出一个假的取消地址')

// ---------- 取消的真实语义 ----------
// 后端 VideoQualityStore.cancel 对已经 completed 的任务原样返回、状态不变，
// 但 HTTP 仍然是 200。「2xx = 取消成功」是错的，必须看返回体里的 status。
const finished = readCancelOutcome({ status: 'completed', data: { status: 'completed' } })
assert.equal(finished.cancelled, false, '已经跑完的任务不能被判成取消成功')
assert.equal(finished.alreadyFinished, true)
assert.match(finished.message, /已经生成完/)

const cancelledRunning = readCancelOutcome({
  status: 'cancelled', cancel_disposition: 'running_not_interrupted'
})
assert.equal(cancelledRunning.cancelled, true)
assert.match(
  cancelledRunning.message, /不会被打断/,
  '正在跑的活并不会真的停下，文案必须如实说明，不能只说一句「已取消」'
)
const cancelledCloud = readCancelOutcome({
  data: { status: 'cancelled', cancel_disposition: 'cloud_not_cancelled' }
})
assert.equal(cancelledCloud.cancelled, true)
assert.match(cancelledCloud.message, /云端任务不会被打断/)

assert.equal(
  readCancelOutcome({ cancel_latched: true }).cancelled, true,
  'cancel_latched 也是取消成功的凭据'
)
assert.equal(
  readCancelOutcome({ status: 'running' }).cancelled, false,
  '后端没确认取消就不能把节点擦成已取消'
)
assert.equal(readCancelOutcome({}).cancelled, false)
assert.equal(readCancelOutcome(null).cancelled, false)

// ---------- 接线 ----------
const videoApiSource = read('../src/api/video.js')
assert.match(videoApiSource, /export const cancelVideoTask/, '取消必须有 API 层入口')
assert.match(videoApiSource, /buildVideoTaskCancelUrl/)
assert.match(videoApiSource, /method:\s*'post'/)

const useApiSource = read('../src/hooks/useApi.js')
assert.match(useApiSource, /cancelVideoTask/, 'useVideoGeneration 必须把取消暴露给节点')
assert.match(useApiSource, /getVideoTaskEndpoint\(\)/)
assert.match(useApiSource, /readVideoTaskQueueState/, '轮询必须顺路把队列字段带回节点')
assert.match(useApiSource, /options\?\.signal/, '取消要能立刻中止轮询，而不是再空转一个轮询间隔')

const videoNodeSource = read('../src/components/nodes/VideoNode.vue')
assert.match(videoNodeSource, /data-testid="video-task-cancel"/, '排队/生成中的节点必须有取消按钮')
assert.match(videoNodeSource, /data-testid="video-task-retry"/, '失败的节点必须有重试按钮')
assert.match(videoNodeSource, /data-testid="video-task-badge"/)
assert.match(videoNodeSource, /describeVideoNodeTask/, '节点状态必须走可单测的纯函数，不要在模板里堆三元')
assert.match(videoNodeSource, /参数已保留，重试不用重填/)
assert.match(videoNodeSource, /var\(--danger-color\)/, '失败卡片要用 danger 色')
assert.match(videoNodeSource, /retryRequest/, '重试必须把参数交还给上游配置节点，而不是自己重建一份')
assert.match(
  videoNodeSource, /readCancelOutcome\(await cancelVideoTask\(taskId\)\)/,
  '取消结果必须过一遍返回体判定，不能默认 HTTP 200 就是取消成功'
)
assert.match(
  videoNodeSource, /if \(!outcome\.cancelled\) \{[\s\S]{0,400}?\breturn\b/,
  '后端没确认取消时必须提前返回，绝不能把刚跑完的节点擦成「已取消」丢掉结果'
)
assert.match(videoNodeSource, /etaCompletionSeconds/, '生成中那一态要显示还需多久出片')

const videoConfigSource = read('../src/components/nodes/VideoConfigNode.vue')
assert.match(
  videoConfigSource,
  /watch\(\s*\n?\s*\(\) => props\.data\?\.retryRequest\?\.at/,
  '配置节点必须响应输出节点的重试请求'
)
assert.doesNotMatch(
  videoConfigSource.slice(videoConfigSource.indexOf('props.data?.retryRequest?.at')),
  /^[\s\S]{0,600}immediate:\s*true/,
  'retryRequest 会随画布持久化，加 immediate 会让刷新页面自动重发任务'
)
assert.match(videoConfigSource, /startedAt: runStartedAt/, '完成态要报「用时」，起点必须在提交时落下')

const indicatorSource = read('../src/components/ComputeStatusIndicator.vue')
assert.match(indicatorSource, /data-testid="compute-queue-badge"/, '顶栏必须能直接看到队列长度')
assert.match(indicatorSource, /data-testid="compute-queue-link"/)
assert.match(indicatorSource, /查看队列/)
assert.match(indicatorSource, /readComputeQueueSnapshot/)
assert.match(indicatorSource, /compute-monitor__queue-badge/)
assert.match(indicatorSource, /var\(--warning-color\)/, '队列徽章用警告色调')
assert.match(indicatorSource, /router\.push\('\/tasks'\)/, '「查看队列」进任务中心')

// 字段名反向锁：源码里不许再出现那两个错字段，否则顶栏会显示另一个池的数字。
const queueStateSource = read('../src/utils/videoQueueState.js')
const readsField = (source, field) =>
  new RegExp(`['"\`]${field}['"\`]`).test(source.replace(/\/\*[\s\S]*?\*\//g, ''))
for (const field of ['video_queue', 'video_workers', 'total_waiting']) {
  assert.equal(
    readsField(queueStateSource, field), false,
    `${field} 不是 GPU 视频队列（提交池 / 各池之和），读它会显示错的数`
  )
}
for (const field of ['video_quality_queue', 'video_quality_waiting', 'video_quality_workers']) {
  assert.equal(readsField(queueStateSource, field), true, `必须读真正的 GPU 队列字段 ${field}`)
}
for (const field of ['segment_count', 'segment_index']) {
  assert.equal(
    readsField(queueStateSource, field), false,
    `${field} 是旧别名，判断依据必须是恒定输出的 total_segments / current_segment`
  )
}
for (const field of ['current_segment', 'total_segments', 'eta_completion_seconds']) {
  assert.equal(readsField(queueStateSource, field), true, `必须读分段契约字段 ${field}`)
}

// 轮询处数不增加：队列可见性全部搭在已有的两处轮询上
// （算力条 5 秒一次的 setInterval + useApi 里唯一那个带预算的任务轮询循环）。
assert.equal(
  (indicatorSource.match(/setInterval/g) || []).length,
  1,
  '算力条只能有原来那一个定时器'
)
for (const [name, source] of [['VideoNode.vue', videoNodeSource], ['VideoConfigNode.vue', videoConfigSource]]) {
  assert.equal(
    (source.match(/setInterval/g) || []).length,
    0,
    `${name} 不允许自己起轮询循环，队列状态搭已有的任务轮询顺路带回来`
  )
}
assert.equal(
  (useApiSource.match(/createPollingBudget\(/g) || []).length,
  1,
  '视频任务仍然只有一个带预算的轮询循环'
)

console.log('videoQueueVisibility.test.mjs passed')
