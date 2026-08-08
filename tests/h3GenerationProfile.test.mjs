import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchVideoCapabilities } from '../src/api/videoCapabilities.js'
import {
  getH3GenerationProfiles,
  isH3GenerationProfileEnabled,
  normalizeH3GenerationProfile
} from '../src/utils/h3GenerationProfile.js'

const fallbackProfiles = getH3GenerationProfiles(null)
assert.equal(fallbackProfiles.find(profile => profile.id === 'stable').enabled, true)
assert.equal(fallbackProfiles.find(profile => profile.id === 'turbo').enabled, false)
assert.equal(normalizeH3GenerationProfile('turbo', null), 'stable')

const capability = {
  profiles: [
    { id: 'stable', name: '稳定生成', enabled: true, sampling_steps: 20 },
    { id: 'turbo', name: '高速生成', enabled: true, sampling_steps: 4 }
  ]
}
assert.equal(isH3GenerationProfileEnabled(capability, 'turbo'), true)
assert.equal(normalizeH3GenerationProfile('turbo', capability), 'turbo')

const models = await fetchVideoCapabilities({
  fetchImpl: async (_url, options) => {
    assert.equal(options.credentials, 'include')
    return {
      ok: true,
      json: async () => ({ data: { models: { 'minimax-h3': capability } } })
    }
  }
})
assert.deepEqual(models['minimax-h3'], capability)
assert.equal(await fetchVideoCapabilities({ fetchImpl: async () => ({ ok: false }) }), null)

const source = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
const useApi = readFileSync(new URL('../src/hooks/useApi.js', import.meta.url), 'utf8')
assert.match(source, /H3 生成速度/)
assert.match(source, /fetchVideoCapabilities/)
assert.match(source, /params\.h3_generation_profile = localH3GenerationProfile\.value/)
assert.match(source, /成品仍强制 SeedVR2 超分/)
assert.match(useApi, /requestData\.h3_generation_profile = params\.h3_generation_profile/)

console.log('h3GenerationProfile.test.mjs passed')
