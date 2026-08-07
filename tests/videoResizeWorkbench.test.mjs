import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeResizeTargets, validateSocialVideoUrl } from '../src/utils/videoResize.js'

assert.deepEqual(normalizeResizeTargets(['720x1280', '1080x1080', '720x1280']), [
  { width: 720, height: 1280 },
  { width: 1080, height: 1080 }
])
assert.equal(validateSocialVideoUrl('https://www.instagram.com/reel/abc/').ok, true)
assert.equal(validateSocialVideoUrl('https://fb.watch/abc/').ok, true)
assert.equal(validateSocialVideoUrl('http://127.0.0.1/private').ok, false)
assert.equal(validateSocialVideoUrl('https://example.com/video').ok, false)
assert.throws(() => normalizeResizeTargets(['721x1280']), /偶数/)

const api = readFileSync(new URL('../src/api/videoResize.js', import.meta.url), 'utf8')
for (const endpoint of ['/v1/video-resize/jobs', '/cancel', '/retry', '/save', '/handoff']) {
  assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')))
}
const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/views/VideoResizeWorkbench.vue', import.meta.url), 'utf8')
assert.match(router, /path: '\/video-resize'/)
assert.match(entries, /视频尺寸工作台/)
for (const copy of ['公开 FB / Instagram 链接', '上传 MP4 / MOV / WebM', '智能主体裁剪', '完整保留＋模糊背景', '居中裁剪', '强制 AI 超分', '取消任务', '失败重试', '送入无限画布']) assert.match(view, new RegExp(copy))
for (const uploadContract of [
  'ref="fileInput"',
  '@click="openFilePicker"',
  '@dragover.prevent',
  '@drop.prevent="handleDrop"',
  'const handleDrop',
  '点击选择或拖入视频'
]) assert.match(view, new RegExp(uploadContract))

console.log('videoResizeWorkbench.test.mjs passed')
