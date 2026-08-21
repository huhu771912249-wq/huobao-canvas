import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
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

const componentFiles = readdirSync(new URL('../src', import.meta.url), { recursive: true })
  .map((entry) => String(entry).replaceAll('\\', '/'))
  .filter((entry) => entry.endsWith('.vue'))
const componentsCallingLogout = componentFiles.filter(
  (file) => /\blogout\b/.test(readSource(`src/${file}`))
)
assert.ok(
  componentsCallingLogout.length > 0,
  'src/api/auth.js 的 logout() 必须至少被一个界面组件调用，否则用户无法登出'
)

const accountMenu = readSource('src/components/AccountMenu.vue')
assert.match(accountMenu, /import \{ logout \} from '\.\.\/api\/auth'/)
assert.match(accountMenu, /performSignOut/)
assert.match(accountMenu, /markSessionAuthenticated\(null\)/, '登出必须清掉本地会话用户')
assert.match(accountMenu, /invalidateSessionCache\(\)/, '登出必须让路由守卫的会话缓存失效')
assert.match(accountMenu, /router\.replace\(target\)/, '登出必须跳到登录页且不留历史记录')
assert.match(accountMenu, /退出登录/)

// Canvas uses AppHeader, Home/Tasks/Recent use WorkspaceShell: both shells need the entry.
for (const shell of ['src/components/AppHeader.vue', 'src/components/workspace/WorkspaceShell.vue']) {
  const source = readSource(shell)
  assert.match(source, /<AccountMenu \/>/, `${shell} 必须挂载登出入口`)
  assert.match(source, /import AccountMenu from/, `${shell} 必须导入 AccountMenu`)
}

console.log('authSignOut.test.mjs passed')
