/**
 * Sign-out orchestration | 退出登录流程
 *
 * Pure helper so the "clear local session + leave for the login page" contract can be
 * tested without a browser. The backend call is best effort on purpose: if `/auth/logout`
 * is unreachable the user must still end up logged out locally instead of being trapped
 * in a UI that only looks authenticated.
 */

export const SIGN_OUT_REDIRECT = Object.freeze({ name: 'Login' })

export const performSignOut = async ({
  requestLogout,
  clearLocalSession,
  redirect
} = {}) => {
  let error = null

  try {
    await requestLogout?.()
  } catch (requestError) {
    error = requestError || new Error('退出登录请求失败')
  }

  clearLocalSession?.()
  await redirect?.(SIGN_OUT_REDIRECT)

  return { ok: !error, error }
}
