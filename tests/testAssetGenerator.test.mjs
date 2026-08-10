import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildTestAssetRequest,
  defaultTestWatermark,
  normalizeTestAssetSize
} from '../src/utils/testAssetGenerator.js'

assert.deepEqual(normalizeTestAssetSize(1, 1), { width: 1, height: 1 })
assert.deepEqual(normalizeTestAssetSize('300', '250'), { width: 300, height: 250 })
assert.deepEqual(normalizeTestAssetSize(1999, 2000), { width: 1999, height: 2000 })
assert.throws(() => normalizeTestAssetSize(0, 250), /1–2000/)
assert.throws(() => normalizeTestAssetSize(2001, 250), /1–2000/)
assert.throws(() => normalizeTestAssetSize(300.5, 250), /整数/)

assert.equal(defaultTestWatermark(new Date('2026-08-10T10:00:00+07:00')), '[TEST] 2026-08-10')

assert.deepEqual(
  buildTestAssetRequest({
    width: 300,
    height: 250,
    format: 'gif',
    backgroundColor: '#ff0000',
    watermarkText: '[TEST] 2026-08-10',
    watermarkPosition: 'center',
    watermarkColor: '#ffffff',
    watermarkOpacity: 80,
    adSlotId: 'home-banner'
  }),
  {
    sizes: [{ width: 300, height: 250 }],
    formats: ['gif'],
    background_color: '#ff0000',
    watermark: {
      text: '[TEST] 2026-08-10',
      position: 'center',
      color: '#ffffff',
      opacity: 80
    },
    ad_slot_id: 'home-banner'
  }
)

const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/views/TestAssetGenerator.vue', import.meta.url), 'utf8')
assert.match(router, /path: '\/test-assets'/)
assert.match(entries, /测试素材生成/)
for (const copy of [
  '填写尺寸', '选择类型', '设置水印', '预览确认', '生成与下载',
  'PNG', 'JPG', 'GIF', 'MP4', '批量生成', 'ZIP'
]) assert.match(page, new RegExp(copy))
assert.match(page, /h-screen[^"']*overflow-y-auto/, '独立页面必须可以滚动')

console.log('testAssetGenerator.test.mjs passed')
