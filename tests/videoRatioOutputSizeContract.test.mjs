import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getImageAlignmentSpec } from '../src/config/studioProjectFlow.js'
import { normalizeVideoOutputSize } from '../src/utils/videoOutputSizes.js'

/**
 * 比例下拉框和最终输出尺寸必须联动，否则两者永远只能有一个生效。
 *
 * 后端 material_generation_api.py:6509 起：
 *   target_width  = int(payload["output_width"])
 *   target_height = int(payload["output_height"])
 *   ratio = "9:16" if target_height > target_width else "16:9"   # 前端的 ratio/size 被完全忽略
 *   expected_native = (608, 352) if h3 and ratio == "16:9" else ...
 *   if isinstance(raw_alignment, dict) and (w, h) != expected_native: raise ValueError(...)
 *
 * 也就是说 image_alignment 必须由 output_size 推导。历史上 handleRatioSelect 只改 localRatio、
 * 从 localRatio 推导 image_alignment，于是：
 *   - #43 之前适配器丢掉 output_width/height -> 比例能用、自定义分辨率坏；
 *   - #43 之后放行 output_width/height       -> 分辨率能用、选 9:16 直接 400。
 * 这个守卫要求两者同时可用。
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const videoSource = read('../src/components/nodes/VideoConfigNode.vue')

const ratioContractSource = videoSource.match(
  /\/\/ --- video ratio\/output-size contract ---([\s\S]*?)\/\/ --- end video ratio\/output-size contract ---/
)?.[1] || ''
assert.ok(ratioContractSource, 'VideoConfigNode 必须暴露一段可执行的比例/输出尺寸契约')

const { getVideoRatioFromOutputSize, resolveVideoOutputSizeForRatio } = await import(
  `data:text/javascript,${encodeURIComponent(
    `${ratioContractSource}\nexport { getVideoRatioFromOutputSize, resolveVideoOutputSizeForRatio }`
  )}`
)

// 1) 比例推导必须逐字镜像后端：只有 height > width 才是 9:16，方形算 16:9。
for (const [width, height, expected] of [
  [1920, 1080, '16:9'],
  [1280, 720, '16:9'],
  [1080, 1920, '9:16'],
  [720, 1280, '9:16'],
  [1080, 1080, '16:9']
]) {
  assert.equal(
    getVideoRatioFromOutputSize(width, height),
    expected,
    `${width}x${height} 的比例推导必须和后端 material_generation_api.py:6511 一致`
  )
}

const ratioDefault = ratio => normalizeVideoOutputSize({ ratio })

// 2) 切到 9:16 必须真的把输出尺寸改成竖屏，否则后端永远按 16:9 出片。
assert.deepEqual(
  resolveVideoOutputSizeForRatio('9:16', { width: 1920, height: 1080 }, ratioDefault('9:16')),
  { width: 1080, height: 1920 }
)

// 3) 用户手动挑过的分辨率档位不能被切比例粗暴清空，只翻转朝向。
assert.deepEqual(
  resolveVideoOutputSizeForRatio('9:16', { width: 1280, height: 720 }, ratioDefault('9:16')),
  { width: 720, height: 1280 },
  '切比例必须保留用户选的 720p 档位，只改朝向'
)
assert.deepEqual(
  resolveVideoOutputSizeForRatio('16:9', { width: 720, height: 1280 }, ratioDefault('16:9')),
  { width: 1280, height: 720 }
)

// 4) 朝向本来就对得上时一个像素都不许动（自定义分辨率必须活下来）。
assert.deepEqual(
  resolveVideoOutputSizeForRatio('16:9', { width: 1280, height: 720 }, ratioDefault('16:9')),
  { width: 1280, height: 720 }
)
assert.deepEqual(
  resolveVideoOutputSizeForRatio('16:9', { width: 1366, height: 768 }, ratioDefault('16:9')),
  { width: 1366, height: 768 },
  '非预设的自定义分辨率不能被换成预设'
)
assert.deepEqual(
  resolveVideoOutputSizeForRatio('9:16', { width: 606, height: 1078 }, ratioDefault('9:16')),
  { width: 606, height: 1078 }
)

// 5) 正方形没有朝向可翻，只能回落到该比例的默认档。
assert.deepEqual(
  resolveVideoOutputSizeForRatio('9:16', { width: 1080, height: 1080 }, ratioDefault('9:16')),
  { width: 1080, height: 1920 }
)
assert.deepEqual(
  resolveVideoOutputSizeForRatio('1:1', { width: 1080, height: 1080 }, ratioDefault('1:1')),
  { width: 1080, height: 1080 },
  '后端把 1:1 也推导成 16:9，方形尺寸本身不冲突，不该被改掉'
)

// 6) 脏尺寸回落到默认档，而不是继续把非法值往下传。
for (const dirty of [{}, { width: 0, height: 0 }, { width: Number.NaN, height: 720 }, { width: 1280.5, height: 720 }]) {
  assert.deepEqual(resolveVideoOutputSizeForRatio('16:9', dirty, ratioDefault('16:9')), { width: 1920, height: 1080 })
}

// 7) 端到端：任意比例选择产生的 output_size，其后端推导出的 expected_native
//    必须和前端算出的 image_alignment 完全一致——这就是 400 的那条判断。
const backendExpectedNative = (model, ratio) => {
  if (model === 'minimax-h3') return ratio === '16:9' ? [608, 352] : [352, 608]
  return ratio === '16:9' ? [512, 320] : [320, 512]
}
for (const model of ['minimax-h3', 'ltx-2.3']) {
  for (const ratio of ['16:9', '9:16', '1:1']) {
    for (const current of [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
      { width: 1280, height: 720 },
      { width: 1080, height: 1080 },
      { width: 1366, height: 768 }
    ]) {
      const size = resolveVideoOutputSizeForRatio(ratio, current, ratioDefault(ratio))
      const backendRatio = getVideoRatioFromOutputSize(size.width, size.height)
      const alignment = getImageAlignmentSpec(model, backendRatio)
      assert.deepEqual(
        [alignment.width, alignment.height],
        backendExpectedNative(model, backendRatio),
        `${model} / ${ratio} / ${current.width}x${current.height} 会触发 image_alignment dimensions do not match`
      )
      // 选了竖屏就必须真的发竖屏尺寸
      if (ratio === '9:16') {
        assert.ok(size.height > size.width, '选了 9:16 却发了一个后端会判成 16:9 的尺寸')
      }
    }
  }
}

// 8) 持久化恢复必须过 normalizeVideoOutputSize，历史脏数据不能直接发到后端被拒。
const restoreSource = videoSource.match(/const restoreVideoOutputSize = \(data = \{\}\) => \{[\s\S]*?\n\}\n/)?.[0] || ''
assert.ok(restoreSource, 'VideoConfigNode 必须暴露一个可执行的持久化尺寸恢复函数')
const outputSizeUtilUrl = new URL('../src/utils/videoOutputSizes.js', import.meta.url).href
const { restoreVideoOutputSize } = await import(
  `data:text/javascript,${encodeURIComponent(
    `import { normalizeVideoOutputSize } from ${JSON.stringify(outputSizeUtilUrl)}\n${restoreSource}\nexport { restoreVideoOutputSize }`
  )}`
)
assert.deepEqual(restoreVideoOutputSize({}), { width: 1920, height: 1080, preset: 'landscape-1080p' })
assert.deepEqual(restoreVideoOutputSize({ ratio: '9:16' }), { width: 1080, height: 1920, preset: 'portrait-1080p' })
assert.deepEqual(
  restoreVideoOutputSize({ outputWidth: 1280, outputHeight: 720, ratio: '16:9' }),
  { width: 1280, height: 720, preset: 'landscape-720p' },
  '合法的持久化尺寸必须原样恢复'
)
for (const dirty of [
  { outputWidth: 1281, outputHeight: 721 },   // 奇数
  { outputWidth: 9999, outputHeight: 1080 },  // 超界
  { outputWidth: 128, outputHeight: 72 },     // 低于下界
  { outputWidth: 1280 },                       // 只存了一半
  { outputHeight: 720 }
]) {
  const restored = restoreVideoOutputSize(dirty)
  assert.deepEqual(
    { width: restored.width, height: restored.height },
    { width: 1920, height: 1080 },
    `历史脏数据 ${JSON.stringify(dirty)} 必须回落到默认档而不是原样发到后端`
  )
  assert.doesNotThrow(() => normalizeVideoOutputSize({ output_width: restored.width, output_height: restored.height }))
}

// 9) 源码守卫：旧的三处写法不能回来。
assert.doesNotMatch(
  videoSource,
  /ref\(Number\(props\.data\?\.outputWidth/,
  '持久化尺寸必须过 normalizeVideoOutputSize 校验'
)
assert.doesNotMatch(
  videoSource,
  /getImageAlignmentSpec\(localModel\.value,\s*localRatio\.value\)/,
  'image_alignment 必须由输出尺寸推导，用 localRatio 推导就是 9:16 直接 400 的根因'
)
assert.match(
  videoSource,
  /const effectiveRatio = computed\(\(\) => getVideoRatioFromOutputSize\(outputWidth\.value, outputHeight\.value\)\)/,
  '必须存在一个和后端同款的输出尺寸 -> 比例推导'
)
assert.match(
  videoSource,
  /getImageAlignmentSpec\(localModel\.value,\s*effectiveRatio\.value\)/
)
const ratioHandler = videoSource.match(/const handleRatioSelect = \(key\) => \{[\s\S]*?\n\}/)?.[0] || ''
assert.ok(ratioHandler, 'handleRatioSelect 必须存在')
assert.match(ratioHandler, /applyRatioToOutputSize\(key\)/, '选比例必须真的改写输出尺寸')
assert.match(ratioHandler, /outputWidth:\s*resolved\.width/, '比例联动后的尺寸必须落盘')
assert.match(ratioHandler, /outputHeight:\s*resolved\.height/)
assert.match(
  videoSource,
  /watch\(\[outputWidth, outputHeight\],/,
  '尺寸选择器改完必须落盘并同步比例，否则刷新后回到 1920x1080'
)

console.log('videoRatioOutputSizeContract.test.mjs passed')
