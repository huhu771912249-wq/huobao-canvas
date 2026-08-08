const SUPPORTED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'image/gif'])
// Base64 expands by roughly 4/3; keep the JSON body under the live 125 MiB proxy cap.
const MAX_BYTES = 90 * 1024 * 1024

export const validateOverlayVideoFile = (file) => {
  const supportedName = /\.(mp4|mov|webm|gif)$/i.test(String(file?.name || ''))
  if (!file || (!SUPPORTED_TYPES.has(String(file.type || '').toLowerCase()) && !supportedName)) {
    return '只支持 MP4、MOV、WebM 或 GIF 素材'
  }
  if (Number(file.size || 0) > MAX_BYTES) return '上传视频不能超过 90MB'
  return ''
}

export const parseSubtitleTimeline = (value) => {
  const lines = String(value || '').split('\n').map(line => line.trim()).filter(Boolean)
  if (!lines.length) throw new Error('请填写字幕时间轴')
  return lines.map((line, index) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\|\s*(.+)$/)
    if (!match) throw new Error(`第 ${index + 1} 行时间轴格式错误，请使用 0-2 | 字幕`)
    const start = Number(match[1])
    const end = Number(match[2])
    const text = match[3].trim()
    if (end <= start) throw new Error(`第 ${index + 1} 行时间范围无效`)
    return { start, end, text }
  })
}

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('读取视频失败'))
  reader.readAsDataURL(file)
})
