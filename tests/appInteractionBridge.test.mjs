import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildDownloadUrl,
  isInlineImageAsset,
  sanitizeDownloadFilename,
  shouldProxyRemoteAsset
} from '../src/utils/assetDownload.js'
import { nextSuggestionSetIndex } from '../src/utils/suggestions.js'

assert.equal(sanitizeDownloadFilename('../广告 素材?.png'), '广告-素材-.png')
assert.equal(sanitizeDownloadFilename(''), '冠希无限画布-素材')
assert.equal(isInlineImageAsset('data:image/png;base64,AAAA'), true)
assert.equal(isInlineImageAsset('https://example.com/a.png'), false)
assert.equal(
  shouldProxyRemoteAsset('https://frw-images.aiaipic.win/result.png'),
  true
)
assert.equal(
  shouldProxyRemoteAsset('http://127.0.0.1:8788/public-assets/result.png'),
  false
)
assert.equal(
  buildDownloadUrl(
    'http://127.0.0.1:8788/public-assets/canvas.png',
    '广告素材.png'
  ),
  'http://127.0.0.1:8788/public-assets/canvas.png?download=1&filename=%E5%B9%BF%E5%91%8A%E7%B4%A0%E6%9D%90.png'
)
assert.equal(
  buildDownloadUrl('https://cdn.example.com/result.png', 'result.png'),
  'https://cdn.example.com/result.png'
)
assert.equal(nextSuggestionSetIndex(0, 3), 1)
assert.equal(nextSuggestionSetIndex(2, 3), 0)
assert.equal(nextSuggestionSetIndex(5, 0), 0)

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')

const appSource = read('src/App.vue')
const messageBridgeSource = read('src/components/GlobalMessageBridge.vue')
const canvasSource = read('src/views/Canvas.vue')
const homeSource = read('src/views/Home.vue')
const downloadModalSource = read('src/components/DownloadModal.vue')
const imageNodeSource = read('src/components/nodes/ImageNode.vue')
const videoNodeSource = read('src/components/nodes/VideoNode.vue')
const dspCreativeLibrarySource = read('src/components/nodes/DspCreativeLibraryNode.vue')
const workspaceShellSource = read('src/components/workspace/WorkspaceShell.vue')
const taskRailSource = read('src/components/workspace/TaskRail.vue')
const dspTaskCenterSource = read('src/components/nodes/DspCreativeTaskCenterNode.vue')
const creationLauncherSource = read('src/components/home/CreationLauncher.vue')
const recentProjectsSource = read('src/components/home/RecentProjects.vue')
const workspaceLaunchSource = read('src/config/workspaceLaunch.js')
const viteConfigSource = read('vite.config.js')

assert.match(viteConfigSource, /target:\s*'http:\/\/127\.0\.0\.1:8788'/)
assert.match(viteConfigSource, /'\/public-assets':\s*\{/)
assert.match(appSource, /<GlobalMessageBridge\s*\/>/)
assert.match(messageBridgeSource, /useMessage\(\)/)
assert.match(messageBridgeSource, /window\.\$message\s*=\s*message/)

assert.match(canvasSource, /@click="refreshSuggestions"/)
assert.match(homeSource, /@refresh-suggestions="refreshSuggestions"/)
assert.match(canvasSource, /duplicateProject\(projectId\)/)
assert.match(canvasSource, /deleteProject\(projectId\)/)
assert.match(canvasSource, /class="canvas-studio/)
assert.match(canvasSource, /class="canvas-tool-rail/)
assert.match(canvasSource, /class="canvas-prompt-dock/)
assert.match(canvasSource, /class="canvas-zoom-dock/)

for (const source of [downloadModalSource, imageNodeSource, videoNodeSource]) {
  assert.match(source, /startAssetDownload/)
}
assert.doesNotMatch(downloadModalSource, /window\.open\(asset\.url/)
assert.match(dspCreativeLibrarySource, /正在读取 \{\{ previewElapsedSeconds \}\} 秒/)
assert.match(dspCreativeLibrarySource, /通常需要 1–2 分钟/)
assert.match(dspCreativeLibrarySource, /class="dsp-library-node/)
assert.match(dspCreativeLibrarySource, /class="dsp-filter-panel/)
assert.match(dspCreativeLibrarySource, /class="dsp-candidate-gallery/)
assert.match(dspCreativeLibrarySource, /normalizeServiceIncident/)
assert.match(dspCreativeLibrarySource, /先预览并选择素材/)
assert.match(dspCreativeLibrarySource, /请选择至少 1 条素材/)
assert.match(dspTaskCenterSource, /class="dsp-task-center/)
assert.match(dspTaskCenterSource, /normalizeServiceIncident/)
assert.match(workspaceShellSource, /buildWorkspaceNavigation/)
assert.match(workspaceShellSource, /<aside/)
assert.match(workspaceShellSource, /<slot\s+name="main"/)
assert.match(taskRailSource, /任务中心/)
assert.match(taskRailSource, /buildTaskSummary/)
assert.match(creationLauncherSource, /54DSP 优秀素材/)
assert.match(creationLauncherSource, /accept="image\/png,image\/jpeg,image\/webp,image\/gif,video\/mp4,video\/quicktime,video\/webm"/)
assert.match(creationLauncherSource, /@drop\.prevent="handleAttachmentDrop"/)
assert.match(creationLauncherSource, /识别需求/)
assert.match(creationLauncherSource, /素材摘要/)
assert.match(creationLauncherSource, /v-for="key in \['quick', 'workflow'\]"/)
assert.match(creationLauncherSource, /intentPreview\.destinations\[key\]\.title/)
assert.match(creationLauncherSource, /class="intent-confirmation/)
assert.match(creationLauncherSource, /defineEmits\(\[[\s\S]*?'review-intent'[\s\S]*?'confirm-intent'[\s\S]*?'cancel-intent'/)
assert.match(homeSource, /@review-intent="handleIntentReview"/)
assert.match(homeSource, /publishImageAsset/)
assert.match(homeSource, /createMaterialInput/)
assert.match(homeSource, /runNavigation\(`intent-confirm:/)
assert.doesNotMatch(homeSource, /@submit="handlePromptSubmit"/, 'dialog prompt must review intent before any project creation')
assert.match(recentProjectsSource, /打开项目/)
assert.match(homeSource, /<WorkspaceShell/)
assert.match(homeSource, /<CreationLauncher/)
assert.match(homeSource, /<RecentProjects/)
assert.doesNotMatch(homeSource, /fixed left-4 top-1\/2/)
assert.match(workspaceLaunchSource, /type:\s*'dspCreativeLibrary'/)
assert.match(workspaceLaunchSource, /type:\s*'dspCreativeTaskCenter'/)

const installerUrl = new URL('../../../install_material_desktop_app.sh', `file://${root}/`)
if (existsSync(installerUrl)) {
  const installerSource = read('../../../install_material_desktop_app.sh')
  assert.match(installerSource, /WKUIDelegate/)
  assert.match(installerSource, /webView\.uiDelegate\s*=\s*self/)
  assert.match(installerSource, /runOpenPanelWith parameters/)
} else {
  console.log('external desktop installer unavailable; installer bridge assertions skipped')
}
assert.match(viteConfigSource, /target:\s*'http:\/\/127\.0\.0\.1:8788'/)
assert.match(imageNodeSource, /defineOptions\(\{\s*inheritAttrs:\s*false\s*\}\)/)

console.log('appInteractionBridge.test.mjs passed')
