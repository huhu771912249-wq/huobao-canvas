import assert from 'node:assert/strict'
import { detectStudioIntent } from '../src/utils/studioIntent.js'

assert.equal(detectStudioIntent({ prompt: '生成产品海报' }), 'text-to-image')
assert.equal(detectStudioIntent({ prompt: '先生成图片再做成视频', wantsVideo: true }), 'image-to-video')
assert.equal(detectStudioIntent({ fileName: '第一章.docx' }), 'novel-video')
assert.equal(detectStudioIntent({ fileName: 'reference.png' }), 'asset')
console.log('studioIntent.test.mjs passed')
