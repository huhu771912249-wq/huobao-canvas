import assert from 'node:assert/strict'
import { PROVIDERS } from '../src/config/providers.js'

const base = {
  model: 'minimax-h3', prompt: 'test', size: '16:9', seconds: 5,
  quality_profile: { mode: 'quality', width: 1920, height: 1080, upscaler: 'seedvr2-3b-fp16', label: '高质量 1080p' },
  image_alignment: { mode: 'crop_or_pad', width: 608, height: 352, preserve_aspect_ratio: true, allow_stretch: false },
  should_never_leak: 'secret'
}

for (const provider of ['local-material', 'chatfire', 'openai']) {
  const adapted = PROVIDERS[provider].requestAdapter.video(base)
  assert.deepEqual(adapted.quality_profile, base.quality_profile, `${provider} dropped quality profile`)
  assert.deepEqual(adapted.image_alignment, base.image_alignment, `${provider} dropped alignment`)
  assert.equal('should_never_leak' in adapted, false, `${provider} leaked unknown field`)
}

const seedance = PROVIDERS.chatfire.requestAdapter.video({ ...base, model: 'doubao-seedance' })
assert.deepEqual(seedance.quality_profile, base.quality_profile)
assert.deepEqual(seedance.image_alignment, base.image_alignment)

console.log('providerVideoQuality.test.mjs passed')
