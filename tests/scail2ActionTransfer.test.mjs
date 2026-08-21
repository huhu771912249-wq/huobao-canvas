import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIDEO_MODELS, getModelByName } from '../src/config/models.js'
import { supportsVideoBatch } from '../src/utils/videoBatch.js'
import { getVideoInputCapabilities } from '../src/utils/videoInputCapabilities.js'

const SCAIL2 = 'scail2-action-transfer'

// The bug: the backend, the batch helper and the node UI all supported SCAIL-2,
// but the model was missing from VIDEO_MODELS so nobody could ever pick it.
const model = VIDEO_MODELS.find((entry) => entry.key === SCAIL2)
assert.ok(model, 'VIDEO_MODELS 必须包含 scail2-action-transfer，否则「动作迁移」在 UI 里选不到')
assert.equal(getModelByName(SCAIL2)?.key, SCAIL2)
assert.ok(model.label.includes('动作迁移'), '下拉里必须能看出这是动作迁移能力')

// Backend contract: ratio ∈ {9:16, 16:9}, duration 1..5 seconds.
assert.deepEqual(model.ratios, ['9:16', '16:9'])
assert.deepEqual(model.durs.map((option) => option.key), [1, 2, 3, 4, 5])
assert.equal(model.defaultParams.ratio, '9:16')
assert.ok(model.durs.some((option) => option.key === model.defaultParams.duration))
assert.deepEqual(model.provider, ['local-material'])

// Already-shipped behaviour that only becomes reachable once the model is selectable.
assert.equal(supportsVideoBatch(model.key), true, 'SCAIL-2 选中后应走批量视频输出')
assert.deepEqual(
  getVideoInputCapabilities(model.key),
  { firstFrame: true, lastFrame: false, references: false },
  'SCAIL-2 只吃一张参考角色图'
)

const videoConfigNode = readFileSync(
  new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url),
  'utf8'
)
assert.match(
  videoConfigNode,
  new RegExp(`localModel\\.value === '${SCAIL2}'`),
  'VideoConfigNode 的 SCAIL-2 分支必须仍然匹配同一个 model key'
)
assert.match(videoConfigNode, /驱动视频/, '选中 SCAIL-2 后必须能上传驱动视频')

console.log('scail2ActionTransfer.test.mjs passed')
