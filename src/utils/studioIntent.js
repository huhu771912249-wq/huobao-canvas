const DOCUMENT_RE = /\.(txt|md|markdown|docx|pdf)$/i
const MEDIA_RE = /\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i

export const detectStudioIntent = ({ prompt = '', fileName = '', wantsVideo = false } = {}) => {
  if (DOCUMENT_RE.test(fileName)) return 'novel-video'
  if (MEDIA_RE.test(fileName)) return 'asset'
  if (String(prompt).trim().length >= 1200 || /第[一二三四五六七八九十百0-9]+[章节回卷]/.test(prompt)) return 'novel-video'
  if (wantsVideo || /视频|video|动起来|运镜/i.test(prompt)) return 'image-to-video'
  return 'text-to-image'
}
