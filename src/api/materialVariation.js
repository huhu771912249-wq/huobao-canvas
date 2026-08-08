import { request } from '@/utils'
import {
  MATERIAL_VARIATION_API_BASE,
  MATERIAL_VARIATION_POLL_INTERVAL,
  buildMaterialVariationRetryUrl,
  buildMaterialVariationSecondWaveUrl,
  buildMaterialVariationTaskUrl,
  isMaterialVariationTerminal,
  unwrapMaterialVariationTask
} from '@/utils/materialVariation'

/**
 * Fixed local contract:
 * POST /v1/material/variations
 * GET /v1/material/variations/{job_id}
 * POST /v1/material/variations/{job_id}/retry
 * POST /v1/material/variations/{job_id}/second-wave
 */
const jsonRequest = (config) => request({
  ...config,
  headers: { 'Content-Type': 'application/json', ...(config.headers || {}) }
})

export const createMaterialVariation = (data) => jsonRequest({
  url: MATERIAL_VARIATION_API_BASE,
  method: 'post',
  data
})

export const getMaterialVariation = (jobId) => request({
  url: buildMaterialVariationTaskUrl(jobId),
  method: 'get'
})

export const retryMaterialVariation = (jobId) => jsonRequest({
  url: buildMaterialVariationRetryUrl(jobId),
  method: 'post',
  data: {}
})

export const startMaterialVariationSecondWave = (jobId, data) => jsonRequest({
  url: buildMaterialVariationSecondWaveUrl(jobId),
  method: 'post',
  data
})

export const pollMaterialVariation = async (
  jobId,
  { interval = MATERIAL_VARIATION_POLL_INTERVAL, maxAttempts = 1800, onUpdate, signal } = {}
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('素材裂变轮询已取消', 'AbortError')
    const result = await getMaterialVariation(jobId)
    const task = unwrapMaterialVariationTask(result)
    onUpdate?.(task)
    if (isMaterialVariationTerminal(task.status)) return task
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('素材裂变任务轮询超时')
}
