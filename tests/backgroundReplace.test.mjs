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

// 形状依旧逐键锁死（deepEqual，不是 match）。相比修复前少了 `quality` 和 `n`：
// 后端 _image_generations 这两个字段一次都没读过，useApi 也从不转发，
// 留在 payload 里只会让人以为它们是通的。少发两个死字段不改变任何一次请求的结果。
// 「谁被发出去、谁被故意不发」由 tests/imageAdapterFieldContract.test.mjs 端到端锁住。
assert.deepEqual(
  buildBackgroundReplacePayload({
    model: 'frw-qianwen',
    size: '1024x1024',
    subjectImage: 'data:image/png;base64,SUBJECT',
    backgroundReferenceImage: 'data:image/png;base64,BACKGROUND',
    instruction: '换成四人宿舍，保留人物和桌面物品'
  }),
  {
    model: 'frw-qianwen',
    prompt: '换成四人宿舍，保留人物和桌面物品',
    size: '1024x1024',
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

// 批次 6 复核结论：这五条全部是 D 类节点级接线，本批不动，原样保留。
// 真断言意味着把 ImageConfigNode.vue（1103 行，含上传、模式切换、四条异步提交路径）挂进
// vue-flow harness 并打桩 API —— 那是 docs/testing-migration.md 里 batch 4 的活。
// 在那之前删掉任何一条都是净损失：它们锁的是「换背景这条路真的接上了」，
// 而 buildBackgroundReplacePayload / getBackgroundReplaceReadiness 本身
// 已经由上面的真断言覆盖，缺的正好就是这段接线。
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
