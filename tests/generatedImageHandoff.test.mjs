import assert from 'node:assert/strict'
import {
  clearGeneratedImageForRegeneration,
  isLocalPublicAssetUrl,
  isReadyVideoImageNode,
  localizeGeneratedImageInput,
  normalizeGeneratedImageResult
} from '../src/utils/generatedImageHandoff.js'
import { PROVIDERS } from '../src/config/providers.js'

assert.equal(isLocalPublicAssetUrl('/public-assets/generated-image-1.png'), true)
assert.equal(isLocalPublicAssetUrl('https://cdn.example/generated.png'), false)
assert.equal(isReadyVideoImageNode({ loading: true, publicUrl: 'https://old.example/previous.png' }), false)
assert.equal(isReadyVideoImageNode({ loading: false, url: '/public-assets/current.png' }), true)
assert.deepEqual(clearGeneratedImageForRegeneration(), {
  loading: true,
  error: null,
  url: '',
  publicUrl: '',
  public_url: '',
  localUrl: '',
  local_url: '',
  base64: '',
  assetRole: '',
  asset_role: ''
})

const adapted = PROVIDERS['local-material'].responseAdapter.image({
  data: [{
    url: '/public-assets/generated-image-1.png',
    public_url: 'https://canvas.example/public-assets/generated-image-1.png',
    asset_role: 'generated',
    file_name: 'generated-image-1.png'
  }]
})[0]
assert.equal(adapted.public_url, 'https://canvas.example/public-assets/generated-image-1.png')
assert.equal(adapted.asset_role, 'generated')

assert.deepEqual(
  normalizeGeneratedImageResult({
    url: '/public-assets/generated-image-1.png',
    source_url: 'https://cdn.example/generated.png',
    asset_role: 'generated'
  }),
  {
    url: '/public-assets/generated-image-1.png',
    publicUrl: '/public-assets/generated-image-1.png',
    sourceUrl: 'https://cdn.example/generated.png',
    assetRole: 'generated'
  }
)

let importedPayload
const localized = await localizeGeneratedImageInput('https://cdn.example/legacy.png', {
  importAsset: async (payload) => {
    importedPayload = payload
    return { public_url: '/public-assets/generated-image-legacy.png' }
  }
})
assert.deepEqual(importedPayload, {
  url: 'https://cdn.example/legacy.png',
  name: '视频参考图',
  asset_role: 'generated'
})
assert.equal(localized, '/public-assets/generated-image-legacy.png')

let publishPayload
const published = await localizeGeneratedImageInput('data:image/png;base64,AAAA', {
  publishAsset: async (payload) => {
    publishPayload = payload
    return { public_url: '/public-assets/generated-image-inline.png' }
  }
})
assert.equal(publishPayload.name, '视频参考图')
assert.equal(publishPayload.asset_role, 'generated')
assert.equal(published, '/public-assets/generated-image-inline.png')
