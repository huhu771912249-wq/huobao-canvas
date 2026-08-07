import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildStudioCanvas,
  getModelNativeVideoSize,
  getImageAlignmentSpec,
  normalizeVideoImageAlignmentRequest,
  normalizeVideoQualityRequestProfile,
  buildQualityProfilesBySize
} from '../src/config/studioProjectFlow.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const studio = read('../src/views/VideoStudio.vue')
const videoNode = read('../src/components/nodes/VideoConfigNode.vue')
const materialNode = read('../src/components/nodes/MaterialVariationNode.vue')
const videoApiHook = read('../src/hooks/useApi.js')

for (const [name, source] of [['studio', studio], ['videoNode', videoNode]]) {
  assert.doesNotMatch(source, /快速导出/, `${name} must not let video delivery bypass SeedVR2`)
  assert.match(source, /SeedVR2 AI 超分/, `${name} must expose mandatory AI upscale`)
}
assert.match(materialNode, /快速导出/)
assert.match(materialNode, /高质量 1080p/)
assert.match(studio, /getVideoQualityProfile/)
assert.match(videoNode, /getVideoQualityProfile/)
assert.match(materialNode, /buildQualityProfilesBySize/)
for (const label of ['原生分辨率', 'AI 超分', '最终输出']) assert.match(videoNode, new RegExp(label))
assert.match(videoNode, /quality_profile:\s*qualityProfile\.value/)
assert.match(videoNode, /upscale_status/)
assert.match(videoNode, /actual_width/)
assert.match(videoNode, /actual_height/)
assert.match(videoNode, /crop_or_pad/)
assert.match(videoNode, /isVerifiedTargetOutput/)
assert.match(videoApiHook, /normalizeVideoQualityRequestProfile\(params\.quality_profile\)/)
assert.match(videoApiHook, /requestData\.quality_profile\s*=\s*qualityProfile/)
assert.match(videoApiHook, /normalizeVideoImageAlignmentRequest\(params\.image_alignment\)/)
assert.match(videoApiHook, /requestData\.image_alignment\s*=\s*imageAlignment/)
assert.doesNotMatch(videoApiHook, /Object\.assign\(requestData,\s*params\)/)
assert.doesNotMatch(videoNode, /teacache\s*:\s*true/i)
assert.doesNotMatch(videoNode, /easycache\s*:\s*true/i)

assert.deepEqual(getModelNativeVideoSize('minimax-h3', '16:9'), { width: 608, height: 352 })
assert.deepEqual(getModelNativeVideoSize('minimax-h3', '9:16'), { width: 352, height: 608 })
assert.deepEqual(getModelNativeVideoSize('ltx-2.3', '16:9'), { width: 512, height: 320 })
assert.deepEqual(getModelNativeVideoSize('ltx-2.3', '9:16'), { width: 320, height: 512 })
assert.deepEqual(getImageAlignmentSpec('minimax-h3', '16:9'), {
  mode: 'crop_or_pad', width: 608, height: 352, preserve_aspect_ratio: true, allow_stretch: false
})
assert.deepEqual(normalizeVideoQualityRequestProfile({ mode: 'fast', width: '1080', height: 1920, upscaler: 'ignored', unknown: true }), {
  mode: 'fast', width: 1080, height: 1920, upscaler: null, label: '快速导出'
})
assert.equal(normalizeVideoQualityRequestProfile({ mode: 'quality', width: 0, height: 1080 }), null)
assert.deepEqual(normalizeVideoImageAlignmentRequest({ mode: 'stretch', width: 608, height: 352, allow_stretch: true, unknown: true }), {
  mode: 'crop_or_pad', width: 608, height: 352, preserve_aspect_ratio: true, allow_stretch: false
})

const qualityCanvas = buildStudioCanvas({ mode: 'image-to-video', prompt: 'test', qualityMode: 'quality' })
const videoConfig = qualityCanvas.nodes.find(node => node.type === 'videoConfig')
const imageConfig = qualityCanvas.nodes.find(node => node.type === 'imageConfig')
assert.equal(videoConfig.data.qualityMode, 'quality')
assert.deepEqual(videoConfig.data.qualityProfile, {
  mode: 'quality', width: 1920, height: 1080,
  upscaler: 'seedvr2-3b-fp16', label: '高质量 1080p'
})
assert.equal(imageConfig.data.qualityMode, 'quality')
assert.equal(videoConfig.data.imageAlignment.mode, 'crop_or_pad')
assert.equal(buildStudioCanvas({ mode: 'image-to-video', size: '1080x1920' }).nodes.find(node => node.type === 'videoConfig').data.ratio, '9:16')

assert.match(materialNode, /buildQualityProfilesBySize/)
assert.doesNotMatch(materialNode, /createMaterialVariation\(\{[^}]*quality_profile/s)
assert.match(materialNode, /upscale_status/)
assert.match(materialNode, /actual_width/)
assert.match(materialNode, /actual_height/)
const mixedTargets = buildQualityProfilesBySize(['1280x720', '720x1280'], 'quality')
assert.equal(mixedTargets['1280x720'].quality_profile.width, 1920)
assert.equal(mixedTargets['720x1280'].quality_profile.width, 1080)
assert.equal(mixedTargets['720x1280'].image_alignment.height, 608)
console.log('global1080Quality.test.mjs passed')
