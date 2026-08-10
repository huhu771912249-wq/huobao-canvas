const MIN_TEST_ASSET_DIMENSION = 1
const MAX_TEST_ASSET_DIMENSION = 2000
const SUPPORTED_TEST_ASSET_FORMATS = new Set(['png', 'jpg', 'gif', 'mp4'])

const toInteger = (value, label) => {
  const number = Number(value)
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label}必须是整数`)
  return number
}

export const normalizeTestAssetSize = (width, height) => {
  const normalized = {
    width: toInteger(width, '宽度'),
    height: toInteger(height, '高度')
  }
  if (
    normalized.width < MIN_TEST_ASSET_DIMENSION ||
    normalized.height < MIN_TEST_ASSET_DIMENSION ||
    normalized.width > MAX_TEST_ASSET_DIMENSION ||
    normalized.height > MAX_TEST_ASSET_DIMENSION
  ) throw new Error('宽度和高度必须在 1–2000 像素之间')
  return normalized
}

export const defaultTestWatermark = (date = new Date()) => {
  const pad = value => String(value).padStart(2, '0')
  return `[TEST] ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const buildTestAssetRequest = ({
  width,
  height,
  sizes,
  format,
  formats,
  backgroundColor,
  watermarkText,
  watermarkPosition,
  watermarkColor,
  watermarkOpacity,
  adSlotId
}) => {
  const normalizedSizes = (sizes?.length ? sizes : [{ width, height }]).map(size => (
    normalizeTestAssetSize(size.width, size.height)
  ))
  const normalizedFormats = (formats?.length ? formats : [format]).map(value => String(value || '').toLowerCase())
  if (!normalizedFormats.length || normalizedFormats.some(value => !SUPPORTED_TEST_ASSET_FORMATS.has(value))) {
    throw new Error('请选择 PNG、JPG、GIF 或 MP4')
  }
  if (normalizedSizes.length * normalizedFormats.length > 50) throw new Error('单次最多生成 50 个素材')
  return {
    sizes: normalizedSizes,
    formats: [...new Set(normalizedFormats)],
    background_color: backgroundColor,
    watermark: {
      text: String(watermarkText || '').trim(),
      position: watermarkPosition,
      color: watermarkColor,
      opacity: toInteger(watermarkOpacity, '水印透明度')
    },
    ad_slot_id: String(adSlotId || '').trim()
  }
}

export const formatTestAssetBytes = bytes => {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  if (value < 1024) return `${Math.round(value)} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}

export const estimateTestAssetBytes = (width, height, format) => {
  const pixels = Number(width) * Number(height)
  const factor = { png: 0.45, jpg: 0.16, gif: 1.1, mp4: 0.24 }[format] || 0.5
  return Math.max(100, Math.round(pixels * factor))
}
