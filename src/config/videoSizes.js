import { deriveVideoRatioFromSize } from '../utils/videoAspectRatio.js'
import { findVideoSizeViolation } from '../utils/videoSizeRules.js'

export const COMMON_VIDEO_SIZES = [
  { key: '1280x720', width: 1280, height: 720, ratio: '16:9', label: '1280 × 720 横屏' },
  { key: '720x1280', width: 720, height: 1280, ratio: '9:16', label: '720 × 1280 竖屏' }
]

/** 三种文案是 VideoStudio 自定义尺寸输入框直接展示给用户的，逐条保留。 */
const SIZE_VIOLATION_MESSAGE = {
  'not-integer': '尺寸必须是整数',
  odd: '宽高必须是偶数像素',
  'out-of-range': '尺寸超出 256–4096 范围'
}

export const normalizeVideoSize = (width, height) => {
  const violation = findVideoSizeViolation(width, height)
  if (violation) throw new Error(SIZE_VIOLATION_MESSAGE[violation])
  const w = Number(width)
  const h = Number(height)
  return { width: w, height: h, key: `${w}x${h}` }
}

export const ratioForVideoSize = deriveVideoRatioFromSize
