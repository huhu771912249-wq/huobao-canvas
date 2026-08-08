import { getImageAlignmentSpec } from '../config/studioProjectFlow.js'
import { getVideoQualityProfile } from './videoQualityProfile.js'

const node = (key, type, x, y, data) => ({ key, type, position: { x, y }, data })
const edge = (sourceKey, targetKey, extra = {}) => ({ sourceKey, targetKey, ...extra })

export const buildH3DirectorWorkflow = (plan, position = { x: 100, y: 100 }, autoExecute = false) => {
  const x = Number(position?.x) || 0
  const y = Number(position?.y) || 0
  const ratio = plan?.aspect_ratio === '9:16' ? '9:16' : '16:9'
  const duration = [2, 3, 5].includes(Number(plan?.duration_seconds)) ? Number(plan.duration_seconds) : 5
  const qualityMode = plan?.quality_mode === 'fast' ? 'fast' : 'quality'
  const qualityProfile = getVideoQualityProfile(qualityMode, ratio)
  const videoData = {
    label: 'MiniMax H3 专业视频',
    mode: plan?.requires_keyframe ? 'image_to_video' : 'text_to_video',
    model: 'minimax-h3',
    ratio,
    dur: duration,
    qualityMode,
    qualityProfile,
    imageAlignment: getImageAlignmentSpec('minimax-h3', ratio),
    targetResolution: qualityMode === 'quality' ? '1080p' : '原生分辨率',
    directorPlan: plan,
    autoExecute: Boolean(autoExecute && !plan?.requires_keyframe)
  }

  if (!plan?.requires_keyframe) {
    return {
      nodes: [
        node('videoPrompt', 'text', x, y, { content: plan?.video_prompt || '', label: 'H3 专业视频提示词' }),
        node('videoConfig', 'videoConfig', x + 400, y, videoData),
        node('videoOutput', 'video', x + 800, y, {
          url: '', label: 'H3 视频结果', model: 'minimax-h3', qualityProfile,
          targetResolution: videoData.targetResolution
        })
      ],
      edges: [
        edge('videoPrompt', 'videoConfig', { type: 'promptOrder', data: { promptOrder: 1 } }),
        edge('videoConfig', 'videoOutput')
      ]
    }
  }

  const imageSize = ratio === '9:16' ? '720x1280' : '1280x720'
  return {
    nodes: [
      node('imagePrompt', 'text', x, y, { content: plan?.image_prompt || '', label: '一致性关键帧提示词' }),
      node('videoPrompt', 'text', x, y + 270, { content: plan?.video_prompt || '', label: 'H3 专业视频提示词' }),
      node('imageConfig', 'imageConfig', x + 400, y, {
        label: 'FRW 一致性关键帧', model: 'frw-qianwen', size: imageSize,
        autoExecute: Boolean(autoExecute), directorPlan: plan
      }),
      node('imageOutput', 'image', x + 800, y, { url: '', label: 'H3 首帧' }),
      node('videoConfig', 'videoConfig', x + 1200, y + 140, videoData),
      node('videoOutput', 'video', x + 1600, y + 140, {
        url: '', label: 'H3 视频结果', model: 'minimax-h3', qualityProfile,
        targetResolution: videoData.targetResolution
      })
    ],
    edges: [
      edge('imagePrompt', 'imageConfig', { type: 'promptOrder', data: { promptOrder: 1 } }),
      edge('imageConfig', 'imageOutput'),
      edge('imageOutput', 'videoConfig', { type: 'imageRole', data: { imageRole: 'first_frame_image' } }),
      edge('videoPrompt', 'videoConfig', { type: 'promptOrder', data: { promptOrder: 1 } }),
      edge('videoConfig', 'videoOutput')
    ]
  }
}

