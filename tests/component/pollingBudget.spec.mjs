/**
 * Takes over the `useApi.js` grep tail of tests/pollingBudget.test.mjs.
 *
 * The pure half of that file — `createPollingBudget` driven by a fake clock — was already
 * a real test and stays put. The tail read src/hooks/useApi.js as text:
 *
 *   grep                                        | behaviour asserted here
 *   --------------------------------------------|--------------------------------------
 *   no `while (true)`                            | a backend that answers "running"
 *                                                |   forever still terminates the loop
 *                                                |   with POLLING_BUDGET_EXHAUSTED
 *   `createPollingBudget({ label: '视频任务' })`  | that error names 视频任务 and points at
 *                                                |   the 任务中心, and is not terminal
 *   `const attempt = budget.nextAttempt()`       | onProgress receives 1, 2, 3 … so a node
 *                                                |   can show which poll it is on
 *   `budget.markNotReady()` inside the 404 branch| a task the backend can never find stops
 *                                                |   being retried instead of `continue`ing
 *                                                |   forever, and a *transient* 404 right
 *                                                |   after creation is still forgiven
 *
 * `doesNotMatch(/while (true)/)` was the weakest of the four: `for (;;)` — which is what
 * the code actually uses — passes it too. What matters is that the loop stops, which is
 * what this file measures.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

const getVideoTaskStatus = vi.fn()
vi.mock('@/api', () => ({
  getVideoTaskStatus: (...args) => getVideoTaskStatus(...args),
  createVideoTask: vi.fn(),
  cancelVideoTask: vi.fn(),
  generateImage: vi.fn(),
  streamChatCompletions: vi.fn()
}))

const { useVideoGeneration } = await import('../../src/hooks/useApi.js')
const {
  POLL_MAX_ATTEMPTS,
  POLL_MAX_NOT_READY_ATTEMPTS
} = await import('../../src/utils/pollingBudget.js')

const POLL_INTERVAL_MS = 5000

const notFound = () => Object.assign(new Error('task not found'), { response: { status: 404 } })

const mountVideoGeneration = () => {
  let api = null
  const wrapper = mount(defineComponent({
    setup () {
      api = useVideoGeneration()
      return () => null
    }
  }), { attachTo: document.body })
  return { api, wrapper }
}

/** Run the loop to completion under fake timers and hand back the outcome. */
const drain = async (promise, maxMs) => {
  const settled = promise.then(value => ({ value }), error => ({ error }))
  await vi.advanceTimersByTimeAsync(maxMs)
  return settled
}

describe('video task polling budget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    getVideoTaskStatus.mockReset()
  })

  it('stops retrying a task the backend can never find', async () => {
    getVideoTaskStatus.mockRejectedValue(notFound())
    const { api, wrapper } = mountVideoGeneration()

    const { error } = await drain(
      api.pollVideoTask('lost-task'),
      (POLL_MAX_NOT_READY_ATTEMPTS + 2) * POLL_INTERVAL_MS
    )

    expect(error, '任务永远查不到时必须抛错，而不是无限 continue').toBeTruthy()
    expect(error.code).toBe('POLLING_BUDGET_EXHAUSTED')
    expect(error.pollingBudgetReason).toBe('not_found')
    expect(error.videoTaskTerminal, '预算耗尽不代表任务已失败').toBe(false)
    expect(error.message).toMatch(/任务可能已丢失/)
    expect(getVideoTaskStatus).toHaveBeenCalledTimes(POLL_MAX_NOT_READY_ATTEMPTS + 1)

    vi.useRealTimers()
    wrapper.unmount()
  })

  it('forgives the transient 404 a freshly created task returns', async () => {
    getVideoTaskStatus
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ status: 'running' })
      .mockRejectedValueOnce(notFound())
      .mockResolvedValue({ status: 'completed', url: 'https://example.com/a.mp4' })
    const { api, wrapper } = mountVideoGeneration()

    const { value, error } = await drain(api.pollVideoTask('slow-task'), 10 * POLL_INTERVAL_MS)

    expect(error).toBeUndefined()
    expect(
      value?.url,
      '任务恢复可见后 404 计数必须清零，否则偶发 404 会累积成假的「任务丢失」'
    ).toBe('https://example.com/a.mp4')

    vi.useRealTimers()
    wrapper.unmount()
  })

  it('terminates even when the backend keeps answering "running" forever', async () => {
    getVideoTaskStatus.mockResolvedValue({ status: 'running' })
    const { api, wrapper } = mountVideoGeneration()

    const { error } = await drain(
      api.pollVideoTask('endless-task'),
      (POLL_MAX_ATTEMPTS + 2) * POLL_INTERVAL_MS
    )

    expect(error, '一个永不结束的任务必须最终报出可读错误，而不是让节点一直转圈').toBeTruthy()
    expect(error.code).toBe('POLLING_BUDGET_EXHAUSTED')
    expect(error.videoTaskTerminal).toBe(false)
    expect(error.message, '错误文案必须说清是哪种任务').toMatch(/视频任务/)
    expect(error.message, '并且告诉用户去哪里找回它').toMatch(/任务中心/)
    expect(getVideoTaskStatus.mock.calls.length).toBeLessThanOrEqual(POLL_MAX_ATTEMPTS)

    vi.useRealTimers()
    wrapper.unmount()
  })

  it('numbers the attempts it hands to the caller', async () => {
    getVideoTaskStatus
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValue({ status: 'completed', url: 'https://example.com/a.mp4' })
    const { api, wrapper } = mountVideoGeneration()

    const attempts = []
    await drain(
      api.pollVideoTask('numbered-task', attempt => attempts.push(attempt)),
      5 * POLL_INTERVAL_MS
    )

    expect(attempts, '轮询次数必须从 1 开始逐次递增').toEqual([1, 2, 3])

    vi.useRealTimers()
    wrapper.unmount()
  })
})
