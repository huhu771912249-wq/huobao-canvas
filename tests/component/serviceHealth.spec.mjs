/**
 * Takes over the store half of the grep tail in tests/serviceHealth.test.mjs.
 *
 * That file's pure half — `normalizeServiceHealth`, `summarizeServiceHealth`,
 * `fetchServiceHealth` against a fake `fetchImpl` — was already a real test and stays
 * where it is. The tail read src/stores/serviceHealth.js as text:
 *
 *   grep                                     | behaviour asserted here
 *   -----------------------------------------|-----------------------------------------
 *   exactly one `window.setInterval(`         | N subscribers still produce ONE probe
 *                                            |   loop at one interval's cadence
 *   `subscribers += 1`                        | reference counting: releasing one of two
 *                                            |   subscribers keeps probing, releasing the
 *                                            |   last one stops it (and does not stop it
 *                                            |   twice)
 *   `document.hidden`                         | a hidden tab performs no probe, and picks
 *                                            |   probing back up when it is shown again
 *
 * The counting grep could only see how many times the *string* `window.setInterval(`
 * occurs; it says nothing about whether the timer is ever cleared, or whether the
 * refcount goes back up correctly. Those are the failures this file adds.
 *
 * Still grep'd in tests/serviceHealth.test.mjs (D 类接线, batch 5): TaskCenter.vue and
 * RecentGenerations.vue must call `useServiceStatus()` and must not open their own
 * `setInterval`. Asserting that for real means mounting both views.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchServiceHealth = vi.fn()
vi.mock('../../src/api/health.js', () => ({
  fetchServiceHealth: (...args) => fetchServiceHealth(...args)
}))

const {
  SERVICE_HEALTH_INTERVAL_MS,
  refreshServiceHealth,
  serviceStatus,
  subscribeServiceHealth
} = await import('../../src/stores/serviceHealth.js')

const HEALTHY = { ok: true, chat_workers: 2, image_workers: 1, video_workers: 1 }

/** jsdom's `document.hidden` is a prototype getter; override it as an own property. */
const setTabHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

describe('service health store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchServiceHealth.mockReset()
    fetchServiceHealth.mockResolvedValue(HEALTHY)
    setTabHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    delete document.hidden
  })

  it('runs one probe loop no matter how many views subscribe', async () => {
    const releaseFirst = subscribeServiceHealth()
    const releaseSecond = subscribeServiceHealth()

    expect(
      fetchServiceHealth,
      'the second subscriber must join the running loop, not start a second probe'
    ).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(SERVICE_HEALTH_INTERVAL_MS)
    expect(
      fetchServiceHealth,
      'two subscribers must still cost one request per interval'
    ).toHaveBeenCalledTimes(2)

    releaseFirst()
    releaseSecond()
  })

  it('keeps probing while any subscriber is left, and stops when the last one leaves', async () => {
    const releaseFirst = subscribeServiceHealth()
    const releaseSecond = subscribeServiceHealth()
    fetchServiceHealth.mockClear()

    releaseFirst()
    await vi.advanceTimersByTimeAsync(SERVICE_HEALTH_INTERVAL_MS)
    expect(
      fetchServiceHealth,
      'one view unmounting must not blind the views that are still open'
    ).toHaveBeenCalledTimes(1)

    releaseSecond()
    await vi.advanceTimersByTimeAsync(SERVICE_HEALTH_INTERVAL_MS * 3)
    expect(
      fetchServiceHealth,
      'the timer must be cleared once nothing is watching'
    ).toHaveBeenCalledTimes(1)
  })

  it('ignores a repeated release so the refcount cannot go negative', async () => {
    const releaseFirst = subscribeServiceHealth()
    releaseFirst()
    releaseFirst()

    const releaseSecond = subscribeServiceHealth()
    fetchServiceHealth.mockClear()
    await vi.advanceTimersByTimeAsync(SERVICE_HEALTH_INTERVAL_MS)
    expect(
      fetchServiceHealth,
      'a double release must not leave the refcount below zero — the next subscriber would never start a timer'
    ).toHaveBeenCalledTimes(1)

    releaseSecond()
  })

  it('does not probe while the tab is hidden', async () => {
    setTabHidden(true)
    const release = subscribeServiceHealth()
    await vi.advanceTimersByTimeAsync(SERVICE_HEALTH_INTERVAL_MS * 2)
    expect(
      fetchServiceHealth,
      'a background tab must not keep hitting /health'
    ).toHaveBeenCalledTimes(0)

    setTabHidden(false)
    await refreshServiceHealth()
    expect(
      fetchServiceHealth,
      'coming back to the tab must resume probing'
    ).toHaveBeenCalledTimes(1)

    release()
  })

  it('reports a dead backend as offline instead of leaving the last good reading up', async () => {
    const release = subscribeServiceHealth()
    await vi.advanceTimersByTimeAsync(0)
    expect(serviceStatus.value).toEqual({ label: '服务已连接', tone: 'success' })

    fetchServiceHealth.mockRejectedValueOnce(new Error('fetch failed'))
    await refreshServiceHealth()
    expect(
      serviceStatus.value,
      'a backend that stopped answering must not keep reading as 服务已连接'
    ).toEqual({ label: '服务离线', tone: 'danger' })

    release()
  })
})
