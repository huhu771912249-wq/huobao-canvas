import assert from 'node:assert/strict'
import { buildStudioCanvas } from '../src/config/studioProjectFlow.js'

const videoCanvas = buildStudioCanvas({ mode: 'image-to-video', prompt: '雨夜车站，镜头缓慢推进', size: '1280x720', videoModel: 'minimax-h3' })
assert.deepEqual(videoCanvas.nodes.map(node => node.type), ['text', 'imageConfig', 'image', 'text', 'videoConfig', 'video'])
assert.equal(videoCanvas.nodes.find(node => node.type === 'videoConfig').data.model, 'minimax-h3')
assert.equal(videoCanvas.nodes.find(node => node.type === 'videoConfig').data.ratio, '16:9')
assert.equal(videoCanvas.nodes.find(node => node.type === 'videoConfig').data.targetResolution, '1080p')
assert.equal(videoCanvas.nodes.find(node => node.type === 'video').data.label, '视频结果')
assert.equal(videoCanvas.nodes.find(node => node.type === 'video').data.actualResolution, null)
assert.equal(videoCanvas.nodes.find(node => node.type === 'imageConfig').data.size, '1280x720')

const imageCanvas = buildStudioCanvas({ mode: 'text-to-image', prompt: '商品海报', size: '720x1280' })
assert.deepEqual(imageCanvas.nodes.map(node => node.type), ['text', 'imageConfig', 'image'])
assert.equal(imageCanvas.nodes[1].data.model, 'frw-qianwen')
assert.equal(imageCanvas.nodes[1].data.size, '720x1280')
console.log('studioProjectFlow.test.mjs passed')
