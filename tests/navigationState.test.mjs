import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTH_SESSION_CACHE_MS,
  createLatestNavigationRunner,
  createLatestRequestGate,
  hasFreshAuthenticatedSession,
  normalizeStudioTab
} from '../src/utils/navigationState.js'

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
const creationCardMarkup = launcher.match(/<div class="creation-grid">[\s\S]*?<\/div>\s*<div class="suggestion-row">/)?.[0] || ''
assert.ok(creationCardMarkup, 'launcher must expose creation shortcuts')
assert.doesNotMatch(creationCardMarkup, /:disabled="busy"/, 'pending navigation must not disable switching to another shortcut')
assert.match(creationCardMarkup, /:aria-busy="busy && pendingEntry === entry\.id"/, 'shortcut loading must identify the latest intent')
assert.doesNotMatch(home, /v-for="entry in studioEntries"[^>]*:disabled="navigationPending"/, 'studio shortcuts must remain selectable while another navigation is pending')

console.log('navigationState.test.mjs passed')
