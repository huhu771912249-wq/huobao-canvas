export const TASK_CATEGORY_DEFINITIONS = [
  { id: 'all', label: '全部' },
  { id: 'video', label: '视频生成' },
  { id: 'variation', label: '素材裂变' },
  { id: 'novel', label: '小说成片' },
  { id: 'dsp', label: 'DSP 素材' },
  { id: 'resize', label: '尺寸/文字' }
]

export const buildTaskCategoryTabs = (tasks = []) => {
  const counts = new Map()
  for (const task of tasks) {
    const category = String(task?.category || '')
    counts.set(category, (counts.get(category) || 0) + 1)
  }
  return TASK_CATEGORY_DEFINITIONS.map(category => ({
    ...category,
    count: category.id === 'all' ? tasks.length : (counts.get(category.id) || 0)
  }))
}

export const filterTaskCenterTasks = (tasks = [], category = 'all') => {
  if (!category || category === 'all') return tasks
  return tasks.filter(task => task?.category === category)
}

export const resolveTaskDetailsTarget = (task = {}) => {
  const sourceId = String(task?.source_id || '').trim()
  if (!sourceId) return null

  if (task?.source === 'novel' && task?.category === 'novel') {
    return { path: '/video-studio', query: { tab: 'novel', job: sourceId } }
  }
  if (task?.source === 'resize' && task?.category === 'resize') {
    return { path: '/video-resize', query: { job: sourceId } }
  }
  return null
}

export const buildTaskCenterActions = (task = {}) => {
  const actions = []
  if (task?.download_url) actions.push('download')
  if (resolveTaskDetailsTarget(task)) actions.push('details')
  return actions
}

export const withTaskCenterActions = (task = {}) => ({
  ...task,
  actions: buildTaskCenterActions(task)
})
