<template>
  <div class="relative nodrag" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div class="w-[600px] overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
      <div class="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
        <div>
          <div class="text-base font-semibold text-[var(--text-primary)]">素材裂变</div>
          <div class="mt-1 text-[11px] text-[var(--text-secondary)]">
            逆向提示词 → 独立创意 → 多尺寸投放素材
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button class="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]" title="复制节点" @click="duplicateNode(id)">
            <n-icon :size="16"><CopyOutline /></n-icon>
          </button>
          <button class="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]" title="删除节点" @click="removeNode(id)">
            <n-icon :size="16"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>

      <div class="space-y-4 p-5">
        <div>
          <div class="mb-2 text-xs font-medium text-[var(--text-primary)]">参考素材</div>
          <label
            class="relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-xl border border-dashed bg-[var(--bg-tertiary)] px-4 py-3 text-left transition-colors"
            :class="dragActive ? 'border-emerald-300 bg-emerald-400/10' : 'border-[var(--border-color)] hover:border-emerald-400'"
            @dragenter.prevent="dragActive = true"
            @dragover.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false"
            @drop.prevent="handleFileDrop"
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.zip"
              aria-label="选择参考素材"
              class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              @click="$event.target.value = ''"
              @change="handleFileChange"
            />
            <span>
              <span class="block text-sm text-[var(--text-primary)]">{{ sourceTitle }}</span>
              <span class="mt-1 block text-[11px]" :class="hasUsableSource ? 'text-emerald-400' : 'text-[var(--text-secondary)]'">
                {{ sourceSubtitle }}
              </span>
            </span>
            <n-icon :size="20" class="text-emerald-400"><CloudUploadOutline /></n-icon>
          </label>
          <div class="mt-2 text-[11px] text-[var(--text-secondary)]">
            点击选择或拖入 JPG / PNG / WebP / ZIP，最大 100MB
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1.5 block text-xs text-[var(--text-secondary)]">创意数量</span>
            <input
              v-model.number="creativeCount"
              type="number"
              min="2"
              max="20"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-emerald-400"
              @change="creativeCount = normalizeMaterialVariationCount(creativeCount)"
            />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-[var(--text-secondary)]">裂变强度</span>
            <select
              v-model="strength"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-emerald-400"
            >
              <option value="subtle">轻度：保留更多原图</option>
              <option value="moderate">中度：平衡变化</option>
              <option value="strong">强度：拉开测试差异</option>
            </select>
          </label>
        </div>

        <div>
          <div class="mb-2 text-xs text-[var(--text-secondary)]">质量模式</div>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="rounded-xl border px-3 py-2 text-left transition-colors"
              :class="qualityMode === 'fast' ? activeOptionClass : inactiveOptionClass"
              @click="qualityMode = 'fast'"
            >
              <span class="block text-sm font-medium">快速</span>
              <span class="mt-0.5 block text-[10px] opacity-70">每个创意一张母版，本地适配</span>
            </button>
            <button
              class="rounded-xl border px-3 py-2 text-left transition-colors"
              :class="qualityMode === 'quality' ? activeOptionClass : inactiveOptionClass"
              @click="qualityMode = 'quality'"
            >
              <span class="block text-sm font-medium">高质量 1080p</span>
              <span class="mt-0.5 block text-[10px] opacity-70">按尺寸分别生成；视频素材接入 AI 超分</span>
            </button>
          </div>
          <div class="mt-2 text-[10px] text-[var(--text-secondary)]">
            {{ qualityMode === 'fast' ? '快速导出：保留原始生成尺寸' : '最终输出以任务返回的实际尺寸为准，不把普通放大标成 1080p' }}
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs text-[var(--text-secondary)]">输出尺寸</span>
            <span class="text-[10px] text-[var(--text-secondary)]">
              {{ creativeCount }} 个创意 · 预计 {{ creativeCount * selectedSizes.length }} 张
            </span>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <label
              v-for="size in DEFAULT_MATERIAL_VARIATION_SIZES"
              :key="size"
              class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs"
              :class="selectedSizes.includes(size) ? activeOptionClass : inactiveOptionClass"
            >
              <input
                type="checkbox"
                class="accent-emerald-500"
                :checked="selectedSizes.includes(size)"
                @change="toggleSize(size)"
              />
              {{ size }}
            </label>
          </div>
        </div>

        <button
          :disabled="submitting || isWorking || !hasUsableSource"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-400/10 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          @click="submitVariation('compare_masters')"
        >
          <n-spin v-if="submitting" :size="14" />
          Grok 双版高清对比
        </button>

        <div class="grid grid-cols-2 gap-2">
          <button
            :disabled="submitting || isWorking || !hasUsableSource"
            class="rounded-xl border border-sky-400/40 bg-sky-400/10 py-2.5 text-sm font-medium text-sky-400 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            @click="submitVariation('reverse')"
          >
            只逆向
          </button>
          <button
            :disabled="submitting || isWorking || !hasUsableSource"
            class="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            @click="submitVariation('generate')"
          >
            <n-spin v-if="submitting" :size="14" />
            逆向并生成
          </button>
        </div>

        <div v-if="jobId || status" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium" :class="statusColor">{{ statusText }}</span>
            <span class="font-mono text-emerald-400">{{ progressPercent }}%</span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
            <div class="h-full rounded-full bg-emerald-400 transition-all" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <div class="mt-2 truncate text-[10px] text-[var(--text-secondary)]">
            {{ currentStep || `任务：${jobId}` }}
          </div>
          <div class="mt-1 text-[10px] text-[var(--text-secondary)]">AI 超分：{{ upscaleStatusLabel }} · 实际输出：{{ actualOutputLabel }}</div>
        </div>

        <div v-if="visibleError" class="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
          {{ visibleError }}
        </div>

        <button
          v-if="canRetry"
          :disabled="retrying"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 py-2 text-sm text-amber-400 hover:bg-amber-400/20 disabled:opacity-50"
          @click="handleRetry"
        >
          <n-spin v-if="retrying" :size="14" />
          <n-icon v-else :size="15"><RefreshOutline /></n-icon>
          重试失败项
        </button>

        <details v-if="analysisText" class="rounded-xl border border-[var(--border-color)] bg-black/10 p-3">
          <summary class="cursor-pointer text-xs font-medium text-[var(--text-primary)]">逆向分析与测试方向</summary>
          <pre class="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-[var(--text-secondary)]">{{ analysisText }}</pre>
        </details>

        <div v-if="comparisonMasters.length || comparisonFailures.length" class="space-y-3 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
          <div>
            <div class="text-xs font-semibold text-cyan-300">双版高清母版对比</div>
            <div class="mt-1 text-[10px] text-[var(--text-secondary)]">
              两版均为无字母版，选中后再进入 GIF 和本地文字排版。
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="master in comparisonMasters"
              :key="master.id"
              class="overflow-hidden rounded-xl border bg-black/20 text-left transition-colors"
              :class="selectedComparisonId === master.id ? 'border-cyan-300 ring-1 ring-cyan-300/50' : 'border-[var(--border-color)]'"
              @click="selectComparisonMaster(master)"
            >
              <img :src="assetUrlOf(master)" :alt="master.label" class="h-44 w-full object-contain" />
              <span class="block px-2 pt-2 text-xs font-medium text-[var(--text-primary)]">{{ master.label }}</span>
              <span class="block px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                {{ master.width }}×{{ master.height }} · {{ master.model }}
              </span>
              <span class="mx-2 mb-2 block rounded-lg border border-cyan-400/40 py-1 text-center text-[10px] text-cyan-300">
                {{ selectedComparisonId === master.id ? '已选为 GIF 母版' : '选为 GIF 母版' }}
              </span>
            </button>
          </div>
          <div v-if="comparisonMasters.length" class="flex flex-wrap gap-2">
            <a
              v-for="master in comparisonMasters"
              :key="`download-${master.id}`"
              :href="assetUrlOf(master)"
              download
              class="rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-[10px] text-[var(--text-secondary)] hover:border-cyan-400 hover:text-cyan-300"
            >
              下载 {{ master.label }}
            </a>
          </div>
          <div
            v-for="failure in comparisonFailures"
            :key="failure.id"
            class="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-300"
          >
            {{ failure.label }}失败：{{ failure.error }}
          </div>
        </div>

        <div v-if="primaryAssets.length" class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-medium text-[var(--text-primary)]">结果预览</div>
              <div class="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                每个独立创意仅展示一个主尺寸
              </div>
            </div>
            <a
              v-if="zipUrl"
              :href="zipUrl"
              download
              class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              下载全部 ZIP
            </a>
          </div>
          <div class="grid max-h-72 grid-cols-3 gap-2 overflow-auto pr-1">
            <button
              v-for="(asset, index) in primaryAssets"
              :key="assetKey(asset, index)"
              class="overflow-hidden rounded-xl border bg-black/20 text-left"
              :class="winnerIndex === String(index) ? 'border-emerald-400' : 'border-[var(--border-color)]'"
              @click="winnerIndex = String(index)"
            >
              <img :src="assetUrlOf(asset)" :alt="assetLabel(asset, index)" class="h-28 w-full object-contain" />
              <span class="block truncate px-2 py-1.5 text-[10px] text-[var(--text-secondary)]">
                {{ assetLabel(asset, index) }}
              </span>
            </button>
          </div>

          <div class="rounded-xl border border-[var(--border-color)] p-3">
            <div class="mb-2 text-xs font-medium text-[var(--text-primary)]">胜出素材</div>
            <div class="grid grid-cols-[1fr_110px] gap-2">
              <select
                v-model="winnerIndex"
                class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs outline-none focus:border-emerald-400"
              >
                <option v-for="(asset, index) in primaryAssets" :key="assetKey(asset, index)" :value="String(index)">
                  {{ assetLabel(asset, index) }}
                </option>
              </select>
              <input
                v-model="ctr"
                type="number"
                min="0"
                step="0.01"
                placeholder="CTR（可选）"
                class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs outline-none focus:border-emerald-400"
              />
            </div>
            <button
              :disabled="secondWaveSubmitting || !selectedWinner"
              class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40"
              @click="handleSecondWave"
            >
              <n-spin v-if="secondWaveSubmitting" :size="14" />
              发起二轮裂变
            </button>
          </div>
        </div>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-emerald-400" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-emerald-400" />
      <NodeHandleMenu :nodeId="id" nodeType="materialVariation" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { CloudUploadOutline, CopyOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import {
  createMaterialVariation,
  getMaterialVariation,
  retryMaterialVariation,
  startMaterialVariationSecondWave
} from '../../api/materialVariation'
import {
  DEFAULT_MATERIAL_VARIATION_COUNT,
  DEFAULT_MATERIAL_VARIATION_SIZES,
  MATERIAL_VARIATION_POLL_INTERVAL,
  assetUrlOf,
  buildMaterialVariationPayload,
  buildSecondWavePayload,
  getMaterialVariationProgress,
  getPrimaryCreativeAssets,
  isMaterialVariationTerminal,
  normalizeMaterialVariationCount,
  normalizeMaterialVariationSizes,
  readMaterialVariationFile,
  unwrapMaterialVariationTask,
  validateMaterialVariationFile
} from '../../utils/materialVariation'
import { addNodes, duplicateNode, nodes, removeNode, updateNode } from '../../stores/canvas'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { getVideoQualityProfile } from '../../utils/videoQualityProfile'

const props = defineProps({
  id: String,
  data: Object
})

const selectedFile = ref(null)
const dragActive = ref(false)
const creativeCount = ref(normalizeMaterialVariationCount(props.data?.count))
const selectedSizes = ref(normalizeMaterialVariationSizes(props.data?.sizes))
const qualityMode = ref(props.data?.qualityMode === 'fast' ? 'fast' : 'quality')
const strength = ref(['subtle', 'moderate', 'strong'].includes(props.data?.strength) ? props.data.strength : 'moderate')
const task = ref(props.data?.taskSnapshot || {})
const submitting = ref(false)
const retrying = ref(false)
const secondWaveSubmitting = ref(false)
const polling = ref(false)
const pollError = ref('')
const ctr = ref(props.data?.ctr ?? '')
const winnerIndex = ref(String(props.data?.winnerIndex ?? 0))
const selectedComparisonId = ref(String(props.data?.selectedComparisonId || ''))
const showHandleMenu = ref(false)
const materializedJobId = ref(props.data?.materializedJobId || '')
const materializedCreativeIds = ref(
  Array.isArray(props.data?.materializedCreativeIds) ? [...props.data.materializedCreativeIds] : []
)
let pollTimer = null

const activeOptionClass = 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
const inactiveOptionClass = 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'

const sourceJobId = computed(() => String(props.data?.sourceJobId || '').trim())
const qualityProfile = computed(() => getVideoQualityProfile(qualityMode.value, '16:9'))
const hasUsableSource = computed(() => Boolean(selectedFile.value || sourceJobId.value))
const formatFileSize = (bytes) => {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return ''
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}
const sourceTitle = computed(() => (
  selectedFile.value?.name
  || (sourceJobId.value ? '已连接 54DSP 优秀素材' : '')
  || props.data?.fileName
  || '单张图片或 ZIP'
))
const sourceSubtitle = computed(() => {
  if (selectedFile.value) {
    return `已选择 · ${formatFileSize(selectedFile.value.size)}`
  }
  if (sourceJobId.value) {
    return `已连接任务 ${sourceJobId.value}，可直接逆向或生成`
  }
  return '尚未选择素材'
})

const jobId = computed(() => task.value?.job_id || task.value?.jobId || props.data?.jobId || '')
const status = computed(() => String(task.value?.status || props.data?.status || '').toLowerCase())
const isWorking = computed(() => ['queued', 'submitted', 'running', 'processing'].includes(status.value))
const canRetry = computed(() => ['partial', 'failed'].includes(status.value) && Boolean(jobId.value))
const progressPercent = computed(() => getMaterialVariationProgress(task.value?.status ? task.value : props.data))
const currentStep = computed(() => task.value?.current_step || task.value?.currentStep || props.data?.currentStep || '')
const upscaleStatusLabel = computed(() => {
  const value = String(task.value?.upscale_status || props.data?.upscale_status || '').toLowerCase()
  return ({ queued: '等待中', running: '处理中', completed: '已完成', failed: '失败' }[value] || (qualityMode.value === 'fast' ? '未启用' : '等待后端回报'))
})
const actualOutputLabel = computed(() => {
  const width = Number(task.value?.actual_width || props.data?.actual_width)
  const height = Number(task.value?.actual_height || props.data?.actual_height)
  return width > 0 && height > 0 ? `${width}×${height}` : '等待实际尺寸'
})
const visibleError = computed(() => {
  const error = task.value?.error || props.data?.error
  return pollError.value || error?.message || error || ''
})
const statusText = computed(() => ({
  queued: '已接单，等待处理',
  submitted: '任务已提交',
  running: '素材裂变中',
  processing: '素材裂变中',
  completed: '生成完成',
  partial: '部分完成，可重试失败项',
  failed: '任务失败'
}[status.value] || '等待开始'))
const statusColor = computed(() => (
  status.value === 'failed'
    ? 'text-red-400'
    : status.value === 'partial'
      ? 'text-amber-400'
      : 'text-emerald-400'
))

const flattenAssets = (value) => {
  const source = Array.isArray(value) ? value : []
  return source.flatMap((item) => Array.isArray(item?.assets) ? item.assets : [item])
}

const assets = computed(() => flattenAssets(
  task.value?.assets || task.value?.results || props.data?.assets || []
))
const primaryAssets = computed(() => getPrimaryCreativeAssets(assets.value, selectedSizes.value))
const zipUrl = computed(() => (
  task.value?.zip_url || task.value?.zipUrl || props.data?.zipUrl || ''
))
const analysisText = computed(() => {
  const analysis = task.value?.analysis || task.value?.reverse_analysis || task.value?.reverseAnalysis || props.data?.reverseAnalysis
  if (!analysis) return ''
  return typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2)
})
const selectedWinner = computed(() => primaryAssets.value[Number(winnerIndex.value)] || null)
const comparisonMasters = computed(() => (
  Array.isArray(task.value?.comparison_masters)
    ? task.value.comparison_masters.filter((item) => assetUrlOf(item))
    : []
))
const comparisonFailures = computed(() => (
  Array.isArray(task.value?.failures)
    ? task.value.failures.filter((item) => item?.failure_stage === 'xai_master')
    : []
))

const assetKey = (asset, index) => (
  asset?.asset_id || asset?.id || `${asset?.creative_id || asset?.creativeId || index}-${asset?.size || index}`
)
const assetLabel = (asset, index) => {
  if (asset?.label) return String(asset.label)
  const creative = asset?.creative_id || asset?.creativeId || asset?.concept_id || `创意 ${index + 1}`
  return `${creative}${asset?.size ? ` · ${asset.size}` : ''}`
}

const selectComparisonMaster = (master) => {
  selectedComparisonId.value = String(master?.id || '')
  updateNode(props.id, {
    selectedComparisonId: selectedComparisonId.value,
    selectedComparisonMaster: master,
    updatedAt: Date.now()
  })
}

const toggleSize = (size) => {
  const next = selectedSizes.value.includes(size)
    ? selectedSizes.value.filter((item) => item !== size)
    : [...selectedSizes.value, size]
  selectedSizes.value = normalizeMaterialVariationSizes(next)
}

const applySelectedFile = (file) => {
  const validation = validateMaterialVariationFile(file)
  if (!validation.valid) {
    selectedFile.value = null
    pollError.value = validation.message
    window.$message?.error?.(validation.message)
    return
  }
  selectedFile.value = file
  pollError.value = ''
  updateNode(props.id, {
    fileName: file.name,
    updatedAt: Date.now()
  })
}

const handleFileChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  applySelectedFile(file)
}

const handleFileDrop = (event) => {
  dragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) {
    pollError.value = '没有检测到可上传文件'
    return
  }
  applySelectedFile(file)
}

const materializePrimaryImages = (syncedTask) => {
  const syncedJobId = syncedTask?.job_id || syncedTask?.jobId || ''
  const syncedStatus = String(syncedTask?.status || '').toLowerCase()
  if (!syncedJobId || !['completed', 'partial'].includes(syncedStatus)) return

  const comparison = Array.isArray(syncedTask?.comparison_masters)
    ? syncedTask.comparison_masters.filter((item) => assetUrlOf(item))
    : []
  const syncedAssets = flattenAssets(syncedTask?.assets || syncedTask?.results || [])
  const primary = comparison.length
    ? comparison
    : getPrimaryCreativeAssets(syncedAssets, selectedSizes.value)
  if (!primary.length) return
  if (materializedJobId.value !== syncedJobId) {
    materializedJobId.value = syncedJobId
    materializedCreativeIds.value = []
  }
  const seen = new Set(materializedCreativeIds.value)
  const pending = primary.filter((asset, index) => {
    const creativeId = asset?.id || asset?.creative_id || asset?.creativeId || asset?.concept_id || `creative-${index + 1}`
    return !seen.has(String(creativeId))
  })
  if (!pending.length) return

  const sourceNode = nodes.value.find((node) => node.id === props.id)
  const origin = sourceNode?.position || { x: 100, y: 100 }
  const specs = pending.map((asset, index) => ({
    type: 'image',
    position: {
      x: origin.x + 680 + (index % 5) * 280,
      y: origin.y + Math.floor(index / 5) * 250
    },
    data: {
      url: assetUrlOf(asset),
      label: assetLabel(asset, index),
      publicProps: { name: assetLabel(asset, index) },
      variationJobId: syncedJobId,
      variationAsset: asset
    }
  }))

  addNodes(specs)
  materializedCreativeIds.value = [
    ...seen,
    ...pending.map((asset, index) => String(
      asset?.id || asset?.creative_id || asset?.creativeId || asset?.concept_id || `creative-${index + 1}`
    ))
  ]
  updateNode(props.id, {
    materializedJobId: syncedJobId,
    materializedCreativeIds: [...materializedCreativeIds.value],
    updatedAt: Date.now()
  })
}

const syncTask = (result) => {
  const synced = unwrapMaterialVariationTask(result)
  task.value = synced
  const syncedJobId = synced.job_id || synced.jobId || jobId.value
  const syncedAssets = flattenAssets(synced.assets || synced.results || [])
  updateNode(props.id, {
    jobId: syncedJobId,
    status: synced.status || status.value,
    progress: getMaterialVariationProgress(synced),
    currentStep: synced.current_step || synced.currentStep || '',
    assets: syncedAssets,
    zipUrl: synced.zip_url || synced.zipUrl || '',
    reverseAnalysis: synced.analysis || synced.reverse_analysis || synced.reverseAnalysis || null,
    comparisonMasters: synced.comparison_masters || [],
    selectedComparisonId: selectedComparisonId.value,
    error: synced.error?.message || synced.error || null,
    taskSnapshot: synced,
    count: creativeCount.value,
    sizes: [...selectedSizes.value],
    qualityMode: qualityMode.value,
    upscale_status: synced.upscale_status || '',
    actual_width: synced.actual_width || null,
    actual_height: synced.actual_height || null,
    strength: strength.value,
    updatedAt: Date.now()
  })
  materializePrimaryImages(synced)
}

const stopPolling = () => {
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
}

const pollCurrentTask = async () => {
  if (!jobId.value || polling.value) return
  polling.value = true
  try {
    const result = await getMaterialVariation(jobId.value)
    pollError.value = ''
    syncTask(result)
    if (isMaterialVariationTerminal(unwrapMaterialVariationTask(result).status)) stopPolling()
  } catch (error) {
    pollError.value = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || '查询任务失败'
  } finally {
    polling.value = false
  }
}

const startPolling = () => {
  if (!jobId.value || isMaterialVariationTerminal(status.value)) return
  stopPolling()
  pollCurrentTask()
  pollTimer = window.setInterval(pollCurrentTask, MATERIAL_VARIATION_POLL_INTERVAL)
}

const submitVariation = async (action) => {
  if (submitting.value) return
  if (!hasUsableSource.value) {
    pollError.value = '请先选择单张图片或 ZIP'
    window.$message?.warning?.(pollError.value)
    return
  }

  submitting.value = true
  pollError.value = ''
  try {
    const fileData = selectedFile.value
      ? await readMaterialVariationFile(selectedFile.value)
      : ''
    const payload = buildMaterialVariationPayload({
      fileName: selectedFile.value?.name || '',
      fileData,
      sourceJobId: selectedFile.value ? '' : sourceJobId.value,
      count: creativeCount.value,
      sizes: selectedSizes.value,
      qualityMode: qualityMode.value,
      strength: strength.value,
      action
    })
    const requestPayload = { ...payload, quality_profile: qualityProfile.value }
    const result = await createMaterialVariation(requestPayload)
    materializedJobId.value = ''
    materializedCreativeIds.value = []
    selectedComparisonId.value = ''
    updateNode(props.id, {
      fileName: selectedFile.value?.name || props.data?.fileName || '',
      materializedJobId: '',
      materializedCreativeIds: [],
      winnerIndex: 0,
      selectedComparisonId: '',
      selectedComparisonMaster: null,
      ctr: '',
      updatedAt: Date.now()
    })
    winnerIndex.value = '0'
    ctr.value = ''
    syncTask(result)
    startPolling()
  } catch (error) {
    pollError.value = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || '创建素材裂变任务失败'
  } finally {
    submitting.value = false
  }
}

const handleRetry = async () => {
  if (!jobId.value || retrying.value) return
  retrying.value = true
  pollError.value = ''
  try {
    const result = await retryMaterialVariation(jobId.value)
    syncTask(result)
    startPolling()
  } catch (error) {
    pollError.value = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || '重试失败'
  } finally {
    retrying.value = false
  }
}

const handleSecondWave = async () => {
  if (!jobId.value || !selectedWinner.value || secondWaveSubmitting.value) return
  secondWaveSubmitting.value = true
  pollError.value = ''
  try {
    const payload = buildSecondWavePayload({
      asset: selectedWinner.value,
      ctr: ctr.value,
      count: creativeCount.value,
      sizes: selectedSizes.value,
      qualityMode: qualityMode.value,
      strength: strength.value
    })
    const parentJobId = jobId.value
    const requestPayload = { ...payload, quality_profile: qualityProfile.value }
    const result = await startMaterialVariationSecondWave(parentJobId, requestPayload)
    materializedJobId.value = ''
    materializedCreativeIds.value = []
    updateNode(props.id, {
      parentJobId,
      materializedJobId: '',
      materializedCreativeIds: [],
      winnerIndex: Number(winnerIndex.value),
      ctr: ctr.value,
      updatedAt: Date.now()
    })
    syncTask(result)
    startPolling()
  } catch (error) {
    pollError.value = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || '发起二轮裂变失败'
  } finally {
    secondWaveSubmitting.value = false
  }
}

watch(
  () => props.data?.jobId,
  (nextJobId) => {
    if (nextJobId && nextJobId !== (task.value?.job_id || task.value?.jobId)) {
      task.value = props.data?.taskSnapshot || { job_id: nextJobId, status: props.data?.status }
    }
    startPolling()
  }
)

onMounted(() => startPolling())
onUnmounted(() => stopPolling())
</script>
