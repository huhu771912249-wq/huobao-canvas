const NAV_ITEMS = [
  ['home', '创作首页', '/'],
  ['image', 'AI 作图', '/?launch=image'],
  ['video', '视频生成', '/?launch=video'],
  ['variation', '素材裂变', '/?launch=variation'],
  ['dsp', '54DSP 素材', '/?launch=dsp'],
  ['recent', '最近生成', '/recent-generations'],
  ['tasks', '任务中心', '/tasks'],
  ['projects', '我的项目', '/?section=projects']
]

const TASK_TONES = {
  completed: 'success',
  partial: 'warning',
  awaiting_confirmation: 'warning',
  failed: 'danger',
  cancelled: 'neutral'
}

const TASK_LABELS = {
  running: '生成中',
  awaiting_confirmation: '等待确认',
  partial: '部分完成',
  completed: '已完成',
  failed: '生成失败',
  cancelled: '已取消'
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
})

const CANVAS_STARTER_ACTIONS = [
  {
    id: 'dsp',
    eyebrow: '数据驱动',
    title: '抓取高点击素材',
    description: '读取近 7 天优秀素材，筛选后进入 GMI 反向和 GIF 裂变。',
    actionLabel: '打开 54DSP'
  },
  {
    id: 'variation',
    eyebrow: '快速测试',
    title: '五套素材裂变',
    description: '上传一张或 ZIP，生成 A-E 五套差异化素材和多尺寸版本。',
    actionLabel: '开始裂变'
  },
  {
    id: 'background',
    eyebrow: '参考图编辑',
    title: '按参考图换背景',
    description: '保留人物、服装和姿势，只替换成宿舍等指定环境。',
    actionLabel: '更换背景'
  }
]

export function buildWorkspaceNavigation() {
  return NAV_ITEMS.map(([id, label, to]) => ({ id, label, to }))
}

export function buildCanvasStarterActions() {
  return CANVAS_STARTER_ACTIONS.map((item) => ({ ...item }))
}

export function resolvePromptDockExpanded({ nodeCount = 0, userPreference = null } = {}) {
  if (typeof userPreference === 'boolean') return userPreference
  return false
}

export function normalizeServiceIncident(error) {
  const text = String(error || '').trim()
  if (!text) return null

  if (/token expired|TOKEN_IS_WRONG|refresh script/i.test(text)) {
    return {
      code: 'dsp_token_expired',
      title: 'DSP 授权已过期',
      message: '当前授权无法读取最新素材，请重新验证 DSP 连接。',
      actions: ['reauthorize', 'settings', 'details'],
      tone: 'danger'
    }
  }

  if (/timed out|timeout/i.test(text)) {
    return {
      code: 'material_ai_timeout',
      title: '素材分析部分超时',
      message: '已保留成功结果，可以只重试失败素材。',
      actions: ['retry_failed', 'details'],
      tone: 'warning'
    }
  }

  return {
    code: 'unknown',
    title: '服务异常',
    message: text,
    actions: ['details'],
    tone: 'danger'
  }
}

export function normalizeTaskTone(status) {
  return TASK_TONES[status] || 'info'
}

export function buildCreativeCardView(candidate = {}) {
  const width = Number(candidate.width) || 0
  const height = Number(candidate.height) || 0
  const ctr = Number(candidate.ctr) || 0
  const wilson = Number(candidate.wilson_ctr) || 0
  const spend = Number(candidate.spend) || 0

  return {
    id: String(candidate.creative_id || candidate.candidate_key || ''),
    type: String(candidate.media_type || 'UNKNOWN'),
    size: width && height ? `${width}×${height}` : '尺寸未知',
    impressions: numberFormatter.format(Number(candidate.impressions) || 0),
    clicks: numberFormatter.format(Number(candidate.clicks) || 0),
    ctr: `${ctr.toFixed(2)}%`,
    wilson: `${(wilson * 100).toFixed(2)}%`,
    spend: `$${spend.toFixed(2)}`
  }
}

export function buildTaskSummary(task = {}) {
  const status = String(task.status || 'running')
  const successCount = Number(task.success_count) || 0
  const failureCount = Number(task.failure_count) || 0
  const detail = String(task.detail || '').trim() || `成功 ${successCount} · 失败 ${failureCount}`
  const actionMap = {
    running: ['details'],
    awaiting_confirmation: ['confirm', 'cancel', 'details'],
    partial: ['retry_failed', 'view_results', 'details'],
    completed: ['view_results', 'download'],
    failed: ['retry', 'details'],
    cancelled: ['details']
  }

  const actions = Array.isArray(task.actions)
    ? [...task.actions]
    : [...(actionMap[status] || ['details'])]
  if (task.download_url && !actions.includes('download')) actions.push('download')

  return {
    title: TASK_LABELS[status] || '处理中',
    tone: normalizeTaskTone(status),
    detail,
    actions
  }
}

export function mapNovelJobToTask(job = {}) {
  const summary = job.shot_summary || {}
  const total = Math.max(0, Number(summary.total) || 0)
  const completed = Math.max(0, Number(summary.completed) || 0)
  const status = String(job.status || 'queued')
  const normalizedStatus = ['completed', 'failed', 'cancelled'].includes(status) ? status : 'running'
  return {
    id: `novel:${String(job.job_id || '')}`,
    source: 'novel', source_id: String(job.job_id || ''),
    name: String(job.title || '未命名小说任务'), status: normalizedStatus,
    progress: total ? Math.round((completed / total) * 100) : (status === 'completed' ? 100 : 0),
    success_count: completed, failure_count: Math.max(0, Number(summary.failed) || 0)
  }
}

export function mergeRecentTasks(existingTasks = [], novelTasks = []) {
  return [...new Map([...novelTasks, ...existingTasks].filter(task => task?.id).map(task => [task.id, task])).values()]
}
