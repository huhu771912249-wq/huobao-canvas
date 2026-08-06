const edge = (source, target, extra = {}) => ({
  id: `edge_${source}_${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  ...extra
})

const ratioForSize = (size) => String(size).startsWith('720x1280') ? '9:16' : '16:9'

export const buildStudioCanvas = ({ mode, prompt = '', size = '1280x720', videoModel = 'minimax-h3' }) => {
  const imagePrompt = { id: 'studio_image_prompt', type: 'text', position: { x: 80, y: 140 }, data: { content: prompt, label: '画面提示词' } }
  const imageConfig = { id: 'studio_image_config', type: 'imageConfig', position: { x: 440, y: 140 }, data: { label: '文生图', model: 'frw-qianwen', size } }
  const imageResult = { id: 'studio_image_result', type: 'image', position: { x: 800, y: 140 }, data: { url: '', label: '首帧结果' } }
  const imageEdges = [
    edge(imagePrompt.id, imageConfig.id, { type: 'promptOrder', data: { promptOrder: 1 } }),
    edge(imageConfig.id, imageResult.id)
  ]
  if (mode === 'text-to-image') return { nodes: [imagePrompt, imageConfig, imageResult], edges: imageEdges, viewport: { x: 60, y: 80, zoom: 0.78 } }

  const motionPrompt = { id: 'studio_motion_prompt', type: 'text', position: { x: 800, y: 430 }, data: { content: prompt, label: '动态与运镜提示词' } }
  const videoConfig = { id: 'studio_video_config', type: 'videoConfig', position: { x: 1160, y: 220 }, data: { label: '云端视频', mode: 'image_to_video', model: videoModel, ratio: ratioForSize(size), dur: 5, exportResolution: '1080p' } }
  const videoResult = { id: 'studio_video_result', type: 'video', position: { x: 1540, y: 220 }, data: { url: '', label: '1080p 视频结果' } }
  return {
    nodes: [imagePrompt, imageConfig, imageResult, motionPrompt, videoConfig, videoResult],
    edges: [
      ...imageEdges,
      edge(imageResult.id, videoConfig.id, { type: 'imageRole', data: { imageRole: 'first_frame_image' } }),
      edge(motionPrompt.id, videoConfig.id, { type: 'promptOrder', data: { promptOrder: 1 } }),
      edge(videoConfig.id, videoResult.id)
    ],
    viewport: { x: 30, y: 60, zoom: 0.62 }
  }
}
