import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { performSignOut, SIGN_OUT_REDIRECT } from '../src/utils/authSession.js'

const readSource = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

// --- pure sign-out contract | 退出登录纯逻辑 ---

const runSignOut = async ({ requestLogout }) => {
  const calls = []
  const result = await performSignOut({
    requestLogout,
    clearLocalSession: () => calls.push('clear'),
    redirect: (target) => {
      calls.push(`redirect:${target.name}`)
    }
  })
  return { calls, result }
}

const happy = await runSignOut({ requestLogout: async () => ({ ok: true }) })
assert.deepEqual(happy.calls, ['clear', 'redirect:Login'])
assert.equal(happy.result.ok, true)
assert.equal(SIGN_OUT_REDIRECT.name, 'Login')

// A dead backend must not trap the user inside an authenticated-looking UI.
const failed = await runSignOut({
  requestLogout: async () => { throw new Error('network down') }
})
assert.deepEqual(
  failed.calls,
  ['clear', 'redirect:Login'],
  '后端退出失败时仍必须清本地状态并跳登录页'
)
assert.equal(failed.result.ok, false)
assert.equal(failed.result.error.message, 'network down')

// --- the entry point must actually exist in the UI | 全站必须真有按钮调用登出 ---
//
// The AccountMenu half of this tail moved to tests/component/authSignOut.spec.mjs, where
// the button is really clicked: it calls logout(), empties `currentUser`, invalidates the
// session cache (proven by the next refreshSession() re-probing), and `replace`s onto
// Login so Back cannot return. That also subsumes the old "some .vue file mentions
// logout" scan — a dead button used to satisfy it.
//
// What is left below is D 类接线 and still waits for batch 5: mounting both shells.

// Canvas uses AppHeader, Home/Tasks/Recent use WorkspaceShell: both shells need the entry.
for (const shell of ['src/components/AppHeader.vue', 'src/components/workspace/WorkspaceShell.vue']) {
  const source = readSource(shell)
  assert.match(source, /<AccountMenu \/>/, `${shell} 必须挂载登出入口`)
  assert.match(source, /import AccountMenu from/, `${shell} 必须导入 AccountMenu`)
}

console.log('authSignOut.test.mjs passed')
