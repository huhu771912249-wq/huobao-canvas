<template>
  <div class="relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div
      class="w-[520px] rounded-2xl border bg-[var(--bg-secondary)] shadow-xl"
      :class="data.selected ? 'border-emerald-400' : 'border-[var(--border-color)]'"
    >
      <div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div>
          <div class="text-sm font-semibold text-[var(--text-primary)]">批量视频结果</div>
          <div class="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            4 个尺寸 · MP4{{ hasGif ? ' + GIF' : '' }}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <a
            v-if="data.zipUrl"
            :href="data.zipUrl"
            download
            class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            下载全部 ZIP
          </a>
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="复制节点" @click="handleDuplicate">
            <n-icon :size="15"><CopyOutline /></n-icon>
          </button>
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="删除节点" @click="removeNode(id)">
            <n-icon :size="15"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>

      <div class="p-4">
        <div v-if="isWorking" class="mb-4 rounded-xl bg-[var(--bg-tertiary)] p-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-[var(--text-primary)]">{{ data.currentStep || '正在生成母版' }}</span>
            <span class="font-mono text-emerald-400">{{ progressPercent }}%</span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
            <div class="h-full rounded-full bg-emerald-400 transition-all" :style="{ width: `${progressPercent}%` }"></div>
          </div>
        </div>

        <div v-if="data.error && !assets.length" class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
          {{ data.error }}
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="size in orderedSizes"
            :key="size"
            class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]"
          >
            <div class="flex items-center justify-between px-3 py-2">
              <span class="font-mono text-xs font-semibold text-[var(--text-primary)]">{{ size }}</span>
              <span class="text-[11px]" :class="statusClass(assetFor(size)?.status)">
                {{ statusLabel(assetFor(size)?.status) }}
              </span>
            </div>
            <video
              v-if="assetFor(size)?.mp4_url"
              :src="assetFor(size).mp4_url"
              controls
              muted
              loop
              class="h-28 w-full bg-black object-contain"
            />
            <div v-else class="flex h-28 items-center justify-center bg-black/25 text-xs text-[var(--text-secondary)]">
              {{ assetFor(size)?.error || (isWorking ? '生成中...' : '暂无结果') }}
            </div>
            <div class="flex gap-2 px-3 py-2">
              <a
                v-if="assetFor(size)?.mp4_url"
                :href="assetFor(size).mp4_url"
                download
                class="rounded-md bg-sky-500/15 px-2 py-1 text-[11px] text-sky-400 hover:bg-sky-500/25"
              >
                MP4
              </a>
              <a
                v-if="assetFor(size)?.gif_url"
                :href="assetFor(size).gif_url"
                download
                class="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/25"
              >
                GIF
              </a>
            </div>
          </div>
        </div>

        <button
          v-if="canRetry"
          :disabled="retrying"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 py-2 text-sm text-amber-400 hover:bg-amber-400/20 disabled:opacity-50"
          @click="handleRetry"
        >
          <n-spin v-if="retrying" :size="14" />
          <n-icon v-else :size="16"><RefreshOutline /></n-icon>
          仅重试失败尺寸
        </button>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-emerald-400" />
      <NodeHandleMenu :nodeId="id" nodeType="videoBatch" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { CopyOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import { retryVideoBatch } from '../../api/video'
import { duplicateNode, removeNode, updateNode } from '../../stores/canvas'
import { useVideoGeneration } from '../../hooks/useApi'
import { useModelStore } from '../../stores/pinia'
import { VIDEO_BATCH_SIZES } from '../../utils/videoBatch'
import NodeHandleMenu from './NodeHandleMenu.vue'

const props = defineProps({
  id: String,
  data: Object
})

const modelStore = useModelStore()
const { pollVideoTask } = useVideoGeneration()
const polling = ref(false)
const retrying = ref(false)
const showHandleMenu = ref(false)

const orderedSizes = VIDEO_BATCH_SIZES
const assets = computed(() => Array.isArray(props.data?.assets) ? props.data.assets : [])
const hasGif = computed(() => {
  const formats = props.data?.outputFormats || []
  return formats.includes('gif') || assets.value.some(asset => asset?.gif_url)
})
const progressPercent = computed(() => Math.max(0, Math.min(100, Math.round(Number(props.data?.progress || 0) * 100))))
const isWorking = computed(() => ['queued', 'submitted', 'running'].includes(String(props.data?.status || '').toLowerCase()))
const canRetry = computed(() => ['partial', 'failed'].includes(String(props.data?.status || '').toLowerCase()) && Boolean(props.data?.taskId))

const assetFor = (size) => assets.value.find(asset => asset?.size === size)
const statusLabel = (status) => ({
  completed: '已完成',
  failed: '失败',
  running: '处理中'
}[status] || (isWorking.value ? '等待中' : '未生成'))
const statusClass = (status) => ({
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  running: 'text-sky-400'
}[status] || 'text-[var(--text-secondary)]')

const syncResult = (result = {}) => {
  const payload = result?.data?.task_id ? result.data : result
  updateNode(props.id, {
    taskId: payload.task_id || payload.taskId || props.data?.taskId,
    status: payload.status || props.data?.status,
    progress: payload.progress ?? props.data?.progress ?? 0,
    currentStep: payload.current_step || payload.currentStep || '',
    assets: payload.assets || [],
    zipUrl: payload.zip_url || payload.zipUrl || '',
    outputFormats: payload.output_formats || props.data?.outputFormats || [],
    error: payload.error?.message || payload.error || null,
    updatedAt: Date.now()
  })
}

const startPolling = async () => {
  const taskId = props.data?.taskId
  if (!taskId || polling.value || !isWorking.value) return
  polling.value = true
  try {
    const result = await pollVideoTask(taskId, (_attempt, percentage) => {
      updateNode(props.id, { progress: Math.max(Number(props.data?.progress || 0), percentage / 100) })
    })
    syncResult(result)
    if (result.status === 'partial') {
      window.$message?.warning('部分尺寸生成失败，可点击仅重试失败尺寸')
    } else {
      window.$message?.success('四尺寸 MP4/GIF 已生成')
    }
  } catch (err) {
    updateNode(props.id, {
      status: 'failed',
      error: err?.message || '批量视频生成失败',
      updatedAt: Date.now()
    })
  } finally {
    polling.value = false
  }
}

const handleRetry = async () => {
  if (!props.data?.taskId || retrying.value) return
  retrying.value = true
  try {
    const result = await retryVideoBatch(props.data.taskId, {
      endpoint: modelStore.getVideoEndpoint()
    })
    syncResult(result)
    await startPolling()
  } catch (err) {
    updateNode(props.id, { error: err?.message || '重试失败' })
  } finally {
    retrying.value = false
  }
}

const handleDuplicate = () => duplicateNode(props.id)

watch(
  () => [props.data?.taskId, props.data?.status],
  () => startPolling()
)

onMounted(() => startPolling())
</script>
