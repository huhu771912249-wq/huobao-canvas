import { buildMaterialApiUrl } from '../utils/apiBase.js'

/**
 * Backend health probe | 后端健康探测
 * `GET /health` needs no credential (it is not a `/v1/` route) and returns
 * `{ ok, ...release metadata, ...worker_status() }`.
 */
export const fetchServiceHealth = async ({ fetchImpl = globalThis.fetch, signal } = {}) => {
  if (typeof fetchImpl !== 'function') throw new Error('当前浏览器不支持服务状态检测')
  const response = await fetchImpl(buildMaterialApiUrl('/health'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal
  })
  if (!response?.ok) throw new Error(`服务健康检查返回 ${response?.status || '错误'}`)
  return await response.json()
}
