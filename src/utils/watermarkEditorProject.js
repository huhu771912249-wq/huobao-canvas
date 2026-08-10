const safeAssetUrl = value => {
  const url = String(value || '').trim()
  return /^(?:https?:\/\/|\/public-assets\/)/i.test(url) ? url : ''
}

const cloneList = value => Array.isArray(value) ? value.map(item => ({ ...item })) : []

export const createDefaultWatermarkEditorProject = ({ title = '新品投放 GIF 方案' } = {}) => ({
  version: 1,
  title,
  clips: [
    { id: 'clip-1', name: '产品开场.mp4', kind: 'video', duration: 4.2, color: 'linear-gradient(135deg,#123b4e,#0e7490 48%,#f59e0b)', transition: '叠化' },
    { id: 'clip-2', name: '卖点演示.gif', kind: 'gif', duration: 3.6, color: 'linear-gradient(135deg,#3b0764,#a21caf 48%,#fb7185)', transition: '闪白' },
    { id: 'clip-3', name: '行动号召.mp4', kind: 'video', duration: 3.2, color: 'linear-gradient(135deg,#052e16,#16a34a 48%,#fde047)', transition: '无' }
  ],
  textTracks: [
    { id: 'text-1', text: '限时优惠 · 立即体验', start: 0.4, end: 4.4, x: 50, y: 78, fontSize: 38, style: '爆款白字', effect: 'pop' },
    { id: 'text-2', text: '核心卖点一眼看懂', start: 4.5, end: 8.1, x: 50, y: 18, fontSize: 30, style: '高亮黄字', effect: 'slide' }
  ],
  imageTracks: [
    { id: 'image-1', name: '品牌 Logo.png', start: 0, end: 11, x: 82, y: 10, size: 22, opacity: 92, url: '', saved: true }
  ],
  watermarkLibrary: [
    { id: 'image-1', name: '品牌 Logo.png', kind: 'image' }
  ],
  output: { presetKey: 'vertical', cornerRadius: 6, fps: 12, colors: 128, loop: 'forever' },
  quickSettings: { watermarkId: 'image-1', position: 'top-right', size: 22, opacity: 92 }
})

export const sanitizeWatermarkEditorProject = value => {
  const fallback = createDefaultWatermarkEditorProject({ title: value?.title })
  const clips = cloneList(value?.clips ?? fallback.clips).map(clip => ({ ...clip, url: safeAssetUrl(clip.url) }))
  const imageTracks = cloneList(value?.imageTracks ?? fallback.imageTracks).map(item => ({
    ...item,
    url: safeAssetUrl(item.url),
    opacity: Math.min(100, Math.max(0, Number(item.opacity ?? 100)))
  }))
  const watermarkLibrary = cloneList(value?.watermarkLibrary).length
    ? cloneList(value.watermarkLibrary)
    : imageTracks.filter(item => item.saved).map(item => ({ id: item.id, name: item.name, kind: 'image' }))

  return {
    version: 1,
    title: String(value?.title || fallback.title).slice(0, 80),
    clips,
    textTracks: cloneList(value?.textTracks ?? fallback.textTracks),
    imageTracks,
    watermarkLibrary,
    output: { ...fallback.output, ...(value?.output || {}) },
    quickSettings: { ...fallback.quickSettings, ...(value?.quickSettings || {}) }
  }
}
