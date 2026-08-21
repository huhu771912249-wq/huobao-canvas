/**
 * Service health summary | 服务状态归纳
 * Pure helpers turning `GET /health` into the `{ label, tone }` shape ServiceStatusPill wants.
 */

const QUEUE_KEYS = ['chat_queue', 'image_queue', 'video_queue', 'video_resize_queue', 'variation_queue']
const WORKER_KEYS = ['chat_workers', 'image_workers', 'video_workers']

// A queue depth at or above this is worth warning about instead of claiming everything is fine.
export const SERVICE_QUEUE_BUSY_THRESHOLD = 3

const positiveNumber = (value) => {
  const number = Number(value)
  // The backend reports -1 when a worker queue cannot be measured; treat it as "nothing waiting".
  return Number.isFinite(number) && number > 0 ? number : 0
}

const sumKeys = (data, keys) => keys.reduce((total, key) => total + positiveNumber(data[key]), 0)

export const normalizeServiceHealth = (payload) => {
  const data = payload && typeof payload === 'object' ? payload : {}
  return {
    ok: data.ok === true,
    queue: sumKeys(data, QUEUE_KEYS),
    workers: sumKeys(data, WORKER_KEYS)
  }
}

export const summarizeServiceHealth = ({ health, error, checkedAt } = {}) => {
  if (error) return { label: '服务离线', tone: 'danger' }
  if (!health) {
    return checkedAt
      ? { label: '服务异常', tone: 'danger' }
      : { label: '正在检测服务', tone: 'warning' }
  }

  const { ok, queue, workers } = normalizeServiceHealth(health)
  if (!ok) return { label: '服务异常', tone: 'danger' }
  if (workers <= 0) return { label: '服务无可用工作线程', tone: 'warning' }
  if (queue >= SERVICE_QUEUE_BUSY_THRESHOLD) return { label: `服务排队 ${queue}`, tone: 'warning' }
  return { label: '服务已连接', tone: 'success' }
}
