/**
 * 首页能力目录 —— 全站唯一一份。
 *
 * tool     快捷工具   —— 跳到一个独立页面，给素材直接出结果。
 * workflow 画板工作流 —— 进画布，预置节点，多步骤编排、全参数可调。
 *
 * 改造前同一个能力最多出现在四个地方：侧栏、顶部智能输入的固定卡片、
 * 「常用工作流」区、「快捷操作」区。素材裂变和 54DSP 各出现 4 次。
 * 现在动作只在这里出现一次；侧栏只放「地点」（首页 / 项目 / 素材库 / 任务）。
 */
export const ENTRY_GROUPS = [
  { key: 'tool', title: '快捷工具', hint: '独立页面，给素材直接出结果' },
  { key: 'workflow', title: '画板工作流', hint: '进画布编排，全参数可调' }
]

export const STUDIO_ENTRIES = [
  { key: 'gif-editor', group: 'tool', title: '水印与 GIF 素材编辑', description: '保存水印、多轨拼接、文字图片与圆角导出', flow: 'gifEditor' },
  { key: 'resize', group: 'tool', title: '视频尺寸工作台', description: '公开链接或上传，一次生成多平台尺寸', route: '/video-resize' },
  { key: 'quick', group: 'tool', title: '快速创作', description: '文生图、文生图＋视频', route: '/video-studio' },
  { key: 'novel', group: 'tool', title: '小说成片', description: '上传章节，自动拆分镜头', route: '/video-studio?tab=novel' },
  { key: 'test-assets', group: 'tool', title: '测试素材生成', description: '精确尺寸 PNG / JPG / GIF / MP4', route: '/test-assets' },

  { key: 'blank', group: 'workflow', title: '空白画板', description: '不预设节点，自己编排', route: '/canvas' },
  { key: 'image', group: 'workflow', title: 'AI 作图', description: '文字提示词与图片节点可继续编辑', flow: 'image' },
  { key: 'image-to-video', group: 'workflow', title: '图生视频', description: '首帧图、动作描述与视频输出节点', flow: 'image-to-video' },
  { key: 'video', group: 'workflow', title: '文生视频', description: '提示词、视频配置与输出节点', flow: 'video' },
  { key: 'batch', group: 'workflow', title: '批量广告尺寸', description: '同一创意保留多尺寸 MP4 / GIF 结果', flow: 'batch' },
  { key: 'background', group: 'workflow', title: '背景替换', description: '保留主体并在画板中继续调整背景', flow: 'background' },
  { key: 'variation', group: 'workflow', title: '素材变化', description: '从已有素材创建可追踪的多版本结果', flow: 'variation' },
  { key: 'dsp', group: 'workflow', title: 'DSP 素材库', description: '选择高点击素材并交给已有 DSP 工作流', flow: 'dsp' }
]

/**
 * 「素材库」和「任务中心」不在这份目录里 —— 它们不是动作，是地点，
 * 归侧栏（`utils/workspaceUi.js` 的 NAV_ITEMS）。放这里会造出第五处重复。
 */
export const entriesByGroup = groupKey => STUDIO_ENTRIES.filter(entry => entry.group === groupKey)
