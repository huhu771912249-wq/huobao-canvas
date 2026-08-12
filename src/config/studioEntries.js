export const STUDIO_ENTRIES = [
  { key: 'test-assets', title: '测试素材生成', description: '精确尺寸 PNG / JPG / GIF / MP4', route: '/test-assets' },
  { key: 'gif-editor', title: '水印与 GIF 素材编辑', description: '保存水印、多轨拼接、文字图片与圆角导出', flow: 'gifEditor' },
  { key: 'quick', title: '快速创作', description: '文生图、文生图＋视频', route: '/video-studio' },
  { key: 'novel', title: '小说成片', description: '上传章节，自动拆分镜头', route: '/video-studio?tab=novel' },
  { key: 'assets', title: '素材库', description: '上传、生成与项目素材', route: '/video-studio?tab=assets' },
  { key: 'dsp', title: 'DSP 素材库', description: '保留 54DSP 优秀素材', flow: 'dsp' },
  { key: 'tasks', title: '任务中心', description: '查看生成和失败任务', route: '/tasks' },
  { key: 'batch', title: '批量广告尺寸', description: '保留 GIF / MP4 多尺寸', flow: 'batch' },
  { key: 'resize', title: '视频尺寸工作台', description: '公开链接或上传，一次生成多平台尺寸', route: '/video-resize' },
  { key: 'background', title: '背景替换', description: '保留图片背景工作流', flow: 'background' },
  { key: 'variation', title: '素材变化', description: '保留素材裂变功能', flow: 'variation' }
]
