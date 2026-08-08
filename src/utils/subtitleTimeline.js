export const validateSubtitleText = (text) => Boolean(String(text || '').trim())

export const buildSubtitleSegments = (text, duration) => {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const total = Number(duration)
  if (!lines.length || !Number.isFinite(total) || total <= 0) return []
  const step = total / lines.length
  return lines.map((line, index) => ({
    start: Number((index * step).toFixed(3)),
    end: Number(((index + 1) * step).toFixed(3)),
    text: line
  }))
}
