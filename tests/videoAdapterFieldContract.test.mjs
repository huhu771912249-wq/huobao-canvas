import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROVIDERS, getProviderConfig } from '../src/config/providers.js'

// 与 useProvider.js / stores/pinia/models.js 的 adaptRequest 派发逻辑一致：
// 取当前渠道配置 -> 调用 requestAdapter[type]。下面的守卫保证这份镜像不会和源码脱节。
const adaptRequest = (providerKey, type, params) => {
  const config = getProviderConfig(providerKey)
  if (config.requestAdapter && config.requestAdapter[type]) {
    return config.requestAdapter[type](params)
  }
  return params
}

const useProviderSource = readFileSync(new URL('../src/hooks/useProvider.js', import.meta.url), 'utf8')
const modelStoreSource = readFileSync(new URL('../src/stores/pinia/models.js', import.meta.url), 'utf8')
for (const source of [useProviderSource, modelStoreSource]) {
  assert.match(source, /config\.requestAdapter\[type\]\(params\)/, 'adaptRequest 派发方式已变化，请同步本测试里的镜像实现')
}

const QUALITY_PROFILE = { mode: 'quality', width: 1920, height: 1080, upscaler: 'seedvr2-3b-fp16', label: '高质量 1080p' }
const IMAGE_ALIGNMENT = { mode: 'crop_or_pad', width: 608, height: 352, preserve_aspect_ratio: true, allow_stretch: false }
const DIRECTOR_PLAN = { shots: [{ id: 'shot_1', prompt: '推镜到猫脸', seconds: 2 }] }

// PR #22 漏掉的四个字段：UI 正常高亮、单测照过，但请求发出前被 adapter 静默丢弃。
const REGRESSED_FIELDS = {
  output_width: 1280,
  output_height: 720,
  sampling_mode: 'turbo4',
  director_plan: DIRECTOR_PLAN
}

const requestData = {
  model: 'minimax-h3',
  prompt: '一只猫在霓虹街头跳舞',
  first_frame_image: 'https://example.com/first.png',
  size: '16:9',
  seconds: 5,
  quality_profile: QUALITY_PROFILE,
  ...REGRESSED_FIELDS
}

const adapted = adaptRequest('local-material', 'video', requestData)
for (const [key, value] of Object.entries(REGRESSED_FIELDS)) {
  assert.ok(key in adapted, `local-material video adapter 丢弃了 ${key}`)
  assert.deepEqual(adapted[key], value, `local-material video adapter 篡改了 ${key}`)
}
assert.equal(adapted.sampling_mode, 'turbo4', '用户选的 4 步 Turbo 必须真的发到后端，否则永远跑 standard20')

// 未知字段仍然不允许泄漏（白名单语义不能退化成透传）
const leaky = adaptRequest('local-material', 'video', { ...requestData, should_never_leak: 'secret' })
assert.equal('should_never_leak' in leaky, false, 'local-material video adapter 泄漏了未知字段')

// 守卫：useApi.js 往 requestData 写的每个字段，都必须能穿过 local-material 的 video adapter。
// 以后再往 useApi.js 加字段却忘了同步白名单，这里会直接红。
const useApiSource = readFileSync(new URL('../src/hooks/useApi.js', import.meta.url), 'utf8')
const createVideoTaskBody = useApiSource.slice(
  useApiSource.indexOf('const createVideoTaskOnly'),
  useApiSource.indexOf("adaptRequest('video', requestData)")
)
assert.ok(createVideoTaskBody.length > 0, '未能在 useApi.js 中定位 createVideoTaskOnly')

const assignedFields = [...createVideoTaskBody.matchAll(/requestData\.([A-Za-z_][A-Za-z0-9_]*)\s*=/g)].map(match => match[1])
assert.ok(assignedFields.length >= 13, `useApi.js 中解析到的 requestData 字段过少（${assignedFields.length}），正则可能已失效`)
for (const key of Object.keys(REGRESSED_FIELDS)) {
  assert.ok(assignedFields.includes(key), `useApi.js 不再设置 ${key}，请同步本测试`)
}

const PROBE_VALUES = {
  model: 'minimax-h3',
  prompt: '探针提示词',
  first_frame_image: 'https://example.com/first.png',
  last_frame_image: 'https://example.com/last.png',
  images: ['https://example.com/ref.png'],
  driving_video: 'https://example.com/drive.mp4',
  driving_video_name: 'drive.mp4',
  size: '16:9',
  seconds: 5,
  sizes: ['1280x720'],
  output_formats: ['mp4', 'gif'],
  quality_profile: QUALITY_PROFILE,
  image_alignment: IMAGE_ALIGNMENT,
  ...REGRESSED_FIELDS
}

const probeParams = { model: 'minimax-h3', prompt: '探针提示词' }
for (const key of assignedFields) {
  assert.ok(key in PROBE_VALUES, `useApi.js 新增了 requestData.${key}，请在本测试补探针值并同步 adapter 白名单`)
  probeParams[key] = PROBE_VALUES[key]
}

const probeAdapted = adaptRequest('local-material', 'video', probeParams)
const droppedFields = assignedFields.filter(key => !(key in probeAdapted))
assert.deepEqual(droppedFields, [], `local-material video adapter 白名单与 useApi.js 脱节，被丢弃的字段: ${droppedFields.join(', ')}`)

// 兜底：其它渠道的 video adapter 至少不能崩，且仍旧不透传未知字段
for (const providerKey of ['chatfire', 'openai']) {
  const out = PROVIDERS[providerKey].requestAdapter.video({ ...requestData, should_never_leak: 'secret' })
  assert.equal('should_never_leak' in out, false, `${providerKey} video adapter 泄漏了未知字段`)
}

console.log('videoAdapterFieldContract.test.mjs passed')
