import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IMAGE_MODELS } from '../src/config/models.js'
import { buildStudioCanvas } from '../src/config/studioProjectFlow.js'

const wai = IMAGE_MODELS.find(model => model.key === 'wai-illustrious-sdxl-v17')
assert.ok(wai, 'WAI Illustrious SDXL v17 must be selectable')
assert.deepEqual(wai.provider, ['local-material'])
assert.equal(wai.defaultParams.size, '1024x1024')
assert.equal(wai.defaultParams.steps, 30)
assert.equal(wai.defaultParams.cfg, 7)
assert.equal(wai.defaultParams.samplerName, 'euler_ancestral')
assert.equal(wai.defaultParams.clipSkip, 2)
assert.ok(wai.sizes.includes('1024x1344'))

const studioCanvas = buildStudioCanvas({
  mode: 'text-to-image',
  prompt: 'masterpiece, futuristic product poster',
  size: '1024x1344',
  imageModel: 'wai-illustrious-sdxl-v17'
})
assert.equal(studioCanvas.nodes.find(node => node.type === 'imageConfig').data.model, 'wai-illustrious-sdxl-v17')

const studioSource = readFileSync(new URL('../src/views/VideoStudio.vue', import.meta.url), 'utf8')
assert.match(studioSource, /v-model="selectedImageModel"/)
assert.match(studioSource, /imageModel:\s*selectedImageModel\.value/)

const nodeSource = readFileSync(new URL('../src/components/nodes/ImageConfigNode.vue', import.meta.url), 'utf8')
assert.match(nodeSource, /modelStore\.allImageModelOptions/)
for (const field of ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'seed']) {
  assert.match(nodeSource, new RegExp(field))
}

const hookSource = readFileSync(new URL('../src/hooks/useApi.js', import.meta.url), 'utf8')
const providerSource = readFileSync(new URL('../src/config/providers.js', import.meta.url), 'utf8')
for (const field of ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'seed']) {
  assert.match(hookSource, new RegExp(field))
  assert.match(providerSource, new RegExp(field))
}

console.log('waiIllustriousV17.test.mjs passed')
