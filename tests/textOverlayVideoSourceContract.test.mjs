import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/nodes/TextOverlayNode.vue', import.meta.url), 'utf8')
for (const text of [
  '上传需要叠字的视频',
  '1920×1080 横屏',
  '1080×1920 竖屏',
  '0-2 | 第一条字幕',
  '生成 1080p 叠字视频',
  '下载叠字 MP4'
]) assert.match(source, new RegExp(text))
assert.match(source, /createVideoTextOverlay/)

console.log('textOverlayVideoSourceContract.test.mjs passed')
