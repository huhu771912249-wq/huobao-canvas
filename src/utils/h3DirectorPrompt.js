const CAMERA_COMMAND = /\[([^\]]+)\]/g
const REFERENCE_TOKEN = /@(图片|图|视频|音频)(\d+)/g

function referenceTag(id) {
  const match = String(id || '').trim().match(/^(图片|图|视频|音频)(\d+)$/)
  if (!match) return ''
  if (!['图', '图片'].includes(match[1]) || Number(match[2]) !== 1) {
    throw new TypeError('当前 H3 生成通道只支持 @图1 单图参考')
  }
  return '<Picture 1>'
}

function dialogueText(value) {
  return String(value || '').trim().replace(/^<d>\s*/i, '').replace(/\s*<\/d>$/i, '')
}

function humanText(value) {
  if (Array.isArray(value)) return value.map(humanText).filter(Boolean).join('；')
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${key}：${humanText(item)}`).filter(item => !item.endsWith('：')).join('；')
  }
  return String(value || '').trim()
}

function strings(value) {
  if (Array.isArray(value)) return value.map(humanText).filter(Boolean)
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}：${humanText(item)}`).filter(item => !item.endsWith('：'))
  return humanText(value).split(/[，,；;]/).map(item => item.trim()).filter(Boolean)
}

export function normalizeH3DirectorPrompt(input = {}) {
  const references = Array.isArray(input.references)
    ? input.references.map(item => ({ id: String(item?.id || '').trim(), role: String(item?.role || '').trim() })).filter(item => item.id)
    : []
  const knownReferences = new Set(references.map(item => `@${item.id}`))
  const subjectDefinitions = humanText(input.subject_definitions)
  for (const token of subjectDefinitions.match(REFERENCE_TOKEN) || []) {
    if (!knownReferences.has(token)) throw new TypeError(`${token} 没有对应参考图`)
  }

  const shots = Array.isArray(input.detailed_description) ? input.detailed_description.map((item, index) => {
    const start = Number(item?.start)
    const end = Number(item?.end)
    const action = String(item?.action || '').trim()
    const camera = String(item?.camera || '').trim()
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !action) {
      throw new TypeError(`第 ${index + 1} 个镜头时间或动作无效`)
    }
    for (const match of camera.matchAll(CAMERA_COMMAND)) {
      if (match[1].split(',').map(value => value.trim()).filter(Boolean).length > 3) {
        throw new TypeError('单个镜头最多组合 3 个相机指令')
      }
    }
    return { start, end, action, camera }
  }) : []
  const ordered = [...shots].sort((a, b) => a.start - b.start)
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].start < ordered[index - 1].end) throw new TypeError('镜头时间不能重叠')
  }

  return {
    references,
    subject_definitions: subjectDefinitions,
    summary: humanText(input.summary),
    dialogue: dialogueText(input.dialogue),
    retention_analysis: {
      required: strings(input.retention_analysis?.required),
      flexible: strings(input.retention_analysis?.flexible)
    },
    detailed_description: ordered,
    overall_soundscape: humanText(input.overall_soundscape),
    non_diegetic_music: humanText(input.non_diegetic_music)
  }
}

export function compileH3DirectorPrompt(input) {
  const plan = normalizeH3DirectorPrompt(input)
  const referenceTags = new Map(plan.references.map(item => [`@${item.id}`, referenceTag(item.id)]))
  const sections = [
    `主体定义：${plan.subject_definitions}`,
    `画面摘要：${plan.summary}`,
    `必须保留：${plan.retention_analysis.required.join('、')}`,
    `允许变化：${plan.retention_analysis.flexible.join('、')}`,
    ...plan.detailed_description.map(shot => `${shot.start}-${shot.end}秒：${shot.action}${shot.camera ? ` ${shot.camera}` : ''}`),
    `对白：${plan.dialogue ? `<d>${plan.dialogue}</d>` : ''}`,
    `现场声音：${plan.overall_soundscape}`,
    `画外音乐：${plan.non_diegetic_music}`
  ].filter(section => !section.endsWith('：'))
  const prompt = sections.join('\n').replace(REFERENCE_TOKEN, token => {
    const tag = referenceTags.get(token)
    if (!tag) throw new TypeError(`${token} 没有对应参考素材`)
    return tag
  })
  if (prompt.length > 2000) throw new TypeError('H3 完整提示词不能超过 2000 字符')
  return prompt
}
