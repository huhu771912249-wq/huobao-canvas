import assert from 'node:assert/strict'
import {
  createImageToVideoTemplateFlow,
  createTextToVideoTemplateFlow,
  VIDEO_WORKFLOW_TEMPLATES
} from '../src/config/videoWorkflows.js'
import { DEFAULT_VIDEO_MODEL, VIDEO_DURATION_OPTIONS, VIDEO_MODELS } from '../src/config/models.js'

const textFlow = createTextToVideoTemplateFlow({ x: 100, y: 200 })

assert.deepEqual(
  textFlow.nodes.map((node) => node.type),
  ['text', 'videoConfig', 'video']
)
assert.deepEqual(
  textFlow.nodes.map((node) => node.data.label),
  ['视频提示词', '文生视频', '视频结果']
)
assert.equal(textFlow.nodes[1].data.mode, 'text_to_video')
assert.deepEqual(
  textFlow.edges.map((edge) => [edge.source, edge.target, edge.type]),
  [
    [textFlow.nodes[0].id, textFlow.nodes[1].id, 'promptOrder'],
    [textFlow.nodes[1].id, textFlow.nodes[2].id, undefined]
  ]
)

const imageFlow = createImageToVideoTemplateFlow({ x: 10, y: 20 })

assert.deepEqual(
  imageFlow.nodes.map((node) => node.type),
  ['image', 'text', 'videoConfig', 'video']
)
assert.deepEqual(
  imageFlow.nodes.map((node) => node.data.label),
  ['首帧/参考图', '视频动作提示词', '图生视频', '视频结果']
)
assert.equal(imageFlow.nodes[2].data.mode, 'image_to_video')
assert.deepEqual(
  imageFlow.edges.map((edge) => [edge.source, edge.target, edge.type, edge.data]),
  [
    [imageFlow.nodes[0].id, imageFlow.nodes[2].id, 'imageRole', { imageRole: 'first_frame_image' }],
    [imageFlow.nodes[1].id, imageFlow.nodes[2].id, 'promptOrder', { promptOrder: 1 }],
    [imageFlow.nodes[2].id, imageFlow.nodes[3].id, undefined, undefined]
  ]
)

assert.deepEqual(
  VIDEO_WORKFLOW_TEMPLATES.map((workflow) => workflow.id),
  ['text-to-video', 'image-to-video']
)

const frwVideo = VIDEO_MODELS.find((model) => model.key === 'frw-video')
const h3Video = VIDEO_MODELS.find((model) => model.key === 'minimax-h3')
const ltxVideo = VIDEO_MODELS.find((model) => model.key === 'ltx-2.3')

assert.ok(frwVideo)
assert.ok(frwVideo.durs.some((duration) => duration.key === 60))
assert.ok(VIDEO_DURATION_OPTIONS.some((duration) => duration.key === 60))
assert.ok(h3Video)
assert.ok(ltxVideo)
assert.equal(h3Video.provider[0], 'local-material')
assert.equal(ltxVideo.provider[0], 'local-material')
assert.equal(h3Video.type, 't2v+i2v')
assert.equal(ltxVideo.type, 't2v+i2v')
assert.equal(DEFAULT_VIDEO_MODEL, 'minimax-h3')
