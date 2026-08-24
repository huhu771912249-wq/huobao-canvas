import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROVIDERS, getProviderConfig } from '../src/config/providers.js'
import {
  IMAGE_REQUEST_FIELDS,
  IMAGE_UI_LOCAL_FIELDS,
  IMAGE_UNSUPPORTED_BY_PROVIDER,
  buildImageRequestParams,
  describeUnsupportedImageFields,
  getUnsupportedImageFields,
  pickImageRequestFields
} from '../src/utils/imageRequestContract.js'
import { buildBackgroundReplacePayload } from '../src/utils/backgroundReplace.js'
import { IMAGE_MODELS, SEEDREAM_SIZE_OPTIONS, SEEDREAM_4K_SIZE_OPTIONS } from '../src/config/models.js'

/**
 * 图片链路的字段契约 —— 视频侧早就有 videoAdapterFieldContract.test.mjs，图片侧一直没有，
 * 这正是同一个 bug 能连着犯三次的原因：
 *
 *   #43  video adapter 白名单漏了 output_width/output_height/sampling_mode/director_plan
 *        → 用户选的「4 步 Turbo」永远跑 standard20，导演编排从不生效。
 *   #46  ImageConfigNode 发数组形状的 image，后端只认字符串
 *        → 接了参考图却被静默当纯文生图跑。
 *   本次 ImageConfigNode 发 quality、chatfire adapter 也有 `if (params.quality)` 接着，
 *        中间的 useApi.js 却没抄这个字段。
 *
 * 三次都是「同一份字段清单被手抄三遍」。所以本测试盯的不是某一个字段，而是这条不变式：
 *
 *   **ImageConfigNode 上每一个能调的控件，要么能被证明送达后端，
 *     要么在 IMAGE_UI_LOCAL_FIELDS 里写明为什么不发。没有第三种状态。**
 */

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const imageConfigSource = read('../src/components/nodes/ImageConfigNode.vue')
const useApiSource = read('../src/hooks/useApi.js')
const modelStoreSource = read('../src/stores/models.js')
const providerHookSource = read('../src/hooks/useProvider.js')
const pinaModelStoreSource = read('../src/stores/pinia/models.js')

// ---------------------------------------------------------------------------
// 0. 镜像守卫：下面几段是对生产代码的复刻，先确认被复刻的那几行还在
// ---------------------------------------------------------------------------

// 与 useProvider.js / stores/pinia/models.js 的 adaptRequest 派发逻辑一致。
const adaptRequest = (providerKey, type, params) => {
  const config = getProviderConfig(providerKey)
  if (config.requestAdapter && config.requestAdapter[type]) {
    return config.requestAdapter[type](params)
  }
  return params
}
for (const source of [providerHookSource, pinaModelStoreSource]) {
  assert.match(source, /config\.requestAdapter\[type\]\(params\)/, 'adaptRequest 派发方式已变化，请同步本测试里的镜像实现')
}

// 与 stores/models.js:getModelSizeOptions 一致（该文件走 `@/` 别名，node 里直接 import 不了）。
assert.match(modelStoreSource, /model\?\.getSizesByQuality\s*\n?\s*\)?\s*\{?[\s\S]{0,80}getSizesByQuality\(quality\)/, 'getModelSizeOptions 的画质分支已变化，请同步镜像')
const getModelSizeOptions = (modelKey, quality = 'standard') => {
  const model = IMAGE_MODELS.find(m => m.key === modelKey)
  if (model?.getSizesByQuality) return model.getSizesByQuality(quality)
  if (!model?.sizes) return SEEDREAM_SIZE_OPTIONS
  const sizeOptions = quality === '4k' ? SEEDREAM_4K_SIZE_OPTIONS : SEEDREAM_SIZE_OPTIONS
  return model.sizes.map(size => sizeOptions.find(o => o.key === size) || { label: size, key: size })
}

// 与 ImageConfigNode.vue:handleQualitySelect 一致。
const handleQualitySelectSource = imageConfigSource.slice(
  imageConfigSource.indexOf('const handleQualitySelect'),
  imageConfigSource.indexOf('const handleSizeSelect')
)
assert.match(handleQualitySelectSource, /getModelSizeOptions\(localModel\.value, quality\)/, 'handleQualitySelect 已变化，请同步镜像')
assert.match(handleQualitySelectSource, /quality === '4k'/, 'handleQualitySelect 的 4K 分支已变化，请同步镜像')
const sizeAfterQualitySelect = (modelKey, quality) => {
  const options = getModelSizeOptions(modelKey, quality)
  if (options.length === 0) return null
  const preferred = quality === '4k'
    ? options.find(o => o.key.includes('4096'))?.key || options[4]?.key
    : options[4]?.key
  return preferred || options[0].key
}

// ---------------------------------------------------------------------------
// 1. 后端消费规则镜像（guanxi-canvas-backend/material_generation_api.py，本次逐行复核）
// ---------------------------------------------------------------------------
//   :8651 body 只是 json.loads 出来的 dict，无 pydantic / 无 extra="forbid"：未知键静默丢弃
//   :4583 edit_mode == "background_replace" 才走换背景分支
//   :4592 mode = "img2img" if image_url else "text2image"
//   :4600 model ∈ COMFYUI_IMAGE_MODELS 且 text2image 才消费原生参数；
//         带参考图 raise ValueError("<模型名> 当前仅支持文生图")
//   :4937 scheduler 一律被改回 profile 默认值
//   :4634 FRW 路径不传 width/height，size 只经 apply_visual_prompt_policy 变成提示词文本
//   quality / style / n 全链路零命中，且每条返回分支都是硬编码单元素 data 列表
const COMFYUI_IMAGE_MODELS = new Set(['z-image', 'krea-2-turbo'])
const NATIVE_FIELDS = ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'seed']

const backendFate = (field, { model = '', hasReferenceImage = false, editMode = '' } = {}) => {
  if (field === 'quality' || field === 'style' || field === 'n') return 'never'
  if (editMode === 'background_replace') {
    if (['model', 'prompt', 'edit_mode', 'subject_image', 'background_reference_image', 'background_instruction'].includes(field)) {
      return 'consumed'
    }
    if (field === 'size') return 'prompt-hint-only'
    return 'never' // 换背景分支从不调 _local_comfy_image_options
  }
  if (['model', 'prompt', 'image'].includes(field)) return 'consumed'
  if (field === 'size') return COMFYUI_IMAGE_MODELS.has(model) ? 'consumed' : 'prompt-hint-only'
  if (field === 'scheduler') return 'overwritten'
  if (NATIVE_FIELDS.includes(field)) {
    if (!COMFYUI_IMAGE_MODELS.has(model)) return 'never'
    return hasReferenceImage ? 'rejected' : 'consumed'
  }
  if (field === 'edit_mode') return 'consumed'
  return 'never'
}

// 守卫这份镜像本身，否则下面的断言就没意义了。
assert.equal(backendFate('quality', { model: 'doubao-seedream-4-5-251128' }), 'never')
assert.equal(backendFate('steps', { model: 'z-image' }), 'consumed')
assert.equal(backendFate('steps', { model: 'z-image', hasReferenceImage: true }), 'rejected')
assert.equal(backendFate('steps', { model: 'frw-qianwen' }), 'never')
assert.equal(backendFate('size', { model: 'z-image' }), 'consumed')
assert.equal(backendFate('size', { model: 'frw-qianwen' }), 'prompt-hint-only')

// ---------------------------------------------------------------------------
// 2. UI 控件清单 —— 反向锁：模板里出现的每一个绑定都必须在这张表里有归宿
// ---------------------------------------------------------------------------
const template = imageConfigSource.slice(0, imageConfigSource.indexOf('<script setup>'))
const templateBindings = new Set([
  ...[...template.matchAll(/v-model(?:\.\w+)*="(\w+)"/g)].map(m => m[1]),
  ...[...template.matchAll(/:value="(\w+)"/g)].map(m => m[1])
])

/**
 * 绑定 → 这个控件调的是哪个请求字段。
 * `field: null` 表示它根本不是生成参数，必须写清 why。
 */
const UI_CONTROLS = {
  localModel: { field: 'model', label: '模型' },
  localQuality: { field: 'quality', label: '画质' },
  localSize: { field: 'size', label: '尺寸' },
  imageNegativePrompt: { field: 'negative_prompt', label: '负面提示词', nativeOnly: true },
  imageSteps: { field: 'steps', label: '步数', nativeOnly: true },
  imageCfg: { field: 'cfg', label: 'CFG', nativeOnly: true },
  imageSampler: { field: 'sampler_name', label: '采样器', nativeOnly: true },
  imageSeed: { field: 'seed', label: '随机种子', nativeOnly: true },
  backgroundInstruction: { field: 'background_instruction', label: '背景指令', backgroundOnly: true },
  editingLabelValue: { field: null, why: '改的是画布上的节点名，不进请求体' }
}

for (const binding of templateBindings) {
  assert.ok(
    binding in UI_CONTROLS,
    `ImageConfigNode 模板里新增了绑定 ${binding}，但没在本测试的 UI_CONTROLS 里说明它进不进请求体。`
      + '「加了个控件却忘了接线」正是 #43/#46/quality 这三次 bug 的成因，请补上再提交。'
  )
}
// 反过来也不许留幽灵条目
for (const binding of Object.keys(UI_CONTROLS)) {
  assert.ok(templateBindings.has(binding), `UI_CONTROLS 里的 ${binding} 已经不在模板中，请清理`)
}

// 上传型控件没有 v-model，单独点名
for (const testId of ['background-replace-subject-file', 'background-replace-reference-file']) {
  assert.match(template, new RegExp(`data-testid="${testId}"`), `换背景的上传控件 ${testId} 不见了`)
}

// 每个控件的字段，要么在传输清单里，要么在「故意不发」清单里，不许两头落空
for (const [binding, control] of Object.entries(UI_CONTROLS)) {
  if (control.field === null) {
    assert.ok(control.why, `${binding} 声明为非请求参数，必须写明理由`)
    continue
  }
  const transported = IMAGE_REQUEST_FIELDS.includes(control.field)
  const uiLocal = Object.prototype.hasOwnProperty.call(IMAGE_UI_LOCAL_FIELDS, control.field)
  assert.ok(
    transported !== uiLocal,
    `${control.label}(${control.field}) 既不在 IMAGE_REQUEST_FIELDS 也不在 IMAGE_UI_LOCAL_FIELDS（或两边都在）。`
      + '一个 UI 上能调的参数只有两种合法状态：送达后端，或写明为什么不送。'
  )
  if (uiLocal) {
    assert.ok(
      typeof IMAGE_UI_LOCAL_FIELDS[control.field] === 'string' && IMAGE_UI_LOCAL_FIELDS[control.field].length > 20,
      `${control.field} 被标成「故意不发」，必须写一段说得清的理由，不能留空`
    )
  }
}

// ---------------------------------------------------------------------------
// 3. 「画质」的判定：它不是一个请求字段，而是尺寸档位开关 —— 但它必须真的能换尺寸
// ---------------------------------------------------------------------------
assert.ok('quality' in IMAGE_UI_LOCAL_FIELDS, 'quality 必须留在「故意不发」清单里')
assert.equal(IMAGE_REQUEST_FIELDS.includes('quality'), false, 'quality 不许进传输清单：后端 _image_generations 从不读它')

// 画质下拉框只在 model.qualities 非空时渲染（ImageConfigNode.vue:hasQualityOptions）。
assert.match(imageConfigSource, /const hasQualityOptions = computed\(\(\) => \{\s*return qualityOptions\.value && qualityOptions\.value\.length > 0/)
const modelsWithQualityPicker = IMAGE_MODELS.filter(m => (m.qualities?.length ?? 0) > 0)
assert.deepEqual(
  modelsWithQualityPicker.map(m => m.key),
  ['doubao-seedream-4-5-251128'],
  '画质下拉框的可见范围变了。它至今只对 Seedream 4.5 出现过，改动范围前先重新走一遍后端能力核对。'
)

// 关键论证：画质**不是死的** —— 它通过 size 生效，而 size 是端到端送达的。
const standardSize = sizeAfterQualitySelect('doubao-seedream-4-5-251128', 'standard')
const fourKSize = sizeAfterQualitySelect('doubao-seedream-4-5-251128', '4k')
assert.equal(standardSize, '2048x2048')
assert.equal(fourKSize, '4096x4096')
assert.notEqual(standardSize, fourKSize, '选 4K 必须真的改变请求里的 size，否则这个下拉框就该从 UI 上摘掉')

// 而且改出来的 size 真的会被发出去（不是只改了个本地 ref）。
const fourKAdapted = adaptRequest('chatfire', 'image', pickImageRequestFields(buildImageRequestParams({
  model: 'doubao-seedream-4-5-251128',
  prompt: '一只猫',
  size: fourKSize
})))
assert.equal(fourKAdapted.size, '4096x4096', '4K 档位选出来的尺寸必须真的进请求体')
assert.equal('quality' in fourKAdapted, false, 'quality 不许被偷偷接回去：后端不读，chatfire 侧 "4k" 也不是合法的 quality 取值')

// ---------------------------------------------------------------------------
// 4. 端到端：UI 状态 → buildImageRequestParams → useApi 白名单 → 渠道适配器 → 后端
// ---------------------------------------------------------------------------
const SENTINELS = {
  model: 'z-image',
  prompt: '霓虹街头的广告主视觉',
  size: '1344x1024',
  image: 'https://cdn.example.com/ref.png',
  negative_prompt: 'low quality, watermark',
  steps: 42,
  cfg: 3.5,
  sampler_name: 'res_multistep',
  scheduler: 'simple',
  seed: 20260824
}

// 4a. 纯文生图 + ComfyUI 原生参数（z-image 走 local-material）
const nativeParams = {
  negative_prompt: SENTINELS.negative_prompt,
  steps: SENTINELS.steps,
  cfg: SENTINELS.cfg,
  sampler_name: SENTINELS.sampler_name,
  scheduler: SENTINELS.scheduler,
  seed: SENTINELS.seed
}
const text2imageParams = buildImageRequestParams({
  model: SENTINELS.model,
  prompt: SENTINELS.prompt,
  size: SENTINELS.size,
  nativeParams
})
const text2imageBody = adaptRequest('local-material', 'image', pickImageRequestFields(text2imageParams))

for (const [binding, control] of Object.entries(UI_CONTROLS)) {
  if (!control.field || !IMAGE_REQUEST_FIELDS.includes(control.field)) continue
  if (control.backgroundOnly) continue
  assert.ok(
    control.field in text2imageBody,
    `${control.label}(${control.field}) 在 UI 上能调，却没能穿过 useApi + local-material adapter 送到后端。`
      + `绑定：${binding}。这就是 quality 那个 bug 的形状。`
  )
  assert.deepEqual(
    text2imageBody[control.field],
    SENTINELS[control.field] ?? text2imageParams[control.field],
    `${control.field} 在链路中途被篡改了`
  )
  const fate = backendFate(control.field, { model: SENTINELS.model })
  assert.notEqual(
    fate, 'never',
    `${control.label}(${control.field}) 送到了后端，但后端在这条路径上根本不读它（fate=${fate}）。`
      + '要么别发，要么别在 UI 上暴露 —— 不要把静默失败换个位置。'
  )
}

// 空的负面提示词必须原样发出去（krea 这类不支持负面提示词的模型发 ''），
// 否则后端会回退到 profile 里的默认负面提示词（material_generation_api.py:4921），
// 用户清空的动作就白做了。
const clearedNegative = adaptRequest('local-material', 'image', pickImageRequestFields(buildImageRequestParams({
  model: 'krea-2-turbo',
  prompt: SENTINELS.prompt,
  size: '1024x1024',
  nativeParams: { ...nativeParams, negative_prompt: '' }
})))
assert.equal(clearedNegative.negative_prompt, '', '空字符串的负面提示词不能被当成「没填」丢掉')

// 4b. 图生图：参考图必须以字符串形状抵达（#46）
const img2imgBody = adaptRequest('local-material', 'image', pickImageRequestFields(buildImageRequestParams({
  model: 'frw-qianwen',
  prompt: SENTINELS.prompt,
  size: '1024x1024',
  image: SENTINELS.image
})))
assert.equal(img2imgBody.image, SENTINELS.image)
assert.equal(typeof img2imgBody.image, 'string')

// 4c. 换背景：三个上传/输入控件必须整套抵达
const backgroundBody = adaptRequest('local-material', 'image', pickImageRequestFields(buildBackgroundReplacePayload({
  model: 'frw-qianwen',
  size: '1024x1024',
  subjectImage: 'data:image/png;base64,SUBJECT',
  backgroundReferenceImage: 'data:image/png;base64,BACKGROUND',
  instruction: '换成四人宿舍'
})))
for (const field of ['edit_mode', 'subject_image', 'background_reference_image', 'background_instruction']) {
  assert.ok(field in backgroundBody, `换背景的 ${field} 被丢了 —— 后端会退回纯文生图且不报错`)
  assert.equal(backendFate(field, { editMode: 'background_replace' }), 'consumed')
}
assert.equal(backgroundBody.edit_mode, 'background_replace')
assert.equal('quality' in backgroundBody, false, '换背景请求体里也不许出现 quality')
assert.equal('n' in backgroundBody, false, 'n 后端从不读，且每条返回分支都硬编码单张图')

// ---------------------------------------------------------------------------
// 5. 白名单语义不能退化成透传
// ---------------------------------------------------------------------------
for (const providerKey of ['local-material', 'chatfire', 'openai']) {
  const leaky = adaptRequest(providerKey, 'image', {
    ...text2imageParams,
    should_never_leak: 'secret',
    quality: '4k',
    style: 'vivid',
    n: 4
  })
  assert.equal('should_never_leak' in leaky, false, `${providerKey} image adapter 泄漏了未知字段`)
  assert.equal('quality' in leaky, false, `${providerKey} image adapter 把 quality 放进去了 —— 后端不读，这是假装能用`)
  assert.equal('style' in leaky, false, `${providerKey} image adapter 把 style 放进去了 —— 全链路无人读`)
  assert.equal('n' in leaky, false, `${providerKey} image adapter 把 n 放进去了 —— 后端恒返回 1 张图`)
}

// ---------------------------------------------------------------------------
// 6. 渠道能力差异必须是「声明过的」，不是「碰巧掉的」
// ---------------------------------------------------------------------------
for (const providerKey of ['local-material', 'chatfire', 'openai']) {
  const full = {}
  for (const field of IMAGE_REQUEST_FIELDS) full[field] = SENTINELS[field] ?? `sentinel-${field}`
  const adapted = adaptRequest(providerKey, 'image', full)
  const actuallyDropped = IMAGE_REQUEST_FIELDS.filter(field => !(field in adapted)).sort()
  assert.deepEqual(
    actuallyDropped,
    [...IMAGE_UNSUPPORTED_BY_PROVIDER[providerKey]].sort(),
    `${providerKey} image adapter 实际丢弃的字段和 IMAGE_UNSUPPORTED_BY_PROVIDER 声明的不一致。`
      + '静默丢字段就是 #43 的死法：要丢可以，但必须先在契约里声明，UI 才拦得住。'
  )
}
assert.deepEqual(IMAGE_UNSUPPORTED_BY_PROVIDER['local-material'], [], '本地后端必须接得住全部字段')

// 声明表和 PROVIDERS 不能脱节
assert.deepEqual(
  Object.keys(IMAGE_UNSUPPORTED_BY_PROVIDER).sort(),
  Object.keys(PROVIDERS).filter(key => key !== 'default').sort(),
  '新增渠道必须同时声明它的图片字段支持范围'
)

// ---------------------------------------------------------------------------
// 7. UI 护栏：渠道接不住的字段，必须当场报错，而不是发一个会静默降级的请求
// ---------------------------------------------------------------------------
const backgroundPayload = buildBackgroundReplacePayload({
  model: 'nano-banana-2',
  size: '1x1',
  subjectImage: 'data:image/png;base64,SUBJECT',
  backgroundReferenceImage: 'data:image/png;base64,BACKGROUND',
  instruction: '换成四人宿舍'
})
assert.deepEqual(getUnsupportedImageFields('local-material', backgroundPayload), [])
const blocked = getUnsupportedImageFields('chatfire', backgroundPayload)
assert.deepEqual(
  blocked,
  ['edit_mode', 'subject_image', 'background_reference_image', 'background_instruction'],
  '换背景模式下把模型切到 chatfire，这四个字段会被 adapter 整批丢掉，必须被识别出来'
)
const message = describeUnsupportedImageFields(blocked, '冠希 (Chatfire)')
assert.match(message, /冠希 \(Chatfire\)/)
assert.match(message, /主体图/)
assert.match(message, /背景参考图/)

// 纯文生图在 chatfire 上是完整的，不许误伤
assert.deepEqual(
  getUnsupportedImageFields('chatfire', buildImageRequestParams({
    model: 'doubao-seedream-4-5-251128',
    prompt: SENTINELS.prompt,
    size: '2048x2048'
  })),
  []
)

// ---------------------------------------------------------------------------
// 8. 接线守卫：三处必须真的用同一份契约（否则上面所有断言都测的是一个没人调用的模块）
// ---------------------------------------------------------------------------
assert.match(useApiSource, /pickImageRequestFields\(\{/, 'useApi.js 必须用契约挑字段，不能再手抄 if 链')
assert.match(useApiSource, /from '@\/utils\/imageRequestContract'/)
assert.doesNotMatch(
  useApiSource.slice(useApiSource.indexOf('const requestData = pickImageRequestFields'), useApiSource.indexOf("adaptRequest('image', requestData)")),
  /requestData\.\w+\s*=/,
  'useApi.js 的图片请求体不许再出现逐字段手抄赋值'
)

const providersSource = read('../src/config/providers.js')
assert.match(providersSource, /pickImageRequestFields\(params, \{ drop: IMAGE_UNSUPPORTED_BY_PROVIDER\[providerKey\] \}\)/)
assert.doesNotMatch(providersSource, /adapted\.quality = params\.quality/, 'adapter 里不许再留 quality 的死分支')
assert.doesNotMatch(providersSource, /adapted\.style = params\.style/, 'adapter 里不许再留 style 的死分支')

assert.match(imageConfigSource, /buildImageRequestParams\(\{/, 'ImageConfigNode 必须走契约组装请求参数')
// 只看「组装请求参数」那一段：localQuality 依旧要写进节点数据（画布要记住用户选的档位），
// 但不许出现在发出去的 params 里。
const requestBuildRegion = imageConfigSource.slice(
  imageConfigSource.indexOf('const params = isBackgroundReplaceMode.value'),
  imageConfigSource.indexOf('let imageNodeId = null')
)
assert.ok(requestBuildRegion.length > 0, '未能在 ImageConfigNode 中定位请求参数组装段')
assert.doesNotMatch(requestBuildRegion, /^\s*quality:/m, '请求体里不许再出现 quality —— 它是本地档位，不是请求字段')
assert.doesNotMatch(requestBuildRegion, /^\s*n:\s*1/m, '请求体里不许再出现 n —— 后端从不读，且恒返回 1 张图')
assert.match(imageConfigSource, /getUnsupportedImageFields\(modelStore\.currentProvider, params\)/, '提交前必须做渠道能力检查')
assert.ok(
  imageConfigSource.indexOf('getUnsupportedImageFields(modelStore.currentProvider, params)')
    < imageConfigSource.indexOf('let imageNodeId = null'),
  '渠道能力检查必须发生在创建 loading 节点之前，否则失败时会留下一个空转节点'
)

console.log('imageAdapterFieldContract.test.mjs passed')
