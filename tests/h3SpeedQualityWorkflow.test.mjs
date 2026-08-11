import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  H3_SAMPLING_OPTIONS,
  buildOfficialH3PromptSystemInstruction,
  normalizeH3SamplingMode
} from '../src/utils/h3GenerationOptions.js'
import { buildH3AdGifWorkflow } from '../src/config/h3AdGifWorkflow.js'

assert.deepEqual(H3_SAMPLING_OPTIONS.map(option => option.mode), ['standard20', 'turbo4'])
assert.equal(normalizeH3SamplingMode(), 'standard20')
assert.equal(normalizeH3SamplingMode('turbo4'), 'turbo4')
assert.equal(normalizeH3SamplingMode('unknown'), 'standard20')

const officialInstruction = buildOfficialH3PromptSystemInstruction({ hasReference: true })
assert.match(officialInstruction, /I2VA/)
assert.match(officialInstruction, /integrated_multimodal_description/)
assert.match(officialInstruction, /overall_soundscape/)
assert.match(officialInstruction, /non_diegetic_music/)
assert.match(officialInstruction, /对话、歌词和画面文字保留原语言/)

const graph = buildH3AdGifWorkflow({ x: 100, y: 200 })
assert.deepEqual(graph.nodes.map(node => node.type), [
  'text', 'imageConfig', 'image', 'text', 'videoConfig', 'video',
  'videoGif', 'text', 'textOverlay', 'watermarkEditor', 'materialExport'
])
const video = graph.nodes.find(node => node.type === 'videoConfig')
assert.equal(graph.nodes.find(node => node.type === 'imageConfig').data.model, 'z-image')
assert.equal(video.data.model, 'minimax-h3')
assert.equal(video.data.samplingMode, 'standard20')
assert.equal(video.data.qualityMode, 'fast')
assert.ok(graph.edges.some(edge => edge.target === video.id && edge.data?.imageRole === 'first_frame_image'))
assert.ok(graph.edges.some(edge => edge.source === graph.nodes.find(node => node.type === 'videoGif').id && edge.target === graph.nodes.find(node => node.type === 'textOverlay').id))
assert.equal(graph.nodes.find(node => node.type === 'textOverlay').data.videoOutputFormat, 'both')
assert.equal(graph.nodes.at(-1).type, 'materialExport')

const videoNodeSource = readFileSync(new URL('../src/components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')
const gifNodeSource = readFileSync(new URL('../src/components/nodes/VideoGifNode.vue', import.meta.url), 'utf8')
const overlayNodeSource = readFileSync(new URL('../src/components/nodes/TextOverlayNode.vue', import.meta.url), 'utf8')
const watermarkNodeSource = readFileSync(new URL('../src/components/nodes/WatermarkEditorNode.vue', import.meta.url), 'utf8')
const exportNodeSource = readFileSync(new URL('../src/components/nodes/MaterialExportNode.vue', import.meta.url), 'utf8')
const videoApiSource = readFileSync(new URL('../src/hooks/useApi.js', import.meta.url), 'utf8')
assert.match(videoNodeSource, /H3_SAMPLING_OPTIONS/)
assert.match(videoNodeSource, /原生快速/)
assert.match(videoNodeSource, /智能判断/)
assert.match(videoNodeSource, /AI 高清/)
assert.match(videoNodeSource, /sampling_mode/)
assert.match(videoApiSource, /requestData\.sampling_mode\s*=\s*params\.sampling_mode/)

for (const source of [gifNodeSource, overlayNodeSource, watermarkNodeSource, exportNodeSource]) {
  assert.match(source, /data\?\.label|data\.label/)
}
assert.match(overlayNodeSource, /素材输入/)
assert.match(overlayNodeSource, /hasVideoPath/)
assert.match(watermarkNodeSource, /compositionReady:\s*false/)
assert.match(exportNodeSource, /水印尚未合成/)
assert.match(exportNodeSource, /11 GIF 导出/)
assert.doesNotMatch(exportNodeSource, /label:\s*'素材导出'/)

console.log('h3SpeedQualityWorkflow.test.mjs passed')
