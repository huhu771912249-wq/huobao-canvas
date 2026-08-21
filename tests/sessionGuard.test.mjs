import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SESSION_ANONYMOUS,
  SESSION_AUTHENTICATED,
  SESSION_PROBE_COOLDOWN_MS,
  SESSION_PROBE_TIMEOUT_MS,
  SESSION_UNKNOWN,
  createSessionProbe,
  resolveSessionRoute
} from '../src/router/sessionGuard.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

// A hung backend must not be able to freeze navigation for hours.
// 后端挂起不能让导航冻结数小时。
const requestSource = read('../src/utils/request.js')
const defaultTimeout = Number(requestSource.match(/DEFAULT_REQUEST_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])
assert.ok(Number.isFinite(defaultTimeout), 'request.js must name its default timeout')
assert.ok(defaultTimeout >= 30000, `默认超时 ${defaultTimeout}ms 过短，会误伤正常请求`)
assert.ok(defaultTimeout <= 300000, `默认超时 ${defaultTimeout}ms 过长，后端挂起时界面会长时间无响应`)
assert.match(requestSource, /timeout:\s*DEFAULT_REQUEST_TIMEOUT_MS/)
assert.doesNotMatch(requestSource, /timeout:\s*30000000/, '默认超时不得回退成 8 小时量级的巨值')

// Calls that legitimately run long must keep their own per-request override.
// 确实耗时的调用必须保留各自的超时覆盖。
for (const [path, expected] of [
  ['../src/api/materialInput.js', /timeout:\s*15 \* 60 \* 1000/],
  ['../src/api/mediaComposition.js', /timeout:\s*15 \* 60 \* 1000/],
  ['../src/api/videoTextOverlay.js', /timeout:\s*15 \* 60 \* 1000/],
  ['../src/api/gifEditor.js', /timeout:\s*15 \* 60 \* 1000/],
  ['../src/api/studioDocument.js', /timeout:\s*120000/]
]) {
  assert.match(read(path), expected, `${path} 必须保留自己的长超时覆盖`)
}

assert.ok(SESSION_PROBE_TIMEOUT_MS > 0 && SESSION_PROBE_TIMEOUT_MS <= 15000)
assert.ok(SESSION_PROBE_COOLDOWN_MS > 0)

const createClock = () => {
  let current = 0
  const timers = []
  return {
    now: () => current,
    setTimer: (fn, ms) => {
      const timer = { fn, at: current + ms, cancelled: false }
      timers.push(timer)
      return timer
    },
    clearTimer: timer => { timer.cancelled = true },
    advance: async ms => {
      current += ms
      for (const timer of [...timers]) {
        if (!timer.cancelled && timer.at <= current) {
          timer.cancelled = true
          timer.fn()
        }
      }
      await Promise.resolve()
      await Promise.resolve()
    }
  }
}

// 1. A backend that answers is still trusted verbatim. | 后端正常应答时结论不变。
{
  const clock = createClock()
  const probe = createSessionProbe({
    refreshSession: async () => true,
    readCachedUser: () => null,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })
  assert.equal(await probe(), SESSION_AUTHENTICATED)
}
{
  const clock = createClock()
  const probe = createSessionProbe({
    refreshSession: async () => false,
    readCachedUser: () => null,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })
  assert.equal(await probe(), SESSION_ANONYMOUS)
}

// 2. A session probe that never resolves must still settle. | 永不 resolve 的探测必须有结论。
{
  const clock = createClock()
  let probeCalls = 0
  const probe = createSessionProbe({
    refreshSession: () => {
      probeCalls += 1
      return new Promise(() => {})
    },
    readCachedUser: () => null,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })

  const pending = probe()
  let settled = false
  pending.then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false, '超时前不应有结论')

  await clock.advance(SESSION_PROBE_TIMEOUT_MS)
  assert.equal(await pending, SESSION_UNKNOWN, '后端挂起时必须在时限内给出"未知"，而不是永远挂起')

  // The cooldown keeps later navigations instant instead of costing another
  // full timeout each. | 冷却期内后续导航立即作答，不再各等一个超时。
  assert.equal(await probe(), SESSION_UNKNOWN)
  assert.equal(probeCalls, 1, '冷却期内不应重复发起探测')

  await clock.advance(SESSION_PROBE_COOLDOWN_MS)
  probe()
  await Promise.resolve()
  assert.equal(probeCalls, 2, '冷却期结束后必须重新探测')
}

// 3. A blip must not sign out a user we already authenticated in this tab.
//    后端抖动不得把已登录用户变成登出。
{
  const clock = createClock()
  const probe = createSessionProbe({
    refreshSession: () => new Promise(() => {}),
    readCachedUser: () => ({ username: 'gx' }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })
  const pending = probe()
  await clock.advance(SESSION_PROBE_TIMEOUT_MS)
  assert.equal(await pending, SESSION_AUTHENTICATED)
}

// 4. A probe that throws must not reject the guard. | 探测抛错不能让守卫 reject。
{
  const clock = createClock()
  const probe = createSessionProbe({
    refreshSession: () => { throw new Error('boom') },
    readCachedUser: () => null,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })
  assert.equal(await probe(), SESSION_ANONYMOUS)
}

// 5. Route verdicts. | 路由结论。
const home = { name: 'Home', fullPath: '/', meta: {} }
const login = { name: 'Login', fullPath: '/login', meta: { public: true } }

assert.equal(resolveSessionRoute(SESSION_AUTHENTICATED, home), true)
assert.deepEqual(resolveSessionRoute(SESSION_ANONYMOUS, home), { name: 'Login', query: { redirect: '/' } })
assert.deepEqual(
  resolveSessionRoute(SESSION_UNKNOWN, home),
  { name: 'Login', query: { redirect: '/' } },
  '无法确认会话时必须跳登录页，而不是把用户丢进一个所有请求都失败的空壳'
)
assert.deepEqual(resolveSessionRoute(SESSION_AUTHENTICATED, login), { name: 'Home' })
assert.equal(resolveSessionRoute(SESSION_ANONYMOUS, login), true)
assert.equal(resolveSessionRoute(SESSION_UNKNOWN, login), true, '登录页必须始终可达，否则用户无法自救')

// 6. The router actually uses the bounded probe. | 路由确实接上了有界探测。
const routerSource = read('../src/router/index.js')
assert.match(routerSource, /createSessionProbe/)
assert.match(routerSource, /resolveSessionRoute/)
assert.match(routerSource, /readCachedUser:\s*\(\)\s*=>\s*currentUser\.value/)
assert.doesNotMatch(
  routerSource,
  /const authenticated = await refreshSession\(\)/,
  '守卫不得再直接 await 一个无上限的会话请求'
)

console.log('sessionGuard.test.mjs passed')
