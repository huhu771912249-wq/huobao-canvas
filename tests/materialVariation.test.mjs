import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_MATERIAL_VARIATION_COUNT,
  DEFAULT_MATERIAL_VARIATION_SIZES,
  MATERIAL_VARIATION_POLL_INTERVAL,
  buildMaterialVariationPayload,
  buildMaterialVariationRetryUrl,
  buildMaterialVariationSecondWaveUrl,
  buildMaterialVariationTaskUrl,
  buildSecondWavePayload,
  getMaterialVariationProgress,
  getPrimaryCreativeAssets,
  isMaterialVariationTerminal,
  normalizeMaterialVariationCount,
  normalizeMaterialVariationSizes,
  validateMaterialVariationFile
} from '../src/utils/materialVariation.js'

assert.equal(DEFAULT_MATERIAL_VARIATION_COUNT, 10)
assert.deepEqual(DEFAULT_MATERIAL_VARIATION_SIZES, [
  '300x100',
  '300x250',
  '720x240',
  '200x200'
])
assert.equal(MATERIAL_VARIATION_POLL_INTERVAL, 2000)

assert.equal(normalizeMaterialVariationCount(undefined), 10)
assert.equal(normalizeMaterialVariationCount(1), 2)
assert.equal(normalizeMaterialVariationCount('12'), 12)
assert.equal(normalizeMaterialVariationCount(99), 20)

assert.deepEqual(
  normalizeMaterialVariationSizes(['720x240', 'invalid', '300x100', '720x240']),
  ['300x100', '720x240']
)
assert.deepEqual(normalizeMaterialVariationSizes([]), DEFAULT_MATERIAL_VARIATION_SIZES)

assert.deepEqual(
  validateMaterialVariationFile({ name: 'reference.webp', size: 1024 }),
  { valid: true, kind: 'image', message: '' }
)
assert.deepEqual(
  validateMaterialVariationFile({ name: 'references.zip', size: 1024 }),
  { valid: true, kind: 'zip', message: '' }
)
assert.equal(validateMaterialVariationFile({ name: 'brief.pdf', size: 1024 }).valid, false)
assert.equal(validateMaterialVariationFile({ name: 'large.zip', size: 101 * 1024 * 1024 }).valid, false)

assert.deepEqual(
  buildMaterialVariationPayload({
    fileName: 'reference.png',
    fileData: 'data:image/png;base64,AAAA',
    count: 30,
    sizes: ['200x200', '300x100'],
    qualityMode: 'invalid',
    strength: 'strong',
    action: 'generate'
  }),
  {
    file_name: 'reference.png',
    file_data: 'data:image/png;base64,AAAA',
    count: 20,
    sizes: ['300x100', '200x200'],
    quality_mode: 'high_quality',
    strength: 'strong',
    action: 'generate'
  }
)
assert.equal(
  buildMaterialVariationPayload({
    fileName: 'reference.png',
    fileData: 'data:image/png;base64,AAAA',
    count: 10,
    sizes: ['300x100'],
    qualityMode: 'fast',
    strength: 'moderate',
    action: 'reverse'
  }).action,
  'reverse'
)
assert.equal(
  buildMaterialVariationPayload({
    fileName: 'reference.png',
    fileData: 'data:image/png;base64,AAAA',
    count: 10,
    sizes: ['300x100'],
    qualityMode: 'high_quality',
    strength: 'moderate',
    action: 'compare_masters'
  }).action,
  'compare_masters'
)
assert.deepEqual(
  buildMaterialVariationPayload({
    sourceJobId: 'import-21a0ac95ba90489f',
    count: 10,
    sizes: ['300x100'],
    qualityMode: 'fast',
    strength: 'moderate',
    action: 'reverse'
  }),
  {
    source_job_id: 'import-21a0ac95ba90489f',
    count: 10,
    sizes: ['300x100'],
    quality_mode: 'fast',
    strength: 'moderate',
    action: 'reverse'
  }
)

assert.equal(
  buildMaterialVariationTaskUrl('job 1'),
  'http://127.0.0.1:8788/v1/material/variations/job%201'
)
assert.equal(
  buildMaterialVariationRetryUrl('job/1'),
  'http://127.0.0.1:8788/v1/material/variations/job%2F1/retry'
)
assert.equal(
  buildMaterialVariationSecondWaveUrl('job:1'),
  'http://127.0.0.1:8788/v1/material/variations/job%3A1/second-wave'
)

for (const status of ['completed', 'partial', 'failed']) {
  assert.equal(isMaterialVariationTerminal(status), true)
}
for (const status of ['queued', 'running', 'submitted']) {
  assert.equal(isMaterialVariationTerminal(status), false)
}
assert.equal(getMaterialVariationProgress({ progress: 0.42 }), 42)
assert.equal(getMaterialVariationProgress({ progress: 73 }), 73)
assert.equal(getMaterialVariationProgress({ completed_count: 3, total_count: 4 }), 75)

const creativeAssets = [
  { creative_id: 'H01-A', size: '300x250', url: '/h01-300x250.png' },
  { creative_id: 'H01-A', size: '300x100', url: '/h01-300x100.png' },
  { creative_id: 'H02-B', size: '200x200', url: '/h02-200x200.png' },
  { creative_id: 'H02-B', size: '720x240', url: '/h02-720x240.png' }
]
assert.deepEqual(
  getPrimaryCreativeAssets(creativeAssets, ['300x100', '720x240']),
  [creativeAssets[1], creativeAssets[3]]
)

assert.deepEqual(
  buildSecondWavePayload({
    asset: creativeAssets[1],
    ctr: '2.35',
    count: 8,
    sizes: ['300x100', '200x200'],
    qualityMode: 'fast',
    strength: 'moderate'
  }),
  {
    winner_asset: creativeAssets[1],
    ctr: 2.35,
    count: 8,
    sizes: ['300x100', '200x200'],
    quality_mode: 'fast',
    strength: 'moderate'
  }
)

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')

// 画布 store 的默认值与 api 层的四个端点搬到 tests/component/materialVariation.spec.mjs：
// 真的 addNode('materialVariation') 拿默认数据（并且证明每个节点拿到的是自己的 sizes 数组，
// 不是共享引用），真的把四个请求发出去看 URL 和动词，真的量一次轮询间隔。
//
// 下面留着的是 D 类：MaterialVariationNode.vue 的文案与交互契约（batch 4，要挂节点组件），
// 以及 Canvas.vue 的节点类型注册表（batch 5，要挂 Canvas.vue）。
const nodeSource = read('src/components/nodes/MaterialVariationNode.vue')
const canvasSource = read('src/views/Canvas.vue')

for (const label of [
  '素材裂变',
  '单张图片或 ZIP',
  '创意数量',
  '快速',
  '高质量',
  '裂变强度',
  '只逆向',
  '逆向并生成',
  'Grok 双版高清对比',
  '双版高清母版对比',
  '选为 GIF 母版',
  '重试失败项',
  '下载全部 ZIP',
  '胜出素材',
  'CTR',
  '发起二轮裂变'
]) {
  assert.match(nodeSource, new RegExp(label), `素材裂变节点缺少“${label}”`)
}

assert.match(nodeSource, /setInterval\([^,]+,\s*MATERIAL_VARIATION_POLL_INTERVAL\)/s)
assert.match(nodeSource, /getPrimaryCreativeAssets/)
assert.match(nodeSource, /addNodes\(/)
assert.match(nodeSource, /task\.value\?\.analysis/)
assert.match(nodeSource, /materializedCreativeIds/)
assert.match(nodeSource, /type="file"[\s\S]*absolute[\s\S]*opacity-0/)
assert.match(nodeSource, /@drop\.prevent="handleFileDrop"/)
assert.match(nodeSource, /sourceJobId/)
assert.doesNotMatch(nodeSource, /fileInput\?\.click\(\)/)
assert.match(canvasSource, /MaterialVariationNode/)
assert.match(canvasSource, /materialVariation:\s*markRaw\(MaterialVariationNode\)/)
assert.match(canvasSource, /type:\s*'materialVariation',\s*name:\s*'素材裂变'/)

console.log('materialVariation.test.mjs passed')
