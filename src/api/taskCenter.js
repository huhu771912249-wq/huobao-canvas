import { buildMaterialApiUrl } from '../utils/apiBase.js'

export const listTaskCenterTasks = async ({ limit = 100 } = {}) => {
  const response = await fetch(buildMaterialApiUrl(`/v1/tasks?limit=${encodeURIComponent(limit)}`), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `任务中心读取失败（HTTP ${response.status}）`)
  }
  const tasks = (Array.isArray(payload?.tasks) ? payload.tasks : []).map(task => ({
    ...task,
    actions: task?.download_url ? ['download', 'details'] : ['details']
  }))
  return {
    tasks,
    sourceErrors: Array.isArray(payload?.source_errors) ? payload.source_errors : []
  }
}
