import assert from 'node:assert/strict'
import {
  compileH3DirectorPrompt,
  normalizeH3DirectorPrompt
} from '../src/utils/h3DirectorPrompt.js'

const plan = normalizeH3DirectorPrompt({
  references: [
    { id: '图1', role: '人脸身份' },
    { id: '图2', role: '服装一致性' }
  ],
  subject_definitions: '@图1 保持人脸身份；@图2 保持服装',
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
assert.match(compiled, /@图1/)
assert.match(compiled, /\[Tracking shot\]/)
assert.match(compiled, /0-2秒/)
assert.ok(compiled.length <= 2000)

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
