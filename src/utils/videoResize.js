import { findVideoSizeViolation, parseVideoSizeKey } from './videoSizeRules.js'

export const RESIZE_PRESETS = ['720x1280', '1080x1920', '1080x1080', '1280x720', '1920x1080']

export function normalizeResizeTargets(values = []) {
  return [...new Set(values)].map(value => {
    const { width, height } = parseVideoSizeKey(value)
    // 规则本身在 videoSizeRules.js；这里保留 Error + 本工作台的文案，
    // VideoResizeWorkbench 直接把 message 渲染进错误条。
    if (findVideoSizeViolation(width, height)) {
      throw new Error('输出尺寸必须是 256–4096 范围内的偶数')
    }
    return { width, height }
  })
}

export function validateSocialVideoUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const host = url.hostname.toLowerCase()
    const allowed = ['facebook.com', 'fb.watch', 'instagram.com'].some(domain => host === domain || host.endsWith(`.${domain}`))
    return { ok: url.protocol === 'https:' && allowed && !url.username && !url.password, host }
  } catch {
    return { ok: false, host: '' }
  }
}
