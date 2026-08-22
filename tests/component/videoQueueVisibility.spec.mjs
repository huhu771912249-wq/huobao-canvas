/**
 * Takes over part of the wiring tail of tests/videoQueueVisibility.test.mjs.
 *
 * That file's pure half — `readComputeQueueSnapshot`, `readVideoTaskQueueState`, the
 * formatters, `describeVideoNodeTask`, `readCancelOutcome` — was already a real test and
 * stays put, **including the field-name reverse locks**. Those are not implementation
 * detail: reading `video_queue` (the HTTP submission pool) or `queues.total_waiting` (the
 * sum of every pool) instead of `video_quality_*` is the bug that nearly shipped, and the
 * source-level locks are what stop it coming back through a *different* code path than
 * the one the pure tests drive. They are kept verbatim.
 *
 * What moved here:
 *
 *   grep                                        | behaviour asserted here
 *   --------------------------------------------|--------------------------------------
 *   api/video.js `export const cancelVideoTask`  | cancelling POSTs to
 *   api/video.js `buildVideoTaskCancelUrl`       |   `<endpoint>/<id>/cancel` with the id
 *   api/video.js `method: 'post'`                |   percent-encoded
 *   useApi.js `cancelVideoTask`                  | useVideoGeneration exposes cancel …
 *   useApi.js `getVideoTaskEndpoint()`           |   … and sends it to the same provider
 *                                                |   endpoint the status poll uses
 *   useApi.js `readVideoTaskQueueState`          | queue_position / eta_seconds /
 *                                                |   eta_completion_seconds / segments
 *                                                |   ride back to the node on every poll
 *   useApi.js `options?.signal`                  | cancelling aborts the poll immediately
 *                                                |   instead of spinning one more 5s wait
 *   Indicator `data-testid="compute-queue-badge"`| the top bar renders the waiting count
 *   Indicator `readComputeQueueSnapshot`         |   and the estimate …
 *   Indicator `compute-monitor__queue-badge`     |   … and renders NOTHING when only the
 *                                                |   wrong pools have numbers
 *   Indicator `data-testid="compute-queue-link"` | 「查看队列」 navigates to /tasks
 *   Indicator `查看队列` / `router.push('/tasks')`|
 *
 * Still grep'd in tests/videoQueueVisibility.test.mjs: everything about VideoNode.vue and
 * VideoConfigNode.vue (batch 4 — node-level components), the `setInterval` head counts,
 * and the videoQueueState.js field reverse locks described above.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createTestRouter } from './helpers/canvasHarness.mjs'

const fetchComputeStatus = vi.fn()
vi.mock('../../src/api/computeStatus.js', () => ({
  fetchComputeStatus: (...args) => fetchComputeStatus(...args)
}))

const { cancelVideoTask } = await import('../../src/api/video.js')
const { useVideoGeneration } = await import('../../src/hooks/useApi.js')
const { useModelStore } = await import('../../src/stores/pinia/index.js')
const { default: request } = await import('../../src/utils/request.js')
const { default: ComputeStatusIndicator } = await import('../../src/components/ComputeStatusIndicator.vue')

/** Drive the real axios instance (interceptors included) and record what went out. */
const captureRequests = (respond = () => ({})) => {
  const sent = []
  request.defaults.adapter = async (config) => {
    sent.push(config)
    return {
      data: respond(config) ?? {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }
  }
  return sent
}

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

describe('video task cancellation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('POSTs to the task cancel endpoint with an encoded task id', async () => {
    const sent = captureRequests()

    await cancelVideoTask('task 1', { endpoint: 'http://127.0.0.1:8788/v1/video/task/{taskId}' })

    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('http://127.0.0.1:8788/v1/video/task/task%201/cancel')
    expect(sent[0].method, '取消是一次写操作').toBe('post')
  })

  it('sends the cancel to the same provider endpoint the status poll uses', async () => {
    const sent = captureRequests()
    const { api, wrapper } = mountVideoGeneration()
    const taskEndpoint = useModelStore().getVideoTaskEndpoint()

    await api.cancelVideoTask('task-7')

    expect(taskEndpoint, '这个渠道的查询端点带 {taskId} 占位符').toContain('{taskId}')
    expect(
      sent[0].url,
      '取消必须打到查询用的同一个端点，否则会发到另一个渠道去'
    ).toBe(`${taskEndpoint.replace('{taskId}', 'task-7')}/cancel`)
    wrapper.unmount()
  })

  it('refuses to build a cancel request without a task id', async () => {
    const sent = captureRequests()
    const { api, wrapper } = mountVideoGeneration()

    await expect(api.cancelVideoTask('')).rejects.toThrow(/缺少任务 ID/)
    expect(sent, '没有任务 ID 时不能发出一个打在错地址上的取消请求').toHaveLength(0)
    wrapper.unmount()
  })
})

describe('video task polling carries the queue state back', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('hands queue position, ETAs and segment progress to the node on every poll', async () => {
    vi.useFakeTimers()
    captureRequests(() => ({
      status: 'running',
      queue_position: 2,
      eta_seconds: 300,
      eta_completion_seconds: 540,
      current_segment: 3,
      total_segments: 5
    }))
    const { api, wrapper } = mountVideoGeneration()

    const seen = []
    const controller = new AbortController()
    const settled = api
      .pollVideoTask('t-1', (attempt, percent, info) => seen.push(info), { signal: controller.signal })
      .then(value => ({ value }), error => ({ error }))
    await vi.advanceTimersByTimeAsync(0)

    expect(seen[0]).toMatchObject({
      queuePosition: 2,
      etaSeconds: 300,
      etaCompletionSeconds: 540,
      currentSegment: 3,
      totalSegments: 5
    })

    controller.abort()
    await vi.advanceTimersByTimeAsync(1)
    await settled
    vi.useRealTimers()
    wrapper.unmount()
  })

  it('aborts the poll the moment the user cancels, without waiting out the interval', async () => {
    vi.useFakeTimers()
    captureRequests(() => ({ status: 'running' }))
    const { api, wrapper } = mountVideoGeneration()

    const controller = new AbortController()
    const settled = api.pollVideoTask('t-2', () => {}, { signal: controller.signal })
      .then(value => ({ value }), error => ({ error }))

    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    // Deliberately do NOT advance by the 5s polling interval.
    await vi.advanceTimersByTimeAsync(1)

    const { error } = await settled
    expect(error, '取消后必须立刻收摊，而不是再空转一个 5 秒轮询间隔').toBeTruthy()
    expect(error.videoTaskCancelled).toBe(true)
    expect(error.videoTaskTerminal).toBe(false)

    vi.useRealTimers()
    wrapper.unmount()
  })
})

describe('compute status indicator queue badge', () => {
  const mountIndicator = async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()
    const wrapper = mount(ComputeStatusIndicator, {
      attachTo: document.body,
      global: { plugins: [router] }
    })
    await flushPromises()
    return { wrapper, router }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    fetchComputeStatus.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows the GPU queue length and estimate without opening the drawer', async () => {
    fetchComputeStatus.mockResolvedValue({
      status: 'online',
      gpus: [],
      queues: {
        video_quality_waiting: 3,
        video_quality_workers: 1,
        queue_estimate_seconds: 240,
        comfyui_pending: 4,
        total_waiting: 9
      }
    })
    const { wrapper } = await mountIndicator()

    const badge = document.querySelector('[data-testid="compute-queue-badge"]')
    expect(badge, '用户必须不展开抽屉就能判断「要不要等」').toBeTruthy()
    expect(badge.textContent).toContain('队列 3 个等待')
    expect(badge.textContent).toContain('约 4 分钟')
    wrapper.unmount()
  })

  it('renders no badge when only the wrong pools have numbers', async () => {
    // 顶层 video_queue 是 HTTP 提交池，queues.total_waiting 是各池之和 —— 两者都不是
    // GPU 视频队列。读错字段的界面会显示一个和等待时间无关的数字。
    fetchComputeStatus.mockResolvedValue({
      status: 'online',
      gpus: [],
      video_queue: 7,
      video_workers: 3,
      queues: { total_waiting: 9, comfyui_pending: 7 }
    })
    const { wrapper } = await mountIndicator()

    expect(
      document.querySelector('[data-testid="compute-queue-badge"]'),
      '没有 GPU 队列信号时整块不渲染，绝不能拿另一个池的数字顶上'
    ).toBeNull()
    wrapper.unmount()
  })

  it('sends 「查看队列」 to the task centre', async () => {
    fetchComputeStatus.mockResolvedValue({ status: 'online', gpus: [], queues: {} })
    const { wrapper, router } = await mountIndicator()

    const link = document.querySelector('[data-testid="compute-queue-link"]')
    expect(link.textContent).toContain('查看队列')
    link.click()
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/tasks')
    wrapper.unmount()
  })
})
