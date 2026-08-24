/**
 * Image request contract | 图片生成请求契约
 *
 * 这是「UI 上能调的参数 → 请求体」的**唯一事实源**。
 * ImageConfigNode 组装、useApi 过滤、providers 各渠道适配器统统从这里取字段表，
 * 三处不可能再各抄一份然后互相脱节。
 *
 * 为什么要有这个文件：#43（video adapter 白名单漏了 output_width/output_height/
 * sampling_mode/director_plan）、#46（image 传数组形状后端只认字符串）、以及本次的
 * quality，是**同一个**成因 —— 同一份字段清单被手抄了三遍，改一处不会让另外两处变红。
 *
 * ---------------------------------------------------------------------------
 * 后端事实（guanxi-canvas-backend/material_generation_api.py，本次逐行复核）：
 *
 *   :8651 请求体只是 `json.loads(...)` 出来的 dict，没有 pydantic、没有 extra="forbid"，
 *         **未知键一律静默丢弃**（所以「多发一个字段」永远不会报错，只会白发）。
 *   :4582 `_image_generations(payload)` 入口。
 *   :4583 `edit_mode == "background_replace"` 才走 `_background_replace_generations`，
 *         其余取值静默忽略。
 *   :4600 `model ∈ COMFYUI_IMAGE_MODELS`（z-image / krea-2-turbo）且 `mode == "text2image"`
 *         才调 `_local_comfy_image_options` 消费原生参数；带参考图直接
 *         `raise ValueError("<模型名> 当前仅支持文生图")`。
 *   :4937 `scheduler` 收到后一律被改回 profile 默认值 —— 发了等于没发。
 *   :4634 FRW 路径（`MATERIAL_IMAGE_PROVIDER` 默认就是 `frw`）调 `frw.generate_material()`
 *         时**根本没传 width/height**；`size` 只经 `apply_visual_prompt_policy` 变成一句
 *         「构图同时适配以下输出尺寸：…」拼进提示词。只有 ComfyUI 路径真的按 size 出图。
 *   quality / style / n 在整条图片链路上一次都没被读过（`grep 'get("n")'` 零命中），
 *         而且每条返回分支都是硬编码的单元素 data 列表，后端恒返回 1 张图。
 * ---------------------------------------------------------------------------
 */

/**
 * 会真的进请求体的字段。useApi 按这份清单过滤，local-material adapter 按这份清单透传。
 * 往这里加字段 = 三处同时生效；不加 = 三处同时不发。没有第四种状态。
 */
export const IMAGE_REQUEST_FIELDS = Object.freeze([
  'model',
  'prompt',
  'size',
  'image',
  'edit_mode',
  'subject_image',
  'background_reference_image',
  'background_instruction',
  'negative_prompt',
  'steps',
  'cfg',
  'sampler_name',
  'scheduler',
  'seed'
])

/**
 * UI 上能调、但**故意不发**的参数。值就是「为什么不发」——
 * 契约测试要求每一条都有理由，不许留空，也不许在这里塞一个其实该接上的字段。
 */
export const IMAGE_UI_LOCAL_FIELDS = Object.freeze({
  quality:
    '「画质」是纯前端的尺寸档位开关，不是请求字段。选 4K 会把尺寸下拉框换成 '
    + 'SEEDREAM_4K_SIZE_OPTIONS 并把 size 改成 4096x4096 —— 真正生效的是 size。'
    + '后端 _image_generations 从头到尾没读过 quality，chatfire/openai 侧 "4k" 也不是 '
    + 'OpenAI images API 的合法 quality 取值（standard/hd）。接上去只会把静默失败换个位置。'
})

/**
 * 各渠道**已知不支持**的字段：适配器会主动丢，UI 侧也会在提交前拦下来。
 * chatfire / openai 是 OpenAI 兼容中转，只有 model/prompt/size/image 四个字段是通的；
 * 换背景和 ComfyUI 原生参数是本地后端独有的能力。
 */
export const IMAGE_UNSUPPORTED_BY_PROVIDER = Object.freeze({
  'local-material': Object.freeze([]),
  chatfire: Object.freeze([
    'edit_mode',
    'subject_image',
    'background_reference_image',
    'background_instruction',
    'negative_prompt',
    'steps',
    'cfg',
    'sampler_name',
    'scheduler',
    'seed'
  ]),
  openai: Object.freeze([
    'edit_mode',
    'subject_image',
    'background_reference_image',
    'background_instruction',
    'negative_prompt',
    'steps',
    'cfg',
    'sampler_name',
    'scheduler',
    'seed'
  ])
})

/** 给用户看的字段名。只覆盖会被渠道拦下来的那些。 */
export const IMAGE_FIELD_LABELS = Object.freeze({
  edit_mode: '换背景模式',
  subject_image: '主体图',
  background_reference_image: '背景参考图',
  background_instruction: '背景指令',
  negative_prompt: '负面提示词',
  steps: '步数',
  cfg: 'CFG',
  sampler_name: '采样器',
  scheduler: '调度器',
  seed: '随机种子'
})

const isPresent = (value) => value !== undefined && value !== null

/**
 * 按契约挑字段。
 *
 * 只跳过 undefined / null，**不跳过空字符串**：用户把负面提示词清空是一个有意义的动作，
 * 漏发 `negative_prompt: ''` 会让后端回退到 profile 里那条默认负面提示词
 * （material_generation_api.py:4921），等于用户清了个寂寞。
 */
export const pickImageRequestFields = (params = {}, { drop = [] } = {}) => {
  const dropped = new Set(drop)
  const picked = {}
  for (const key of IMAGE_REQUEST_FIELDS) {
    if (dropped.has(key)) continue
    if (!isPresent(params[key])) continue
    picked[key] = params[key]
  }
  return picked
}

/**
 * 组装一次普通（非换背景）图片生成的请求参数。
 * 换背景走 `utils/backgroundReplace.js` 的 `buildBackgroundReplacePayload`。
 */
export const buildImageRequestParams = ({
  model,
  prompt,
  size,
  image = '',
  nativeParams = null
} = {}) => {
  const params = { model, prompt, size }
  // ComfyUI 原生参数：只有 nativeParams 模型才带，其余模型带了后端也不看。
  if (nativeParams) {
    for (const key of ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'scheduler', 'seed']) {
      if (isPresent(nativeParams[key])) params[key] = nativeParams[key]
    }
  }
  if (image) params.image = image
  return params
}

/** 当前渠道会把哪些**已经填了值**的字段丢掉。空 = 这次请求在该渠道上是完整的。 */
export const getUnsupportedImageFields = (providerKey, params = {}) =>
  (IMAGE_UNSUPPORTED_BY_PROVIDER[providerKey] || []).filter(
    key => isPresent(params[key]) && params[key] !== ''
  )

/** 拦截文案：宁可当场报错，也不要发一个会被静默降级成纯文生图的请求（#46 同款）。 */
export const describeUnsupportedImageFields = (fields = [], providerLabel = '当前渠道') => {
  const names = fields.map(key => IMAGE_FIELD_LABELS[key] || key)
  return `${providerLabel}不支持${names.join('、')}，请把模型切回本地 API 的模型再生成`
}
