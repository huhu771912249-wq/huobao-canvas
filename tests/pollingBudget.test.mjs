import assert from 'node:assert/strict'
import {
  POLL_MAX_ATTEMPTS,
  POLL_MAX_NOT_READY_ATTEMPTS,
  POLL_TIMEOUT_MS,
  createPollingBudget
} from '../src/utils/pollingBudget.js'

// The bound exists to catch runaway loops, not to cut short long renders.
// 上限用于兜住失控循环，而不是限制正常的长时间渲染。
assert.ok(POLL_TIMEOUT_MS >= 60 * 60 * 1000, `${POLL_TIMEOUT_MS}ms 太短，会中断合法的长视频任务`)
assert.ok(POLL_MAX_ATTEMPTS * 5000 >= 60 * 60 * 1000, '按 5 秒间隔，次数上限至少要覆盖一小时')
assert.ok(Number.isFinite(POLL_TIMEOUT_MS) && Number.isFinite(POLL_MAX_ATTEMPTS))

const createClock = () => {
  let current = 0
  return { now: () => current, advance: ms => { current += ms } }
}

// 1. Normal polling is untouched. | 正常轮询不受影响。
{
  const budget = createPollingBudget({ maxAttempts: 5, timeoutMs: 1000, now: () => 0 })
  assert.equal(budget.nextAttempt(), 1)
  assert.equal(budget.nextAttempt(), 2)
  assert.equal(budget.attempts, 2)
}

// 2. The attempt ceiling terminates the loop with a readable error.
//    次数上限必须让循环终止并抛出可读错误。
{
  const budget = createPollingBudget({ label: '视频任务', maxAttempts: 3, timeoutMs: 1e9, now: () => 0 })
  budget.nextAttempt()
  budget.nextAttempt()
  budget.nextAttempt()
  assert.throws(() => budget.nextAttempt(), error => {
    assert.equal(error.code, 'POLLING_BUDGET_EXHAUSTED')
    assert.equal(error.pollingBudgetReason, 'attempts')
    assert.equal(error.videoTaskTerminal, false, '预算耗尽不代表任务已失败')
    assert.match(error.message, /视频任务/)
    assert.match(error.message, /任务中心/)
    return true
  })
}

// 3. The wall-clock ceiling terminates a loop that polls faster than expected.
//    墙钟上限兜住轮询过快的情况。
{
  const clock = createClock()
  const budget = createPollingBudget({ maxAttempts: 1e9, timeoutMs: 60000, now: clock.now })
  budget.nextAttempt()
  clock.advance(60000)
  assert.throws(() => budget.nextAttempt(), error => {
    assert.equal(error.pollingBudgetReason, 'timeout')
    assert.match(error.message, /分钟/)
    return true
  })
}

// 4. A task the backend can never find must stop being retried forever.
//    后端永远查不到的任务不能被无限重试。
{
  const budget = createPollingBudget({ maxNotReadyAttempts: 3, now: () => 0 })
  assert.equal(budget.markNotReady(), 1)
  assert.equal(budget.markNotReady(), 2)
  assert.equal(budget.markNotReady(), 3)
  assert.throws(() => budget.markNotReady(), error => {
    assert.equal(error.pollingBudgetReason, 'not_found')
    assert.match(error.message, /任务可能已丢失/)
    return true
  })
}

// 5. A transient 404 right after task creation is forgiven once the task shows up.
//    任务刚创建时的短暂 404 在任务出现后应被清零。
{
  const budget = createPollingBudget({ maxNotReadyAttempts: 2, now: () => 0 })
  budget.markNotReady()
  budget.markNotReady()
  budget.markReady()
  assert.equal(budget.notReadyAttempts, 0)
  assert.equal(budget.markNotReady(), 1, '任务恢复可见后，404 计数必须重新开始')
}

assert.ok(POLL_MAX_NOT_READY_ATTEMPTS >= 12, '至少要容忍一分钟左右的任务可见性延迟')

// 6. useApi actually spends the budget on every poll and every 404 retry.
//    useApi 必须在每次轮询和每次 404 重试上都消耗预算。
//
// Moved to tests/component/pollingBudget.spec.mjs: `pollVideoTask` is driven for real
// against a stubbed backend, so "a task that is never found stops being retried", "a
// transient 404 is forgiven", "an endless 'running' still terminates" and "attempts are
// numbered from 1" are asserted as outcomes. The old `doesNotMatch(/while (true)/)` was
// the weakest of the four — the production loop is `for (;;)`, which passed it anyway.

console.log('pollingBudget.test.mjs passed')
