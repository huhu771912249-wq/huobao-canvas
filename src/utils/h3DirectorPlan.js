const H3_PROMPT_LIMIT = 1000
const VALID_RATIOS = new Set(['16:9', '9:16'])
const VALID_DURATIONS = new Set([2, 3, 5])

const text = (value, fallback = '') => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}

const record = value => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
)

const compactList = value => (
  Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : []
)

const isEnglishDominant = value => {
  const normalized = text(value)
  const latinWords = normalized.match(/[A-Za-z]{2,}/g) ?? []
  const chineseChars = normalized.match(/[\u3400-\u9fff]/g) ?? []
  return latinWords.length >= 4 && latinWords.join('').length > chineseChars.length * 2
}

const visibleText = (value, fallback = '') => (
  isEnglishDominant(value) ? text(fallback) : text(value, fallback)
)

const visibleList = (value, fallback = []) => {
  const normalized = compactList(value)
  if (!normalized.length || normalized.some(isEnglishDominant)) return fallback
  return normalized
}

const inferRatio = input => /竖屏|纵向|portrait|9\s*[:：x×]\s*16/i.test(input) ? '9:16' : '16:9'

const inferDuration = input => {
  const match = String(input).match(/([235])\s*(?:秒|s\b)/i)
  return match ? Number(match[1]) : 5
}

const inferShotSize = input => {
  const match = String(input).match(/大远景|全景|远景|中景|中近景|近景|特写|微距/)
  return match?.[0] || '中景转近景'
}

const inferLocation = input => {
  const candidates = ['上海', '北京', '深圳', '广州', '纽约', '东京', '巴黎', '海边', '街道', '咖啡馆', '办公室', '工作室', '卧室', '客厅', '厨房', '森林', '沙漠', '屋顶', '顶楼']
  const found = candidates.filter(item => String(input).includes(item))
  return found.length ? found.join('·') : '与故事语义匹配的真实空间'
}

const inferCharacter = input => {
  const raw = String(input)
  const explicitEthnicity = /黑人|白人|拉丁裔|南亚|欧美|非洲|欧洲|美国人|日本人|韩国人/.test(raw)
  const gender = /女人|女性|女孩|女主|女士/.test(raw) ? '女性' : (/男人|男性|男孩|男主|先生/.test(raw) ? '男性' : '人物')
  return {
    identity: explicitEthnicity ? `用户指定的成年${gender}` : `成年中国或东亚${gender}`,
    appearance: `成年${gender}，五官与体态自然，身份特征清晰，跨帧保持一致`,
    wardrobe: '符合人物职业、地点与时代的完整服装，材质细节真实',
    accessories: '少量与情节相关的配饰，不喧宾夺主',
    continuity: '脸部、发型、服装、配饰、体型和左右方向全程一致'
  }
}

const inferCameraMovement = input => {
  const match = String(input).match(/缓慢推近|推镜|拉镜|横移|跟拍|环绕|升降|摇镜|手持|固定镜头|航拍/)
  return match?.[0] || '稳定缓慢推近，运动曲线平滑'
}

const cleanPromptEnd = value => text(value).replace(/[，,；;、\s]+$/g, '').trim()

const truncatePrompt = (value, limit = H3_PROMPT_LIMIT) => {
  const prompt = cleanPromptEnd(value)
  if (prompt.length <= limit) return prompt
  const clipped = prompt.slice(0, limit)
  const boundary = Math.max(clipped.lastIndexOf('。'), clipped.lastIndexOf('；'), clipped.lastIndexOf(','), clipped.lastIndexOf('，'))
  return cleanPromptEnd(boundary >= limit * 0.72 ? clipped.slice(0, boundary + 1) : clipped)
}

export const buildFallbackH3DirectorPlan = (userInput = '') => {
  const input = text(userInput, '一个具有明确主体与动作的电影感连续镜头')
  const duration = inferDuration(input)
  const character = inferCharacter(input)
  const location = inferLocation(input)
  const shotSize = inferShotSize(input)
  return normalizeH3DirectorPlan({
    title: input.slice(0, 22),
    summary: input,
    aspect_ratio: inferRatio(input),
    duration_seconds: duration,
    quality_mode: 'quality',
    requires_keyframe: /角色一致|产品一致|参考图|首帧|同一个人|同一人物/.test(input),
    character,
    environment: {
      location,
      time: /夜|晚上|凌晨/.test(input) ? '夜晚' : (/黄昏|夕阳/.test(input) ? '黄昏' : '自然日间'),
      weather: /雨/.test(input) ? '细雨，地面有受控反光' : '天气与剧情连续、能见度清晰',
      set_dressing: `在${location}布置与人物身份相关的家具、道具、材质纹理和前中后景层次，装饰克制且服务叙事`,
      spatial_layout: '主体与关键道具完整入镜，画面四周保留约 10% 安全边距'
    },
    cinematography: {
      shot_size: shotSize,
      camera_angle: '平视，符合人物视线高度',
      lens: shotSize.includes('远') ? '24mm 广角电影镜头' : (shotSize.includes('特写') ? '85mm 人像镜头' : '50mm 标准电影镜头'),
      composition: '三分法构图，主体清晰，前景引导线与背景层次明确，避免裁切头手脚',
      camera_movement: inferCameraMovement(input),
      focus: '主体眼睛与关键动作清晰，浅景深随动作自然跟焦'
    },
    lighting: {
      key_light: '有明确方向的柔和主光，辅光控制反差，轮廓光分离主体与背景',
      color_palette: '统一的电影级色彩，肤色自然，避免过饱和',
      mood: '情绪与用户描述一致，光影随动作连续变化'
    },
    action_timeline: [
      `0-${Math.max(1, Math.floor(duration / 2))}秒：建立${shotSize}、人物和环境关系，主体开始核心动作`,
      `${Math.max(1, Math.floor(duration / 2))}-${duration}秒：镜头平滑推进，核心动作完成并停在清晰收束画面`
    ],
    audio_direction: '与地点匹配的环境底噪、关键动作拟音和克制音乐；如有人说话，口型与声音同步',
    image_prompt: `${input}，电影级关键帧，${shotSize}，主体和关键道具完整入镜，真实材质，统一光影，四周 10% 安全边距，无字幕无水印`,
    negative_prompt: '避免身份漂移、脸部变形、多余肢体、手指错误、服装跳变、背景闪烁、物体穿模、镜头突跳、低清晰度、文字、水印和黑边',
    assumptions: ['未明确的导演参数已按 H3 单一连续镜头专业规则补全']
  }, input, 'rules')
}

export const buildH3VideoPrompt = planValue => {
  const plan = record(planValue)
  const character = record(plan.character)
  const environment = record(plan.environment)
  const camera = record(plan.cinematography)
  const lighting = record(plan.lighting)
  const action = compactList(plan.action_timeline).join('；')
  const sections = [
    `单一连续镜头：${text(plan.summary, plan.title)}`,
    `人物：${[character.identity, character.appearance, character.wardrobe, character.accessories, character.continuity].map(item => text(item)).filter(Boolean).join('，')}`,
    `场景：${[environment.location, environment.time, environment.weather, environment.set_dressing, environment.spatial_layout].map(item => text(item)).filter(Boolean).join('，')}`,
    `摄影：${[camera.shot_size, camera.camera_angle, camera.lens, camera.composition, camera.camera_movement, camera.focus].map(item => text(item)).filter(Boolean).join('，')}`,
    `光影：${[lighting.key_light, lighting.color_palette, lighting.mood].map(item => text(item)).filter(Boolean).join('，')}`,
    action ? `时间线：${action}` : '',
    text(plan.audio_direction) ? `声音：${text(plan.audio_direction)}` : '',
    text(plan.negative_prompt) ? `约束：${text(plan.negative_prompt)}` : ''
  ].filter(Boolean)
  return truncatePrompt(sections.join('。'), H3_PROMPT_LIMIT)
}

export const normalizeH3DirectorPlan = (rawValue = {}, userInput = '', source = 'gemma') => {
  const raw = record(rawValue)
  const input = text(userInput, text(raw.summary, text(raw.title)))
  const characterFallback = inferCharacter(input)
  const characterRaw = record(raw.character)
  const environmentRaw = record(raw.environment)
  const cameraRaw = record(raw.cinematography)
  const lightingRaw = record(raw.lighting)
  const ratio = VALID_RATIOS.has(raw.aspect_ratio) ? raw.aspect_ratio : inferRatio(input)
  const durationCandidate = Number(raw.duration_seconds)
  const duration = VALID_DURATIONS.has(durationCandidate) ? durationCandidate : inferDuration(input)
  const location = text(environmentRaw.location, inferLocation(input))
  const shotSize = text(cameraRaw.shot_size, inferShotSize(input))
  const fallbackLocation = inferLocation(input)
  const fallbackShotSize = inferShotSize(input)
  const fallbackTimeline = [
    `0-${Math.max(1, Math.floor(duration / 2))}秒：建立主体与环境，开始核心动作`,
    `${Math.max(1, Math.floor(duration / 2))}-${duration}秒：镜头连续运动，核心动作完成并清晰收束`
  ]
  const plan = {
    workflow_type: 'h3_video',
    title: visibleText(raw.title, input.slice(0, 22) || 'H3 专业视频'),
    summary: visibleText(raw.summary, input),
    model: 'minimax-h3',
    aspect_ratio: ratio,
    duration_seconds: duration,
    quality_mode: raw.quality_mode === 'fast' ? 'fast' : 'quality',
    requires_keyframe: Boolean(raw.requires_keyframe),
    character: {
      identity: visibleText(characterRaw.identity, characterFallback.identity),
      appearance: visibleText(characterRaw.appearance, characterFallback.appearance),
      wardrobe: visibleText(characterRaw.wardrobe, characterFallback.wardrobe),
      accessories: visibleText(characterRaw.accessories, characterFallback.accessories),
      continuity: visibleText(characterRaw.continuity, characterFallback.continuity)
    },
    environment: {
      location: visibleText(location, fallbackLocation),
      time: visibleText(environmentRaw.time, '自然日间或与故事明确匹配的时段'),
      weather: visibleText(environmentRaw.weather, '天气连续，空气透视自然'),
      set_dressing: visibleText(environmentRaw.set_dressing, `在${fallbackLocation}加入服务叙事的家具、道具、材质纹理与前中后景装饰`),
      spatial_layout: visibleText(environmentRaw.spatial_layout, '主体与关键道具完整入镜，四周保留约 10% 安全边距')
    },
    cinematography: {
      shot_size: visibleText(shotSize, fallbackShotSize),
      camera_angle: visibleText(cameraRaw.camera_angle, '平视'),
      lens: visibleText(cameraRaw.lens, fallbackShotSize.includes('远') ? '24mm' : (fallbackShotSize.includes('特写') ? '85mm' : '50mm')),
      composition: visibleText(cameraRaw.composition, '三分法构图，主体清晰，前中后景层次明确'),
      camera_movement: visibleText(cameraRaw.camera_movement, inferCameraMovement(input)),
      focus: visibleText(cameraRaw.focus, '主体清晰并随动作自然跟焦')
    },
    lighting: {
      key_light: visibleText(lightingRaw.key_light, '有明确方向的柔和主光与轮廓光'),
      color_palette: visibleText(lightingRaw.color_palette, '统一电影级色彩，肤色自然'),
      mood: visibleText(lightingRaw.mood, '情绪与故事一致')
    },
    action_timeline: visibleList(raw.action_timeline, fallbackTimeline),
    audio_direction: visibleText(raw.audio_direction, '匹配地点的环境声、关键动作拟音和克制音乐，人物对白需口型同步'),
    image_prompt: visibleText(raw.image_prompt, `${input}，电影级关键帧，${fallbackShotSize}，主体完整入镜，真实材质，四周 10% 安全边距，无文字无水印`),
    negative_prompt: visibleText(raw.negative_prompt, '避免身份漂移、脸部变形、多余肢体、手指错误、服装跳变、背景闪烁、物体穿模、镜头突跳、文字和水印'),
    assumptions: visibleList(raw.assumptions),
    plan_source: source === 'rules' ? 'rules' : 'gemma'
  }
  plan.video_prompt = buildH3VideoPrompt({ ...plan, video_prompt: undefined })
  return plan
}

const extractJsonObject = value => {
  const input = String(value ?? '')
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (start < 0) {
      if (char === '{') { start = index; depth = 1 }
      continue
    }
    if (escaped) { escaped = false; continue }
    if (char === '\\' && inString) { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return input.slice(start, index + 1)
  }
  return ''
}

export const parseDirectorResponse = (response, userInput = '') => {
  try {
    const json = extractJsonObject(response)
    if (!json) throw new Error('missing JSON object')
    return normalizeH3DirectorPlan(JSON.parse(json), userInput, 'gemma')
  } catch {
    return buildFallbackH3DirectorPlan(userInput)
  }
}

export { H3_PROMPT_LIMIT }
