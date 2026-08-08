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
