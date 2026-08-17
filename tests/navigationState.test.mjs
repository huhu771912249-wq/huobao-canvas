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

const uploadedGif = normalizeHomeIntentUploadedAsset({
  url: '/public-assets/material-input-a.gif',
  mime: 'image/gif',
  name: 'campaign.gif',
  asset_name: 'material-input-a.gif',
  width: 320,
  height: 180,
  bytes: 1024
}, validateHomeIntentAttachment(gifAttachment).attachment)
const intentCanvas = buildHomeIntentCanvas({
  canvas: {
    nodes: [{ id: 'watermark-editor', type: 'watermarkEditor', position: { x: 160, y: 100 }, data: { label: '水印与素材编辑' } }],
    edges: [],
    viewport: { x: 100, y: 80, zoom: 0.8 }
  },
  plan: watermarkPlan,
  asset: uploadedGif
})
assert.equal(intentCanvas.nodes[0].type, 'materialInput')
assert.equal(intentCanvas.nodes[0].data.url, '/public-assets/material-input-a.gif')
assert.equal(intentCanvas.edges[0].target, 'watermark-editor')
const persistedIntentCanvas = JSON.stringify(intentCanvas)
assert.doesNotMatch(persistedIntentCanvas, /data:|blob:|source_base64|base64/i, 'workflow project JSON must contain only published asset metadata')
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
assert.equal(normalizeStudioTab('assets'), 'assets')
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
const creationCardMarkup = launcher.match(/<div class="creation-grid">[\s\S]*?<\/div>\s*<div class="suggestion-row">/)?.[0] || ''
assert.ok(creationCardMarkup, 'launcher must expose creation shortcuts')
assert.doesNotMatch(creationCardMarkup, /:disabled="busy"/, 'pending navigation must not disable switching to another shortcut')
assert.match(creationCardMarkup, /:aria-busy="busy && pendingEntry === entry\.id"/, 'shortcut loading must identify the latest intent')
assert.doesNotMatch(home, /v-for="entry in studioEntries"[^>]*:disabled="navigationPending"/, 'studio shortcuts must remain selectable while another navigation is pending')

console.log('navigationState.test.mjs passed')
