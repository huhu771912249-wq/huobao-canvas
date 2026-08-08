import { buildMaterialApiUrl } from '../utils/apiBase.js'

export const fetchComputeStatus = async ({ fetchImpl = globalThis.fetch, signal } = {}) => {
  if (typeof fetchImpl !== 'function') throw new Error('当前浏览器不支持算力状态检测')
  const response = await fetchImpl(buildMaterialApiUrl('/v1/compute/status'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal
  })
  if (!response?.ok) throw new Error(`算力状态接口返回 ${response?.status || '错误'}`)
  const payload = await response.json()
  return payload?.data || payload
}
