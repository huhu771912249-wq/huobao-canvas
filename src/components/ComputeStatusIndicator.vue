<template>
  <div class="compute-monitor-host">
    <section
      ref="monitorRef"
      class="compute-monitor"
      :class="[`compute-monitor--${summary.state}`, { 'compute-monitor--collapsed': collapsed }]"
      :style="monitorStyle"
      aria-label="GPU实时状态"
    >
      <header class="compute-monitor__drag" @pointerdown="startDrag">
        <div class="compute-monitor__identity">
          <span class="compute-monitor__dot"></span>
          <div>
            <small>LOCAL COMPUTE</small>
            <strong>{{ summary.gpuName }}</strong>
          </div>
        </div>
        <div class="compute-monitor__actions">
          <button type="button" :disabled="loading" title="立即刷新" @pointerdown.stop @click.stop="refresh">↻</button>
          <button type="button" :title="collapsed ? '展开监控窗' : '折叠监控窗'" @pointerdown.stop @click.stop="toggleCollapsed">
            {{ collapsed ? '＋' : '−' }}
          </button>
        </div>
      </header>

      <template v-if="!collapsed">
        <div v-if="error" class="compute-monitor__error">{{ error }}</div>

        <div class="compute-monitor__health">
          <span :class="`tone-${summary.state}`">{{ statusLabel }}</span>
          <span>ComfyUI {{ summary.comfyOnline ? '在线' : '离线' }}</span>
          <span v-if="summary.temperature !== null">{{ summary.temperature }}°C</span>
          <span>{{ powerLabel }}</span>
        </div>

        <div class="compute-monitor__meter">
          <div><span>GPU利用率</span><b>{{ summary.utilization }}%</b></div>
          <div class="compute-monitor__track"><i :style="{ width: `${summary.utilization}%` }"></i></div>
        </div>
        <div class="compute-monitor__meter">
          <div><span>显存</span><b>{{ summary.memoryLabel }}</b></div>
          <div class="compute-monitor__track"><i :style="{ width: `${summary.memoryPercent}%` }"></i></div>
        </div>

        <div class="compute-monitor__queue-row">
          <button type="button" @click="tasksOpen = true">
            <small>运行</small><b>{{ summary.running }}</b>
          </button>
          <button type="button" @click="tasksOpen = true">
            <small>排队</small><b>{{ summary.waiting }}</b>
          </button>
          <div><small>刷新</small><b>{{ updatedLabel }}</b></div>
        </div>

        <div v-if="currentTask" class="compute-monitor__current">
          <span>当前</span>
          <div>
            <b>{{ computeTaskStageLabel(currentTask) }} · {{ currentTask.progress !== null && currentTask.progress !== undefined ? `${currentTask.progress}%` : '执行中' }}</b>
            <small>{{ currentTask.task_id }}{{ taskElapsedLabel(currentTask) ? ` · ${taskElapsedLabel(currentTask)}` : '' }}</small>
          </div>
        </div>

        <button type="button" class="compute-monitor__details-toggle" @click="detailsOpen = !detailsOpen">
          {{ detailsOpen ? '收起详细状态' : '查看详细状态' }}
        </button>
        <div v-if="detailsOpen" class="compute-monitor__details">
          <div><span>后端视频等待</span><b>{{ queueDetails.backend_video_waiting || 0 }}</b></div>
          <div><span>尺寸任务等待</span><b>{{ queueDetails.video_resize_waiting || 0 }}</b></div>
          <div><span>ComfyUI执行</span><b>{{ queueDetails.comfyui_running || 0 }}</b></div>
          <div><span>ComfyUI等待</span><b>{{ queueDetails.comfyui_pending || 0 }}</b></div>
          <div><span>质量任务活跃</span><b>{{ queueDetails.video_quality_active || 0 }}</b></div>
          <div><span>GPU互斥锁</span><b>{{ queueDetails.shared_gpu_busy ? '占用' : '空闲' }}</b></div>
        </div>
      </template>
    </section>

    <aside v-if="tasksOpen" class="compute-task-drawer" aria-label="当前GPU任务">
      <header>
        <div><small>COMPUTE TASKS</small><strong>当前任务与等待队列</strong></div>
        <button type="button" @click="tasksOpen = false">关闭</button>
      </header>
      <div class="compute-task-drawer__summary">
        <span>运行 {{ summary.running }}</span>
        <span>等待 {{ summary.waiting }}</span>
        <span>{{ summary.gpuName }}</span>
      </div>
      <div v-if="!summary.tasks.length" class="compute-task-drawer__empty">当前没有GPU任务</div>
      <div v-else class="compute-task-drawer__list">
        <article v-for="task in summary.tasks" :key="`${task.source}-${task.task_id}`">
          <span :class="task.status === 'running' ? 'running' : 'queued'">
            {{ task.status === 'running' ? '运行中' : `等待${task.position || ''}` }}
          </span>
          <div>
            <b>{{ computeTaskStageLabel(task) }}</b>
            <small>{{ task.task_id }}</small>
            <p v-if="task.model || task.detail">{{ task.model || task.detail }}</p>
            <div class="compute-task-drawer__meta">
              <span v-if="task.progress !== null && task.progress !== undefined">进度 {{ task.progress }}%</span>
              <span v-if="taskElapsedLabel(task)">{{ taskElapsedLabel(task) }}</span>
              <span>{{ task.source }}</span>
            </div>
          </div>
        </article>
      </div>
      <footer>这里只展示实时任务；取消、重试和历史记录仍在任务中心处理。</footer>
    </aside>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchComputeStatus } from '../api/computeStatus.js'
import {
  computeTaskStageLabel,
  formatElapsedSeconds,
  summarizeComputeStatus
} from '../utils/computeStatus.js'

const COLLAPSED_KEY = 'huobao-compute-monitor-collapsed-v1'
const monitorRef = ref(null)
const loading = ref(false)
const error = ref('')
const status = ref(null)
const collapsed = ref(false)
const detailsOpen = ref(false)
const tasksOpen = ref(false)
const position = ref(null)
const summary = computed(() => summarizeComputeStatus(status.value))
const queueDetails = computed(() => status.value?.queues || {})
const currentTask = computed(() => summary.value.tasks.find(task => task.status === 'running') || null)
const monitorStyle = computed(() => position.value
  ? { left: `${position.value.left}px`, top: `${position.value.top}px` }
  : { right: '18px', bottom: '150px' })
const statusLabel = computed(() => ({ online: 'GPU在线', degraded: '服务异常', offline: 'GPU离线', loading: '检测中' }[summary.value.state]))
const powerLabel = computed(() => {
  if (summary.value.powerDraw === null) return '功耗未知'
  return summary.value.powerLimit === null
    ? `${summary.value.powerDraw}W`
    : `${summary.value.powerDraw}/${summary.value.powerLimit}W`
})
const updatedLabel = computed(() => {
  if (!summary.value.updatedAt) return '--:--:--'
  const date = new Date(summary.value.updatedAt)
  return Number.isNaN(date.getTime()) ? summary.value.updatedAt : date.toLocaleTimeString()
})
const taskElapsedLabel = task => formatElapsedSeconds(task?.elapsed_seconds)

const readStoredState = () => {
  try {
    collapsed.value = localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    collapsed.value = false
  }
}
const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
  try { localStorage.setItem(COLLAPSED_KEY, collapsed.value ? '1' : '0') } catch { /* storage is optional */ }
}

let dragState = null
const moveMonitor = event => {
  if (!dragState || !monitorRef.value) return
  const width = monitorRef.value.offsetWidth
  const height = monitorRef.value.offsetHeight
  position.value = {
    left: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragState.offsetX)),
    top: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragState.offsetY))
  }
}
const finishDrag = () => {
  if (!dragState) return
  dragState = null
  window.removeEventListener('pointermove', moveMonitor)
  window.removeEventListener('pointerup', finishDrag)
}
const startDrag = event => {
  if (event.button !== 0 || !monitorRef.value) return
  const rect = monitorRef.value.getBoundingClientRect()
  position.value = { left: rect.left, top: rect.top }
  dragState = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
  monitorRef.value.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', moveMonitor)
  window.addEventListener('pointerup', finishDrag)
}

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

onMounted(() => {
  readStoredState()
  void refresh()
  timer = window.setInterval(refresh, 5000)
})
onBeforeUnmount(() => {
  controller?.abort()
  window.clearInterval(timer)
  window.removeEventListener('pointermove', moveMonitor)
  window.removeEventListener('pointerup', finishDrag)
})
</script>

<style scoped>
.compute-monitor-host{display:contents}.compute-monitor{position:fixed;z-index:3000;width:310px;padding:14px;border:1px solid rgba(101,230,189,.24);border-radius:18px;color:var(--text-primary);background:rgba(8,13,22,.94);box-shadow:0 20px 70px rgba(0,0,0,.45);backdrop-filter:blur(22px)}.compute-monitor--collapsed{width:210px;padding:9px 11px}.compute-monitor__drag{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:grab;touch-action:none}.compute-monitor__drag:active{cursor:grabbing}.compute-monitor__identity{display:flex;align-items:center;gap:9px}.compute-monitor__identity>div{display:grid;gap:3px}.compute-monitor__identity small,.compute-task-drawer header small{color:#65e6bd;font:600 9px/1 ui-monospace;letter-spacing:.14em}.compute-monitor__identity strong{font-size:14px}.compute-monitor__dot{width:9px;height:9px;border-radius:99px;background:#718096}.compute-monitor--online .compute-monitor__dot{background:#65e6bd;box-shadow:0 0 12px rgba(101,230,189,.8)}.compute-monitor--degraded .compute-monitor__dot{background:#fbbf24}.compute-monitor--offline .compute-monitor__dot{background:#fb7185}.compute-monitor__actions{display:flex;gap:5px}.compute-monitor__actions button{width:25px;height:25px;border-radius:8px;color:var(--text-secondary);background:rgba(255,255,255,.06);font-size:14px}.compute-monitor__actions button:hover{color:var(--text-primary);background:rgba(255,255,255,.1)}.compute-monitor__error{margin-top:9px;padding:7px;border-radius:9px;color:#fda4af;background:rgba(244,63,94,.1);font-size:10px}.compute-monitor__health{display:flex;flex-wrap:wrap;gap:5px;margin:11px 0}.compute-monitor__health span{padding:4px 6px;border-radius:99px;color:var(--text-secondary);background:rgba(255,255,255,.05);font-size:9px}.compute-monitor__health .tone-online{color:#65e6bd}.compute-monitor__health .tone-degraded{color:#fbbf24}.compute-monitor__health .tone-offline{color:#fb7185}.compute-monitor__meter{margin-top:9px}.compute-monitor__meter>div:first-child{display:flex;justify-content:space-between;font-size:10px}.compute-monitor__meter b{font-family:ui-monospace,monospace}.compute-monitor__track{height:5px;margin-top:5px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.compute-monitor__track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#65e6bd,#6ea8ff);transition:width .3s}.compute-monitor__queue-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:11px}.compute-monitor__queue-row>*{display:grid;gap:3px;padding:8px;border:1px solid var(--border-color);border-radius:10px;text-align:left}.compute-monitor__queue-row button:hover{border-color:rgba(101,230,189,.45)}.compute-monitor__queue-row small{color:var(--text-secondary);font-size:9px}.compute-monitor__queue-row b{font:700 11px/1 ui-monospace}.compute-monitor__current{display:flex;align-items:flex-start;gap:8px;margin-top:9px;padding:8px;border-radius:10px;background:rgba(101,230,189,.07)}.compute-monitor__current>span{padding:3px 5px;border-radius:99px;color:#65e6bd;background:rgba(101,230,189,.1);font-size:8px}.compute-monitor__current div{min-width:0;display:grid;gap:3px}.compute-monitor__current b{font-size:10px}.compute-monitor__current small{overflow:hidden;color:var(--text-secondary);font:8px/1.2 ui-monospace;text-overflow:ellipsis;white-space:nowrap}.compute-monitor__details-toggle{width:100%;margin-top:9px;color:var(--text-secondary);font-size:9px;text-align:center}.compute-monitor__details-toggle:hover{color:#65e6bd}.compute-monitor__details{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.compute-monitor__details div{display:flex;justify-content:space-between;padding:6px 7px;border-radius:8px;background:rgba(255,255,255,.035);font-size:8px}.compute-monitor__details span{color:var(--text-secondary)}.compute-task-drawer{position:fixed;z-index:3100;top:76px;right:16px;bottom:16px;width:min(420px,calc(100vw - 24px));display:flex;flex-direction:column;padding:18px;border:1px solid rgba(110,168,255,.25);border-radius:22px;color:var(--text-primary);background:rgba(7,12,21,.98);box-shadow:0 25px 90px rgba(0,0,0,.55);backdrop-filter:blur(24px)}.compute-task-drawer header{display:flex;align-items:center;justify-content:space-between}.compute-task-drawer header>div{display:grid;gap:5px}.compute-task-drawer header strong{font-size:16px}.compute-task-drawer header button{padding:6px 9px;border-radius:9px;color:var(--text-secondary);background:rgba(255,255,255,.06);font-size:10px}.compute-task-drawer__summary{display:flex;gap:6px;margin-top:14px}.compute-task-drawer__summary span{padding:5px 8px;border-radius:99px;color:var(--text-secondary);background:rgba(255,255,255,.05);font-size:9px}.compute-task-drawer__list{min-height:0;margin-top:12px;overflow:auto}.compute-task-drawer__list article{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;padding:11px;border:1px solid var(--border-color);border-radius:13px;background:rgba(255,255,255,.03)}.compute-task-drawer__list article>span{flex:0 0 auto;padding:4px 6px;border-radius:99px;font-size:8px}.compute-task-drawer__list .running{color:#65e6bd;background:rgba(101,230,189,.1)}.compute-task-drawer__list .queued{color:#fbbf24;background:rgba(251,191,36,.1)}.compute-task-drawer__list article>div{min-width:0;display:grid;gap:4px}.compute-task-drawer__list b{font-size:11px}.compute-task-drawer__list small{overflow:hidden;color:var(--text-secondary);font:9px/1.2 ui-monospace;text-overflow:ellipsis;white-space:nowrap}.compute-task-drawer__list p{color:var(--text-secondary);font-size:9px}.compute-task-drawer__meta{display:flex;flex-wrap:wrap;gap:5px}.compute-task-drawer__meta span{padding:3px 5px;border-radius:6px;color:var(--text-secondary);background:rgba(255,255,255,.04);font-size:8px}.compute-task-drawer__empty{margin-top:16px;padding:28px;border:1px dashed var(--border-color);border-radius:14px;color:var(--text-secondary);font-size:11px;text-align:center}.compute-task-drawer footer{margin-top:auto;padding-top:12px;color:var(--text-secondary);font-size:9px}@media(max-width:760px){.compute-monitor{width:280px}.compute-task-drawer{top:62px;right:8px;bottom:8px}.compute-monitor__details{grid-template-columns:1fr}}
</style>
