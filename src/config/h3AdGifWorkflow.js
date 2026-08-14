import { getImageAlignmentSpec } from './studioProjectFlow.js'
import { getVideoQualityProfile } from '../utils/videoQualityProfile.js'

const edge = (source, target, extra = {}) => ({
  id: `edge_${source}_${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  ...extra
})

export const buildH3AdGifWorkflow = (startPosition = { x: 0, y: 0 }) => {
  const prefix = `h3_ad_gif_${Date.now()}`
  const id = name => `${prefix}_${name}`
  const qualityProfile = getVideoQualityProfile('fast', '16:9')
  const ids = {
    imagePrompt: id('image_prompt'),
    imageConfig: id('image_config'),
    imageResult: id('image_result'),
    motionPrompt: id('motion_prompt'),
    videoConfig: id('video_config'),
    videoResult: id('video_result'),
    gif: id('gif'),
    copy: id('copy'),
    overlay: id('overlay'),
    watermark: id('watermark'),
    export: id('export')
  }
  const x = startPosition.x
  const y = startPosition.y
  const nodes = [
    { id: ids.imagePrompt, type: 'text', position: { x, y }, data: { label: '01 文生图提示词', content: '输入成年人广告画面、产品、构图和光线，保留四周安全边距' } },
    { id: ids.imageConfig, type: 'imageConfig', position: { x: x + 430, y }, data: { label: '02 Z-Image 人像文生图', model: 'z-image', size: '1280x720', negativePrompt: 'low quality, blurry, deformed, bad anatomy, extra fingers, watermark', steps: 36, cfg: 4, samplerName: 'res_multistep', scheduler: 'simple', seed: -1 } },
    { id: ids.imageResult, type: 'image', position: { x: x + 956, y }, data: { label: '03 H3 首帧结果', url: '' } },
    { id: ids.motionPrompt, type: 'text', position: { x: x + 956, y: y + 367 }, data: { label: '04 H3 动作与声音', content: '描述 5 秒内的主体动作、运镜、口播、环境音与音乐' } },
    { id: ids.videoConfig, type: 'videoConfig', position: { x: x + 1404, y: y + 80 }, data: { label: '05 MiniMax H3', mode: 'image_to_video', model: 'minimax-h3', ratio: '16:9', dur: 5, outputWidth: 1280, outputHeight: 720, samplingMode: 'standard20', qualityMode: 'fast', qualityProfile, imageAlignment: getImageAlignmentSpec('minimax-h3', '16:9') } },
    { id: ids.videoResult, type: 'video', position: { x: x + 2044, y: y + 80 }, data: { label: '06 H3 视频结果', url: '' } },
    { id: ids.gif, type: 'videoGif', position: { x: x + 2524, y: y + 80 }, data: { label: '07 视频转 GIF', outputWidth: 720, outputHeight: 1280, fitMode: 'blur', fps: 12, colors: 256, gifUrl: '', mime: 'image/gif' } },
    { id: ids.copy, type: 'text', position: { x: x + 2524, y: y + 680 }, data: { label: '08 广告文案', content: '在这里输入 GIF 广告文案' } },
    { id: ids.overlay, type: 'textOverlay', position: { x: x + 3064, y: y + 80 }, data: { label: '09 GIF 可视化加字', outputWidth: 720, outputHeight: 1280, videoFitMode: 'blur', videoOutputFormat: 'both', x: 50, y: 78, fontSize: 48, boxWidth: 76, color: '#ffffff', strokeColor: '#111111', strokeWidth: 4, align: 'center', shadow: true } },
    { id: ids.watermark, type: 'watermarkEditor', position: { x: x + 3664, y: y + 80 }, data: { label: '10 水印与细节编辑', quickSettings: { watermarkId: 'image-1', position: 'top-right', size: 22, opacity: 92 } } },
    { id: ids.export, type: 'materialExport', position: { x: x + 4164, y: y + 80 }, data: { label: '11 GIF 导出', url: '', gifUrl: '', mime: 'image/gif' } }
  ]
  const edges = [
    edge(ids.imagePrompt, ids.imageConfig, { type: 'promptOrder', data: { promptOrder: 1 } }),
    edge(ids.imageConfig, ids.imageResult),
    edge(ids.imageResult, ids.videoConfig, { type: 'imageRole', data: { imageRole: 'first_frame_image' } }),
    edge(ids.motionPrompt, ids.videoConfig, { type: 'promptOrder', data: { promptOrder: 1 } }),
    edge(ids.videoConfig, ids.videoResult),
    edge(ids.videoResult, ids.gif),
    edge(ids.gif, ids.overlay),
    edge(ids.copy, ids.overlay),
    edge(ids.overlay, ids.watermark),
    edge(ids.watermark, ids.export)
  ]
  return { nodes, edges, viewport: { x: 40, y: 70, zoom: 0.42 } }
}

export const H3_AD_GIF_WORKFLOW_TEMPLATE = {
  id: 'h3-ad-gif-production',
  name: 'H3 广告 GIF 完整链路',
  description: 'Z-Image 文生图 → H3 视频 → GIF → 文字/水印 → 导出',
  icon: 'VideocamOutline',
  category: 'video',
  createNodes: startPosition => buildH3AdGifWorkflow(startPosition)
}
