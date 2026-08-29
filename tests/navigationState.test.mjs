import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTH_SESSION_CACHE_MS,
  createGuardedUrlLaunchAction,
  createLatestNavigationRunner,
  createLatestRequestGate,
  hasFreshAuthenticatedSession,
  normalizeStudioTab
} from '../src/utils/navigationState.js'
import {
  buildHomeIntentCanvas,
  chooseHomeIntentDestination,
  createHomeIntentAttachmentState,
  createHomeIntentPlan,
  normalizeHomeIntentUploadedAsset,
  validateHomeIntentAttachment
} from '../src/utils/homeIntent.js'

assert.equal(
  hasFreshAuthenticatedSession({ user: 'gx', checkedAt: 1000, now: 1000 + AUTH_SESSION_CACHE_MS - 1 }),
  true
)
assert.equal(
  hasFreshAuthenticatedSession({ user: 'gx', checkedAt: 1000, now: 1000 + AUTH_SESSION_CACHE_MS }),
  false
)
assert.equal(hasFreshAuthenticatedSession({ user: null, checkedAt: 1000, now: 1001 }), false)

const requestGate = createLatestRequestGate()
const firstRequest = requestGate.begin()
const secondRequest = requestGate.begin()
assert.equal(requestGate.isCurrent(firstRequest), false)
assert.equal(requestGate.isCurrent(secondRequest), true)
requestGate.invalidate()
assert.equal(requestGate.isCurrent(secondRequest), false)

const createDeferred = () => {
  let resolve
  const promise = new Promise(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

const assertLatestNavigationWins = async completionOrder => {
  const pendingUpdates = []
  const committedIntents = []
  let renderedDestination = null
  const delays = { A: createDeferred(), B: createDeferred() }
  const destinations = {
    A: { url: '/gif-editor', title: '水印与 GIF 素材编辑', form: 'gif' },
    B: { url: '/video-resize', title: '视频尺寸工作台', form: 'resize' }
  }
  const runNavigation = createLatestNavigationRunner({
    setPending: (active, intent) => { pendingUpdates.push({ active, intent }) }
  })
  const start = intent => runNavigation(intent, async ({ commit }) => {
    await delays[intent].promise
    return commit(() => {
      committedIntents.push(intent)
      renderedDestination = destinations[intent]
    })
  })

  const firstNavigation = start('A')
  const secondNavigation = start('B')
  for (const intent of completionOrder) {
    delays[intent].resolve()
    await Promise.resolve()
  }
  await Promise.all([firstNavigation, secondNavigation])

  assert.deepEqual(committedIntents, ['B'], `latest intent must win when requests finish ${completionOrder.join(' then ')}`)
  assert.deepEqual(renderedDestination, destinations.B, 'the latest shortcut must own the final URL, title, and form')
  assert.deepEqual(pendingUpdates, [
    { active: true, intent: 'A' },
    { active: true, intent: 'B' },
    { active: false, intent: 'B' }
  ], 'only the latest intent may update or clear loading state')
}

await assertLatestNavigationWins(['A', 'B'])
await assertLatestNavigationWins(['B', 'A'])

const imageAttachment = { name: 'brand-watermark.png', type: 'image/png', size: 2 * 1024 * 1024 }
const videoAttachment = { name: 'campaign.mp4', type: 'video/mp4', size: 30 * 1024 * 1024 }
const gifAttachment = { name: 'campaign.gif', type: 'image/gif', size: 8 * 1024 * 1024 }
assert.equal(validateHomeIntentAttachment(imageAttachment).ok, true)
assert.equal(validateHomeIntentAttachment(videoAttachment).ok, true)
assert.equal(validateHomeIntentAttachment(gifAttachment).ok, true)
assert.equal(validateHomeIntentAttachment({ name: 'notes.txt', type: 'text/plain', size: 10 }).ok, false)
assert.equal(validateHomeIntentAttachment({ ...imageAttachment, size: 21 * 1024 * 1024 }).ok, false)
assert.equal(validateHomeIntentAttachment({ ...videoAttachment, size: 91 * 1024 * 1024 }).ok, false)

const attachmentChanges = []
const attachmentState = createHomeIntentAttachmentState({ onChange: value => attachmentChanges.push(value) })
attachmentState.select(imageAttachment)
assert.equal(attachmentState.current()?.file, imageAttachment)
const invalidReplacement = attachmentState.select({ name: 'bad.exe', type: 'application/octet-stream', size: 100 })
assert.equal(invalidReplacement.ok, false)
assert.equal(attachmentState.current(), null, 'an invalid replacement must clear the previous accepted attachment')
assert.equal(attachmentChanges.at(-1).attachment, null)

const intentCases = [
  ['给这个素材加品牌水印并导出 GIF', imageAttachment, 'gif-edit', 'workflow'],
  ['转成抖音和横版广告尺寸', null, 'resize', 'quick'],
  ['保留商品替换背景', null, 'background', 'quick'],
  ['做五组素材裂变', null, 'variation', 'quick'],
  ['生成一个可编辑的广告画面', null, 'image', 'workflow']
]
for (const [prompt, attachment, expectedIntent, expectedDestination] of intentCases) {
  const plan = createHomeIntentPlan({ prompt, attachment })
  assert.equal(plan.intent.id, expectedIntent, `${prompt} must use the explainable intent table`)
  assert.equal(plan.recommendation, expectedDestination)
  assert.ok(plan.intent.reason)
  assert.ok(plan.steps.length > 0)
}
const watermarkPlan = createHomeIntentPlan({ prompt: '加水印', attachment: imageAttachment })
assert.equal(watermarkPlan.destinations.quick.disabled, true, 'quick tools must honestly reject an attachment they cannot receive')
assert.match(watermarkPlan.destinations.quick.explanation, /附件/)
assert.equal(chooseHomeIntentDestination(watermarkPlan, 'quick').selectedDestination, 'workflow')
assert.equal(chooseHomeIntentDestination(createHomeIntentPlan({ prompt: '调整尺寸' }), 'workflow').selectedDestination, 'workflow')

const gifEditorCanvas = () => ({
  nodes: [{ id: 'watermark-editor', type: 'watermarkEditor', position: { x: 160, y: 100 }, data: { label: '水印与素材编辑' } }],
  edges: [],
  viewport: { x: 100, y: 80, zoom: 0.8 }
})
const gifEditorAttachmentCases = [
  [imageAttachment, { url: '/public-assets/brand-watermark.png', mime: 'image/png', name: 'brand-watermark.png' }, 'image'],
  [gifAttachment, { url: '/public-assets/campaign.gif', mime: 'image/gif', name: 'campaign.gif', asset_name: 'campaign.gif' }, 'materialInput'],
  [videoAttachment, { url: '/public-assets/campaign.mp4', mime: 'video/mp4', name: 'campaign.mp4', asset_name: 'campaign.mp4' }, 'materialInput']
]
for (const [file, uploaded, expectedNodeType] of gifEditorAttachmentCases) {
  const descriptor = validateHomeIntentAttachment(file).attachment
  const plan = createHomeIntentPlan({ prompt: '加水印并导出 GIF', attachment: file })
  const asset = normalizeHomeIntentUploadedAsset(uploaded, descriptor)
  const canvas = buildHomeIntentCanvas({ canvas: gifEditorCanvas(), plan, asset })
  const assetNode = canvas.nodes.find(node => node.id === 'home-intent-asset')
  assert.equal(plan.destinations.workflow.disabled, false, `${file.type} must be consumable by gifEditor`)
  assert.equal(assetNode.type, expectedNodeType)
  assert.equal(assetNode.data.url, uploaded.url)
  assert.deepEqual(canvas.edges[0], {
    id: 'edge_home-intent-asset_watermark-editor',
    source: 'home-intent-asset',
    target: 'watermark-editor',
    sourceHandle: 'right',
    targetHandle: 'left'
  }, `${file.type} must connect through the real watermark editor handles`)
  assert.doesNotMatch(JSON.stringify(canvas), /data:|blob:|source_base64|base64/i, 'workflow project JSON must contain only published asset metadata')
}

for (const [prompt, file] of [['换背景', imageAttachment], ['做一条视频', videoAttachment]]) {
  const plan = createHomeIntentPlan({ prompt, attachment: file })
  assert.equal(plan.destinations.quick.disabled, true)
  assert.equal(plan.destinations.workflow.disabled, true, `${plan.destinations.workflow.flow} must not accept an attachment without a proven consumer`)
  assert.equal(plan.recommendation, 'unavailable', 'an unsupported attachment combination must not be presented as recommended')
  assert.equal(plan.destinations.unavailable.disabled, true)
  assert.match(plan.destinations.workflow.explanation, /无法消费|不支持/)
  assert.throws(() => buildHomeIntentCanvas({
    canvas: { nodes: [], edges: [] },
    plan,
    asset: normalizeHomeIntentUploadedAsset({ url: `/public-assets/${file.name}`, mime: file.type }, validateHomeIntentAttachment(file).attachment)
  }), /无法消费/, 'unsupported workflow attachments must not create orphan nodes')
}
assert.throws(() => normalizeHomeIntentUploadedAsset({ url: 'data:image/png;base64,AAAA' }, validateHomeIntentAttachment(imageAttachment).attachment), /公开/)

const assertLatestIntentConfirmationWins = async completionOrder => {
  const confirmUploadDelays = { A: createDeferred(), B: createDeferred() }
  const confirmedProjects = []
  const confirmedDestinations = []
  const runIntentConfirmation = createLatestNavigationRunner()
  const confirmIntent = intent => runIntentConfirmation(`intent-confirm:${intent}`, async ({ isCurrent, commit }) => {
    await confirmUploadDelays[intent].promise
    if (!isCurrent()) return false
    return commit(() => {
      confirmedProjects.push(intent)
      confirmedDestinations.push(intent)
    })
  })
  const confirmA = confirmIntent('A')
  const confirmB = confirmIntent('B')
  for (const intent of completionOrder) {
    confirmUploadDelays[intent].resolve()
    await Promise.resolve()
  }
  await Promise.all([confirmA, confirmB])
  assert.deepEqual(confirmedProjects, ['B'], 'only the latest confirmation may create a project')
  assert.deepEqual(confirmedDestinations, ['B'], 'only the latest confirmation may navigate')
}
await assertLatestIntentConfirmationWins(['A', 'B'])
await assertLatestIntentConfirmationWins(['B', 'A'])

const urlReplaceDelay = createDeferred()
const shortcutNavigationDelay = createDeferred()
const urlLaunchPendingUpdates = []
let urlLaunchCreateCount = 0
let urlLaunchNavigateCount = 0
let urlLaunchDestination = null
const runUrlLaunchNavigation = createLatestNavigationRunner({
  setPending: (active, intent) => { urlLaunchPendingUpdates.push({ active, intent }) }
})
const staleUrlLaunch = runUrlLaunchNavigation('url-launch:gifEditor', createGuardedUrlLaunchAction({
  replace: () => urlReplaceDelay.promise,
  launch: () => {
    urlLaunchCreateCount += 1
    urlLaunchNavigateCount += 1
    urlLaunchDestination = { url: '/gif-editor', title: '水印与 GIF 素材编辑', form: 'gif' }
  }
}))
const latestShortcut = runUrlLaunchNavigation('studio:resize', async ({ commit }) => {
  await shortcutNavigationDelay.promise
  return commit(() => {
    urlLaunchDestination = { url: '/video-resize', title: '视频尺寸工作台', form: 'resize' }
  })
})
urlReplaceDelay.resolve()
await Promise.resolve()
shortcutNavigationDelay.resolve()
await Promise.all([staleUrlLaunch, latestShortcut])

assert.equal(urlLaunchCreateCount, 0, 'stale URL launch must not create a project after replace resolves')
assert.equal(urlLaunchNavigateCount, 0, 'stale URL launch must not navigate after replace resolves')
assert.deepEqual(urlLaunchDestination, { url: '/video-resize', title: '视频尺寸工作台', form: 'resize' })
assert.deepEqual(urlLaunchPendingUpdates, [
  { active: true, intent: 'url-launch:gifEditor' },
  { active: true, intent: 'studio:resize' },
  { active: false, intent: 'studio:resize' }
], 'stale URL launch must not clear the latest shortcut loading state')

assert.equal(normalizeStudioTab('novel'), 'novel')
// 'assets' tab 已移除（无渲染分支）。存量书签带着 ?tab=assets 进来时必须
// 回落到快速创作，而不是白屏 —— 这比原来断言它是合法值更有价值。
assert.equal(normalizeStudioTab('assets'), 'quick', '已移除的 tab 必须优雅回落')
assert.equal(normalizeStudioTab('unknown'), 'quick')
assert.equal(normalizeStudioTab(['novel']), 'novel')

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const authStore = read('../src/stores/auth.js')
const canvas = read('../src/views/Canvas.vue')
const projectStore = read('../src/stores/projects.js')
const studio = read('../src/views/VideoStudio.vue')
const home = read('../src/views/Home.vue')
const launcher = read('../src/components/home/CreationLauncher.vue')

assert.match(authStore, /hasFreshAuthenticatedSession/)
assert.match(authStore, /sessionRequest/)
assert.match(canvas, /isProjectLoading/)
assert.match(canvas, /projectLoadGate/)
assert.match(canvas, /ensureProjectLoaded\(projectId, \{ activate: false \}\)/)
assert.match(canvas, /activateProject\(projectId\)/)
assert.match(canvas, /正在打开项目/)
assert.match(canvas, /const loadedProjectId = ref\(null\)/)
assert.match(canvas, /loadedProjectId\.value === oldId/)
assert.match(canvas, /clearCanvas\(\)\s+await nextTick\(\)/)
assert.match(projectStore, /export const activateProject/)
assert.match(projectStore, /createProject = \(name = '未命名项目', initialData = \{\}\)/)
assert.match(studio, /computed\(\(\) => normalizeStudioTab\(route\.query\.tab\)\)/)
assert.match(studio, /route\.query\.job/)
assert.match(home, /navigationPending/)
assert.match(home, /createProject\(cleanPrompt \|\| entry\.title, \{/)
assert.match(home, /runNavigation\(`url-launch:\$\{launch\}`, createGuardedUrlLaunchAction\(\{[\s\S]*?replace:\s*\(\) => router\.replace\(\{ path: '\/' \}\),[\s\S]*?launch:\s*\(\) => launchFlow\(launch\)/, 'URL launch must register one guarded token before replace')
assert.doesNotMatch(home, /await router\.replace\(\{ path: '\/' \}\)\s*handleLaunch\(launch\)/, 'URL launch must not create a second token after replace')
// 能力入口从 CreationLauncher 的固定卡片搬到了首页目录（同一个能力原先最多
// 出现在四个地方）。下面两条行为契约跟着搬 —— 它们来自 #34「keep the latest
// home navigation intent」，锁的是「点了一个入口不许锁死其他」和「转圈必须
// 指向最新那次意图」，跟入口长在哪没关系。
const entryCatalogMarkup = home.match(/<div v-for="group in entryGroups"[\s\S]*?<\/button>/)?.[0] || ''
assert.ok(entryCatalogMarkup, '首页必须有能力目录，否则用户没有任何入口')
assert.doesNotMatch(entryCatalogMarkup, /:disabled="navigationPending"/, '有导航在途时不许禁用其他入口，否则点错一个就卡死')
assert.match(
  entryCatalogMarkup,
  /:aria-busy="navigationPending && navigationIntent === /,
  '转圈必须绑定到最新那次导航意图，不能所有入口一起转'
)
// CreationLauncher 不许再挂固定能力卡片 —— 那正是重复的来源之一。
assert.doesNotMatch(launcher, /<div class="creation-grid">/, 'CreationLauncher 是「说需求」的入口，不是能力目录')
assert.doesNotMatch(home, /v-for="entry in studioEntries"[^>]*:disabled="navigationPending"/, 'studio shortcuts must remain selectable while another navigation is pending')

console.log('navigationState.test.mjs passed')
