import { buildStudioCanvas } from './studioProjectFlow.js'
import {
  createBatchVideoTemplateFlow,
  createImageToVideoTemplateFlow,
  createTextToVideoTemplateFlow
} from './videoWorkflows.js'

const withViewport = (flow, viewport = { x: 80, y: 60, zoom: 0.8 }) => ({
  nodes: flow.nodes,
  edges: flow.edges,
  viewport
})

export const WORKSPACE_LAUNCH_LABELS = Object.freeze({
  image: 'AI 作图',
  video: '文生视频',
  'image-to-video': '图生视频',
  batch: '批量广告尺寸',
  variation: '素材裂变',
  background: '背景替换',
  dsp: '54DSP 优秀素材'
})

export const buildCanvasLaunch = (flow, { prompt = '' } = {}) => {
  if (flow === 'image') {
    return buildStudioCanvas({ mode: 'text-to-image', prompt })
  }
  if (flow === 'video' || flow === 'image-to-video' || flow === 'batch') {
    const builders = {
      video: createTextToVideoTemplateFlow,
      'image-to-video': createImageToVideoTemplateFlow,
      batch: createBatchVideoTemplateFlow
    }
    const canvas = withViewport(builders[flow]({ x: 120, y: 140 }))
    if (!prompt) return canvas
    return {
      ...canvas,
      nodes: canvas.nodes.map((node) => node.type === 'text'
        ? { ...node, data: { ...node.data, content: prompt } }
        : node)
    }
  }
  if (flow === 'variation') {
    return {
      nodes: [{
        id: 'variation-workflow',
        type: 'materialVariation',
        position: { x: 160, y: 100 },
        data: { label: '素材裂变' }
      }],
      edges: [],
      viewport: { x: 100, y: 80, zoom: 0.8 }
    }
  }
  if (flow === 'background') {
    return {
      nodes: [
        {
          id: 'background-config',
          type: 'imageConfig',
          position: { x: 140, y: 100 },
          data: { label: '背景替换', editMode: 'background_replace', model: 'frw-qianwen' }
        },
        {
          id: 'background-result',
          type: 'image',
          position: { x: 540, y: 100 },
          data: { url: '', label: '背景替换结果' }
        }
      ],
      edges: [{
        id: 'edge_background-config_background-result',
        source: 'background-config',
        target: 'background-result',
        sourceHandle: 'right',
        targetHandle: 'left'
      }],
      viewport: { x: 100, y: 80, zoom: 0.8 }
    }
  }
  if (flow === 'dsp') {
    return {
      nodes: [
        {
          id: 'dsp-library',
          type: 'dspCreativeLibrary',
          position: { x: 120, y: 100 },
          data: { label: '54DSP 优秀素材' }
        },
        {
          id: 'dsp-tasks',
          type: 'dspCreativeTaskCenter',
          position: { x: 1120, y: 100 },
          data: { label: '素材任务中心', jobIds: [] }
        }
      ],
      edges: [],
      viewport: { x: 40, y: 50, zoom: 0.68 }
    }
  }
  throw new Error(`不支持的画布入口：${flow}`)
}

export const resolveWorkspaceNavigationTarget = (id) => {
  const key = String(id || '').trim()
  if (key === 'recent') return { path: '/recent-generations' }
  if (key === 'tasks') return { path: '/tasks' }
  if (key === 'projects') return { path: '/', query: { section: 'projects' } }
  if (key === 'home') return { path: '/' }
  return { path: '/', query: { launch: key } }
}

export const resolveLegacyCanvasRoute = ({ id, flow, panel } = {}) => {
  if (String(id || '') !== 'new') return null
  if (String(panel || '') === 'tasks') return { path: '/tasks' }
  const launch = String(flow || '').trim()
  return WORKSPACE_LAUNCH_LABELS[launch]
    ? { path: '/', query: { launch } }
    : { path: '/' }
}

export const normalizeStudioTab = (value) => (
  ['quick', 'novel'].includes(String(value || '')) ? String(value) : 'quick'
)
