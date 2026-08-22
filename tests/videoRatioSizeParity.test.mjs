import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMMON_VIDEO_SIZES, normalizeVideoSize, ratioForVideoSize } from '../src/config/videoSizes.js'
import { buildStudioCanvas, getAspectRatioForSize } from '../src/config/studioProjectFlow.js'
import { buildH3DirectorWorkflow } from '../src/utils/h3DirectorWorkflow.js'
import { getVideoQualityProfile } from '../src/utils/videoQualityProfile.js'
import { normalizeVideoOutputSize } from '../src/utils/videoOutputSizes.js'
import { normalizeResizeTargets } from '../src/utils/videoResize.js'

/**
 * 宽高比推导 / 尺寸归一化的**行为对拍**表。
 *
 * 收敛前这两件事各有 7 份和 3 份实现，而且行为已经分叉。这个文件把同一组输入
 * （含非法值、边界值、空值）喂给每一份仍然存在的实现，逐格钉死输出。
 * 它是刻意**跨模块**写的：只要有人重新长出第二份实现、或者把某一份改漂，这里就红。
 *
 * 唯一事实源：
 *   - src/utils/videoAspectRatio.js  比例推导
 *   - src/utils/videoSizeRules.js    256–4096 / 整数 / 偶数
 * 例外：src/components/nodes/VideoConfigNode.vue 里的 getVideoRatioFromOutputSize
 * 故意保持独立（前后端契约，理由写在那段注释里），本文件第 3 节把它和共用实现对拍。
 *
 * 口径以后端为准 —— material_generation_api.py:6510：
 *   ratio = "9:16" if target_height > target_width else "16:9"
 * 只有「高 > 宽」是竖屏；方形、等宽高、无法比较（NaN）一律 16:9。
 */

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

/* ============================ 1. 尺寸 -> 比例 ============================ */

// 三份字符串实现内部都用这一句解析，抽出来喂给数字口径的实现，保证同口径对拍。
const parse = size => String(size).toLowerCase().split('x').map(Number)

// 通过 buildStudioCanvas 观察 studioProjectFlow 内部用的那一份。
const ratioViaStudioCanvas = size => buildStudioCanvas({ mode: 'image-to-video', size })
  .nodes.find(node => node.type === 'videoConfig').data.ratio

// [size 字符串, 期望比例]
const SIZE_TO_RATIO = [
  ['1280x720', '16:9'],
  ['720x1280', '9:16'],
  ['1920x1080', '16:9'],
  ['1080x1920', '9:16'],
  ['1366x768', '16:9'],
  ['720X1280', '9:16'],       // 大小写：解析前先 toLowerCase
  ['1e3x720', '16:9'],        // 科学计数法是合法数字字面量
  ['1080x1080.5', '9:16'],    // 非整数不影响比例判定，只影响尺寸校验
  ['x1280', '9:16'],          // 空宽度 -> Number('') === 0，竖屏成立
  // ---- 方形：后端把 1:1 也判成 16:9，前端不许判成竖屏 ----
  ['1080x1080', '16:9'],
  ['0x0', '16:9'],
  ['-100x-200', '16:9'],
  // ---- 非法 / 解析不出来：一律回落 16:9（收敛前 videoSizes.js 这里返回 '9:16'）----
  ['abcxdef', '16:9'],
  ['', '16:9'],
  ['720', '16:9'],
  ['720x', '16:9'],
  ['1080xInfinity', '16:9']   // toLowerCase 之后 Number('infinity') === NaN
]

for (const [size, expected] of SIZE_TO_RATIO) {
  const [width, height] = parse(size)
  assert.equal(ratioForVideoSize(width, height), expected, `ratioForVideoSize(${width}, ${height})`)
  assert.equal(getAspectRatioForSize(size), expected, `getAspectRatioForSize(${JSON.stringify(size)})`)
  assert.equal(ratioViaStudioCanvas(size), expected, `buildStudioCanvas 的 videoConfig.ratio(${JSON.stringify(size)})`)
}

// 非字符串 size 不许抛异常，一律回落 16:9。
for (const size of [null, undefined, 0, {}, [], NaN]) {
  assert.equal(getAspectRatioForSize(size), '16:9', `getAspectRatioForSize(${String(size)}) 必须回落而不是抛错`)
}

// 数字口径的边界（ratioForVideoSize 的调用方直接传数字，不经过字符串解析）。
for (const [width, height, expected] of [
  [1280, 720, '16:9'],
  [720, 1280, '9:16'],
  [1080, 1080, '16:9'],
  ['1280', '720', '16:9'],
  [NaN, NaN, '16:9'],
  [undefined, undefined, '16:9'],
  [null, null, '16:9'],
  [1280, undefined, '16:9'],
  [0, 0, '16:9'],
  [1080, Infinity, '9:16']    // 数字口径没有 isFinite 守卫：Infinity 确实大于 1080
]) {
  assert.equal(ratioForVideoSize(width, height), expected, `ratioForVideoSize(${String(width)}, ${String(height)})`)
}

// 字符串口径必须有 isFinite 守卫。
// 注意 '1080xInfinity' 抓不到这条：toLowerCase() 之后 Number('infinity') 已经是 NaN 了。
// 真正能走到 Infinity 的是指数溢出，'1e999' 这种；没有守卫就会被判成竖屏。
assert.equal(getAspectRatioForSize('1080x1e999'), '16:9', '解析出 Infinity 时必须回落 16:9，不能判成竖屏')
assert.equal(getAspectRatioForSize('1e999x1080'), '16:9')
assert.equal(getAspectRatioForSize('1080xInfinity'), '16:9')
// 同一个输入在数字口径下没有守卫（Infinity 确实大于 1080），这不是重复实现漂移，
// 而是「字符串解析层」和「后端契约层」的分工：后者逐字镜像后端那行三元，不加料。
assert.equal(ratioForVideoSize(1080, Infinity), '9:16')

// COMMON_VIDEO_SIZES 自带的 ratio 字段必须和推导结果一致，否则预设本身就是脏数据。
for (const item of COMMON_VIDEO_SIZES) {
  assert.equal(ratioForVideoSize(item.width, item.height), item.ratio, `预设 ${item.key} 的 ratio 字段和推导结果不一致`)
  assert.equal(getAspectRatioForSize(item.key), item.ratio)
}

/* ======================= 2. 比例字符串 -> 比例 ======================= */

// 通过 profile 的宽高观察 videoQualityProfile 内部的归一化。
const ratioViaQualityProfile = ratio => {
  const profile = getVideoQualityProfile('quality', ratio)
  return profile.height > profile.width ? '9:16' : '16:9'
}
// 通过 videoConfig.data.ratio 观察 h3DirectorWorkflow 内部的归一化。
const ratioViaH3 = ratio => buildH3DirectorWorkflow({ aspect_ratio: ratio })
  .nodes.find(node => node.type === 'videoConfig').data.ratio

const RATIO_TO_RATIO = [
  ['9:16', '9:16'],
  ['16:9', '16:9'],
  [' 9:16 ', '9:16'],     // 收敛前 h3DirectorWorkflow / NovelVideoWorkspace 这里返回 '16:9'
  ['9:16\n', '9:16'],
  ['1:1', '16:9'],
  ['', '16:9'],
  ['portrait', '16:9'],
  ['9：16', '16:9'],      // 全角冒号不是 9:16
  [null, '16:9'],
  [undefined, '16:9'],
  [0, '16:9']
]

for (const [ratio, expected] of RATIO_TO_RATIO) {
  assert.equal(ratioViaQualityProfile(ratio), expected, `getVideoQualityProfile(_, ${JSON.stringify(ratio)})`)
  assert.equal(ratioViaH3(ratio), expected, `buildH3DirectorWorkflow({ aspect_ratio: ${JSON.stringify(ratio)} })`)
}

// h3 的关键帧尺寸必须跟着同一个比例判定走，不能各判各的。
for (const [ratio, imageSize] of [['9:16', '720x1280'], [' 9:16 ', '720x1280'], ['16:9', '1280x720'], ['1:1', '1280x720']]) {
  const workflow = buildH3DirectorWorkflow({ aspect_ratio: ratio, requires_keyframe: true })
  const imageConfig = workflow.nodes.find(node => node.type === 'imageConfig')
  assert.equal(imageConfig.data.size, imageSize, `H3 关键帧尺寸必须和比例判定一致（ratio=${JSON.stringify(ratio)}）`)
  assert.equal(getAspectRatioForSize(imageConfig.data.size), ratioViaH3(ratio), 'H3 关键帧尺寸反推出来的比例必须回到同一个值')
}

/* ============ 3. VideoConfigNode 的前后端契约实现 vs 共用实现 ============ */

// 这一份故意没被收敛（理由见 VideoConfigNode.vue 里那段注释）。既然是两份代码，
// 就必须有一条断言把它们钉在一起，否则又回到「改了这份忘了那份」。
const videoConfigSource = read('../src/components/nodes/VideoConfigNode.vue')
const contractSource = videoConfigSource.match(
  /\/\/ --- video ratio\/output-size contract ---([\s\S]*?)\/\/ --- end video ratio\/output-size contract ---/
)?.[1] || ''
assert.ok(contractSource, 'VideoConfigNode 必须仍然暴露那段可执行的比例/输出尺寸契约')

const { getVideoRatioFromOutputSize } = await import(
  `data:text/javascript,${encodeURIComponent(`${contractSource}\nexport { getVideoRatioFromOutputSize }`)}`
)

for (const [size] of SIZE_TO_RATIO) {
  const [width, height] = parse(size)
  assert.equal(
    getVideoRatioFromOutputSize(width, height),
    ratioForVideoSize(width, height),
    `VideoConfigNode 的后端契约实现和 utils/videoAspectRatio 对 (${String(width)}, ${String(height)}) 给出了不同的比例`
  )
}
for (const [width, height] of [[1280, 720], [720, 1280], [1080, 1080], [NaN, NaN], [undefined, undefined], [0, 0], [1080, Infinity]]) {
  assert.equal(
    getVideoRatioFromOutputSize(width, height),
    ratioForVideoSize(width, height),
    `VideoConfigNode 的后端契约实现和 utils/videoAspectRatio 对 (${String(width)}, ${String(height)}) 给出了不同的比例`
  )
}

/* ================== 4. 尺寸归一化：三份实现同一条规则 ================== */

// 每一格都是收敛前实测记录下来的真实行为，逐格保留。
// 三个入口的**接受/拒绝判定**必须完全一致；返回形状和错误类型是各自的既有契约，不同是对的。
const DIMENSION_CASES = [
  // [w, h, 是否合法]
  [1280, 720, true],
  [720, 1280, true],
  [1080, 1080, true],
  [256, 256, true],           // 下界含
  [4096, 4096, true],         // 上界含
  ['1280', '720', true],      // 数字字符串会被 Number() 收下
  [254, 720, false],          // 低于下界
  [4098, 720, false],         // 高于上界
  [1279, 720, false],         // 奇数
  [1280.5, 720, false],       // 非整数
  [0, 0, false],
  [NaN, 720, false],
  [-256, -256, false],
  [10000, 720, false],
  [10001, 720, false]
]

const outcome = fn => { try { return { ok: true, value: fn() } } catch (error) { return { ok: false, error } } }

for (const [width, height, valid] of DIMENSION_CASES) {
  const viaSize = outcome(() => normalizeVideoSize(width, height))
  const viaOutput = outcome(() => normalizeVideoOutputSize({ output_width: width, output_height: height }))
  const viaResize = outcome(() => normalizeResizeTargets([`${width}x${height}`]))

  assert.equal(viaSize.ok, valid, `normalizeVideoSize(${String(width)}, ${String(height)}) 的接受/拒绝判定漂了`)
  assert.equal(viaOutput.ok, valid, `normalizeVideoOutputSize(${String(width)}, ${String(height)}) 的接受/拒绝判定漂了`)
  assert.equal(viaResize.ok, valid, `normalizeResizeTargets(["${String(width)}x${String(height)}"]) 的接受/拒绝判定漂了`)

  if (valid) {
    const w = Number(width)
    const h = Number(height)
    assert.deepEqual(viaSize.value, { width: w, height: h, key: `${w}x${h}` })
    assert.deepEqual({ width: viaOutput.value.width, height: viaOutput.value.height }, { width: w, height: h })
    assert.deepEqual(viaResize.value, [{ width: w, height: h }])
  } else {
    // 错误类型是各自调用方的既有契约，不许在收敛时被统一掉。
    assert.ok(viaSize.error instanceof Error && !(viaSize.error instanceof TypeError), 'normalizeVideoSize 必须抛普通 Error')
    assert.ok(viaOutput.error instanceof TypeError, 'normalizeVideoOutputSize 必须抛 TypeError')
    assert.ok(viaResize.error instanceof Error && !(viaResize.error instanceof TypeError), 'normalizeResizeTargets 必须抛普通 Error')
    assert.equal(viaOutput.error.message, '视频输出宽高必须是 256–4096 范围内的正偶数')
    assert.equal(viaResize.error.message, '输出尺寸必须是 256–4096 范围内的偶数')
  }
}

// normalizeVideoSize 的三种文案是直接展示给用户的，优先级也是契约的一部分：
// 整数 -> 偶数 -> 范围。10001 报的是「偶数」而不是「范围」。
for (const [width, height, message] of [
  [1280.5, 720, '尺寸必须是整数'],
  [NaN, 720, '尺寸必须是整数'],
  [1279, 720, '宽高必须是偶数像素'],
  [10001, 720, '宽高必须是偶数像素'],
  [10000, 720, '尺寸超出 256–4096 范围'],
  [254, 720, '尺寸超出 256–4096 范围'],
  [0, 0, '尺寸超出 256–4096 范围']
]) {
  assert.throws(() => normalizeVideoSize(width, height), new RegExp(message), `normalizeVideoSize(${String(width)}, ${String(height)}) 的文案/优先级漂了`)
}

/* ============ 5. 三份归一化的空输入语义各不相同，且必须保持 ============ */

// 抛错 / 静默回落 1920x1080 / 返回 [] —— 三种，都是各自调用方依赖的既有行为。
assert.throws(() => normalizeVideoSize(), /尺寸必须是整数/)
assert.throws(() => normalizeVideoSize(undefined, undefined), /尺寸必须是整数/)
assert.throws(() => normalizeVideoSize(1920, undefined), /尺寸必须是整数/)

assert.deepEqual(normalizeVideoOutputSize(), { width: 1920, height: 1080, preset: 'landscape-1080p' })
assert.deepEqual(normalizeVideoOutputSize({}), { width: 1920, height: 1080, preset: 'landscape-1080p' })
assert.deepEqual(normalizeVideoOutputSize({ ratio: '9:16' }), { width: 1080, height: 1920, preset: 'portrait-1080p' })
assert.deepEqual(normalizeVideoOutputSize({ ratio: '1:1' }), { width: 1080, height: 1080, preset: 'square-1080p' })
assert.deepEqual(normalizeVideoOutputSize({ ratio: '9x16' }), { width: 1080, height: 1920, preset: 'portrait-1080p' })
assert.deepEqual(normalizeVideoOutputSize({ width: 1280, height: 720 }), { width: 1280, height: 720, preset: 'landscape-720p' })
// 只填一半必须报「同时填写」，不能静默补 1920/1080 —— 那样用户改一个框就会拿到半错的尺寸。
assert.throws(() => normalizeVideoOutputSize({ output_width: 1920 }), /同时填写/)
assert.throws(() => normalizeVideoOutputSize({ output_height: 1080 }), /同时填写/)

assert.deepEqual(normalizeResizeTargets(), [])
assert.deepEqual(normalizeResizeTargets([]), [])
assert.throws(() => normalizeResizeTargets(['']), /偶数/)
assert.deepEqual(normalizeResizeTargets(['720x1280', '720x1280']), [{ width: 720, height: 1280 }], '去重是既有行为')
assert.deepEqual(normalizeResizeTargets(['720X1280']), [{ width: 720, height: 1280 }])
assert.deepEqual(normalizeResizeTargets(['720x1280x30']), [{ width: 720, height: 1280 }], '多余的第三段被丢弃是既有行为')

/* ================ 6. 防复发：不许再长出第 N+1 份实现 ================ */

const DUPLICATE_RATIO_TERNARY = /Number\.isFinite\([^)]*\)\s*&&\s*Number\.isFinite\([^)]*\)\s*&&\s*height\s*>\s*width\s*\?/
for (const path of [
  '../src/config/videoSizes.js',
  '../src/config/studioProjectFlow.js',
  '../src/views/VideoStudio.vue',
  '../src/utils/videoQualityProfile.js',
  '../src/utils/h3DirectorWorkflow.js',
  '../src/components/studio/NovelVideoWorkspace.vue'
]) {
  assert.doesNotMatch(read(path), DUPLICATE_RATIO_TERNARY, `${path} 又抄了一份尺寸->比例推导，请改用 utils/videoAspectRatio.js`)
}

// 只有 VideoConfigNode 那段前后端契约可以裸写 '9:16' 三元；其余全部走共用实现。
for (const path of [
  '../src/utils/h3DirectorWorkflow.js',
  '../src/utils/videoQualityProfile.js',
  '../src/components/studio/NovelVideoWorkspace.vue'
]) {
  assert.doesNotMatch(read(path), /===\s*'9:16'\s*\?\s*'9:16'/, `${path} 又抄了一份比例归一化，请改用 videoAspectRatio.normalizeAspectRatio`)
}

// 256–4096 这条规则只允许写在 videoSizeRules.js 一处（模板里的 min/max 属性不算逻辑）。
for (const path of ['../src/config/videoSizes.js', '../src/utils/videoOutputSizes.js', '../src/utils/videoResize.js']) {
  assert.doesNotMatch(read(path), /<\s*256\s*\|\|/, `${path} 又抄了一份尺寸区间校验，请改用 videoSizeRules.findVideoSizeViolation`)
}

console.log('videoRatioSizeParity.test.mjs passed')
