import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchServiceHealth } from '../src/api/health.js'
import {
  SERVICE_QUEUE_BUSY_THRESHOLD,
  normalizeServiceHealth,
  summarizeServiceHealth
} from '../src/utils/serviceHealth.js'

const readSource = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const healthyPayload = {
  ok: true,
  chat_workers: 2,
  image_workers: 1,
  video_workers: 1,
  chat_queue: 0,
  image_queue: 0,
  video_queue: 0,
  video_resize_queue: -1,
  variation_queue: -1
}

// --- normalization | 归一化 ---

assert.deepEqual(normalizeServiceHealth(healthyPayload), { ok: true, queue: 0, workers: 4 })
assert.deepEqual(
  normalizeServiceHealth({ ok: true, video_queue: 5, image_queue: 2, chat_workers: 1 }),
  { ok: true, queue: 7, workers: 1 },
  '队列深度是所有执行器等待数之和'
)
assert.deepEqual(normalizeServiceHealth(null), { ok: false, queue: 0, workers: 0 })

// --- the actual bug: a dead backend must never read as "服务已连接" | 后端挂了不能报已连接 ---

assert.deepEqual(
  summarizeServiceHealth({ error: 'fetch failed', checkedAt: 1 }),
  { label: '服务离线', tone: 'danger' }
)
assert.deepEqual(
  summarizeServiceHealth({ health: { ok: false }, checkedAt: 1 }),
  { label: '服务异常', tone: 'danger' }
)
assert.deepEqual(
  summarizeServiceHealth({ health: null, checkedAt: 1 }),
  { label: '服务异常', tone: 'danger' }
)
assert.deepEqual(
  summarizeServiceHealth({}),
  { label: '正在检测服务', tone: 'warning' },
  '首次探测返回前不得预先宣称已连接'
)
assert.deepEqual(
  summarizeServiceHealth({ health: { ...healthyPayload, video_workers: 0, chat_workers: 0, image_workers: 0 }, checkedAt: 1 }),
  { label: '服务无可用工作线程', tone: 'warning' }
)
assert.deepEqual(
  summarizeServiceHealth({
    health: { ...healthyPayload, video_queue: SERVICE_QUEUE_BUSY_THRESHOLD },
    checkedAt: 1
  }),
  { label: `服务排队 ${SERVICE_QUEUE_BUSY_THRESHOLD}`, tone: 'warning' }
)
assert.deepEqual(
  summarizeServiceHealth({ health: healthyPayload, checkedAt: 1 }),
  { label: '服务已连接', tone: 'success' }
)

// --- transport | 请求 ---

const requested = []
const probed = await fetchServiceHealth({
  fetchImpl: async (url, options) => {
    requested.push(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.credentials, 'include')
    return { ok: true, json: async () => healthyPayload }
  }
})
assert.deepEqual(probed, healthyPayload)
assert.match(requested[0], /\/health$/)

await assert.rejects(
  fetchServiceHealth({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
  /503/
)

// --- wiring | 页面接线 ---

const store = readSource('src/stores/serviceHealth.js')
const taskCenter = readSource('src/views/TaskCenter.vue')
const recent = readSource('src/views/RecentGenerations.vue')

for (const [name, source] of [['TaskCenter.vue', taskCenter], ['RecentGenerations.vue', recent]]) {
  assert.doesNotMatch(
    source,
    /const serviceStatus = \{/,
    `${name} 不得再硬编码服务状态`
  )
  assert.match(source, /useServiceStatus\(\)/, `${name} 必须使用真实探测`)
  assert.doesNotMatch(
    source,
    /setInterval/,
    `${name} 不得自建轮询循环，必须复用共享探测`
  )
}

// One shared, reference-counted loop for the whole app — not a new per-view interval.
assert.equal(
  (store.match(/window\.setInterval\(/g) || []).length,
  1,
  '服务健康探测只允许存在一个共享定时器'
)
assert.match(store, /subscribers \+= 1/)
assert.match(store, /document\.hidden/, '标签页隐藏时不应继续探测')

console.log('serviceHealth.test.mjs passed')
