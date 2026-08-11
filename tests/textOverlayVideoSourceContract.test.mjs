import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/nodes/TextOverlayNode.vue', import.meta.url), 'utf8')
for (const text of [
  '视频 / GIF 可视化加字',
  '图片、视频或 GIF 节点',
  '拖动文字定位',
  '素材输入',
  '完整保留＋模糊背景',
  '生成加字素材',
  '下载 GIF'
]) assert.match(source, new RegExp(text))
for (const contract of ['VisualTextOverlayEditor', 'createVideoResizeJob', 'overlay_style', 'source_asset', 'cancelVideoRender', 'videoPollGeneration', 'videoJobStatus']) assert.match(source, new RegExp(contract))

console.log('textOverlayVideoSourceContract.test.mjs passed')
