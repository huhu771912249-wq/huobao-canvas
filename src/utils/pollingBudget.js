/**
 * Polling budget | 轮询预算
 *
 * Task polling loops must always terminate. An unbounded `while (true)` keeps a
 * node spinning forever when the backend loses a task — the user sees a
 * permanent progress indicator and never learns anything went wrong.
 * 轮询必须有终点：任务丢失时无上限的循环会让界面永远转圈且不报错。
 *
 * The bounds are deliberately generous. Long video renders legitimately take
 * far longer than ten minutes, so the budget is a runaway guard, not a
 * deadline for normal work.
 * 上限刻意放宽：长视频渲染本就可能远超十分钟，这是失控保护而非正常耗时上限。
 */

/** Wall-clock ceiling for one polling run. | 单次轮询的墙钟上限 */
export const POLL_TIMEOUT_MS = 2 * 60 * 60 * 1000

/** Attempt ceiling, sized for the 5s video polling interval. | 次数上限，按 5 秒轮询间隔取值 */
export const POLL_MAX_ATTEMPTS = 2000

/**
 * How many consecutive "task not found" answers to tolerate before declaring
 * the task lost. A task id can be briefly unqueryable right after creation,
 * but a task that stays missing is never coming back.
 * 允许连续多少次"任务不存在"：刚创建时短暂查不到是正常的,一直查不到就是真丢了。
 */
export const POLL_MAX_NOT_READY_ATTEMPTS = 60

const minutes = ms => Math.round(ms / 60000)

/**
 * @param {Object} options
 * @param {string} [options.label] - what is being polled, used in error text
 * @returns {Object} budget with `nextAttempt`, `markReady` and `markNotReady`
 */
export const createPollingBudget = ({
  label = '任务',
  maxAttempts = POLL_MAX_ATTEMPTS,
  timeoutMs = POLL_TIMEOUT_MS,
  maxNotReadyAttempts = POLL_MAX_NOT_READY_ATTEMPTS,
  now = () => Date.now()
} = {}) => {
  const startedAt = now()
  let attempts = 0
  let notReadyAttempts = 0

  // The task may well still be running on the backend, so these errors are not
  // terminal: callers keep the task id so the user can check on it later.
  // 预算耗尽不代表任务失败,调用方应保留 taskId 供用户稍后查看。
  const exhausted = (reason, message) => Object.assign(new Error(message), {
    code: 'POLLING_BUDGET_EXHAUSTED',
    pollingBudgetReason: reason,
    videoTaskTerminal: false
  })

  return {
    get attempts() {
      return attempts
    },
    get notReadyAttempts() {
      return notReadyAttempts
    },
    elapsed: () => now() - startedAt,

    /** Claim one more poll, or throw once the budget is spent. | 申请下一次轮询,超限则抛错 */
    nextAttempt() {
      if (attempts >= maxAttempts) {
        throw exhausted('attempts', `${label}状态查询已达 ${maxAttempts} 次上限，任务可能仍在后台运行，请稍后在任务中心查看`)
      }
      if (now() - startedAt >= timeoutMs) {
        throw exhausted('timeout', `${label}状态查询已超过 ${minutes(timeoutMs)} 分钟仍无结果，任务可能仍在后台运行，请稍后在任务中心查看`)
      }
      attempts += 1
      return attempts
    },

    /** The backend answered about this task. | 后端已能查到该任务 */
    markReady() {
      notReadyAttempts = 0
    },

    /** The backend says it has never heard of this task. | 后端查不到该任务 */
    markNotReady() {
      notReadyAttempts += 1
      if (notReadyAttempts > maxNotReadyAttempts) {
        throw exhausted('not_found', `${label}连续 ${maxNotReadyAttempts} 次查询不到，任务可能已丢失，请重新发起`)
      }
      return notReadyAttempts
    }
  }
}
