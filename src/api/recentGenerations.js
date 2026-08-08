import { buildMaterialApiUrl, getMaterialApiBase } from '../utils/apiBase.js'

const absoluteAssetUrl = value => {
  const raw = String(value || '')
  if (!raw) return ''
  try {
    return new URL(raw, `${getMaterialApiBase()}/`).toString()
  } catch {
    return raw
  }
}

export const listRecentGenerations = async ({ type = '', limit = 80 } = {}) => {
  const query = new URLSearchParams({ limit: String(limit) })
  if (type) query.set('type', type)
  const response = await fetch(buildMaterialApiUrl(`/v1/assets/recent?${query}`), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `最近生成读取失败（HTTP ${response.status}）`)
  }
  return (Array.isArray(payload?.assets) ? payload.assets : []).map(asset => ({
    ...asset,
    url: absoluteAssetUrl(asset.url),
    download_url: absoluteAssetUrl(asset.download_url || asset.url)
  }))
}
