export const STUDIO_ENTRIES = [
  { key: 'quick', title: '快速创作', description: '文生图、文生图＋视频', route: '/video-studio' },
  { key: 'novel', title: '小说成片', description: '上传章节，自动拆分镜头', route: '/video-studio?tab=novel' },
  { key: 'assets', title: '素材库', description: '上传、生成与项目素材', route: '/video-studio?tab=assets' },
  { key: 'dsp', title: 'DSP 素材库', description: '保留 54DSP 优秀素材', flow: 'dsp' },
  { key: 'tasks', title: '任务中心', description: '查看生成和失败任务', flow: 'dsp' },
  { key: 'batch', title: '批量广告尺寸', description: '保留 GIF / MP4 多尺寸', flow: 'video' },
  { key: 'background', title: '背景替换', description: '保留图片背景工作流', flow: 'variation' },
  { key: 'variation', title: '素材变化', description: '保留素材裂变功能', flow: 'variation' }
]
