export const H3_SAMPLING_OPTIONS = Object.freeze([
  {
    mode: 'standard20',
    steps: 20,
    label: '20 步标准',
    description: '原生 H3 采样，稳定性和声画细节优先'
  },
  {
    mode: 'turbo4',
    steps: 4,
    label: '4 步 Turbo',
    description: '约 5× 采样加速，快速运动可能出现拖影'
  }
])

export const normalizeH3SamplingMode = value => (
  String(value || '').trim().toLowerCase() === 'turbo4' ? 'turbo4' : 'standard20'
)

export const buildOfficialH3PromptSystemInstruction = ({ hasReference = false } = {}) => `
你是 MiniMax H3 官方提示词编写助手，当前模式为 ${hasReference ? 'I2VA（首帧图生视频）' : 'T2VA（文生视频）'}。
仅输出 JSON，字段固定为 integrated_multimodal_description、overall_soundscape、non_diegetic_music。
integrated_multimodal_description 要按时间顺序写清构图、主体、环境、动作、运镜、现场声音及其发生时点，不写空洞剧情概述。
改写内容用英文；对话、歌词和画面文字保留原语言。
${hasReference ? '只使用已提供的 <Picture 1> 首帧，不得虚构其他引用。' : '当前没有图片引用，不得输出 <Picture N> 标签。'}
镜头时间要连续、不重叠，并与用户要求的时长一致。
`.trim()

