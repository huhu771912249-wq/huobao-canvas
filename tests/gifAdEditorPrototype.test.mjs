import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIF_OUTPUT_PRESETS,
  calculateTimelineDuration,
  clampCornerRadius,
  detectEditorMediaKind,
  formatTimelineTime,
  timelineRangeStyle
} from '../src/utils/gifAdEditorPrototype.js'

assert.equal(detectEditorMediaKind({ name: 'creative.GIF', type: 'image/gif' }), 'gif')
assert.equal(detectEditorMediaKind({ name: 'clip.mov', type: 'video/quicktime' }), 'video')
assert.equal(detectEditorMediaKind({ name: 'logo.png', type: 'image/png' }), 'image')
assert.equal(clampCornerRadius(-8), 0)
assert.equal(clampCornerRadius(72), 50)
assert.equal(formatTimelineTime(65.4), '01:05.4')
assert.equal(calculateTimelineDuration([{ duration: 4.5 }, { duration: 3.5 }]), 8)
assert.deepEqual(timelineRangeStyle(2, 5, 10), { left: '20%', width: '30%' })
assert.deepEqual(GIF_OUTPUT_PRESETS.vertical, { width: 720, height: 1280, label: '720 × 1280', scene: '常用竖版' })

const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/views/GifAdEditor.vue', import.meta.url), 'utf8')

assert.match(router, /path: '\/gif-editor'/)
assert.match(entries, /GIF 素材编辑/)
for (const contract of [
  '直接导入 GIF',
  '添加文字',
  '导入字体',
  '添加图片',
  '转场',
  '圆角',
  '导出 GIF',
  '当前为交互原型'
]) {
  assert.match(view, new RegExp(contract))
}

console.log('gifAdEditorPrototype.test.mjs passed')
