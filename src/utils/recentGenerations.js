export function buildRecentImageCanvas(asset = {}, { nodeId = '', now = Date.now() } = {}) {
  const assetId = String(asset.id || asset.name || '')
  const resolvedNodeId = nodeId || `recent-image-${now}`
  return {
    nodes: [
      {
        id: resolvedNodeId,
        type: 'image',
        position: { x: 160, y: 120 },
        data: {
          url: String(asset.url || ''),
          label: String(asset.name || '最近生成图片'),
          sourceAssetId: assetId,
          createdAt: now,
          updatedAt: now
        }
      }
    ],
    edges: [],
    viewport: { x: 100, y: 60, zoom: 0.8 }
  }
}

export function formatRecentAssetSize(value) {
  const bytes = Math.max(0, Number(value) || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
