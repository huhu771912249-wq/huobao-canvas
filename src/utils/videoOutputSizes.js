export const VIDEO_OUTPUT_PRESETS = Object.freeze([
  { key: 'landscape-720p', label: '1280 × 720 横屏', width: 1280, height: 720 },
  { key: 'portrait-720p', label: '720 × 1280 竖屏', width: 720, height: 1280 },
  { key: 'landscape-1080p', label: '1920 × 1080 横屏', width: 1920, height: 1080 },
  { key: 'portrait-1080p', label: '1080 × 1920 竖屏', width: 1080, height: 1920 },
  { key: 'square-1080p', label: '1080 × 1080 方形', width: 1080, height: 1080 }
])

const PRESET_BY_SIZE = new Map(
  VIDEO_OUTPUT_PRESETS.map(item => [`${item.width}x${item.height}`, item])
)

const LEGACY_RATIO_SIZE = Object.freeze({
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080]
})

export function normalizeVideoOutputSize(input = {}) {
  const hasWidth = input.output_width != null || input.width != null
  const hasHeight = input.output_height != null || input.height != null
  if (hasWidth !== hasHeight) {
    throw new TypeError('视频输出宽高必须同时填写')
  }

  const legacy = LEGACY_RATIO_SIZE[String(input.ratio || '').replace('x', ':')]
  const width = Number(input.output_width ?? input.width ?? legacy?.[0] ?? 1920)
  const height = Number(input.output_height ?? input.height ?? legacy?.[1] ?? 1080)
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 256 ||
    height < 256 ||
    width > 4096 ||
    height > 4096 ||
    width % 2 ||
    height % 2
  ) {
    throw new TypeError('视频输出宽高必须是 256–4096 范围内的正偶数')
  }

  const preset = PRESET_BY_SIZE.get(`${width}x${height}`)
  return { width, height, preset: preset?.key || 'custom' }
}
