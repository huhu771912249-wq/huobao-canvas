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
assert.match(view, /<main class="[^"]*h-screen[^"]*overflow-y-auto[^"]*"/, '独立工作台必须在全局滚动锁定下提供自身纵向滚动容器')
for (const copy of ['公开 FB / Instagram 链接', '上传视频 / GIF', 'MP4 / MOV / WebM / GIF', '完整保留＋黑色留边', '完整保留＋模糊背景', '居中裁剪', '强制 AI 超分', '取消任务', '失败重试', '送入无限画布']) assert.match(view, new RegExp(copy))
assert.match(view, /\.\(mp4\|mov\|webm\|gif\)/, '独立工作台必须接受 GIF 输入')
assert.match(view, /file\.value = null[\s\S]*只支持 MP4、MOV、WebM、GIF/, '无效的新选择必须清掉旧素材')
for (const uploadContract of [
  'ref="fileInput"',
  '@click="openFilePicker"',
  '@dragover.prevent',
  '@drop.prevent="handleDrop"',
  'const handleDrop',
  '点击选择或拖入素材'
]) assert.match(view, new RegExp(uploadContract))
for (const progressContract of [
  'active_target_index',
  'active_target_count',
  'active_target',
  'gpu_elapsed_seconds',
  'SeedVR2 正在真实计算',
]) assert.match(view, new RegExp(progressContract))
assert.match(view, /job\?\.error/)
assert.match(view, /后端错误/)
assert.match(view, /useRoute/)
assert.match(view, /route\.query\.job/)
assert.match(view, /getVideoResizeJob\(requestedJobId\)/, '工作台必须恢复任务中心选中的任务')

console.log('videoResizeWorkbench.test.mjs passed')
