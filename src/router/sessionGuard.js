/**
 * Session guard | 会话守卫
 *
 * The global `beforeEach` guard awaits a session probe before any route is
 * allowed to render. A backend that hangs — rather than one that errors — would
 * otherwise leave that promise pending forever and freeze the whole SPA on a
 * blank screen with no spinner and no error. Every decision below therefore has
 * to be reachable within a bounded amount of time.
 * 全局前置守卫必须在有限时间内给出结论，否则后端挂起会让整个应用白屏。
 */

/** How long a single navigation may wait for the session probe. | 单次导航等待会话探测的上限 */
export const SESSION_PROBE_TIMEOUT_MS = 8000

/**
 * After a probe has timed out, later navigations answer from cache for this
 * long instead of waiting again — otherwise every click costs another timeout.
 * 探测超时后的冷却期内直接用缓存作答，避免每次导航都再等一个超时。
 */
export const SESSION_PROBE_COOLDOWN_MS = 15000

/** The backend confirmed a signed-in user. | 后端确认已登录 */
export const SESSION_AUTHENTICATED = 'authenticated'
/** The backend answered, and nobody is signed in. | 后端已答复，未登录 */
export const SESSION_ANONYMOUS = 'anonymous'
/** The backend never answered in time. | 后端未在时限内答复 */
export const SESSION_UNKNOWN = 'unknown'

const TIMED_OUT = Symbol('session-probe-timeout')

/**
 * Await `promise`, but give up after `timeoutMs`.
 * The abandoned promise is left running on purpose: the auth store still
 * records its result, so the session self-heals once the backend recovers.
 */
const withDeadline = (promise, timeoutMs, setTimer, clearTimer) => {
  let timer = null
  const deadline = new Promise(resolve => {
    timer = setTimer(() => resolve(TIMED_OUT), timeoutMs)
  })
  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== null) clearTimer(timer)
  })
}

/**
 * Build a bounded session probe.
 *
 * @param {Object} options
 * @param {() => Promise<boolean>} options.refreshSession - the auth store probe
 * @param {() => unknown} options.readCachedUser - last known user, if any
 * @returns {() => Promise<string>} one of the SESSION_* states
 */
export const createSessionProbe = ({
  refreshSession,
  readCachedUser,
  timeoutMs = SESSION_PROBE_TIMEOUT_MS,
  cooldownMs = SESSION_PROBE_COOLDOWN_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = timer => clearTimeout(timer)
} = {}) => {
  let degradedUntil = 0

  /**
   * A probe that could not reach a verdict falls back to what we already know.
   * A user we have already authenticated in this tab stays authenticated: a
   * transient backend hiccup must not masquerade as a sign-out. A user we have
   * never seen stays unknown.
   * 已经登录过的用户不因后端抖动被踢下线；从未确认过的用户保持未知。
   */
  const fromCache = () => (readCachedUser() ? SESSION_AUTHENTICATED : SESSION_UNKNOWN)

  return async () => {
    if (now() < degradedUntil) return fromCache()

    let outcome
    try {
      outcome = await withDeadline(
        Promise.resolve().then(refreshSession),
        timeoutMs,
        setTimer,
        clearTimer
      )
    } catch {
      // The auth store already swallows request errors; this only guards
      // against an unexpected throw so the guard can never reject.
      return SESSION_ANONYMOUS
    }

    if (outcome === TIMED_OUT) {
      degradedUntil = now() + cooldownMs
      return fromCache()
    }

    degradedUntil = 0
    return outcome ? SESSION_AUTHENTICATED : SESSION_ANONYMOUS
  }
}

/**
 * Turn a session state into a vue-router guard verdict.
 *
 * `SESSION_UNKNOWN` is routed to the login screen rather than into the app.
 * Letting an unverified visitor through would drop them on a shell whose every
 * request fails, which reads as "your account is empty" instead of "we cannot
 * reach the server". The login screen is honest, recoverable, and does not end
 * the server-side session, so a reload restores the user once the backend is
 * healthy again. Users already authenticated in this tab never reach this
 * branch — `createSessionProbe` keeps them authenticated from cache.
 * 无法确认会话时跳登录页：这比把用户丢进一个所有请求都失败的空壳更诚实，
 * 且不会真的注销服务端会话，后端恢复后刷新即可回到原状态。
 *
 * @param {string} state - one of the SESSION_* states
 * @param {Object} to - the target route
 * @returns {true|Object} `true` to allow, or a route location to redirect to
 */
export const resolveSessionRoute = (state, to) => {
  const authenticated = state === SESSION_AUTHENTICATED

  if (to?.meta?.public) {
    if (to?.name === 'Login' && authenticated) return { name: 'Home' }
    return true
  }

  if (authenticated) return true
  return { name: 'Login', query: { redirect: to?.fullPath } }
}
