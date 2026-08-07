const CAMERA_COMMAND = /\[([^\]]+)\]/g
const REFERENCE_TOKEN = /@图\d+/g

function strings(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
}

export function normalizeH3DirectorPrompt(input = {}) {
  const references = Array.isArray(input.references)
    ? input.references.map(item => ({ id: String(item?.id || '').trim(), role: String(item?.role || '').trim() })).filter(item => item.id)
    : []
  const knownReferences = new Set(references.map(item => `@${item.id}`))
  const subjectDefinitions = String(input.subject_definitions || '').trim()
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
    summary: String(input.summary || '').trim(),
    retention_analysis: {
      required: strings(input.retention_analysis?.required),
      flexible: strings(input.retention_analysis?.flexible)
    },
    detailed_description: ordered,
    overall_soundscape: String(input.overall_soundscape || '').trim(),
    non_diegetic_music: String(input.non_diegetic_music || '').trim()
  }
}

export function compileH3DirectorPrompt(input) {
  const plan = normalizeH3DirectorPrompt(input)
  const sections = [
    `主体定义：${plan.subject_definitions}`,
    `画面摘要：${plan.summary}`,
    `必须保留：${plan.retention_analysis.required.join('、')}`,
    `允许变化：${plan.retention_analysis.flexible.join('、')}`,
    ...plan.detailed_description.map(shot => `${shot.start}-${shot.end}秒：${shot.action}${shot.camera ? ` ${shot.camera}` : ''}`),
    `现场声音：${plan.overall_soundscape}`,
    `画外音乐：${plan.non_diegetic_music}`
  ].filter(section => !section.endsWith('：'))
  const prompt = sections.join('\n')
  if (prompt.length > 2000) throw new TypeError('H3 完整提示词不能超过 2000 字符')
  return prompt
}
