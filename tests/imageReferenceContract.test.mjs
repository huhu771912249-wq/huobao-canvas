import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROVIDERS } from '../src/config/providers.js'

/**
 * 图生图的参考图曾经完全不生效，而且没有任何报错。
 *
 * ImageConfigNode 把 `allRefImages.map(...)` 的**数组**原样放进 `payload.image`，适配器透传，
 * 后端两处解析却都只认字符串：
 *   material_generation_api.py:1970 extract_image_url -> str(payload[key]).startswith(("http://","https://"))
 *   material_generation_api.py:4412 inline_image      -> str(payload["image"]).startswith("data:image/")
 * Python 的 str(['data:image/...']) 是 "['data:image/...']"，两个 startswith 都不命中，
 * image_url 留空 -> mode 静默变成 "text2image"，HTTP 200，用户以为跑的是图生图。
 *
 * 相对地址（生成结果常见的 /public-assets/xxx.png）同样不命中，属于同一类静默降级。
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const imageSource = read('../src/components/nodes/ImageConfigNode.vue')

const referenceContractSource = imageSource.match(
  /\/\/ --- image reference contract ---([\s\S]*?)\/\/ --- end image reference contract ---/
)?.[1] || ''
assert.ok(referenceContractSource, 'ImageConfigNode 必须暴露一段可执行的参考图归一化契约')

const { buildImageReferenceInput, IMAGE_REFERENCE_UNSUPPORTED_MESSAGE } = await import(
  `data:text/javascript,${encodeURIComponent(
    `${referenceContractSource}\nexport { buildImageReferenceInput, IMAGE_REFERENCE_UNSUPPORTED_MESSAGE }`
  )}`
)

// 镜像 Python 的 str()：列表会被渲染成 repr，而不是元素本身。
const pythonStr = (value) => {
  if (value === undefined || value === null || value === '') return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    return `['${value.join("', '")}']`
  }
  if (typeof value === 'object') return '{...}'
  return String(value)
}

// 镜像 material_generation_api.py:1970 extract_image_url + :4412 inline_image 的取值顺序。
const backendResolvesImageInput = (payload = {}) => {
  for (const key of ['first_frame_image', 'last_frame_image', 'image', 'image_url', 'source_image', 'source_url']) {
    const raw = payload[key]
    const value = pythonStr(raw).trim()
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const url = String(raw.url || '').trim()
      if (url.startsWith('http://') || url.startsWith('https://')) return url
    }
  }
  const inline = pythonStr(payload.image).trim()
  return inline.startsWith('data:image/') ? inline : ''
}

const DATA_URI = 'data:image/png;base64,iVBORw0KGgo='
const SECOND_DATA_URI = 'data:image/png;base64,ZZZZZZZZ='
const API_BASE = 'https://material.example.com'

// 守卫这份镜像本身：数组形状必须真的解析不出图片，否则下面的断言就没意义了。
assert.equal(
  backendResolvesImageInput({ image: [DATA_URI] }),
  '',
  '后端镜像失真：数组形状本应解析失败并静默退回 text2image'
)

// 1) 单张参考图必须是**字符串**，不是单元素数组。
const single = buildImageReferenceInput([DATA_URI], API_BASE)
assert.equal(typeof single.image, 'string', '参考图必须以字符串形状发送，数组会被后端 str() 成 repr')
assert.equal(single.image, DATA_URI)
assert.equal(single.ignored, 0)
assert.equal(backendResolvesImageInput({ image: single.image }), DATA_URI, '后端必须能解析出参考图')

// 2) 后端图生图路径没有任何多图能力（每个 payload.get("images") 都只取 [0]，且只在视频路径上），
//    所以多连的参考图必须在前端显式丢弃并计数，不能悄悄整包发过去导致全部失效。
const multiple = buildImageReferenceInput([DATA_URI, SECOND_DATA_URI, 'https://cdn.example.com/c.png'], API_BASE)
assert.equal(multiple.image, DATA_URI, '多图时必须使用排序后的第一张')
assert.equal(multiple.ignored, 2, '被忽略的参考图数量必须可上报给用户')
assert.equal(backendResolvesImageInput({ image: multiple.image }), DATA_URI)

// 3) http(s) 直接放行。
const remote = buildImageReferenceInput(['https://cdn.example.com/ref.png'], API_BASE)
assert.equal(remote.image, 'https://cdn.example.com/ref.png')
assert.equal(backendResolvesImageInput({ image: remote.image }), 'https://cdn.example.com/ref.png')

// 4) 生成结果的相对素材地址必须补全成绝对地址，否则同样不命中后端的 startswith。
const relative = buildImageReferenceInput(['/public-assets/abc.png'], API_BASE)
assert.equal(relative.image, 'https://material.example.com/public-assets/abc.png')
assert.equal(backendResolvesImageInput({ image: relative.image }), 'https://material.example.com/public-assets/abc.png')
assert.equal(
  buildImageReferenceInput(['/public-assets/abc.png'], 'https://material.example.com/').image,
  'https://material.example.com/public-assets/abc.png',
  'API base 末尾的斜杠不能产生双斜杠'
)

// 5) 解析不了的形状必须被识别出来，让调用方当场报错，而不是发一个会静默降级的请求。
const rejected = buildImageReferenceInput(['blob:http://localhost/9a7f'], API_BASE)
assert.equal(rejected.image, '')
assert.equal(rejected.rejected, 'blob:http://localhost/9a7f')
assert.equal(backendResolvesImageInput({ image: 'blob:http://localhost/9a7f' }), '', '镜像守卫：blob 地址后端确实解析不出来')

// 6) 空输入不得凭空造出 image 字段（否则纯文生图会被误判成图生图）。
assert.deepEqual(buildImageReferenceInput([], API_BASE), { image: '', ignored: 0, rejected: '' })
assert.deepEqual(buildImageReferenceInput(['', '   '], API_BASE), { image: '', ignored: 0, rejected: '' })

// 7) 真适配器必须原样把字符串带到请求体（而不是重新包成数组或丢字段）。
const adapted = PROVIDERS['local-material'].requestAdapter.image({
  model: 'frw-qianwen',
  prompt: '同一人物换个角度',
  size: '1024x1024',
  image: single.image
})
assert.equal(typeof adapted.image, 'string', 'local-material image adapter 必须保持字符串形状')
assert.equal(backendResolvesImageInput(adapted), DATA_URI, '经过真实适配器后后端仍必须解析得到参考图')

// 8) 源码守卫：请求体不能再出现「把整个数组塞给 image」的旧写法。
assert.doesNotMatch(
  imageSource,
  /\{\s*image:\s*refImages\s*\}/,
  '数组形状的 image 会被后端 str() 成 repr，参考图静默失效'
)
assert.match(
  imageSource,
  /image:\s*referenceInput\.image/,
  '请求体必须发送归一化后的单张参考图'
)
assert.match(
  imageSource,
  /buildImageReferenceInput\(refImages,\s*getMaterialApiBase\(\)\)/,
  '归一化必须拿到真实的素材服务地址才能补全相对地址'
)
assert.ok(
  typeof IMAGE_REFERENCE_UNSUPPORTED_MESSAGE === 'string' && IMAGE_REFERENCE_UNSUPPORTED_MESSAGE.length > 0,
  '无法解析的参考图必须有一条给用户看的文案'
)
assert.match(
  imageSource,
  /window\.\$message\?\.error\(IMAGE_REFERENCE_UNSUPPORTED_MESSAGE\)/,
  '参考图无法解析时必须当场报错，不能继续发一个会静默降级的请求'
)
assert.match(
  imageSource,
  /忽略其余 \$\{referenceInput\.ignored\} 张/,
  '被丢弃的参考图必须提示给用户'
)
assert.ok(
  imageSource.indexOf('buildImageReferenceInput(refImages') < imageSource.indexOf('let imageNodeId = null'),
  '参考图校验必须发生在创建 loading 节点之前，否则失败时会留下一个空转节点'
)

console.log('imageReferenceContract.test.mjs passed')
