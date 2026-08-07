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

console.log('videoResizeWorkbench.test.mjs passed')
