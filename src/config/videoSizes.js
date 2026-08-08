export const COMMON_VIDEO_SIZES = [
  { key: '1280x720', width: 1280, height: 720, ratio: '16:9', label: '1280 × 720 横屏' },
  { key: '720x1280', width: 720, height: 1280, ratio: '9:16', label: '720 × 1280 竖屏' }
]

export const normalizeVideoSize = (width, height) => {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isInteger(w) || !Number.isInteger(h)) throw new Error('尺寸必须是整数')
  if (w % 2 || h % 2) throw new Error('宽高必须是偶数像素')
  if (w < 256 || h < 256 || w > 4096 || h > 4096) throw new Error('尺寸超出 256–4096 范围')
  return { width: w, height: h, key: `${w}x${h}` }
}

export const ratioForVideoSize = (width, height) => Number(width) >= Number(height) ? '16:9' : '9:16'
