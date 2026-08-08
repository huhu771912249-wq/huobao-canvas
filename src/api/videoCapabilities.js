import { buildMaterialApiUrl } from '../utils/apiBase.js'

export const fetchVideoCapabilities = async ({ fetchImpl = globalThis.fetch } = {}) => {
  if (typeof fetchImpl !== 'function') return null
  try {
    const response = await fetchImpl(buildMaterialApiUrl('/v1/video/capabilities'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
    if (!response?.ok) return null
    const payload = await response.json()
    return payload?.data?.models || null
  } catch {
    return null
  }
}
