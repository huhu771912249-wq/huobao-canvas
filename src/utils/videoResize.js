export const RESIZE_PRESETS = ['720x1280', '1080x1920', '1080x1080', '1280x720', '1920x1080']

export function normalizeResizeTargets(values = []) {
  return [...new Set(values)].map(value => {
    const [width, height] = String(value).toLowerCase().split('x').map(Number)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || height < 256 || width > 4096 || height > 4096 || width % 2 || height % 2) {
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
