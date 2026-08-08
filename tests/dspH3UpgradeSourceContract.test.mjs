import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const card = readFileSync(
  new URL('../src/components/dsp/DspH3UpgradeCard.vue', import.meta.url),
  'utf8'
)
const library = readFileSync(
  new URL('../src/components/nodes/DspCreativeLibraryNode.vue', import.meta.url),
  'utf8'
)

for (const text of [
  '用 H3 生成获胜视频',
  '5 秒',
  '1080p',
  '确认后才会消耗 H3 / SeedVR2 资源',
  '重试',
  '取消',
  '下载 MP4'
]) {
  assert.match(card, new RegExp(text.replace('/', '\\/')))
}
assert.match(library, /DspH3UpgradeCard/)
assert.match(library, /createDspH3Upgrade/)
assert.match(library, /shouldPollDspCreativeJob\(job\.value/)

console.log('dspH3UpgradeSourceContract.test.mjs passed')
