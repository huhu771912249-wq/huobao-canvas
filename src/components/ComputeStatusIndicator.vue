<template>
  <div ref="rootRef" class="compute-status-indicator">
    <button
      type="button"
      class="compute-status-trigger"
      :class="`compute-status-trigger--${summary.state}`"
      :aria-expanded="panelOpen"
      title="查看本机算力状态"
      @click="panelOpen = !panelOpen"
    >
      <span class="compute-status-dot"></span>
      <span class="compute-status-name">{{ summary.gpuName }}</span>
      <span class="compute-status-memory">{{ summary.memoryLabel }}</span>
      <span v-if="summary.waiting" class="compute-status-badge">排队 {{ summary.waiting }}</span>
    </button>

    <section v-if="panelOpen" class="compute-status-panel" aria-label="GPU算力状态">
      <header>
        <div>
          <small>LOCAL COMPUTE</small>
          <strong>{{ summary.gpuName }}</strong>
        </div>
        <button type="button" :disabled="loading" @click.stop="refresh">{{ loading ? '检测中' : '刷新' }}</button>
      </header>

      <div v-if="error" class="compute-status-error">{{ error }}</div>

      <div class="compute-status-health">
        <span :class="`tone-${summary.state}`">{{ statusLabel }}</span>
        <span>ComfyUI {{ summary.comfyOnline ? '在线' : '离线' }}</span>
        <span v-if="summary.temperature !== null">{{ summary.temperature }}°C</span>
      </div>

      <div class="compute-status-meter">
        <div><span>GPU利用率</span><b>{{ summary.utilization }}%</b></div>
        <div class="track"><i :style="{ width: `${summary.utilization}%` }"></i></div>
      </div>
      <div class="compute-status-meter">
        <div><span>显存</span><b>{{ summary.memoryLabel }}</b></div>
        <div class="track"><i :style="{ width: `${summary.memoryPercent}%` }"></i></div>
      </div>

      <div class="compute-status-metrics">
        <div><small>执行中</small><b>{{ summary.running }}</b></div>
        <div><small>等待中</small><b>{{ summary.waiting }}</b></div>
        <div><small>功耗</small><b>{{ powerLabel }}</b></div>
      </div>

      <div class="compute-status-tasks">
        <div class="compute-status-section-title">当前任务</div>
        <div v-if="!summary.tasks.length" class="compute-status-empty">当前没有GPU任务</div>
        <article v-for="task in summary.tasks" :key="`${task.source}-${task.task_id}`">
          <span :class="task.status === 'running' ? 'running' : 'queued'">{{ task.status === 'running' ? '运行中' : `等待${task.position || ''}` }}</span>
          <div><b>{{ computeTaskStageLabel(task) }}</b><small>{{ task.task_id }}{{ task.model ? ` · ${task.model}` : '' }}{{ task.detail ? ` · ${task.detail}` : '' }}</small></div>
        </article>
      </div>

      <footer>最近刷新：{{ updatedLabel }}</footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchComputeStatus } from '../api/computeStatus.js'
import { computeTaskStageLabel, summarizeComputeStatus } from '../utils/computeStatus.js'

const rootRef = ref(null)
const panelOpen = ref(false)
const loading = ref(false)
const error = ref('')
const status = ref(null)
const summary = computed(() => summarizeComputeStatus(status.value))
const statusLabel = computed(() => ({ online: 'GPU在线', degraded: '服务异常', offline: 'GPU离线', loading: '检测中' }[summary.value.state]))
const powerLabel = computed(() => {
  if (summary.value.powerDraw === null) return '未知'
  return summary.value.powerLimit === null
    ? `${summary.value.powerDraw}W`
    : `${summary.value.powerDraw}/${summary.value.powerLimit}W`
})
const updatedLabel = computed(() => {
  if (!summary.value.updatedAt) return '尚未获取'
  const date = new Date(summary.value.updatedAt)
  return Number.isNaN(date.getTime()) ? summary.value.updatedAt : date.toLocaleTimeString()
})

let timer = 0
let controller = null
const refresh = async () => {
  if (loading.value || (typeof document !== 'undefined' && document.hidden)) return
  loading.value = true
  error.value = ''
  controller?.abort()
  controller = new AbortController()
  try {
    status.value = await fetchComputeStatus({ signal: controller.signal })
  } catch (requestError) {
    if (requestError?.name !== 'AbortError') error.value = requestError?.message || '无法读取算力状态'
  } finally {
    loading.value = false
  }
}
const closeOnOutsideClick = (event) => {
  if (panelOpen.value && !rootRef.value?.contains(event.target)) panelOpen.value = false
}

onMounted(() => {
  void refresh()
  timer = window.setInterval(refresh, 5000)
  document.addEventListener('pointerdown', closeOnOutsideClick)
})
onBeforeUnmount(() => {
  controller?.abort()
  window.clearInterval(timer)
  document.removeEventListener('pointerdown', closeOnOutsideClick)
})
</script>

<style scoped>
.compute-status-indicator{position:relative}.compute-status-trigger{min-height:36px;display:inline-flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--border-color);border-radius:12px;color:var(--text-secondary);background:rgba(255,255,255,.035);font-size:11px}.compute-status-trigger:hover{color:var(--text-primary);background:var(--bg-tertiary)}.compute-status-dot{width:8px;height:8px;border-radius:99px;background:#718096}.compute-status-trigger--online .compute-status-dot{background:#65e6bd;box-shadow:0 0 10px rgba(101,230,189,.8)}.compute-status-trigger--degraded .compute-status-dot{background:#fbbf24}.compute-status-trigger--offline .compute-status-dot{background:#fb7185}.compute-status-name{font-weight:700;color:var(--text-primary)}.compute-status-memory{font-family:ui-monospace,monospace}.compute-status-badge{padding:3px 6px;border-radius:99px;color:#fbbf24;background:rgba(251,191,36,.12)}.compute-status-panel{position:fixed;z-index:3000;top:66px;right:18px;width:min(390px,calc(100vw - 24px));padding:16px;border:1px solid rgba(101,230,189,.22);border-radius:20px;color:var(--text-primary);background:rgba(8,13,22,.97);box-shadow:0 24px 80px rgba(0,0,0,.5);backdrop-filter:blur(24px)}.compute-status-panel header{display:flex;align-items:center;justify-content:space-between}.compute-status-panel header div{display:grid;gap:4px}.compute-status-panel header small,.compute-status-section-title{color:#65e6bd;font:600 10px/1 ui-monospace;letter-spacing:.15em}.compute-status-panel header strong{font-size:17px}.compute-status-panel header button{padding:6px 9px;border-radius:9px;color:var(--text-secondary);background:rgba(255,255,255,.06);font-size:11px}.compute-status-error{margin-top:10px;padding:8px;border-radius:10px;color:#fda4af;background:rgba(244,63,94,.1);font-size:11px}.compute-status-health{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}.compute-status-health span{padding:5px 8px;border-radius:99px;background:rgba(255,255,255,.05);color:var(--text-secondary);font-size:10px}.compute-status-health .tone-online{color:#65e6bd}.compute-status-health .tone-degraded{color:#fbbf24}.compute-status-health .tone-offline{color:#fb7185}.compute-status-meter{margin-top:11px}.compute-status-meter>div:first-child{display:flex;justify-content:space-between;font-size:11px}.compute-status-meter b{font-family:ui-monospace,monospace}.track{height:6px;margin-top:6px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#65e6bd,#6ea8ff);transition:width .3s}.compute-status-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.compute-status-metrics div{display:grid;gap:4px;padding:10px;border:1px solid var(--border-color);border-radius:12px}.compute-status-metrics small{color:var(--text-secondary);font-size:10px}.compute-status-metrics b{font:700 13px/1 ui-monospace}.compute-status-tasks{margin-top:15px}.compute-status-tasks article{display:flex;align-items:flex-start;gap:9px;margin-top:8px;padding:9px;border-radius:12px;background:rgba(255,255,255,.035)}.compute-status-tasks article>span{flex:0 0 auto;padding:4px 6px;border-radius:99px;font-size:9px}.compute-status-tasks .running{color:#65e6bd;background:rgba(101,230,189,.1)}.compute-status-tasks .queued{color:#fbbf24;background:rgba(251,191,36,.1)}.compute-status-tasks article div{min-width:0;display:grid;gap:3px}.compute-status-tasks article b{font-size:11px}.compute-status-tasks article small{overflow:hidden;color:var(--text-secondary);font:9px/1.3 ui-monospace;text-overflow:ellipsis;white-space:nowrap}.compute-status-empty{margin-top:8px;padding:12px;border:1px dashed var(--border-color);border-radius:12px;color:var(--text-secondary);font-size:11px;text-align:center}.compute-status-panel footer{margin-top:12px;color:var(--text-secondary);font-size:9px;text-align:right}@media(max-width:760px){.compute-status-memory{display:none}.compute-status-panel{top:58px;right:12px}.compute-status-name{max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
</style>
