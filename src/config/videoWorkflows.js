/**
 * Dedicated video workflow templates | 专用视频工作流模板
 * Keep these as pure builders so they can be tested without Vue runtime.
 */

const createEdge = (source, target, extra = {}) => ({
  id: `edge_${source}_${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  ...extra
})

export const createTextToVideoTemplateFlow = (startPosition) => {
  const promptId = 'text_to_video_prompt'
  const configId = 'text_to_video_config'
  const outputId = 'text_to_video_output'

  return {
    nodes: [
      {
        id: promptId,
        type: 'text',
        position: { x: startPosition.x, y: startPosition.y },
        data: {
          content: '',
          label: '视频提示词'
        }
      },
      {
        id: configId,
        type: 'videoConfig',
        position: { x: startPosition.x + 360, y: startPosition.y },
        data: {
          label: '文生视频',
          mode: 'text_to_video'
        }
      },
      {
        id: outputId,
        type: 'video',
        position: { x: startPosition.x + 720, y: startPosition.y },
        data: {
          url: '',
          label: '视频结果'
        }
      }
    ],
    edges: [
      createEdge(promptId, configId, {
        type: 'promptOrder',
        data: { promptOrder: 1 }
      }),
      createEdge(configId, outputId)
    ]
  }
}

export const createImageToVideoTemplateFlow = (startPosition) => {
  const imageId = 'image_to_video_image'
  const promptId = 'image_to_video_prompt'
  const configId = 'image_to_video_config'
  const outputId = 'image_to_video_output'

  return {
    nodes: [
      {
        id: imageId,
        type: 'image',
        position: { x: startPosition.x, y: startPosition.y },
        data: {
          url: '',
          label: '首帧/参考图',
          publicProps: { name: '首帧/参考图' }
        }
      },
      {
        id: promptId,
        type: 'text',
        position: { x: startPosition.x, y: startPosition.y + 260 },
        data: {
          content: '',
          label: '视频动作提示词'
        }
      },
      {
        id: configId,
        type: 'videoConfig',
        position: { x: startPosition.x + 360, y: startPosition.y + 120 },
        data: {
          label: '图生视频',
          mode: 'image_to_video'
        }
      },
      {
        id: outputId,
        type: 'video',
        position: { x: startPosition.x + 720, y: startPosition.y + 120 },
        data: {
          url: '',
          label: '视频结果'
        }
      }
    ],
    edges: [
      createEdge(imageId, configId, {
        type: 'imageRole',
        data: { imageRole: 'first_frame_image' }
      }),
      createEdge(promptId, configId, {
        type: 'promptOrder',
        data: { promptOrder: 1 }
      }),
      createEdge(configId, outputId)
    ]
  }
}

export const VIDEO_WORKFLOW_TEMPLATES = [
  {
    id: 'text-to-video',
    name: '文生视频',
    description: '直接输入视频描述，生成视频任务和结果节点',
    icon: 'VideocamOutline',
    category: 'video',
    createNodes: createTextToVideoTemplateFlow
  },
  {
    id: 'image-to-video',
    name: '图生视频',
    description: '先上传首帧/参考图，再输入动作描述生成视频',
    icon: 'VideocamOutline',
    category: 'video',
    createNodes: createImageToVideoTemplateFlow
  }
]
