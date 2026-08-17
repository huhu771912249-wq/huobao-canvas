const DEFAULT_FOOTPRINT = { width: 420, height: 360 }

export const NODE_FOOTPRINTS = Object.freeze({
  text: { width: 350, height: 300 },
  imageConfig: { width: 340, height: 560 },
  image: { width: 280, height: 360 },
  videoConfig: { width: 560, height: 760 },
  video: { width: 400, height: 360 },
  videoGif: { width: 460, height: 520 },
  textOverlay: { width: 520, height: 620 },
  watermarkEditor: { width: 420, height: 420 },
  materialExport: { width: 420, height: 360 },
  materialInput: { width: 420, height: 460 },
  materialVariation: { width: 560, height: 620 },
  dspCreativeLibrary: { width: 920, height: 760 },
  dspCreativeTaskCenter: { width: 620, height: 700 }
})

export const getNodeBounds = node => {
  const footprint = NODE_FOOTPRINTS[node?.type] || DEFAULT_FOOTPRINT
  const left = Number(node?.position?.x) || 0
  const top = Number(node?.position?.y) || 0
  return {
    left,
    top,
    right: left + footprint.width,
    bottom: top + footprint.height
  }
}

export const rectanglesOverlap = (left, right, gap = 0) => !(
  left.right + gap <= right.left
  || right.right + gap <= left.left
  || left.bottom + gap <= right.top
  || right.bottom + gap <= left.top
)

const isPositionOpen = (existingNodes, type, position, gap) => {
  const candidate = getNodeBounds({ type, position })
  return existingNodes.every(node => !rectanglesOverlap(candidate, getNodeBounds(node), gap))
}

export const findOpenNodePosition = (
  existingNodes,
  preferredPosition,
  type,
  { gap = 60, columnStep = 680, rowStep = 560 } = {}
) => {
  const preferred = {
    x: Number(preferredPosition?.x) || 0,
    y: Number(preferredPosition?.y) || 0
  }
  if (isPositionOpen(existingNodes, type, preferred, gap)) return preferred

  for (let ring = 1; ring <= 12; ring += 1) {
    const offsets = [
      [ring, 0], [0, ring], [-ring, 0], [0, -ring],
      [ring, ring], [-ring, ring], [ring, -ring], [-ring, -ring]
    ]
    for (const [column, row] of offsets) {
      const candidate = {
        x: preferred.x + column * columnStep,
        y: preferred.y + row * rowStep
      }
      if (isPositionOpen(existingNodes, type, candidate, gap)) return candidate
    }
  }

  const existingBottom = existingNodes.reduce(
    (maximum, node) => Math.max(maximum, getNodeBounds(node).bottom),
    preferred.y
  )
  return { x: preferred.x, y: existingBottom + gap }
}

const workflowBounds = workflowNodes => workflowNodes.reduce((bounds, node) => {
  const nodeBounds = getNodeBounds(node)
  return {
    left: Math.min(bounds.left, nodeBounds.left),
    top: Math.min(bounds.top, nodeBounds.top),
    right: Math.max(bounds.right, nodeBounds.right),
    bottom: Math.max(bounds.bottom, nodeBounds.bottom)
  }
}, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })

export const placeWorkflowWithoutOverlap = (existingNodes, workflowNodes, { gap = 120 } = {}) => {
  if (!existingNodes.length || !workflowNodes.length) return workflowNodes
  const overlapsExisting = candidates => candidates.some(candidate => (
    existingNodes.some(existing => rectanglesOverlap(
      getNodeBounds(candidate),
      getNodeBounds(existing),
      gap
    ))
  ))
  if (!overlapsExisting(workflowNodes)) return workflowNodes

  const existingBounds = workflowBounds(existingNodes)
  const incomingBounds = workflowBounds(workflowNodes)
  const offsets = [
    { x: existingBounds.right + gap - incomingBounds.left, y: 0 },
    { x: 0, y: existingBounds.bottom + gap - incomingBounds.top }
  ].sort((left, right) => (
    Math.abs(left.x) + Math.abs(left.y) - Math.abs(right.x) - Math.abs(right.y)
  ))

  for (const offset of offsets) {
    const shifted = workflowNodes.map(node => ({
      ...node,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      }
    }))
    if (!overlapsExisting(shifted)) return shifted
  }
  return workflowNodes
}
