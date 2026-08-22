/**
 * Takes over the AccountMenu grep tail of tests/authSignOut.test.mjs.
 *
 * The pure half of that file — `performSignOut` against fake collaborators — was already a
 * real test and stays put. The tail read src/components/AccountMenu.vue as text:
 *
 *   grep                                        | behaviour asserted here
 *   --------------------------------------------|--------------------------------------
 *   at least one .vue file mentions `logout`     | clicking the button really calls
 *                                                |   `logout()` from src/api/auth
 *   `import { logout } from '../api/auth'`       | (same — and that it is *this* button)
 *   `performSignOut`                             | a failing backend still logs the user
 *                                                |   out locally and still redirects
 *   `markSessionAuthenticated(null)`             | `currentUser` is empty afterwards, and
 *                                                |   the next `refreshSession()` re-probes
 *                                                |   the backend instead of trusting the
 *                                                |   cached "authenticated" verdict
 *   `invalidateSessionCache()`                   | (E 类,不等价保留 — see below)
 *   `router.replace(target)`                     | lands on Login *and* leaves no history
 *                                                |   entry to go back to
 *   `退出登录`                                    | the button renders that label
 *
 * The greps could not tell a wired-up button from a dead one — that is the failure this
 * file adds.
 *
 * `invalidateSessionCache()` is a redundant call: `markSessionAuthenticated(null)` already
 * sets `lastSessionCheckedAt = 0` (src/stores/auth.js), which is the only thing
 * `invalidateSessionCache()` does. Deleting the line changes no observable behaviour —
 * measured, not assumed: with the call removed every assertion in this file still passes.
 * So it is not restated as "the source must contain this call". What the two calls exist
 * *for* is asserted instead: after sign-out the guard must re-probe the backend. The two
 * are redundant with each other, so removing either one alone keeps that green; removing
 * both — or removing `markSessionAuthenticated(null)`, which also leaves `currentUser`
 * populated — turns it red.
 *
 * Still grep'd in tests/authSignOut.test.mjs (D 类接线, batch 5): AppHeader.vue and
 * WorkspaceShell.vue must mount `<AccountMenu />`. Proving that for real means mounting
 * both shells.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { h } from 'vue'

const logout = vi.fn()
const session = vi.fn()
vi.mock('@/api/auth', () => ({
  logout: (...args) => logout(...args),
  session: (...args) => session(...args),
  login: vi.fn()
}))

const { default: AccountMenu } = await import('../../src/components/AccountMenu.vue')
const {
  currentUser,
  markSessionAuthenticated,
  refreshSession
} = await import('../../src/stores/auth.js')

const Blank = { render: () => h('div') }

const mountAccountMenu = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: Blank },
      { path: '/login', name: 'Login', component: Blank, meta: { public: true } }
    ]
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AccountMenu, {
    attachTo: document.body,
    global: { plugins: [router, createPinia()] }
  })
  return { wrapper, router }
}

const signOutButton = () => document.querySelector('[data-testid="sign-out-action"]')

describe('AccountMenu sign-out', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    logout.mockReset()
    logout.mockResolvedValue({ ok: true })
    session.mockReset()
    session.mockResolvedValue({ authenticated: true, user: 'gx' })
    markSessionAuthenticated(null)
  })

  it('renders a labelled sign-out entry', async () => {
    const { wrapper } = await mountAccountMenu()
    expect(signOutButton(), 'the app needs a sign-out control the user can find').toBeTruthy()
    expect(signOutButton().textContent).toContain('退出登录')
    wrapper.unmount()
  })

  it('calls the backend, clears the local session and lands on the login page', async () => {
    markSessionAuthenticated('gx')
    const { wrapper, router } = await mountAccountMenu()

    signOutButton().click()
    await flushPromises()

    expect(logout, 'the button must actually hit /auth/logout').toHaveBeenCalledTimes(1)
    expect(currentUser.value, 'the local session user must be dropped').toBeNull()
    expect(router.currentRoute.value.name).toBe('Login')
    wrapper.unmount()
  })

  it('replaces the history entry so Back cannot return to the authenticated view', async () => {
    markSessionAuthenticated('gx')
    const { wrapper, router } = await mountAccountMenu()

    signOutButton().click()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('Login')

    router.go(-1)
    await flushPromises()
    expect(
      router.currentRoute.value.name,
      'a pushed entry would let Back walk into a view whose every request now 401s'
    ).toBe('Login')
    wrapper.unmount()
  })

  it('makes the next session check re-probe the backend instead of trusting the cache', async () => {
    markSessionAuthenticated('gx')
    expect(await refreshSession()).toBe(true)
    expect(session, 'a fresh cache is allowed to answer without a request').toHaveBeenCalledTimes(0)

    const { wrapper } = await mountAccountMenu()
    signOutButton().click()
    await flushPromises()

    session.mockResolvedValue({ authenticated: false })
    expect(await refreshSession()).toBe(false)
    expect(
      session,
      'sign-out must invalidate the session cache, otherwise the guard keeps waving the user through'
    ).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('still signs the user out locally when the backend refuses', async () => {
    markSessionAuthenticated('gx')
    logout.mockRejectedValue(new Error('network down'))
    const warning = vi.fn()
    window.$message = { warning }

    const { wrapper, router } = await mountAccountMenu()
    signOutButton().click()
    await flushPromises()

    expect(
      currentUser.value,
      'a dead backend must not trap the user inside an authenticated-looking UI'
    ).toBeNull()
    expect(router.currentRoute.value.name).toBe('Login')
    expect(warning, 'the user has to be told the backend never confirmed').toHaveBeenCalledTimes(1)

    delete window.$message
    wrapper.unmount()
  })

  it('ignores a second click while the first sign-out is still running', async () => {
    markSessionAuthenticated('gx')
    let releaseLogout
    logout.mockImplementation(() => new Promise(resolve => { releaseLogout = resolve }))

    const { wrapper } = await mountAccountMenu()
    signOutButton().click()
    await flushPromises()
    signOutButton().click()
    await flushPromises()

    expect(logout, 'a double click must not fire two logout requests').toHaveBeenCalledTimes(1)
    releaseLogout({ ok: true })
    await flushPromises()
    wrapper.unmount()
  })
})
