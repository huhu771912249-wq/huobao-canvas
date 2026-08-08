import { buildMaterialApiUrl, getMaterialApiBase, isMaterialApiUrl } from './apiBase.js'

const DEFAULT_DOWNLOAD_NAME = '冠希无限画布-素材'

const LOCAL_IMAGE_ASSET_ENDPOINT = buildMaterialApiUrl('/v1/assets/images')
const LOCAL_REMOTE_ASSET_ENDPOINT = buildMaterialApiUrl('/v1/assets/import')

export const sanitizeDownloadFilename = (value) => {
  const leafName = String(value || '').split(/[\\/]/).pop() || ''
  const normalized = leafName
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)

  return normalized || DEFAULT_DOWNLOAD_NAME
}

export const isInlineImageAsset = (url) => (
  String(url || '').toLowerCase().startsWith('data:image/')
)

export const shouldProxyRemoteAsset = (url) => {
  try {
    const parsed = new URL(String(url || '').trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const localHost = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
    return !(
      (localHost || isMaterialApiUrl(parsed.origin))
      && parsed.pathname.startsWith('/public-assets/')
    )
  } catch {
    return false
  }
}

export const buildDownloadUrl = (url, filename) => {
  const source = String(url || '').trim()
  if (!source) return ''

  try {
    const parsed = new URL(source)
    if (!parsed.pathname.startsWith('/public-assets/')) {
      return source
    }
    if (parsed.origin !== getMaterialApiBase()) {
      const base = new URL(getMaterialApiBase())
      parsed.protocol = base.protocol
      parsed.host = base.host
    }
    parsed.searchParams.set('download', '1')
    parsed.searchParams.set('filename', sanitizeDownloadFilename(filename))
    return parsed.toString()
  } catch {
    return source
  }
}

const triggerBrowserDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const publishInlineImage = async (image, filename) => {
  const response = await fetch(LOCAL_IMAGE_ASSET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, name: filename })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `本地图片发布失败（HTTP ${response.status}）`)
  }
  return payload
}

const importRemoteAsset = async (url, filename) => {
  const response = await fetch(LOCAL_REMOTE_ASSET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, name: filename })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `远程素材下载失败（HTTP ${response.status}）`)
  }
  return payload
}

export const startAssetDownload = async (asset = {}) => {
  const sourceUrl = String(asset.url || '').trim()
  if (!sourceUrl) {
    throw new Error('素材地址为空，无法下载')
  }

  const filename = sanitizeDownloadFilename(asset.fileName || asset.label)
  let resolvedUrl = sourceUrl

  if (isInlineImageAsset(sourceUrl)) {
    const published = await publishInlineImage(sourceUrl, filename)
    resolvedUrl = String(published?.local_url || published?.url || '').trim()
    if (!resolvedUrl) {
      throw new Error('本地图片发布失败，未拿到下载地址')
    }
  } else if (shouldProxyRemoteAsset(sourceUrl)) {
    const imported = await importRemoteAsset(sourceUrl, filename)
    resolvedUrl = String(imported?.local_url || imported?.url || '').trim()
    if (!resolvedUrl) {
      throw new Error('远程素材下载失败，未拿到本地地址')
    }
  }

  const downloadUrl = buildDownloadUrl(resolvedUrl, filename)
  triggerBrowserDownload(downloadUrl, filename)
  return { url: downloadUrl, filename }
}
