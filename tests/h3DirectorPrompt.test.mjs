import assert from 'node:assert/strict'
import { H3_DIRECTOR_SYSTEM_PROMPT } from '../src/config/h3DirectorPrompt.js'
import {
  bindH3ImagePrompt,
  compileH3DirectorPrompt,
  normalizeH3DirectorPrompt
} from '../src/utils/h3DirectorPrompt.js'

assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /所有面向用户展示的字符串值必须使用简体中文/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /JSON 键名必须保持.*英文/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /不得同时输出中英文两套提示词/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /用户输入包含英文时.*保留用户明确给出的英文内容/)

const plan = normalizeH3DirectorPrompt({
  references: [
    { id: '图1', role: '人脸与服装一致性' }
  ],
  subject_definitions: '@图1 保持人脸身份和服装',
  summary: '9:16 竖屏，人物沿走廊前进',
  retention_analysis: {
    required: ['人脸身份', '服装'],
    flexible: ['机位', '表情']
  },
  detailed_description: [
    { start: 0, end: 2, action: '人物自然前进', camera: '[Tracking shot]' },
    { start: 2, end: 5, action: '人物回望镜头', camera: '[Push in,Pan right]' }
  ],
  overall_soundscape: '脚步声与环境底噪',
  non_diegetic_music: '温暖舒缓'
})

const compiled = compileH3DirectorPrompt(plan)
assert.match(compiled, /<Picture 1>/)
assert.doesNotMatch(compiled, /@图1/)
assert.match(compiled, /\[Tracking shot\]/)
assert.match(compiled, /0-2秒/)
assert.ok(compiled.length <= 2000)

const dialoguePlan = normalizeH3DirectorPrompt({
  references: [{ id: '图1', role: '人物参考' }],
  subject_definitions: '@图1 看向镜头',
  dialogue: '今天开始，换一种更聪明的创作方式。'
})
assert.equal(dialoguePlan.dialogue, '今天开始，换一种更聪明的创作方式。')
assert.match(compileH3DirectorPrompt(dialoguePlan), /<d>今天开始，换一种更聪明的创作方式。<\/d>/)

const textOnlyPlan = normalizeH3DirectorPrompt({ summary: '雨夜城市，出租车驶过' })
assert.match(compileH3DirectorPrompt(textOnlyPlan), /雨夜城市/)

assert.equal(
  bindH3ImagePrompt('让 @图1 自然转身', [{ id: '图1' }]),
  '让 <Picture 1> 自然转身'
)
assert.equal(
  bindH3ImagePrompt('人物自然转身', [{ id: '图1' }]),
  '<Picture 1>\n人物自然转身'
)
assert.throws(() => bindH3ImagePrompt('让 @图1 自然转身', []), /没有对应参考图/)
assert.throws(() => bindH3ImagePrompt('<Picture 1> 自然转身', []), /没有提交参考图/)

assert.throws(() => compileH3DirectorPrompt({
  references: [{ id: '视频1', role: '动作参考' }],
  subject_definitions: '@视频1 保持动作'
}), /当前 H3 生成通道只支持 @图1/)

const objectPlan = normalizeH3DirectorPrompt({
  references: [{ id: '图1', role: '主体多视图' }],
  subject_definitions: { '@图1': ['保持同一人物身份', '脸部五官和服装一致'] },
  summary: { ratio: '9:16', scene: '酒店走廊', action: '人物向前行走' },
  retention_analysis: { required: { identity: '人物身份', wardrobe: '黑色礼服' }, flexible: '机位，表情' },
  detailed_description: [{ start: 0, end: 5, action: '人物向前行走', camera: '[Tracking shot]' }],
  overall_soundscape: ['脚步声', '走廊底噪'],
  non_diegetic_music: '轻柔爵士'
})
assert.match(objectPlan.subject_definitions, /@图1.*人物身份.*服装一致/)
assert.match(objectPlan.summary, /9:16.*酒店走廊.*人物向前行走/)
assert.deepEqual(objectPlan.retention_analysis.required, ['identity：人物身份', 'wardrobe：黑色礼服'])
assert.deepEqual(objectPlan.retention_analysis.flexible, ['机位', '表情'])
assert.equal(objectPlan.overall_soundscape, '脚步声；走廊底噪')

assert.throws(() => normalizeH3DirectorPrompt({
  references: [],
  subject_definitions: '@图3 保持身份'
}))
assert.throws(() => normalizeH3DirectorPrompt({
  references: [],
  detailed_description: [{ start: 2, end: 1, action: '倒序' }]
}))
assert.throws(() => normalizeH3DirectorPrompt({
  references: [],
  detailed_description: [{ start: 0, end: 2, action: '移动', camera: '[Pan left,Push in,Tilt up,Shake]' }]
}))

console.log('h3DirectorPrompt.test.mjs passed')
