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
