import assert from 'node:assert/strict'

const storage = new Map()
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}
const reportedErrors = []
// The store logs the outage on purpose; keep it out of the CI transcript.
// 故障日志是刻意保留的行为，这里只是不让它污染 CI 输出。
console.error = () => {}
globalThis.localStorage = localStorage
globalThis.window = {
  localStorage,
  location: { origin: 'https://canvas.test' },
  $message: { error: message => reportedErrors.push(message) }
}

// The backend is down for the first bootstrap and healthy for the second.
// 第一次启动时后端故障，第二次恢复。
let listCalls = 0
let backendDown = true
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url)
  if (parsed.pathname === '/v1/projects' && !options.method) {
    listCalls += 1
    if (backendDown) throw new TypeError('Failed to fetch')
    return Response.json({
      projects: [{
        id: 'project_remote_1',
        name: '线上项目',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z'
      }],
      total: 1
    })
  }
  throw new Error(`unexpected request: ${options.method || 'get'} ${parsed.pathname}`)
}

const { initProjectsStore, projects } = await import('../src/stores/projects.js')

const first = await initProjectsStore()
assert.equal(listCalls, 1)
assert.deepEqual(first, [], '后端故障时暂时没有项目')
assert.ok(reportedErrors.length > 0, '失败必须被上报，不能静默')

// Before the fix the failed bootstrap was memoized forever: the second call
// resolved from cache, never re-hit the backend, and the home screen kept
// claiming the account was empty until a full page reload.
// 修复前失败结果被永久缓存，第二次调用直接返回缓存的空列表，首页会一直显示"暂无项目"。
const second = initProjectsStore()
assert.equal(listCalls, 2, '失败之后再次调用必须真正重试，而不是返回被缓存的空结果')
await second

// 3. Once the backend recovers, the store must actually fill up.
//    后端恢复后，store 必须真的加载出项目。
backendDown = false
await initProjectsStore()
assert.equal(listCalls, 3)
assert.equal(projects.value.length, 1)
assert.equal(projects.value[0].id, 'project_remote_1')

// 4. A successful bootstrap stays memoized — retrying is only for failures.
//    成功结果仍然被缓存，重试只针对失败。
await initProjectsStore()
assert.equal(listCalls, 3, '成功之后不应重复拉取')

console.log('projectsStoreRetry.test.mjs passed')
