import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTH_SESSION_CACHE_MS,
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
assert.match(launcher, /:disabled="busy"/)

console.log('navigationState.test.mjs passed')
