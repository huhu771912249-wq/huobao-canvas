import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 两个「静默失败」：节点被置成 loading 之后，存在返回路径既不清 loading 也不报错。
 *
 * ImageConfigNode: `if (result && result.length > 0) { ... }` 外面直接弹
 * 「图片生成成功」。后端返回空数组时整段节点更新被跳过，loading 永久保留，
 * 同时还弹一个骗人的成功提示。
 *
 * VideoConfigNode: `if (url) ... else if (newTaskId) ...` 没有 else，
 * 而节点在此之前已经被置成 loading，于是永远停在「视频生成中...」。
 * 同一个 try 的 catch 也是全文件唯一漏掉 window.$message?.error 的分支。
 */
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const imageSource = read('../src/components/nodes/ImageConfigNode.vue')
const videoSource = read('../src/components/nodes/VideoConfigNode.vue')

// ---------- ImageConfigNode ----------
const imageStart = imageSource.indexOf('const result = await generate(params)')
assert.ok(imageStart > 0, '未能定位 ImageConfigNode 的生成调用')
const imageCatchStart = imageSource.indexOf('} catch (err) {', imageStart)
assert.ok(imageCatchStart > imageStart, '未能定位 ImageConfigNode 的 catch 分支')
const imageResultBlock = imageSource.slice(imageStart, imageCatchStart)

assert.doesNotMatch(
  imageResultBlock,
  /if \(result && result\.length > 0\) \{/,
  '空结果不能整段跳过节点更新，否则 loading 永久保留'
)

const emptyGuard = imageResultBlock.match(/if \(!result \|\| result\.length === 0\) \{[\s\S]*?\n {4}\}/)?.[0] || ''
assert.ok(emptyGuard, '空结果必须有一个显式分支')
assert.match(emptyGuard, /loading: false/, '空结果必须把节点从 loading 里放出来')
assert.match(emptyGuard, /window\.\$message\?\.error/, '空结果必须给用户报错')
assert.match(emptyGuard, /error:/, '空结果必须在节点上留下错误信息')
assert.match(emptyGuard, /\breturn\b/, '空结果必须提前返回，不能继续走成功路径')

const imageSuccessToast = "window.$message?.success('图片生成成功')"
const successIndex = imageResultBlock.indexOf(imageSuccessToast)
assert.ok(successIndex > 0, '成功提示必须仍然存在')
assert.ok(
  successIndex > imageResultBlock.indexOf(emptyGuard) + emptyGuard.length - 1,
  '成功提示必须在空结果分支之后，空结果时不可达'
)
assert.equal(
  imageResultBlock.split(imageSuccessToast).length - 1,
  1,
  '成功提示只应有一处'
)
// loading 必须在这一段的每条出口上被清掉
for (const chunk of imageResultBlock.split('updateNode(imageNodeId, {').slice(1)) {
  assert.match(chunk.slice(0, 400), /loading: false/, 'generate 之后的每次节点更新都必须清掉 loading')
}

// ---------- VideoConfigNode ----------
const videoStart = videoSource.indexOf('const { taskId: newTaskId, url, result } = await createVideoTaskOnly(params)')
assert.ok(videoStart > 0, '未能定位 VideoConfigNode 的任务创建调用')
const videoFinallyStart = videoSource.indexOf('} finally {', videoStart)
assert.ok(videoFinallyStart > videoStart, '未能定位 VideoConfigNode 的 finally 分支')
const videoCatchStart = videoSource.indexOf('} catch (err) {', videoStart)
assert.ok(videoCatchStart > videoStart && videoCatchStart < videoFinallyStart, '未能定位 VideoConfigNode 的 catch 分支')

const videoBranchBlock = videoSource.slice(videoStart, videoCatchStart)
assert.match(videoBranchBlock, /if \(url\) \{/, 'url 分支必须仍然存在')
assert.match(videoBranchBlock, /\} else if \(newTaskId\) \{/, 'taskId 分支必须仍然存在')

const fallbackIndex = videoBranchBlock.lastIndexOf('} else {')
assert.ok(
  fallbackIndex > videoBranchBlock.indexOf('} else if (newTaskId) {'),
  '既没有 url 也没有 taskId 时必须有兜底分支，否则节点永远停在「视频生成中...」'
)
const fallbackBranch = videoBranchBlock.slice(fallbackIndex)
assert.match(fallbackBranch, /loading: false/, '兜底分支必须把节点从 loading 里放出来')
assert.match(fallbackBranch, /error:/, '兜底分支必须在节点上留下错误信息')
assert.match(fallbackBranch, /window\.\$message\?\.error/, '兜底分支必须给用户报错')

const videoCatchBlock = videoSource.slice(videoCatchStart, videoFinallyStart)
assert.match(videoCatchBlock, /loading: false/)
assert.match(
  videoCatchBlock,
  /window\.\$message\?\.error\(message\)/,
  '视频生成的 catch 必须弹错误提示，这是全文件唯一漏掉的一处'
)

console.log('nodeGenerationFailureFeedback.test.mjs passed')
