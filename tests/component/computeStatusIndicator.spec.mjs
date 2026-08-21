/**
 * Takes over the grep tail of tests/computeStatus.test.mjs.
 *
 * That file is half good test, half source scan. The good half — `fetchComputeStatus`
 * against a fake `fetchImpl`, plus the pure formatters in `src/utils/computeStatus.js` —
 * stays where it is. The tail read ComputeStatusIndicator.vue as text and asserted on
 * `const collapsed = ref(true)`, `window.setInterval(refresh, 5000)`,
 * `{ right: '18px', top: '84px' }`, `<Teleport to="body">` and a handful of copy strings.
 *
 * Every one of those was standing in for a behaviour a user can observe, so each is
 * restated here against the mounted component:
 *
 *   grep                                    | behaviour asserted here
 *   ----------------------------------------|------------------------------------------
 *   `const collapsed = ref(true)`           | first paint is the compact card, no meters
 *   `{ right: '18px', top: '84px' }`        | parks top-right, clear of bottom action bars
 *   `<Teleport to="body">`                  | renders under <body>, not inside the host
 *   `window.setInterval(refresh, 5000)`     | polls once on mount, again after 5s, stops
 *                                           |   on unmount
 *   `fetchComputeStatus`                    | (same)
 *   `GPU利用率` / `当前任务`                 | rendered once expanded / once the drawer opens
 *   `@pointerdown="startDrag"`              | dragging the header moves the card
 *   no `localStorage.setItem(POSITION_KEY`  | a dragged position is not remembered
 *   `查看详细状态` / `compute-task-drawer`   | the toggle and the drawer exist and work
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestRouter } from './helpers/canvasHarness.mjs'

const fetchComputeStatus = vi.fn()
vi.mock('../../src/api/computeStatus.js', () => ({
  fetchComputeStatus: (...args) => fetchComputeStatus(...args)
}))

const { default: ComputeStatusIndicator } = await import('../../src/components/ComputeStatusIndicator.vue')

const PAYLOAD = {
  status: 'online',
  updated_at: '2026-08-08T10:30:00Z',
  gpus: [{
    name: 'NVIDIA GeForce RTX 5090',
    utilization_percent: 76,
    memory_used_mb: 24576,
    memory_total_mb: 32768,
    memory_utilization_percent: 75,
    temperature_c: 68,
    power_draw_w: 410,
    power_limit_w: 575
  }],
  comfyui: { online: true },
  queues: { total_waiting: 3, comfyui_running: 1 },
  current_tasks: [{ task_id: 'videoq-test', stage: 'generate', status: 'running' }]
}

const mountIndicator = async () => {
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ComputeStatusIndicator, {
    attachTo: document.body,
    global: { plugins: [router] }
  })
  await flushPromises()
  return wrapper
}

const monitor = () => document.querySelector('.compute-monitor')

const pointerEvent = (type, { x, y, button = 0 }) => new MouseEvent(type, {
  bubbles: true,
  cancelable: true,
  clientX: x,
  clientY: y,
  button
})

describe('ComputeStatusIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    fetchComputeStatus.mockReset()
    fetchComputeStatus.mockResolvedValue(PAYLOAD)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders into <body> so it floats above whatever view is mounted', async () => {
    const wrapper = await mountIndicator()
    const card = monitor()
    expect(card, 'the monitor must reach the document, not stay inside its host view').toBeTruthy()
    expect(wrapper.element.contains(card)).toBe(false)
    wrapper.unmount()
  })

  it('starts compact and parked away from the bottom action bars', async () => {
    const wrapper = await mountIndicator()
    const card = monitor()

    expect(card.className, 'the monitor must start compact so it cannot cover primary actions').toContain('compute-monitor--collapsed')
    expect(card.textContent).not.toContain('GPU利用率')
    expect(card.style.top).toBe('84px')
    expect(card.style.right).toBe('18px')
    expect(card.style.bottom, 'the monitor must not anchor to the bottom action bars').toBe('')

    wrapper.unmount()
  })

  it('polls compute status on mount, again every 5s, and stops on unmount', async () => {
    const wrapper = await mountIndicator()
    expect(fetchComputeStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchComputeStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchComputeStatus).toHaveBeenCalledTimes(3)

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetchComputeStatus, 'the interval must be cleared when the monitor goes away').toHaveBeenCalledTimes(3)
  })

  it('shows the live GPU numbers once expanded', async () => {
    const wrapper = await mountIndicator()
    const [, expandToggle] = document.querySelectorAll('.compute-monitor__actions button')
    expandToggle.click()
    await flushPromises()

    const card = monitor()
    expect(card.className).not.toContain('compute-monitor--collapsed')
    expect(card.textContent).toContain('GPU利用率')
    expect(card.textContent).toContain('76%')
    expect(card.textContent).toContain('24.0 / 32.0 GB')
    expect(card.textContent).toContain('查看详细状态')

    wrapper.unmount()
  })

  it('opens the task drawer from the queue counters', async () => {
    const wrapper = await mountIndicator()
    const [, expandToggle] = document.querySelectorAll('.compute-monitor__actions button')
    expandToggle.click()
    await flushPromises()

    expect(document.querySelector('.compute-task-drawer')).toBeNull()
    document.querySelector('.compute-monitor__queue-row button').click()
    await flushPromises()

    const drawer = document.querySelector('.compute-task-drawer')
    expect(drawer, 'the queue counters must open the task drawer').toBeTruthy()
    expect(drawer.textContent).toContain('当前任务与等待队列')
    expect(drawer.textContent).toContain('videoq-test')

    wrapper.unmount()
  })

  it('drags from its header but never remembers where it was dropped', async () => {
    const wrapper = await mountIndicator()
    const card = monitor()

    card.querySelector('.compute-monitor__drag').dispatchEvent(pointerEvent('pointerdown', { x: 0, y: 0 }))
    globalThis.dispatchEvent(pointerEvent('pointermove', { x: 300, y: 200 }))
    globalThis.dispatchEvent(pointerEvent('pointerup', { x: 300, y: 200 }))
    await flushPromises()

    expect(monitor().style.left, 'the header must be a drag handle').toBe('300px')
    expect(monitor().style.top).toBe('200px')

    wrapper.unmount()
    const remounted = await mountIndicator()
    expect(
      monitor().style.top,
      'a dragged position must not be persisted — a remembered position can park the monitor over a button'
    ).toBe('84px')
    expect(monitor().style.left).toBe('')
    remounted.unmount()
  })
})
