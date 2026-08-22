/**
 * 视频宽高比推导的唯一实现。
 *
 * 收敛前散落 7 处（config/videoSizes、config/studioProjectFlow ×2、views/VideoStudio、
 * utils/videoQualityProfile、utils/h3DirectorWorkflow、components/studio/NovelVideoWorkspace），
 * 且行为已经分叉：非法输入下 videoSizes 返回 '9:16'，其余全部返回 '16:9'。
 *
 * 以后端为准。material_generation_api.py:6510 完全按输出尺寸推导比例，前端发的 ratio 被忽略：
 *   ratio = "9:16" if target_height > target_width else "16:9"
 * 即：只有「高 > 宽」才是竖屏，方形 / 等宽高 / 无法比较（NaN）一律 16:9。
 * 前端任何一处推导出跟后端不一样的比例，都会导致 image_alignment 与后端 expected_native
 * 对不上而 400（见 tests/videoRatioOutputSizeContract.test.mjs 的背景说明）。
 *
 * ⚠️ components/nodes/VideoConfigNode.vue 里的 getVideoRatioFromOutputSize 是本模块的
 * 姊妹实现，故意保持独立 —— 它被 tests/videoRatioOutputSizeContract.test.mjs 用源码锚点
 * 抽出来单独执行，是钉死前后端契约的护栏。tests/videoRatioSizeParity.test.mjs 里有一条
 * 对拍断言强制两者对同一组输入给出相同结果，任何一边漂了都会红。
 */
import { parseVideoSizeKey } from './videoSizeRules.js'

export const VIDEO_LANDSCAPE_RATIO = '16:9'
export const VIDEO_PORTRAIT_RATIO = '9:16'

/** (width, height) -> 比例。逐字镜像后端那行三元。 */
export const deriveVideoRatioFromSize = (width, height) => (
  Number(height) > Number(width) ? VIDEO_PORTRAIT_RATIO : VIDEO_LANDSCAPE_RATIO
)

/**
 * 'WxH' -> 比例。
 * 解析不出有限数值时按后端口径回落到 16:9（Number.isFinite 这层守卫是三处字符串
 * 实现原本就有的，保留下来，否则 '1080xInfinity' 这类脏值会被判成竖屏）。
 */
export const getAspectRatioForSize = (size) => {
  const { width, height } = parseVideoSizeKey(size)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return VIDEO_LANDSCAPE_RATIO
  return deriveVideoRatioFromSize(width, height)
}

/** 比例字符串 -> 比例。只认去掉首尾空白后的 '9:16'，其余一律 16:9。 */
export const normalizeAspectRatio = (ratio) => (
  String(ratio ?? '').trim() === VIDEO_PORTRAIT_RATIO ? VIDEO_PORTRAIT_RATIO : VIDEO_LANDSCAPE_RATIO
)

/** 比例字符串 -> 是否竖屏。UI 上凡是「竖屏走这条、横屏走那条」的分支都用它。 */
export const isPortraitRatio = (ratio) => normalizeAspectRatio(ratio) === VIDEO_PORTRAIT_RATIO
