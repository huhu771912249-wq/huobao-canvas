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
 * 队列字段（video_queue / queue_estimate_seconds / queue_position / eta_seconds）
 * 的后端实现还没合并，所以这里逐条钉死「字段缺失时的降级行为」：一律返回 null 并
 * 隐藏对应文案，绝不允许 NaN、undefined 或凭空捏造的队列位置漏到界面上。
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const {
  describeVideoNodeTask,
  formatDurationLabel,
  formatEtaLabel,
  formatQueueEstimateLabel,
  formatQueueWaitingLabel,
  formatVideoParamsSummary,
  readComputeQueueSnapshot,
  readVideoTaskQueueState
} = await import('../src/utils/videoQueueState.js')
const { buildVideoTaskCancelUrl } = await import('../src/utils/videoTaskStatus.js')

// ---------- 算力条队列快照 ----------
assert.deepEqual(
  readComputeQueueSnapshot({ video_queue: 2, video_workers: 1, queue_estimate_seconds: 240 }),
  { waiting: 2, workers: 1, estimateSeconds: 240 },
  '新契约字段必须被直接读出来'
)
assert.deepEqual(
  readComputeQueueSnapshot({ queues: { total_waiting: 3, comfyui_running: 1 } }),
  { waiting: 3, workers: null, estimateSeconds: null },
  '后端还没合并时必须退回今天已有的 total_waiting，而不是把顶栏留空'
)
assert.deepEqual(
  readComputeQueueSnapshot({}),
  { waiting: null, workers: null, estimateSeconds: null },
  '完全没有队列信号时必须是 null，让顶栏整块不渲染'
)
assert.deepEqual(readComputeQueueSnapshot(null), { waiting: null, workers: null, estimateSeconds: null })
assert.equal(
  readComputeQueueSnapshot({ video_queue: 'not-a-number' }).waiting,
  null,
  '脏数据不能变成 NaN 漏进界面'
)
assert.equal(readComputeQueueSnapshot({ video_queue: -1 }).waiting, null, '负数队列长度当作未知')

// ---------- 单任务队列状态 ----------
assert.deepEqual(
  readVideoTaskQueueState({ queue_position: 2, eta_seconds: 300 }),
  { queuePosition: 2, etaSeconds: 300, currentSegment: null, totalSegments: null }
)
assert.deepEqual(
  readVideoTaskQueueState({ data: { queue_position: 0, eta_seconds: 0 } }),
  { queuePosition: 0, etaSeconds: 0, currentSegment: null, totalSegments: null },
  'queue_position === 0 表示已经轮到它了，必须能和「没有这个字段」区分开'
)
assert.deepEqual(
  readVideoTaskQueueState({ status: 'running' }),
  { queuePosition: null, etaSeconds: null, currentSegment: null, totalSegments: null },
  '字段缺失必须是 null，不能默认成 0 让节点显示「前面还有 0 个」'
)
assert.deepEqual(readVideoTaskQueueState(undefined, undefined), {
  queuePosition: null, etaSeconds: null, currentSegment: null, totalSegments: null
})

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

const generating = describeVideoNodeTask({
  taskId: 't-2', loading: true, queuePosition: 0, progress: 40,
  currentSegment: 3, totalSegments: 5,
  model: 'minimax-h3', samplingMode: 'turbo4', output_width: 720, output_height: 1280
})
assert.equal(generating.state, 'generating')
assert.equal(generating.badgeLabel, '生成中')
assert.equal(generating.segmentLabel, '第 3 / 5 段')
assert.equal(generating.progressPercent, 40)
assert.equal(generating.paramsSummary, 'H3 · 4 步 turbo · 720×1280')
assert.equal(generating.canCancel, true, '生成中的任务必须能取消')

// 后端字段全缺时的降级：必须退回「生成中」，而不是崩、不是 NaN、不是假的队列位置。
const degraded = describeVideoNodeTask({ taskId: 't-3', loading: true })
assert.equal(degraded.state, 'generating', '没有 queue_position 就退回「生成中」')
assert.equal(degraded.aheadLabel, '')
assert.equal(degraded.etaLabel, '', '没有 eta_seconds 就不显示预计时间')
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
