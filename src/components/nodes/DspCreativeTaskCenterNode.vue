<template>
  <div class="dsp-task-center relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <section
      class="dsp-task-center__shell canvas-node-scroll-shell nowheel w-[620px] rounded-2xl border bg-[var(--bg-secondary)] shadow-2xl"
      :class="data.selected ? 'border-amber-400' : 'border-[var(--border-color)]'"
    >
      <header class="dsp-task-center__header flex items-start justify-between border-b border-[var(--border-color)] px-5 py-4">
        <div>
          <h3 class="text-base font-semibold text-[var(--text-primary)]">素材任务中心</h3>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">
            后端状态为准，本地只保存 Job ID 和界面偏好
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button class="node-icon-button" title="刷新任务中心" @click="loadJobs">
            <n-icon :size="15"><RefreshOutline /></n-icon>
          </button>
          <button class="node-icon-button" title="复制节点" @click="duplicateNode(id)">
            <n-icon :size="15"><CopyOutline /></n-icon>
          </button>
          <button class="node-icon-button" title="删除节点" @click="removeNode(id)">
            <n-icon :size="15"><TrashOutline /></n-icon>
          </button>
        </div>
      </header>

      <div class="nodrag space-y-4 p-5">
        <div class="dsp-task-center__filters grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
          <select v-model="filters.status" class="filter-control" @change="filtersChanged">
            <option value="">全部状态</option>
            <option value="running">进行中</option>
            <option value="awaiting_confirmation">待确认</option>
            <option value="completed">已完成</option>
            <option value="completed_with_errors">部分失败</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
          <select v-model="filters.mediaType" class="filter-control" @change="filtersChanged">
            <option value="">全部类型</option>
            <option v-for="type in mediaOptions" :key="type" :value="type">{{ type }}</option>
          </select>
          <input
            v-model="filters.query"
            class="filter-control"
            placeholder="搜索 Job / Creative"
            @keyup.enter="filtersChanged"
          />
          <button class="primary-button" :disabled="loading" @click="loadJobs">
            <n-spin v-if="loading" :size="14" />
            <span v-else>查询</span>
          </button>
        </div>

        <div v-if="serviceIncident" class="notice-error service-incident">
          <strong>{{ serviceIncident.title }}</strong>
          <span>{{ serviceIncident.summary }}</span>
          <small>{{ serviceIncident.detail }}</small>
        </div>

        <div v-if="!jobs.length && !loading" class="empty-state">
          暂无任务。任务历史从后端读取，不会把完整任务结果写入浏览器。
        </div>

        <div v-else class="max-h-[520px] space-y-3 overflow-auto pr-1">
          <article
            v-for="item in filteredJobs"
            :key="jobId(item)"
            class="dsp-task-card rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate font-mono text-xs text-[var(--text-secondary)]" :title="jobId(item)">
                  {{ jobId(item) }}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-[var(--text-primary)]">{{ jobStep(item) }}</span>
                  <span class="status-pill">{{ statusLabel(item) }}</span>
                  <span v-if="item.media_type || item.mediaType" class="media-pill">
                    {{ item.media_type || item.mediaType }}
                  </span>
                </div>
              </div>
              <span class="font-mono text-sm text-amber-300">{{ progressOf(item) }}%</span>
            </div>

            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
              <div
                class="h-full rounded-full transition-all"
                :class="progressClass(item.status)"
                :style="{ width: `${progressOf(item)}%` }"
              ></div>
            </div>

            <div
              v-if="failureReason(item)"
              class="mt-3 rounded-lg p-3 text-xs"
              :class="qualityBlocked(item)
                ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border border-red-500/30 bg-red-500/10 text-red-400'"
            >
              <strong>{{ qualityBlocked(item) ? '质量拦截：' : '失败原因：' }}</strong>{{ failureReason(item) }}
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-if="canCancel(item)"
                class="action-button"
                :disabled="busyJobId === jobId(item)"
                @click="runAction(item, 'cancel')"
              >
                取消
              </button>
              <button
                v-if="canRetry(item)"
                class="action-button"
                :disabled="busyJobId === jobId(item)"
                @click="runAction(item, 'retry')"
              >
                重试
              </button>
              <button
                v-if="downloadUrl(item)"
                class="action-button"
                :disabled="busyJobId === jobId(item)"
                @click="previewJob(item)"
              >
                查看 GIF
              </button>
              <a v-if="downloadUrl(item)" :href="downloadUrl(item)" download class="action-button">下载 GIF ZIP</a>
              <button
                v-if="canCleanup(item)"
                class="action-button"
                :disabled="busyJobId === jobId(item)"
                @click="runAction(item, 'cleanup')"
              >
                清理临时公开文件
              </button>
              <button
                v-if="canDelete(item)"
                class="danger-button"
                :disabled="busyJobId === jobId(item)"
                @click="runAction(item, 'delete')"
              >
                删除
              </button>
            </div>
          </article>
        </div>

        <p class="text-[11px] leading-5 text-[var(--text-secondary)]">
          任务中心支持历史筛选、进度、失败原因、取消、重试、下载、删除和 public cleanup。
          删除任务前请确认本地素材已经归档。
        </p>
      </div>

      <NodeHandleMenu
        :nodeId="id"
        nodeType="dspCreativeTaskCenter"
        :visible="showHandleMenu"
        :operations="[]"
      />
    </section>

    <Teleport to="body">
      <DspGifResultPreview
        v-if="previewItems.length"
        class="fixed right-6 top-24 z-50 max-h-[calc(100vh-120px)] w-[420px] overflow-auto"
        :items="previewItems"
        :activeKey="activePreviewKey"
        :expectedCount="previewExpectedCount"
        :zipUrl="previewZipUrl"
        :openingFolder="openingDownloadFolder"
        @select="activePreviewKey = $event"
        @previous="selectAdjacentPreview(-1)"
        @next="selectAdjacentPreview(1)"
        @open-folder="openPreviewFolder"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { CopyOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import {
  cancelDspCreativeJob,
  cleanupDspCreativePublicFiles,
  deleteDspCreativeJob,
  getDspCreativeJob,
  listDspCreativeJobs,
  openDspCreativeDownloadFolder,
  retryDspCreativeJob
} from '../../api/dspCreativeLibrary.js'
import {
  buildDspGifPreviewCatalog,
  DEFAULT_DSP_MEDIA_TYPES,
  DSP_CREATIVE_POLL_INTERVAL,
  canCancelDspCreativeJob,
  canCleanupDspCreativeJob,
  canRetryDspCreativeJob,
  getDspCreativeDownloadUrl,
  getDspCreativeExpectedGifCount,
  getDspCreativeJobId,
  getDspCreativeJobs,
  getDspCreativeProgress,
  getDspCreativeStepLabel,
  isDspCreativeJobTerminal,
  isDspCreativeQualityBlocked,
  persistTaskCenterState,
  readPersistedTaskCenterState,
  resolveTaskCenterPreferences,
  sanitizeTaskCenterPersistence
} from '../../utils/dspCreativeLibrary.js'
import { duplicateNode, removeNode, updateNode } from '../../stores/canvas.js'
import { normalizeServiceIncident } from '../../utils/workspaceUi.js'
import {
  createVisibilityPollingController,
  isDocumentVisible
} from '../../utils/visibilityPolling.js'
import DspGifResultPreview from '../dsp/DspGifResultPreview.vue'
import NodeHandleMenu from './NodeHandleMenu.vue'

const props = defineProps({
  id: String,
  data: Object
})

const STORAGE_KEY = 'dsp-creative-task-center'
const mediaOptions = DEFAULT_DSP_MEDIA_TYPES
const jobs = ref([])
const loading = ref(false)
const busyJobId = ref('')
const errorMessage = ref('')
const serviceIncident = computed(() => (
  errorMessage.value ? normalizeServiceIncident(errorMessage.value) : null
))
const showHandleMenu = ref(false)
const previewItems = ref([])
const activePreviewKey = ref('')
const previewZipUrl = ref('')
const previewJobId = ref('')
const previewExpectedCount = ref(0)
const openingDownloadFolder = ref(false)
const filters = reactive({
  status: props.data?.uiPrefs?.status || '',
  mediaType: props.data?.uiPrefs?.mediaType || '',
  query: props.data?.uiPrefs?.query || ''
})
let pollTimer = null
let mounted = false
let requestSequence = 0
let listRequestController = null
let listRequestInFlight = false

const filteredJobs = computed(() => jobs.value)

const jobId = (item) => getDspCreativeJobId(item)
const progressOf = (item) => getDspCreativeProgress(item)
const jobStep = (item) => getDspCreativeStepLabel(item)
const failureReason = (item) => (
  item.error?.message
  || item.error
  || item.failure_reason
  || item.failureReason
  || (
    String(item.status || '').toLowerCase() === 'completed_with_errors'
      ? '部分素材处理失败，请查看后台任务明细'
      : ''
  )
)
const downloadUrl = (item) => getDspCreativeDownloadUrl(item)
const qualityBlocked = (item) => isDspCreativeQualityBlocked(item)
const canCancel = (item) => canCancelDspCreativeJob(item.status, Boolean(busyJobId.value))
const canRetry = (item) => (
  !qualityBlocked(item)
  && canRetryDspCreativeJob(item.status, Boolean(busyJobId.value))
)
const canCleanup = (item) => canCleanupDspCreativeJob(item, Boolean(busyJobId.value))
const canDelete = (item) => (
  !busyJobId.value && isDspCreativeJobTerminal(item.status)
)

const unwrapJob = (result) => (
  result?.data?.job || result?.data || result?.job || result
)

const previewJob = async (item) => {
  const id = jobId(item)
  if (!id || busyJobId.value) return
  busyJobId.value = id
  errorMessage.value = ''
  try {
    const job = unwrapJob(await getDspCreativeJob(id))
    const catalog = buildDspGifPreviewCatalog(job)
    if (!catalog.length) {
      throw new Error('旧任务没有人物保护质量记录，请重新导入素材后生成')
    }
    previewItems.value = catalog
    activePreviewKey.value = catalog[0].key
    previewExpectedCount.value = getDspCreativeExpectedGifCount(job)
    previewZipUrl.value = getDspCreativeDownloadUrl(job) || downloadUrl(item)
    previewJobId.value = id
  } catch (error) {
    errorMessage.value = error?.message || 'GIF 结果读取失败'
  } finally {
    busyJobId.value = ''
  }
}

const selectAdjacentPreview = (direction) => {
  if (!previewItems.value.length) return
  const currentIndex = previewItems.value.findIndex(
    (item) => item.key === activePreviewKey.value
  )
  const nextIndex = (
    (Math.max(currentIndex, 0) + direction + previewItems.value.length)
    % previewItems.value.length
  )
  activePreviewKey.value = previewItems.value[nextIndex].key
}

const openPreviewFolder = async () => {
  if (!previewJobId.value || openingDownloadFolder.value) return
  openingDownloadFolder.value = true
  errorMessage.value = ''
  try {
    await openDspCreativeDownloadFolder(previewJobId.value)
  } catch (error) {
    errorMessage.value = error?.message || '下载文件夹打开失败'
  } finally {
    openingDownloadFolder.value = false
  }
}
const statusLabel = (item) => (
  qualityBlocked(item)
    ? '已拦截'
    : ({
        queued: '排队中',
        downloading: '下载中',
        reversing: 'GMI 反向',
        awaiting_confirmation: '待 FRW 确认',
        generating: 'FRW GIF 五套裂变',
        packaging: '打包中',
        completed: '已完成',
        completed_with_errors: '部分完成（有错误）',
        partial: '部分失败',
        failed: '失败',
        cancelled: '已取消'
      }[String(item?.status || '').toLowerCase()] || String(item?.status || '未知'))
)
const progressClass = (status) => (
  ['failed', 'cancelled'].includes(String(status || '').toLowerCase())
    ? 'bg-red-400'
    : ['partial', 'completed_with_errors'].includes(String(status || '').toLowerCase())
      ? 'bg-amber-400'
      : 'bg-emerald-400'
)

const persistPrefs = () => {
  const safe = sanitizeTaskCenterPersistence({
    jobIds: [...new Set([
      ...(Array.isArray(props.data?.jobIds) ? props.data.jobIds : []),
      ...jobs.value.map(jobId)
    ])],
    filters
  })
  persistTaskCenterState(window.localStorage, safe, STORAGE_KEY)
  updateNode(props.id, {
    jobIds: safe.jobIds,
    uiPrefs: { ...safe.filters }
  })
}

const loadJobs = async ({ abortExisting = false } = {}) => {
  if (listRequestInFlight && !abortExisting) return
  if (abortExisting) {
    requestSequence += 1
    listRequestController?.abort()
    listRequestController = null
    listRequestInFlight = false
  }
  const sequence = ++requestSequence
  const controller = new AbortController()
  listRequestController = controller
  listRequestInFlight = true
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listDspCreativeJobs({
      status: filters.status,
      mediaType: filters.mediaType,
      query: filters.query
    }, { signal: controller.signal })
    if (!mounted || sequence !== requestSequence) return
    jobs.value = getDspCreativeJobs(result)
    persistPrefs()
  } catch (error) {
    if (error?.name !== 'AbortError' && mounted && sequence === requestSequence) {
      errorMessage.value = error?.message || '任务历史读取失败'
    }
  } finally {
    if (sequence === requestSequence) {
      listRequestController = null
      listRequestInFlight = false
      loading.value = false
    }
  }
}

const filtersChanged = () => {
  persistPrefs()
  loadJobs({ abortExisting: true })
}

const replaceJob = (result) => {
  if (!mounted) return
  const payload = result?.data?.job || result?.data || result?.job || result
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
  const id = jobId(payload)
  if (!id) return
  const index = jobs.value.findIndex((item) => jobId(item) === id)
  if (index >= 0) jobs.value.splice(index, 1, payload)
  else jobs.value.unshift(payload)
  persistPrefs()
}

const runAction = async (item, action) => {
  const id = jobId(item)
  if (!id || busyJobId.value) return
  if (action === 'cancel' && !canCancel(item)) return
  if (action === 'retry' && !canRetry(item)) return
  if (action === 'cleanup' && !canCleanup(item)) return
  if (action === 'delete' && !canDelete(item)) return
  if (action === 'delete' && !window.confirm(`确认删除任务 ${id}？本地素材不会由前端自动删除。`)) return

  busyJobId.value = id
  errorMessage.value = ''
  try {
    if (action === 'cancel') replaceJob(await cancelDspCreativeJob(id))
    if (action === 'retry') {
      replaceJob(await retryDspCreativeJob(id))
      startPolling()
    }
    if (action === 'cleanup') {
      await cleanupDspCreativePublicFiles(id)
      if (mounted) await loadJobs()
    }
    if (action === 'delete') {
      await deleteDspCreativeJob(id)
      if (mounted) {
        jobs.value = jobs.value.filter((job) => jobId(job) !== id)
        persistPrefs()
      }
    }
  } catch (error) {
    if (mounted) errorMessage.value = error?.message || `${action} 操作失败`
  } finally {
    if (mounted) busyJobId.value = ''
  }
}

const startPolling = () => {
  stopPolling(false)
  if (!mounted || !isDocumentVisible(document)) return
  pollTimer = window.setInterval(() => {
    if (mounted) loadJobs()
  }, DSP_CREATIVE_POLL_INTERVAL)
}

const stopPolling = (abortRequest = false) => {
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  if (abortRequest) {
    requestSequence += 1
    listRequestController?.abort()
    listRequestController = null
    listRequestInFlight = false
    loading.value = false
  }
}

const visibilityPolling = createVisibilityPollingController({
  documentRef: document,
  onHidden: () => stopPolling(false),
  onVisible: async () => {
    if (!mounted) return
    await loadJobs()
    if (mounted) startPolling()
  }
})

onMounted(async () => {
  mounted = true
  visibilityPolling.start()
  const persisted = readPersistedTaskCenterState(window.localStorage, STORAGE_KEY)
  Object.assign(filters, resolveTaskCenterPreferences(props.data?.uiPrefs, persisted.filters))
  updateNode(props.id, {
    jobIds: Array.isArray(props.data?.jobIds) && props.data.jobIds.length
      ? props.data.jobIds
      : persisted.jobIds,
    uiPrefs: { ...filters }
  })
  await loadJobs()
  if (mounted) startPolling()
})
onUnmounted(() => {
  mounted = false
  visibilityPolling.stop()
  stopPolling(true)
})
</script>

<style scoped>
.dsp-task-center__shell {
  border-color: rgba(159, 181, 215, 0.15);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(23, 33, 49, 0.97), rgba(13, 19, 30, 0.98));
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
}
.dsp-task-center__header {
  padding: 20px 22px;
  background:
    radial-gradient(circle at 15% 0%, rgba(251, 191, 36, 0.08), transparent 45%),
    rgba(14, 20, 31, 0.82);
}
.dsp-task-center__filters {
  padding: 12px;
  border: 1px solid rgba(159, 181, 215, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
}
.dsp-task-card {
  border-color: rgba(159, 181, 215, 0.13) !important;
  border-radius: 17px !important;
  background: rgba(255, 255, 255, 0.026) !important;
}
.service-incident {
  display: grid;
  gap: 4px;
}
.service-incident small {
  color: var(--text-secondary);
  line-height: 1.5;
}
.filter-control {
  @apply min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors;
}
.filter-control:focus {
  @apply border-amber-400;
}
.primary-button {
  @apply inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40;
}
.node-icon-button {
  @apply rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)];
}
.empty-state {
  @apply rounded-xl border border-dashed border-[var(--border-color)] px-4 py-10 text-center text-xs text-[var(--text-secondary)];
}
.notice-error {
  @apply rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400;
}
.status-pill {
  @apply rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300;
}
.media-pill {
  @apply rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-300;
}
.action-button {
  @apply inline-flex items-center rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:border-amber-400 hover:text-amber-300 disabled:opacity-40;
}
.danger-button {
  @apply inline-flex items-center rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-40;
}
</style>
