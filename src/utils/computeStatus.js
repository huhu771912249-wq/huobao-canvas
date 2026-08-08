const finiteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const formatGpuMemory = (usedMb, totalMb) => {
  const used = finiteNumber(usedMb)
  const total = finiteNumber(totalMb)
  if (total <= 0) return '显存未知'
  return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB`
}

export const shortGpuName = (name) => {
  const value = String(name || '').trim()
  return value
    .replace(/^NVIDIA\s+/i, '')
    .replace(/^GeForce\s+/i, '') || 'GPU'
}

export const summarizeComputeStatus = (status) => {
  const data = status && typeof status === 'object' ? status : {}
  const gpu = Array.isArray(data.gpus) ? data.gpus[0] : null
  const queues = data.queues && typeof data.queues === 'object' ? data.queues : {}
  const state = ['online', 'degraded', 'offline'].includes(data.status) ? data.status : 'loading'
  const tasks = Array.isArray(data.current_tasks) ? data.current_tasks : []
  return {
    state,
    online: state === 'online',
    gpuName: gpu ? shortGpuName(gpu.name) : 'GPU状态',
    utilization: Math.max(0, Math.min(100, finiteNumber(gpu?.utilization_percent))),
    memoryPercent: Math.max(0, Math.min(100, finiteNumber(gpu?.memory_utilization_percent))),
    memoryLabel: gpu ? formatGpuMemory(gpu.memory_used_mb, gpu.memory_total_mb) : '等待检测',
    temperature: finiteNumber(gpu?.temperature_c, null),
    powerDraw: finiteNumber(gpu?.power_draw_w, null),
    powerLimit: finiteNumber(gpu?.power_limit_w, null),
    waiting: Math.max(0, finiteNumber(queues.total_waiting)),
    running: Math.max(
      finiteNumber(queues.comfyui_running),
      tasks.filter(task => task?.status === 'running').length
    ),
    comfyOnline: data.comfyui?.online === true,
    tasks,
    updatedAt: String(data.updated_at || '')
  }
}

export const formatElapsedSeconds = (value) => {
  const seconds = Math.max(0, Math.floor(finiteNumber(value)))
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours) return `已运行 ${hours}小时${minutes}分`
  if (minutes) return `已运行 ${minutes}分${remainder}秒`
  return `已运行 ${remainder}秒`
}

export const computeTaskStageLabel = (task) => {
  const stage = String(task?.stage || '').toLowerCase()
  const labels = {
    generate: '生成',
    upscale: 'SeedVR2 超分',
    cloud_generate: 'H3 生成',
    downloading: '下载结果',
    upscaling: 'SeedVR2 超分',
    postprocessing: '后处理',
    queued: '等待处理',
    importing: '导入素材',
    probing: '读取视频',
    framing: '画面适配',
    composing: '文字合成',
    encoding: '编码输出'
  }
  return labels[stage] || stage || '处理中'
}
