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
import {
  createWatermarkEditorProjectForSource,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'

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
  '圆角',
  '导出 GIF',
  '开始真实导出'
]) {
  assert.match(view, new RegExp(contract))
}

/* ---------------------------------------------------------------------------
 * 「转场」原来也在上面这张契约表里。它被移下来换成了下面这段断言，**不是放宽**：
 *
 * 转场是一组死控件。时间轴上的转场按钮由 `clips.slice(0, -1)` 渲染，而一个编辑工程
 * 恒定只有 1 条 clip（sanitizeWatermarkEditorProject 里的 `.slice(0, 1)`、
 * importMedia 里的 `clips.value = [clip]`），所以它一次都没渲染过；片段面板里的
 * 「下一个转场」下拉能改 clip.transition，但 transition 从不进导出 payload，
 * 后端 /v1/media/gif-watermarks 的 schema 里也没有这个字段。
 *
 * 一条 grep 盯着一段「用户永远看不见、也永远不影响成品」的源码，就是
 * docs/testing-migration.md §2 里的 E 类。按那份手册的处理办法：不等价保留，
 * 换成对**真正的决策点**（clip 上限）的断言，外加禁止这些控件重新长回来。
 * -------------------------------------------------------------------------*/

const threeClips = sanitizeWatermarkEditorProject({
  clips: [
    { url: '/public-assets/a.gif', duration: 2 },
    { url: '/public-assets/b.gif', duration: 2 },
    { url: '/public-assets/c.gif', duration: 2 }
  ]
})
assert.equal(threeClips.clips.length, 1, '编辑工程只保留 1 条 clip —— 所以「片段之间」根本不存在')
assert.equal(
  Object.hasOwn(createWatermarkEditorProjectForSource({ url: '/public-assets/a.gif', duration: 2 }).clips[0], 'transition'),
  false,
  'clip 上不许再挂 transition：它不进 payload，后端 schema 里也没有这个字段'
)

// 死控件不许长回来。每一条都配了「它为什么是死的」，别再靠猜。
for (const [pattern, why] of [
  [/转场/, '转场：clips 恒为 1 条，按钮从不渲染，字段也从不进 payload'],
  [/>↶</, '撤销：没有任何 undo 栈，按钮是 disabled 的装饰'],
  [/>↷</, '重做：同上'],
  [/>适应</, '缩放「适应」：没有 v-model，点了不改变任何状态'],
  [/>50%</, '缩放「50%」：同上'],
  [/>参考线</, '参考线：没有实现，点了什么也不发生'],
  [/>🔊</, '音量：导出的是 GIF，没有音轨'],
  [/aria-label="时间轴缩放"/, '时间轴缩放：一个没有 v-model 的 range'],
  [/transition-button/, '时间轴转场按钮：见上']
]) {
  assert.doesNotMatch(view, pattern, `GifAdEditor 又长出了会撒谎的死控件 —— ${why}`)
}

console.log('gifAdEditorPrototype.test.mjs passed')
