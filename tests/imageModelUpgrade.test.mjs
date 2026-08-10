import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  normalizeImageModelKey
} from '../src/config/models.js'
import { buildStudioCanvas } from '../src/config/studioProjectFlow.js'
import { buildH3AdGifWorkflow } from '../src/config/h3AdGifWorkflow.js'

assert.equal(IMAGE_MODELS.some(model => model.key === 'wai-illustrious-sdxl-v17'), false)
assert.equal(DEFAULT_IMAGE_MODEL, 'z-image')
assert.equal(normalizeImageModelKey('wai-illustrious-sdxl-v17'), 'z-image')
assert.equal(normalizeImageModelKey('krea-2-turbo'), 'krea-2-turbo')

const zImage = IMAGE_MODELS.find(model => model.key === 'z-image')
assert.ok(zImage, 'Z-Image must be selectable')
assert.deepEqual(zImage.provider, ['local-material'])
assert.equal(zImage.defaultParams.size, '1024x1024')
assert.equal(zImage.defaultParams.steps, 36)
assert.equal(zImage.defaultParams.cfg, 4)
assert.equal(zImage.defaultParams.samplerName, 'res_multistep')
assert.equal(zImage.defaultParams.scheduler, 'simple')
assert.ok(zImage.sizes.includes('1024x1344'))

const krea = IMAGE_MODELS.find(model => model.key === 'krea-2-turbo')
assert.ok(krea, 'Krea 2 Turbo must be selectable')
assert.deepEqual(krea.provider, ['local-material'])
assert.equal(krea.defaultParams.steps, 8)
assert.equal(krea.defaultParams.cfg, 1)
assert.equal(krea.defaultParams.samplerName, 'euler')
assert.equal(krea.defaultParams.scheduler, 'simple')
assert.equal(krea.supportsNegativePrompt, false)

const studioCanvas = buildStudioCanvas({
  mode: 'text-to-image',
  prompt: 'cinematic portrait advertising still',
  size: '1024x1344',
  imageModel: 'z-image'
})
assert.equal(studioCanvas.nodes.find(node => node.type === 'imageConfig').data.model, 'z-image')
assert.equal(buildH3AdGifWorkflow().nodes.find(node => node.type === 'imageConfig').data.model, 'z-image')

const studioSource = readFileSync(new URL('../src/views/VideoStudio.vue', import.meta.url), 'utf8')
const nodeSource = readFileSync(new URL('../src/components/nodes/ImageConfigNode.vue', import.meta.url), 'utf8')
assert.doesNotMatch(studioSource, /wai-illustrious/i)
assert.doesNotMatch(nodeSource, /wai-illustrious/i)
assert.match(nodeSource, /nativeImageSettings/)
for (const field of ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'scheduler', 'seed']) {
  assert.match(nodeSource, new RegExp(field))
}

console.log('imageModelUpgrade.test.mjs passed')
