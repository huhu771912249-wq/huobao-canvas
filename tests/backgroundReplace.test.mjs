import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_BACKGROUND_INSTRUCTION,
  buildBackgroundReplacePayload,
  getBackgroundReplaceReadiness
} from '../src/utils/backgroundReplace.js'

assert.equal(
  DEFAULT_BACKGROUND_INSTRUCTION,
  '保留原人物的身份、五官、发型、姿势、服装和前景，只把背景替换成参考图中的环境。'
)

assert.deepEqual(
  getBackgroundReplaceReadiness({
    subjectImage: '',
    backgroundReferenceImage: ''
  }),
  {
    ready: false,
    missing: ['主体图', '背景参考图'],
    message: '请先添加主体图和背景参考图'
  }
)

assert.deepEqual(
  getBackgroundReplaceReadiness({
    subjectImage: 'data:image/png;base64,SUBJECT',
    backgroundReferenceImage: ''
  }),
  {
    ready: false,
    missing: ['背景参考图'],
    message: '请先添加背景参考图'
  }
)

assert.equal(
  getBackgroundReplaceReadiness({
    subjectImage: 'data:image/png;base64,SUBJECT',
    backgroundReferenceImage: 'data:image/png;base64,BACKGROUND'
  }).ready,
  true
)

assert.deepEqual(
  buildBackgroundReplacePayload({
    model: 'frw-qianwen',
    size: '1024x1024',
    quality: 'standard',
    subjectImage: 'data:image/png;base64,SUBJECT',
    backgroundReferenceImage: 'data:image/png;base64,BACKGROUND',
    instruction: '换成四人宿舍，保留人物和桌面物品'
  }),
  {
    model: 'frw-qianwen',
    prompt: '换成四人宿舍，保留人物和桌面物品',
    size: '1024x1024',
    quality: 'standard',
    n: 1,
    edit_mode: 'background_replace',
    subject_image: 'data:image/png;base64,SUBJECT',
    background_reference_image: 'data:image/png;base64,BACKGROUND',
    background_instruction: '换成四人宿舍，保留人物和桌面物品'
  }
)

assert.equal(
  buildBackgroundReplacePayload({
    model: 'frw-qianwen',
    subjectImage: 'data:image/png;base64,SUBJECT',
    backgroundReferenceImage: 'data:image/png;base64,BACKGROUND',
    instruction: '  '
  }).background_instruction,
  DEFAULT_BACKGROUND_INSTRUCTION
)

assert.throws(
  () => buildBackgroundReplacePayload({
    subjectImage: '',
    backgroundReferenceImage: 'data:image/png;base64,BACKGROUND'
  }),
  /主体图/
)

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')
const imageNodeSource = read('src/components/nodes/ImageNode.vue')
const imageConfigSource = read('src/components/nodes/ImageConfigNode.vue')

assert.match(imageNodeSource, /更换背景/)
assert.match(imageNodeSource, /background_replace/)
assert.match(imageConfigSource, /背景参考图/)
assert.match(imageConfigSource, /按参考图换背景/)
assert.match(imageConfigSource, /buildBackgroundReplacePayload/)

console.log('backgroundReplace.test.mjs passed')
