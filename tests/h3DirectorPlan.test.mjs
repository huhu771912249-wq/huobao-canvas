import assert from 'node:assert/strict'
import {
  buildFallbackH3DirectorPlan,
  buildH3VideoPrompt,
  normalizeH3DirectorPlan,
  parseDirectorResponse
} from '../src/utils/h3DirectorPlan.js'

const fallback = buildFallbackH3DirectorPlan('一个年轻女设计师在上海顶楼工作室展示新产品')
assert.equal(fallback.workflow_type, 'h3_video')
assert.equal(fallback.model, 'minimax-h3')
assert.equal(fallback.aspect_ratio, '16:9')
assert.equal(fallback.duration_seconds, 5)
assert.equal(fallback.quality_mode, 'quality')
assert.match(fallback.character.appearance, /成年|成人/)
assert.match(fallback.environment.location, /上海|工作室/)
assert.ok(fallback.environment.set_dressing.length > 8)
assert.ok(fallback.cinematography.shot_size)
assert.ok(fallback.cinematography.camera_movement)
assert.ok(fallback.action_timeline.length >= 2)
assert.ok(fallback.audio_direction)
assert.ok(fallback.assumptions.length > 0)
assert.ok(fallback.video_prompt.length <= 1000)

const explicit = normalizeH3DirectorPlan({
  title: '竖屏咖啡广告',
  aspect_ratio: '9:16',
  duration_seconds: 3,
  quality_mode: 'fast',
  character: { identity: '成年黑人男性咖啡师', appearance: '短卷发，温暖笑容', wardrobe: '棕色围裙' },
  environment: { location: '纽约街角咖啡馆', time: '清晨', set_dressing: '黄铜咖啡机、木质吧台、绿植' },
  cinematography: { shot_size: '近景', camera_angle: '平视', lens: '50mm', camera_movement: '缓慢推近' },
  action_timeline: ['0-1秒：咖啡师抬头', '1-3秒：递出咖啡'],
  audio_direction: '蒸汽声和轻爵士乐'
}, '竖屏三秒，纽约黑人咖啡师递出咖啡')
assert.equal(explicit.aspect_ratio, '9:16')
assert.equal(explicit.duration_seconds, 3)
assert.equal(explicit.quality_mode, 'fast')
assert.match(explicit.character.identity, /黑人/)
assert.match(explicit.environment.location, /纽约/)

const englishLeak = normalizeH3DirectorPlan({
  title: 'Fashion walk through a luxury hotel',
  summary: 'A woman walks through a hotel corridor under warm cinematic lighting',
  character: {
    identity: 'An elegant adult woman working as a fashion designer',
    appearance: 'Elegant woman with long black hair and a black dress',
    wardrobe: 'A fitted black evening dress with elegant high heels'
  },
  environment: {
    location: 'Luxury hotel corridor with polished marble floors',
    set_dressing: 'Warm wall lights and polished marble create a premium atmosphere'
  },
  cinematography: {
    shot_size: 'Full body cinematic portrait shot',
    lens: '24mm',
    camera_movement: 'Smooth tracking shot following the subject from behind'
  },
  lighting: {
    key_light: 'Warm cinematic key light from the corridor wall lamps'
  },
  action_timeline: ['The woman walks forward and looks back toward the camera'],
  audio_direction: 'Soft footsteps and quiet hotel ambience with gentle music',
  image_prompt: 'Full body fashion portrait in a luxury hotel corridor with cinematic light',
  negative_prompt: 'blurry face and distorted hands with unstable character identity'
}, '一位穿黑色礼服的成年女性走过酒店走廊，使用 H3，24mm，16:9')
for (const leakedText of [
  'A woman walks',
  'Elegant woman',
  'Luxury hotel corridor',
  'Smooth tracking shot',
  'Full body fashion portrait',
  'blurry face'
]) {
  assert.doesNotMatch(JSON.stringify(englishLeak), new RegExp(leakedText))
}
assert.match(englishLeak.video_prompt, /酒店走廊/)
assert.match(englishLeak.video_prompt, /24mm/)
assert.match(englishLeak.image_prompt, /H3|酒店走廊/)

const chineseWithTerms = normalizeH3DirectorPlan({
  summary: '成年女性在酒店走廊中自然前行，使用 H3 生成电影感画面',
  cinematography: { lens: '24mm 广角电影镜头' },
  image_prompt: '酒店走廊中的成年女性全身入镜，H3 电影感，16:9 构图'
}, '酒店走廊中的成年女性')
assert.match(chineseWithTerms.summary, /H3/)
assert.match(chineseWithTerms.cinematography.lens, /24mm/)
assert.match(chineseWithTerms.image_prompt, /16:9/)

const fenced = parseDirectorResponse('```json\n{"title":"雨夜回家","duration_seconds":2,"cinematography":{"shot_size":"远景"}}\n```', '雨夜回家')
assert.equal(fenced.title, '雨夜回家')
assert.equal(fenced.duration_seconds, 2)
assert.equal(fenced.cinematography.shot_size, '远景')
assert.equal(fenced.plan_source, 'gemma')

const malformed = parseDirectorResponse('我无法输出 JSON', '海边奔跑的成年男子，竖屏')
assert.equal(malformed.plan_source, 'rules')
assert.equal(malformed.aspect_ratio, '9:16')
assert.match(malformed.video_prompt, /海边|奔跑/)

const overlong = buildH3VideoPrompt({
  ...fallback,
  summary: '细节'.repeat(1200),
  environment: { ...fallback.environment, set_dressing: '装饰'.repeat(1200) }
})
assert.ok(overlong.length <= 1000)
assert.ok(!overlong.endsWith('，'))

console.log('h3DirectorPlan.test.mjs passed')
