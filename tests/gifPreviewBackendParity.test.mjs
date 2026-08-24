import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIF_EDITOR_FIT_MODES,
  GIF_TEXT_STYLE_PRESETS,
  buildGifEditorTextTracks,
  buildGifEditorWatermarkPayload,
  findGifEditorWatermarkOverflow,
  gifPreviewFontSizeCqh,
  gifPreviewImageOverlayStyle,
  gifPreviewMediaFit,
  gifPreviewStageBackground,
  gifPreviewTextOverlayStyle,
  gifPreviewUsesBlurBackdrop,
  normalizeGifTextColor,
  resolveGifTextTrackStyle,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'

/**
 * GIF 编辑器**预览 vs 后端 ffmpeg 的行为对拍**表。
 *
 * 这个编辑器的工作流是「调参数 → 看预览 → 导出」。预览一旦和成品对不上，工作流就退化成
 * 「导出 → 下载 → 看 → 改 → 再导出」，每轮几十秒 ffmpeg。所以预览的换算不是装饰，
 * 它和 payload 一样是**契约**，必须有对拍。
 *
 * 写法参照 tests/videoRatioSizeParity.test.mjs：把同一组输入喂给两份实现，逐格钉死输出。
 * 区别是这里的第二份实现在**另一个仓库**（guanxi-canvas-backend）里，CI 读不到，
 * 所以下面 backend* 系列函数是逐字镜像 + 注明出处；只要有人改了前端换算，这里就红。
 *
 * 后端事实源：
 *   video_resize_pipeline.py `_text_track_filter`
 *     fontsize={font_size:.2f}                         绝对像素，不是百分比
 *     x=max(0\,min(w-text_w\, w*{x/100}-text_w/2))     文字中心锚 + 夹到画面内
 *     y=max(0\,min(h-text_h\, h*{y/100}-text_h/2))
 *     选项表里没有 shadowcolor/shadowx/shadowy         文字轨道永远没有投影
 *     文案原样写进 textfile，drawtext 不折行           只按 \n 断行
 *   video_resize_pipeline.py `_watermark_position`（custom 分支）
 *     x=(W-w)*{x/100}   y=(H-h)*{y/100}                左上锚 + 按比例内缩
 *   video_resize_pipeline.py `run_target`
 *     watermark_width = max(1, round(W*{width/100}))，高度 scale=w:-1 保持原图比例
 *   video_resize_pipeline.py `_filter`
 *     blur/contain → force_original_aspect_ratio=decrease（整帧保留）
 *     其余         → force_original_aspect_ratio=increase,crop（裁切）
 *     contain 的留边 color=black；blur 额外铺一层 boxblur=20 背景
 *   video_resize_jobs.py `_required_color` / `_validated_text_tracks` / `_validated_watermark`
 *     颜色必须 #rrggbb，stroke_width 0–32，watermark 是**单个对象**
 */

/* ==================== 0. 后端公式的逐字镜像 ==================== */

const backendTextFrameBox = (track, { width, height, textWidth, textHeight }) => ({
  left: Math.max(0, Math.min(width - textWidth, width * track.x / 100 - textWidth / 2)),
  top: Math.max(0, Math.min(height - textHeight, height * track.y / 100 - textHeight / 2))
})
/** 上面那个 clamp 有没有真的夹住 —— 夹住了就说明输入已经超出画面，不能当对拍样本。 */
const backendTextClampActive = (track, { width, height, textWidth, textHeight }) => {
  const rawLeft = width * track.x / 100 - textWidth / 2
  const rawTop = height * track.y / 100 - textHeight / 2
  return rawLeft < 0 || rawLeft > width - textWidth || rawTop < 0 || rawTop > height - textHeight
}
const backendTextFontPx = track => track.font_size
const backendTextLineCount = track => String(track.text).split('\n').length
const backendTextHasShadow = () => false

const backendWatermarkWidthPx = (payload, width) => Math.max(1, Math.round(width * payload.width / 100))
const backendWatermarkTopLeft = (payload, { width, height, watermarkWidth, watermarkHeight }) => ({
  left: (width - watermarkWidth) * payload.x / 100,
  top: (height - watermarkHeight) * payload.y / 100
})

const backendKeepsWholeFrame = fitMode => ['blur', 'contain'].includes(fitMode)
const backendPadsWithBlackBars = fitMode => fitMode === 'contain'
const backendDrawsBlurBackdrop = fitMode => fitMode === 'blur'

/* ============ 1. 一个最小的 CSS 解析器：把声明摆成像素 ============ */
/*
 * 浏览器只用到三条规则，全部写死在这里，不去猜：
 *   - `left` 的百分比按包含块**宽度**解析，`top` 的百分比按包含块**高度**解析；
 *   - `transform: translate(a%, b%)` 的百分比按元素**自身边框盒**解析；
 *   - `Ncqh` = 尺寸容器高度的 N%（所以 .preview-stage 必须是尺寸容器，见第 6 节）。
 */
const number = (value, unit) => {
  const match = new RegExp(`^(-?[\\d.]+)${unit}$`).exec(String(value))
  assert.ok(match, `期望形如 <number>${unit} 的值，实际拿到 ${JSON.stringify(value)}`)
  return Number(match[1])
}
const percent = value => number(value, '%') / 100
const translatePercents = transform => {
  const match = /^translate\(\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%\s*\)$/.exec(String(transform))
  assert.ok(match, `预览必须用 translate(x%, y%) 定位，实际拿到 ${JSON.stringify(transform)}`)
  return [Number(match[1]) / 100, Number(match[2]) / 100]
}
const paddingPx = (padding, fontSizePx) => {
  const raw = String(padding)
  if (raw === '0') return 0
  return number(raw, 'em') * fontSizePx
}
const resolveCqh = (value, containerHeightPx) => number(value, 'cqh') / 100 * containerHeightPx

/** 元素边框盒的左上角，单位是舞台像素。 */
const layOutOverlay = (style, { stageWidth, stageHeight, elementWidth, elementHeight }) => {
  const [translateX, translateY] = translatePercents(style.transform)
  return {
    left: percent(style.left) * stageWidth + translateX * elementWidth,
    top: percent(style.top) * stageHeight + translateY * elementHeight
  }
}

/* ==================== 2. 文字：字号 / 锚点 / 断行 ==================== */

// 舞台是输出画面的等比缩放，`scale` 是「舞台像素 → 输出像素」的换算系数。
const OUTPUTS = [
  { width: 720, height: 1280, stageHeight: 440 },     // 线上默认竖版，舞台被 max-height:440px 卡住
  { width: 1080, height: 1920, stageHeight: 440 },
  { width: 1280, height: 720, stageHeight: 300 },
  { width: 1080, height: 1080, stageHeight: 440 }
]

const TEXT_CASES = [
  { text: '限时五折', x: 50, y: 50, fontSize: 32, style: '爆款白字' },
  { text: '限时五折', x: 20, y: 78, fontSize: 48, style: '高亮黄字' },
  { text: '字幕一行', x: 50, y: 90, fontSize: 24, style: '字幕黑底' },
  { text: '第一行\n第二行', x: 50, y: 30, fontSize: 40, style: '爆款白字' },
  { text: '自定义配色', x: 65, y: 12, fontSize: 36, style: '爆款白字', color: '#ff0066', strokeColor: '#00ffcc', strokeWidth: 12 },
  { text: '零描边', x: 5, y: 5, fontSize: 14, style: '高亮黄字', strokeWidth: 0 },
  { text: '满格描边', x: 95, y: 95, fontSize: 72, style: '爆款白字', strokeWidth: 32 }
]

let parityRows = 0
for (const output of OUTPUTS) {
  const scale = output.height / output.stageHeight              // 舞台像素 → 输出像素
  const stageWidth = output.width / output.height * output.stageHeight
  assert.ok(Math.abs(stageWidth * scale - output.width) < 1e-9, '舞台必须是输出画面的等比缩放')

  for (const item of TEXT_CASES) {
    const [track] = buildGifEditorTextTracks([{ ...item, start: 0, end: 1 }], 3)
    const style = gifPreviewTextOverlayStyle(item, { outputHeight: output.height })

    /* 2.1 字号：预览 cqh 换算回输出像素，必须等于后端 fontsize */
    const previewFontStagePx = resolveCqh(style.fontSize, output.stageHeight)
    assert.equal(
      Number((previewFontStagePx * scale).toFixed(9)),
      backendTextFontPx(track),
      `字号漂了：${output.width}x${output.height} 上 fontSize=${item.fontSize}`
    )

    /* 2.2 锚点：拿一段假定的文字尺寸，两边各自摆一次，必须落在同一个像素上 */
    for (const textWidthRatio of [0.1, 0.3, 0.62]) {
      const textWidth = output.width * textWidthRatio          // 输出像素
      const textHeight = backendTextFontPx(track) * 1.15       // line-height:1.15
      const frame = { width: output.width, height: output.height, textWidth, textHeight }
      // 只有后端 clamp 没有生效时两边才可比：clamp 需要文字的真实宽度，CSS 拿不到。
      // 这条已知残差写在报告里，这里显式跳过而不是假装相等。
      if (backendTextClampActive(track, frame)) continue

      const padding = paddingPx(style.padding, previewFontStagePx)
      const box = layOutOverlay(style, {
        stageWidth,
        stageHeight: output.stageHeight,
        elementWidth: textWidth / scale + padding * 2,
        elementHeight: textHeight / scale + padding * 2
      })
      const previewTextLeft = (box.left + padding) * scale
      const previewTextTop = (box.top + padding) * scale
      const expected = backendTextFrameBox(track, frame)

      assert.ok(
        Math.abs(previewTextLeft - expected.left) < 1e-6,
        `文字横向锚点漂了：${output.width}x${output.height} x=${item.x} → 预览 ${previewTextLeft}，后端 ${expected.left}`
      )
      assert.ok(
        Math.abs(previewTextTop - expected.top) < 1e-6,
        `文字纵向锚点漂了：${output.width}x${output.height} y=${item.y} → 预览 ${previewTextTop}，后端 ${expected.top}`
      )
      parityRows += 1
    }

    /* 2.3 断行：drawtext 只认文案里的 \n，不会自动折行 */
    const previewPreservesNewlines = ['pre', 'pre-wrap', 'pre-line', 'break-spaces'].includes(style.whiteSpace)
    const previewWraps = ['pre-wrap', 'pre-line', 'normal', 'break-spaces'].includes(style.whiteSpace)
    assert.equal(
      previewPreservesNewlines ? String(item.text).split('\n').length : 1,
      backendTextLineCount(track),
      `换行行为漂了：预览 white-space=${style.whiteSpace}，后端按 \\n 断成 ${backendTextLineCount(track)} 行`
    )
    assert.equal(previewWraps, false, '后端 drawtext 不会自动折行，预览也不许折行')

    /* 2.4 投影：文字轨道的 drawtext 选项表里没有 shadow* */
    assert.equal(
      style.textShadow !== 'none',
      backendTextHasShadow(),
      '预览给文字加了成品永远不会有的投影'
    )

    /* 2.5 颜色 / 描边 */
    // (a) 预览和 payload 必须来自同一次解析 —— 两边不许各读各的。
    const appearance = resolveGifTextTrackStyle(item)
    assert.equal(style.color, track.color, '预览字色和 payload 字色不一致')
    assert.equal(style.WebkitTextStroke, `${track.stroke_width}px ${track.stroke_color}`, '预览描边和 payload 描边不一致')
    assert.equal(appearance.color, track.color)
    assert.equal(appearance.strokeWidth, track.stroke_width)
    assert.equal(
      style.backgroundColor === 'transparent',
      track.background === false,
      '预览底色的有无必须和 payload 的 background 一致'
    )
    // (b) 用户自己设的值必须真的送到后端。后端 video_resize_jobs.py:157 本来就收任意
    //     #rrggbb 和 0–32 描边宽度，前端过去用 3 个写死预设**无条件覆盖**了它们 ——
    //     (a) 那种「两边一致」的断言抓不到这个 bug（一起漂就一起过），所以必须对着输入断言。
    const preset = GIF_TEXT_STYLE_PRESETS[item.style]
    if (Object.hasOwn(item, 'color')) {
      assert.equal(track.color, normalizeGifTextColor(item.color), '用户设的字色被预设无条件覆盖了')
      assert.equal(style.color, normalizeGifTextColor(item.color), '用户设的字色没有反映到预览上')
      assert.notEqual(track.color, preset.color, '这条样例必须和预设不同色，否则断言不到覆盖行为')
    } else {
      assert.equal(track.color, preset.color, '没设颜色时必须回落到预设')
    }
    if (Object.hasOwn(item, 'strokeColor')) {
      assert.equal(track.stroke_color, normalizeGifTextColor(item.strokeColor), '用户设的描边色被预设无条件覆盖了')
    }
    if (Object.hasOwn(item, 'strokeWidth')) {
      assert.equal(track.stroke_width, item.strokeWidth, '用户设的描边宽度被预设无条件覆盖了')
      assert.equal(style.WebkitTextStroke, `${item.strokeWidth}px ${track.stroke_color}`, '用户设的描边宽度没有反映到预览上')
    } else {
      assert.equal(track.stroke_width, preset.strokeWidth, '没设描边宽度时必须回落到预设')
    }
  }
}
assert.ok(parityRows >= 60, `锚点对拍样本太少（只跑了 ${parityRows} 格），护栏形同虚设`)

/* 字号换算本身的边界：非法输出高度不许产出 NaN/Infinity 样式 */
for (const badHeight of [0, -1, Number.NaN, undefined, null, 'abc']) {
  assert.equal(gifPreviewFontSizeCqh(32, badHeight), 0)
  assert.doesNotMatch(
    String(gifPreviewTextOverlayStyle({ fontSize: 32 }, { outputHeight: badHeight }).fontSize),
    /NaN|Infinity/
  )
}

/* ==================== 3. 图片水印：左上锚 + 按比例内缩 ==================== */

const WATERMARK_CASES = [
  { x: 82, y: 12, size: 22, opacity: 92 },     // importImage 的出厂值
  { x: 50, y: 50, size: 22, opacity: 100 },    // 退化成居中，和后端 center 预设同解
  { x: 0, y: 0, size: 8, opacity: 10 },
  { x: 100, y: 100, size: 60, opacity: 55 },
  { x: 18, y: 88, size: 40, opacity: 92 }
]

for (const output of OUTPUTS) {
  const scale = output.height / output.stageHeight
  const stageWidth = output.width / output.height * output.stageHeight

  for (const item of WATERMARK_CASES) {
    const track = { ...item, url: '/public-assets/logo.png' }
    const payload = buildGifEditorWatermarkPayload(track, { sourceDuration: 3 })
    const style = gifPreviewImageOverlayStyle(track)

    assert.equal(payload.position, 'custom', 'position 必须走 custom 分支，预设分支是固定边距')
    assert.equal(payload.x, item.x)
    assert.equal(payload.y, item.y)
    assert.equal(payload.width, item.size)
    assert.equal(payload.opacity, item.opacity / 100)
    assert.equal(style.opacity, payload.opacity, '预览透明度和 payload 透明度不一致')

    // 宽度：预览是舞台宽的 size%，后端是输出宽的 width% —— 等比缩放后必须重合
    const previewWidthStagePx = percent(style.width) * stageWidth
    const backendWidth = backendWatermarkWidthPx(payload, output.width)
    assert.ok(
      Math.abs(previewWidthStagePx * scale - backendWidth) <= 0.5,
      `水印宽度漂了：预览 ${previewWidthStagePx * scale}，后端 ${backendWidth}`
    )

    // 位置：给几种原图比例（后端 scale=w:-1，高度跟着原图走）
    for (const aspect of [1, 0.25, 2.5]) {
      const watermarkHeight = backendWidth * aspect
      const box = layOutOverlay(style, {
        stageWidth,
        stageHeight: output.stageHeight,
        elementWidth: previewWidthStagePx,
        elementHeight: watermarkHeight / scale
      })
      const expected = backendWatermarkTopLeft(payload, {
        width: output.width,
        height: output.height,
        watermarkWidth: backendWidth,
        watermarkHeight
      })
      assert.ok(
        Math.abs(box.left * scale - expected.left) <= 0.5,
        `水印横向锚点漂了：${output.width}x${output.height} x=${item.x} → 预览 ${box.left * scale}，后端 ${expected.left}`
      )
      assert.ok(
        Math.abs(box.top * scale - expected.top) <= 0.5,
        `水印纵向锚点漂了：${output.width}x${output.height} y=${item.y} → 预览 ${box.top * scale}，后端 ${expected.top}`
      )
    }
  }
}

// 这就是修之前的偏差量：中心锚在 720 宽、x=82、size=22 上比左上锚往右多推约 51px。
// 留在这里当基准 —— 谁把 transform 改回 translate(-50%,-50%)，上面第 3 节立刻红。
{
  const output = OUTPUTS[0]
  const payload = buildGifEditorWatermarkPayload({ x: 82, y: 12, size: 22, url: '/public-assets/logo.png' }, { sourceDuration: 3 })
  const watermarkWidth = backendWatermarkWidthPx(payload, output.width)
  const centreAnchored = output.width * 82 / 100 - watermarkWidth / 2
  const backendLeft = backendWatermarkTopLeft(payload, {
    width: output.width, height: output.height, watermarkWidth, watermarkHeight: watermarkWidth
  }).left
  assert.ok(
    Math.abs(centreAnchored - backendLeft) > 50,
    '中心锚和后端左上锚的偏差应该仍在 50px 量级，否则这条基准写错了'
  )
}

/* ==================== 4. 画面适配：三档都必须在预览里看得见 ==================== */

for (const fitMode of GIF_EDITOR_FIT_MODES) {
  assert.equal(
    gifPreviewMediaFit(fitMode) === 'contain',
    backendKeepsWholeFrame(fitMode),
    `fit_mode=${fitMode}：预览的 object-fit 和后端裁不裁切对不上`
  )
  assert.equal(
    gifPreviewUsesBlurBackdrop(fitMode),
    backendDrawsBlurBackdrop(fitMode),
    `fit_mode=${fitMode}：模糊背景的有无和后端对不上`
  )
  assert.equal(
    gifPreviewStageBackground(fitMode) === '#000000',
    backendPadsWithBlackBars(fitMode) || !backendKeepsWholeFrame(fitMode),
    `fit_mode=${fitMode}：留边底色和后端 pad color=black 对不上`
  )
}
// 三档不能给出同一种预览，否则「换了档预览纹丝不动」的老问题就回来了。
assert.equal(
  new Set(GIF_EDITOR_FIT_MODES.map(mode => `${gifPreviewMediaFit(mode)}|${gifPreviewUsesBlurBackdrop(mode)}`)).size,
  3,
  '三种画面适配必须在预览里长得不一样'
)
// 只有后端认识的档位才允许持久化，否则 create job 会被 400 掉。
assert.deepEqual(GIF_EDITOR_FIT_MODES, ['contain', 'blur', 'center'])
assert.equal(sanitizeWatermarkEditorProject({ output: { fitMode: 'smart-ish' } }).output.fitMode, 'contain')
assert.equal(sanitizeWatermarkEditorProject({ output: { fitMode: 'blur' } }).output.fitMode, 'blur')

/* ==================== 5. 静默丢弃：多水印必须报错，不许悄悄挑一张 ==================== */

const watermarkTrack = index => ({ id: `image-${index}`, url: `/public-assets/logo-${index}.png` })
assert.equal(findGifEditorWatermarkOverflow([]), '')
assert.equal(findGifEditorWatermarkOverflow([watermarkTrack(1)]), '')
assert.equal(findGifEditorWatermarkOverflow(undefined), '')
// blob: 之类不会被持久化的地址不算数（sanitize 会丢掉它们）
assert.equal(findGifEditorWatermarkOverflow([watermarkTrack(1), { url: 'blob:http://x/y' }]), '')
for (const count of [2, 3, 8]) {
  const message = findGifEditorWatermarkOverflow(Array.from({ length: count }, (_, index) => watermarkTrack(index)))
  assert.match(message, /只能合成 1 张图片水印/)
  assert.match(message, new RegExp(`当前有 ${count} 张`))
}

/* ==================== 6. cqh 的前置条件 ==================== */
/*
 * 第 2.1 节整段建立在「1cqh = 舞台高度的 1%」上。舞台一旦不是尺寸容器，
 * cqh 会去找更外层的容器（或退化成 0），字号立刻又开始撒谎，而上面的纯函数对拍
 * 一格都不会红。所以这一条必须单独钉住 —— 它是那套换算成立的前提，不是排版细节。
 */
const editorSource = readFileSync(new URL('../src/views/GifAdEditor.vue', import.meta.url), 'utf8')
const stageRule = editorSource.match(/\.preview-stage\{([^}]*)\}/)?.[1] || ''
assert.ok(stageRule, '找不到 .preview-stage 规则')
assert.match(stageRule, /container-type:\s*size/, '.preview-stage 必须是尺寸容器，否则 cqh 字号换算不成立')

/* ==================== 7. 颜色归一化：后端只收 #rrggbb ==================== */

assert.equal(normalizeGifTextColor('#FF0066'), '#ff0066', '后端 _required_color 会 lower()，前端先归一')
assert.equal(normalizeGifTextColor('#f06'), '#ff0066', '三位简写要展开，否则后端直接 400')
assert.equal(normalizeGifTextColor('  #ABCDEF  '), '#abcdef')
for (const invalid of ['red', 'rgb(1,2,3)', '#ggg', '#12345', '', null, undefined, 42, {}]) {
  assert.equal(normalizeGifTextColor(invalid, '#123456'), '#123456', `非法颜色 ${String(invalid)} 必须回落而不是发给后端`)
}
// buildGifEditorTextTracks 出来的颜色永远是后端能收的形状。
for (const item of [...TEXT_CASES, { text: 'x', color: 'red', strokeColor: 'blue', strokeWidth: 999 }]) {
  const [track] = buildGifEditorTextTracks([{ ...item, start: 0, end: 1 }], 3)
  assert.match(track.color, /^#[0-9a-f]{6}$/)
  assert.match(track.stroke_color, /^#[0-9a-f]{6}$/)
  assert.match(track.background_color, /^#[0-9a-f]{6}$/)
  assert.ok(track.stroke_width >= 0 && track.stroke_width <= 32, 'stroke_width 必须落在后端的 0–32 内')
  assert.ok(track.background_opacity >= 0 && track.background_opacity <= 1)
}

console.log('gifPreviewBackendParity.test.mjs passed')
