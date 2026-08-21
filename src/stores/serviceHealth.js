/**
 * Service health store | 服务状态存储
 *
 * ONE shared probe for the whole app. Views must not start their own `setInterval`:
 * they call `useServiceStatus()`, which reference-counts subscribers and keeps a single
 * timer alive while at least one consumer is mounted. Guards mirror
 * ComputeStatusIndicator.vue: skip while the tab is hidden, abort in-flight requests on teardown.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchServiceHealth } from '../api/health.js'
import { summarizeServiceHealth } from '../utils/serviceHealth.js'

export const SERVICE_HEALTH_INTERVAL_MS = 15000

const health = ref(null)
const healthError = ref('')
const checkedAt = ref(0)

let subscribers = 0
let timer = 0
let controller = null
let inFlight = null

export const serviceStatus = computed(() => summarizeServiceHealth({
  health: health.value,
  error: healthError.value,
  checkedAt: checkedAt.value
}))

export const refreshServiceHealth = () => {
  if (inFlight) return inFlight
  if (typeof document !== 'undefined' && document.hidden) return Promise.resolve()

  controller = typeof AbortController === 'function' ? new AbortController() : null
  inFlight = (async () => {
    try {
      health.value = await fetchServiceHealth({ signal: controller?.signal })
      healthError.value = ''
      checkedAt.value = Date.now()
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      health.value = null
      healthError.value = requestError?.message || '无法连接后端服务'
      checkedAt.value = Date.now()
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export const subscribeServiceHealth = () => {
  subscribers += 1
  if (subscribers === 1) {
    void refreshServiceHealth()
    if (typeof window !== 'undefined') {
      timer = window.setInterval(() => { void refreshServiceHealth() }, SERVICE_HEALTH_INTERVAL_MS)
    }
  }

  let released = false
  return () => {
    if (released) return
    released = true
    subscribers = Math.max(0, subscribers - 1)
    if (subscribers > 0) return
    if (typeof window !== 'undefined') window.clearInterval(timer)
    timer = 0
    controller?.abort()
    controller = null
  }
}

export const useServiceStatus = () => {
  let release = null
  onMounted(() => { release = subscribeServiceHealth() })
  onBeforeUnmount(() => {
    release?.()
    release = null
  })
  return { serviceStatus, refreshServiceHealth }
}
