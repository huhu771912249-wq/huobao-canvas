/**
 * 视频输出尺寸规则的唯一实现。
 *
 * 「256–4096 / 整数 / 偶数」这条规则历史上被抄了三遍：
 *   - config/videoSizes.js      normalizeVideoSize(w, h)      抛 Error，三种文案
 *   - utils/videoOutputSizes.js normalizeVideoOutputSize(obj) 抛 TypeError，一种文案，空输入回落 1920x1080
 *   - utils/videoResize.js      normalizeResizeTargets([...]) 抛 Error，一种文案，空数组返回 []
 * 规则本身一致，但错误类型、文案、空输入语义各不相同，而且都是各自调用方的既有契约。
 * 所以这里只收敛「规则」，三个入口保留成薄封装，各自维持对外承诺的返回形状与错误类型。
 * 对拍表见 tests/videoRatioSizeParity.test.mjs。
 */

export const VIDEO_SIZE_MIN = 256
export const VIDEO_SIZE_MAX = 4096

/**
 * 'WxH' -> { width, height }。
 * 三处字符串入口（videoResize / studioProjectFlow / VideoStudio）历史上逐字相同的那句解析。
 * 注意 toLowerCase() 顺带把 '1080xInfinity' 变成 NaN，这是既有行为，不要"修"。
 */
export const parseVideoSizeKey = (size) => {
  const [width, height] = String(size).toLowerCase().split('x').map(Number)
  return { width, height }
}

/**
 * 返回第一条被违反的规则，全部通过时返回 null。
 *
 * 顺序就是 normalizeVideoSize 对外承诺过的报错优先级：整数 -> 偶数 -> 范围。
 * 例如 (10001, 720) 报的是「偶数」而不是「范围」—— 调换顺序会改掉用户看到的文案。
 */
export const findVideoSizeViolation = (width, height) => {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isInteger(w) || !Number.isInteger(h)) return 'not-integer'
  if (w % 2 || h % 2) return 'odd'
  if (w < VIDEO_SIZE_MIN || h < VIDEO_SIZE_MIN || w > VIDEO_SIZE_MAX || h > VIDEO_SIZE_MAX) return 'out-of-range'
  return null
}

export const isValidVideoSize = (width, height) => findVideoSizeViolation(width, height) === null
