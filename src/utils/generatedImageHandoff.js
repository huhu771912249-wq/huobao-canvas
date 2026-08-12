import { getMaterialApiBase, isMaterialApiUrl } from './apiBase.js'

export const isLocalPublicAssetUrl = (value) => {
  const source = String(value || '').trim()
  if (source.startsWith('/public-assets/')) return true
  try {
    const parsed = new URL(source, getMaterialApiBase())
    return parsed.pathname.startsWith('/public-assets/') && isMaterialApiUrl(parsed.origin)
  } catch {
    return false
  }
}

export const normalizeGeneratedImageResult = (result = {}) => {
  const url = String(result.url || result.public_url || result.publicUrl || '').trim()
  const publicUrl = String(result.public_url || result.publicUrl || url).trim()
  const sourceUrl = String(result.source_url || result.sourceUrl || '').trim()
  return {
    url,
    publicUrl,
    sourceUrl,
    assetRole: String(result.asset_role || result.assetRole || 'generated')
  }
}

export const clearGeneratedImageForRegeneration = () => ({
  loading: true,
  error: null,
  url: '',
  publicUrl: '',
  public_url: '',
  localUrl: '',
  local_url: '',
  base64: '',
  assetRole: '',
  asset_role: ''
})

export const isReadyVideoImageNode = (data = {}) => (
  !data.loading
  && Boolean(data.url || data.base64 || data.publicUrl || data.public_url || data.localUrl || data.local_url)
)

export const localizeGeneratedImageInput = async (value, {
  importAsset,
  publishAsset,
  assetRole = 'generated',
  name = '视频参考图'
} = {}) => {
  const source = String(value || '').trim()
  if (!source) return ''
  if (isLocalPublicAssetUrl(source)) return source

  let result
  if (source.startsWith('data:image/')) {
    if (typeof publishAsset !== 'function') throw new Error('缺少图片发布服务')
    result = await publishAsset({ image: source, name, asset_role: assetRole })
  } else if (/^https?:\/\//i.test(source)) {
    if (typeof importAsset !== 'function') throw new Error('缺少远程图片导入服务')
    result = await importAsset({ url: source, name, asset_role: assetRole })
  } else {
    throw new Error('参考图不是可用的本应用素材、图片 data URL 或 http(s) URL')
  }

  const localized = String(result?.url || result?.public_url || result?.local_url || '').trim()
  if (!localized || !isLocalPublicAssetUrl(localized)) {
    throw new Error('参考图本地化失败，未获得本应用素材地址')
  }
  return localized
}
