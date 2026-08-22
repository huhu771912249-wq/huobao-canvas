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
//
// 超时那一段搬到 tests/component/sessionGuard.spec.mjs：默认超时是从真正发出去的请求上量
// 到的（证明常量确实交给了 axios.create），五个长任务接口的逐请求覆盖也是量出来的，并且
// 多了一条老断言够不到的 —— 长超时不得泄漏到实例上影响下一个普通请求。

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
//    D 类接线，留到 batch 5：真断言要把 src/router/index.js 整个路由（含全部懒加载视图）
//    驱动起来跑一次导航，成本远超本批。
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
