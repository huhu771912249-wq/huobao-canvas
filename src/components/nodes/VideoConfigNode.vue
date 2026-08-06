<template>
  <!-- Video config node wrapper | 视频配置节点包裹层 -->
  <div class="video-config-node-wrapper relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <!-- Video config node | 视频配置节点 -->
    <div class="video-config-node bg-[var(--bg-secondary)] rounded-xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span
          v-if="!isEditingLabel"
          @dblclick="startEditLabel"
          class="text-sm font-medium text-[var(--text-secondary)] cursor-text hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
          title="双击编辑名称"
        >{{ data.label || '视频生成' }}</span>
        <input
          v-else
          ref="labelInputRef"
          v-model="editingLabelValue"
          @blur="finishEditLabel"
          @keydown.enter="finishEditLabel"
          @keydown.escape="cancelEditLabel"
          class="text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1 rounded outline-none border border-blue-500"
        />
        <div class="flex items-center gap-1">
          <button @click="handleDuplicate" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="复制节点">
            <n-icon :size="14">
              <CopyOutline />
            </n-icon>
          </button>
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="删除节点">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="p-3 space-y-3">
        <!-- Model selector | 模型选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">模型</span>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ displayModelName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <div v-if="localModel === 'ltx-2.3'" class="space-y-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[var(--text-primary)]">LTX 2.3 原生语音</span>
            <span class="text-[10px] text-cyan-400">48kHz · 双声道</span>
          </div>
          <p class="text-[11px] leading-relaxed text-[var(--text-secondary)]">使用已连接的提示词生成讲话、音乐或环境声。</p>
          <button type="button" :disabled="audioGenerating || !connectedPrompt" class="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40" @click="handleGenerateAudio">
            {{ audioGenerating ? '语音生成中…' : '生成原生语音' }}
          </button>
          <div v-if="audioError" class="text-[11px] text-red-400">{{ audioError }}</div>
          <audio v-if="audioUrl" :src="audioUrl" controls class="h-9 w-full" />
          <a v-if="audioUrl" :href="audioUrl" download class="block text-center text-[11px] text-cyan-400 hover:underline">下载 FLAC</a>
          <div class="border-t border-cyan-400/20 pt-2 space-y-2">
            <div class="text-[11px] font-medium text-[var(--text-primary)]">合成带声音和字幕的 MP4</div>
            <input v-model.trim="compositionVideoUrl" class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1.5 text-[11px] text-[var(--text-primary)]" placeholder="视频公网地址（连接输出节点时自动读取）" />
            <textarea v-model="subtitleText" rows="3" class="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1.5 text-[11px] text-[var(--text-primary)]" placeholder="输入字幕，每行一句；系统按音频时长生成时间轴" />
            <button type="button" :disabled="compositionGenerating || !audioUrl || !effectiveCompositionVideoUrl || !subtitleText.trim()" class="w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" @click="handleComposeMedia">
              {{ compositionGenerating ? '正在合成…' : '生成最终 MP4' }}
            </button>
            <div v-if="compositionError" class="text-[11px] text-red-400">{{ compositionError }}</div>
            <video v-if="compositionUrl" :src="compositionUrl" controls class="w-full rounded-lg" />
            <a v-if="compositionUrl" :href="compositionUrl" download class="block text-center text-[11px] text-violet-400 hover:underline">下载带音频字幕 MP4</a>
          </div>
        </div>

        <div v-if="isBatchCapable" class="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[var(--text-primary)]">批量广告尺寸</span>
            <span class="text-[10px] text-emerald-400">3 个母版 → 4 个成品</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="size in VIDEO_BATCH_SIZES"
              :key="size"
              type="button"
              class="rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors"
              :class="localBatchSizes.includes(size)
                ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400'
                : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
              @click="toggleBatchSize(size)"
            >
              {{ localBatchSizes.includes(size) ? '✓ ' : '' }}{{ size }}
            </button>
          </div>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs"
            @click="toggleGif"
          >
            <span class="text-[var(--text-secondary)]">输出 GIF（同时保留 MP4）</span>
            <span
              class="rounded-full px-2 py-0.5 font-medium"
              :class="localGenerateGif ? 'bg-amber-400/15 text-amber-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'"
            >
              {{ localGenerateGif ? '已开启' : '已关闭' }}
            </span>
          </button>
        </div>

        <!-- Aspect ratio selector | 宽高比选择 -->
        <div v-if="!isBatchCapable" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">比例</span>
          <n-dropdown :options="ratioOptions" @select="handleRatioSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ localRatio }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Duration selector | 时长选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">时长</span>
          <n-dropdown :options="durationOptions" @select="handleDurationSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ localDuration }}s
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>

        <div v-if="isScail2Model" class="space-y-2 rounded-lg border border-[var(--border-color)] p-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-secondary)]">驱动视频</span>
            <button
              type="button"
              class="rounded-md bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] hover:text-[var(--accent-color)]"
              @click="drivingVideoInputRef?.click()"
            >
              选择本地视频
            </button>
          </div>
          <input
            ref="drivingVideoInputRef"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            class="hidden"
            @change="handleDrivingVideoSelect"
          />
          <div class="truncate text-[11px]" :class="drivingVideoFile ? 'text-green-500' : 'text-amber-500'">
            {{ drivingVideoFile ? `已选择：${drivingVideoFile.name}` : '必须选择动作来源视频（最大 100MB）' }}
          </div>
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]">
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedPrompt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompt ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.firstFrame ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            首帧 {{ imagesByRole.firstFrame ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.lastFrame ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            尾帧 {{ imagesByRole.lastFrame ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.referenceImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ imagesByRole.referenceImages.length > 0 ? `✓ ${imagesByRole.referenceImages.length}` : '○' }}
          </span>
        </div>

        <!-- Progress bar | 进度条 -->
        <!-- <div v-if="status === 'polling'" class="space-y-1">
        <div class="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>生成中...</span>
          <span>{{ progress.percentage }}%</span>
        </div>
        <n-progress type="line" :percentage="progress.percentage" :show-indicator="false" :height="4" />
      </div> -->

        <!-- Generate button | 生成按钮 -->
        <button @click="handleGenerate" :disabled="isGenerating || !isConfigured || !isModelAvailable || (isScail2Model && !drivingVideoFile)"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="isGenerating" :size="14" />
          <template v-else>
            <n-icon :size="16">
              <VideocamOutline />
            </n-icon>
            {{ isBatchCapable ? '全部生成' : '生成视频' }}
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>
        <div v-else-if="!isModelAvailable" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前渠道 {{ modelStore.providerLabel }} 不支持 {{ displayModelName }}。切换到火宝 (Chatfire)，或改选当前渠道的视频模型。
        </div>
        <div v-else-if="isScail2Model && !scail2ReferenceInput" class="text-xs text-amber-500 mt-2 leading-relaxed">
          SCAIL-2 需要连接一张参考角色图，并在上方选择驱动视频。
        </div>
        <div v-else-if="isScail2Model && !connectedPrompt" class="text-xs text-amber-500 mt-2 leading-relaxed">
          请连接中文提示词，描述角色、动作和画面要求。
        </div>
        <div v-else-if="firstFrameNeedsPublicUrl" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前首帧是本地或内嵌图片，生成时会先自动发布成公网素材，再提交 FRW 视频。
        </div>
        <div v-else-if="!connectedPrompt" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前只连接了首帧图。建议再连接一个英文视频提示词，描述镜头运动和主体动作。
        </div>

        <!-- Generated video preview | 生成视频预览 -->
        <!-- <div v-if="generatedVideo?.url" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
        <div class="aspect-video rounded-lg overflow-hidden bg-black">
          <video :src="generatedVideo.url" controls class="w-full h-full object-contain" />
        </div>
      </div> -->
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
      <NodeHandleMenu :nodeId="id" nodeType="videoConfig" :visible="showHandleMenu" :operations="[]" />
    </div>

  </div>
</template>

<script setup>
/**
 * Video config node component | 视频配置节点组件
 * Configuration panel for video generation with API integration
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronForwardOutline, ChevronDownOutline, TrashOutline, VideocamOutline, CopyOutline, CreateOutline } from '@vicons/ionicons5'
import { useVideoGeneration } from '../../hooks'
import { publishImageAsset } from '../../api/image'
import { createLtxAudioTask, waitForLtxAudio } from '../../api/audio'
import { createMediaComposition } from '../../api/mediaComposition'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes, edges } from '../../stores/canvas'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { useModelStore } from '../../stores/pinia'
import { getModelRatioOptions, getModelDurationOptions, getModelConfig, DEFAULT_VIDEO_MODEL } from '../../stores/models'
import {
  VIDEO_BATCH_SIZES,
  normalizeVideoBatchSizes,
  supportsVideoBatch
} from '../../utils/videoBatch'

// 使用 Pinia store 获取模型选项（根据渠道过滤）
const modelStore = useModelStore()

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config state | API 配置状态
const isConfigured = computed(() => modelStore.isCurrentProviderConfigured)

// Video generation hook | 视频生成 hook
const { loading, error, status, video: generatedVideo, progress, createVideoTaskOnly } = useVideoGeneration()

// Local state | 本地状态
const showHandleMenu = ref(false)
const isGenerating = ref(false)  // 任务创建中状态
const localModel = ref(props.data?.model || DEFAULT_VIDEO_MODEL)
const localRatio = ref(props.data?.ratio || '16:9')
const localDuration = ref(props.data?.dur || 5)
const localBatchSizes = ref(normalizeVideoBatchSizes(props.data?.batchSizes || []))
const localGenerateGif = ref(props.data?.generateGif !== false)
const drivingVideoInputRef = ref(null)
const drivingVideoFile = ref(null)
const audioGenerating = ref(false)
const audioUrl = ref(props.data?.audioUrl || '')
const audioError = ref('')
const compositionVideoUrl = ref(props.data?.compositionVideoUrl || '')
const subtitleText = ref(props.data?.subtitleText || '')
const compositionGenerating = ref(false)
const compositionUrl = ref(props.data?.compositionUrl || '')
const compositionError = ref('')

// Label editing state | Label 编辑状态
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// Get connected images with roles | 获取连接的图片及其角色
const connectedImages = computed(() => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'image' && (sourceNode.data?.url || sourceNode.data?.base64 || sourceNode.data?.publicUrl)) {
      images.push({
        nodeId: sourceNode.id,
        edgeId: edge.id,
        url: sourceNode.data.url,
        base64: sourceNode.data.base64,
        publicUrl: sourceNode.data.publicUrl || sourceNode.data.public_url || '',
        localUrl: sourceNode.data.localUrl || sourceNode.data.local_url || '',
        role: edge.data?.imageRole || 'first_frame_image' // Default to first frame | 默认首帧
      })
    }
  }

  return images
})

// Get images by role | 按角色获取图片
const imagesByRole = computed(() => {
  const firstFrame = connectedImages.value.find(img => img.role === 'first_frame_image')
  const lastFrame = connectedImages.value.find(img => img.role === 'last_frame_image')
  const referenceImages = connectedImages.value.filter(img => img.role === 'input_reference')

  return {
    firstFrame,
    lastFrame,
    referenceImages
  }
})

const isScail2Model = computed(() => localModel.value === 'scail2-action-transfer')
const isLocalCloudModel = computed(() => ['minimax-h3', 'ltx-2.3'].includes(localModel.value))
const isBatchCapable = computed(() => supportsVideoBatch(localModel.value))
const scail2ReferenceInput = computed(() => {
  const image = imagesByRole.value.firstFrame || imagesByRole.value.referenceImages[0]
  return image ? pickVideoImageInput(image) : ''
})

const handleDrivingVideoSelect = (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > 100 * 1024 * 1024) {
    window.$message?.error('驱动视频不能超过 100MB')
    event.target.value = ''
    drivingVideoFile.value = null
    return
  }
  drivingVideoFile.value = file
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('驱动视频读取失败'))
  reader.readAsDataURL(file)
})

const isPublicHttpUrl = (url) => {
  const value = String(url || '').trim()
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false
  try {
    const { hostname } = new URL(value)
    const host = String(hostname || '').toLowerCase()
    return Boolean(host) && !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)
  } catch {
    return false
  }
}

const isDataImageUrl = (url) => String(url || '').trim().startsWith('data:image/')

const pickVideoImageInput = (image = {}) => {
  if (isPublicHttpUrl(image.publicUrl)) return image.publicUrl
  if (isPublicHttpUrl(image.public_url)) return image.public_url
  if (isPublicHttpUrl(image.url)) return image.url
  if (isPublicHttpUrl(image.localUrl)) return image.localUrl
  if (isPublicHttpUrl(image.local_url)) return image.local_url
  return image.base64 || image.url || image.publicUrl || image.public_url || image.localUrl || image.local_url || ''
}

const publishVideoImageInput = async (value, roleLabel) => {
  const source = String(value || '').trim()
  if (!source) return ''
  if (isPublicHttpUrl(source)) return source

  if (isDataImageUrl(source)) {
    const result = await publishImageAsset({
      image: source,
      name: `视频${roleLabel}`
    })
    const assetUrl = result.public_url || result.url || ''
    if (!isPublicHttpUrl(assetUrl)) {
      throw new Error(`${roleLabel}已转成本地素材，但还没有公网 URL；请先确认本地素材公网隧道可用后再生成视频。`)
    }
    return assetUrl
  }

  throw new Error(`${roleLabel}不是公网图片 URL，且没有可上传的 base64 图片；请重新上传图片或连接 FRW 作图输出。`)
}

const normalizeVideoImages = async ({ first_frame_image, last_frame_image, images }) => {
  const normalized = {
    first_frame_image: await publishVideoImageInput(first_frame_image, '首帧'),
    last_frame_image: await publishVideoImageInput(last_frame_image, '尾帧'),
    images: []
  }

  for (const [index, image] of images.entries()) {
    const url = await publishVideoImageInput(image, `参考图${index + 1}`)
    if (url) normalized.images.push(url)
  }

  return normalized
}

const firstFrameNeedsPublicUrl = computed(() => {
  if (isScail2Model.value || isLocalCloudModel.value) return false
  const firstFrame = imagesByRole.value.firstFrame
  if (!firstFrame) return false
  return !isPublicHttpUrl(pickVideoImageInput(firstFrame))
})

// Get current model config | 获取当前模型配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))

// Model options from Pinia store (filtered by provider) | 从 Pinia store 获取模型选项（根据渠道过滤）
const modelOptions = computed(() => modelStore.videoModelOptions)
const isModelAvailable = computed(() => modelStore.availableVideoModels.some(m => m.key === localModel.value))

// Display model name | 显示模型名称
const displayModelName = computed(() => {
  const model = modelStore.allVideoModels.find(m => m.key === localModel.value)
  return model?.label || localModel.value || '选择模型'
})

// Ratio options based on model | 基于模型的比例选项
const ratioOptions = computed(() => {
  return getModelRatioOptions(localModel.value)
})

// Duration options based on model | 基于模型的时长选项
const durationOptions = computed(() => {
  return getModelDurationOptions(localModel.value)
})

// Handle model selection | 处理模型选择
const handleModelSelect = (key) => {
  localModel.value = key
  // Update ratio and duration to model's default | 更新为模型默认比例和时长
  const config = getModelConfig(key)
  const updates = { model: key }
  if (config?.defaultParams?.ratio) {
    localRatio.value = config.defaultParams.ratio
    updates.ratio = config.defaultParams.ratio
  }
  if (config?.defaultParams?.duration) {
    localDuration.value = config.defaultParams.duration
    updates.dur = config.defaultParams.duration
  }
  if (supportsVideoBatch(key)) {
    updates.batchSizes = [...localBatchSizes.value]
    updates.generateGif = localGenerateGif.value
  }
  updateNode(props.id, updates)
}

const toggleBatchSize = (size) => {
  if (localBatchSizes.value.includes(size)) {
    if (localBatchSizes.value.length === 1) {
      window.$message?.warning('至少保留一个输出尺寸')
      return
    }
    localBatchSizes.value = localBatchSizes.value.filter(item => item !== size)
  } else {
    localBatchSizes.value = VIDEO_BATCH_SIZES.filter(
      item => item === size || localBatchSizes.value.includes(item)
    )
  }
  updateNode(props.id, { batchSizes: [...localBatchSizes.value] })
}

const toggleGif = () => {
  localGenerateGif.value = !localGenerateGif.value
  updateNode(props.id, { generateGif: localGenerateGif.value })
}

const resolveAvailableVideoModel = () => {
  const availableModels = modelStore.availableVideoModels
  if (availableModels.some(m => m.key === localModel.value)) {
    return localModel.value
  }
  if (availableModels.some(m => m.key === modelStore.selectedVideoModel)) {
    return modelStore.selectedVideoModel
  }
  return availableModels[0]?.key || DEFAULT_VIDEO_MODEL
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('节点已复制')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Handle ratio selection | 处理比例选择
const handleRatioSelect = (key) => {
  localRatio.value = key
  updateNode(props.id, { ratio: key })
}

// Handle duration selection | 处理时长选择
const handleDurationSelect = (key) => {
  localDuration.value = key
  updateNode(props.id, { dur: key })
}

// Get connected inputs by role | 根据角色获取连接的输入
const getConnectedInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)

  let prompt = ''
  let first_frame_image = ''
  let last_frame_image = ''
  const images = [] // input_reference images | 参考图

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      prompt = sourceNode.data?.content || ''
    } else if (sourceNode.type === 'llmConfig') {
      // LLM node output as prompt | LLM 节点输出作为提示词
      const content = sourceNode.data?.outputContent || ''
      if (content) prompt = content
    } else if (sourceNode.type === 'image' && (sourceNode.data?.url || sourceNode.data?.base64 || sourceNode.data?.publicUrl)) {
      const imageData = pickVideoImageInput(sourceNode.data)
      const role = edge.data?.imageRole || 'first_frame_image'

      if (role === 'first_frame_image') {
        first_frame_image = imageData
      } else if (role === 'last_frame_image') {
        last_frame_image = imageData
      } else if (role === 'input_reference') {
        images.push(imageData)
      }
    }
  }

  return { prompt, first_frame_image, last_frame_image, images }
}

const getErrorMessage = (err) => {
  return err?.response?.data?.error?.message
    || err?.response?.data?.message
    || err?.data?.error?.message
    || err?.data?.message
    || err?.message
    || '生成失败'
}

// Computed connected prompt | 计算连接的提示词
const connectedPrompt = computed(() => {
  return getConnectedInputs().prompt
})

const handleGenerateAudio = async () => {
  if (!connectedPrompt.value) {
    window.$message?.warning('请先连接文本提示词')
    return
  }
  audioGenerating.value = true
  audioError.value = ''
  try {
    const created = await createLtxAudioTask(connectedPrompt.value, localDuration.value)
    const completed = await waitForLtxAudio(created.task_id || created.taskId)
    audioUrl.value = completed.audio_url || completed.url
    updateNode(props.id, { audioUrl: audioUrl.value, audioTaskId: completed.task_id })
    window.$message?.success('LTX 2.3 原生语音生成完成')
  } catch (err) {
    audioError.value = getErrorMessage(err)
    window.$message?.error(audioError.value)
  } finally {
    audioGenerating.value = false
  }
}

const connectedOutputVideoUrl = computed(() => {
  for (const edge of edges.value.filter(item => item.source === props.id)) {
    const target = nodes.value.find(node => node.id === edge.target)
    if (target?.type === 'video' && target.data?.url) return target.data.url
  }
  return ''
})

const effectiveCompositionVideoUrl = computed(() => compositionVideoUrl.value || connectedOutputVideoUrl.value)

const handleComposeMedia = async () => {
  compositionGenerating.value = true
  compositionError.value = ''
  try {
    const result = await createMediaComposition({
      videoUrl: effectiveCompositionVideoUrl.value,
      audioUrl: audioUrl.value,
      subtitleText: subtitleText.value
    })
    compositionUrl.value = result.output_url
    updateNode(props.id, {
      compositionVideoUrl: effectiveCompositionVideoUrl.value,
      subtitleText: subtitleText.value,
      compositionUrl: compositionUrl.value
    })
    window.$message?.success('带音频和字幕的 MP4 已生成')
  } catch (err) {
    compositionError.value = getErrorMessage(err)
    window.$message?.error(compositionError.value)
  } finally {
    compositionGenerating.value = false
  }
}

// Created video node ID | 创建的视频节点 ID
const createdVideoNodeId = ref(null)

const findConnectedEmptyOutputNode = (nodeType) => {
  const outputEdges = edges.value.filter(edge => edge.source === props.id)
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(node => node.id === edge.target)
    if (
      targetNode?.type === nodeType &&
      !targetNode.data?.url &&
      !targetNode.data?.taskId &&
      !targetNode.data?.loading
    ) {
      return targetNode.id
    }
  }
  return null
}

// Handle generate action | 处理生成操作
const handleGenerate = async () => {
  // 设置生成中状态
  isGenerating.value = true

  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()

  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('请先连接文本节点或图片节点')
    isGenerating.value = false
    return
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    isGenerating.value = false
    return
  }

  if (!isModelAvailable.value) {
    window.$message?.warning('当前渠道不支持这个视频模型，请切换渠道或更换模型')
    isGenerating.value = false
    return
  }

  if (isScail2Model.value) {
    if (!prompt) {
      window.$message?.warning('SCAIL-2 动作迁移需要连接中文提示词')
      isGenerating.value = false
      return
    }
    if (!scail2ReferenceInput.value) {
      window.$message?.warning('SCAIL-2 动作迁移需要连接一张参考角色图')
      isGenerating.value = false
      return
    }
    if (!drivingVideoFile.value) {
      window.$message?.warning('请先选择驱动视频')
      isGenerating.value = false
      return
    }
  }

  // Get current node position | 获取当前节点位置
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  const outputNodeType = isBatchCapable.value ? 'videoBatch' : 'video'
  let videoNodeId = findConnectedEmptyOutputNode(outputNodeType)
  if (videoNodeId) {
    updateNode(videoNodeId, {
      url: '',
      taskId: null,
      error: null,
      loading: true,
      status: isBatchCapable.value ? 'queued' : undefined,
      assets: isBatchCapable.value ? [] : undefined,
      zipUrl: isBatchCapable.value ? '' : undefined,
      progress: 0,
      attempt: 0,
      label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...'
    })
  } else {
    // Create video node with loading state | 创建带加载状态的视频节点
    videoNodeId = addNode(outputNodeType, { x: nodeX + 350, y: nodeY }, {
      url: '',
      error: null,
      loading: true,
      status: isBatchCapable.value ? 'queued' : undefined,
      assets: isBatchCapable.value ? [] : undefined,
      zipUrl: isBatchCapable.value ? '' : undefined,
      outputFormats: isBatchCapable.value && localGenerateGif.value ? ['mp4', 'gif'] : ['mp4'],
      label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...'
    })

    // Auto-connect videoConfig → video | 自动连接 视频配置 → 视频
    addEdge({
      source: props.id,
      target: videoNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }
  createdVideoNodeId.value = videoNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(videoNodeId)
  }, 50)

  try {
    const normalizedImages = (isScail2Model.value || isLocalCloudModel.value)
      ? {
          first_frame_image: first_frame_image || images[0] || '',
          last_frame_image: '',
          images: []
        }
      : await normalizeVideoImages({ first_frame_image, last_frame_image, images })

    // Build request params (raw form data) | 构建请求参数（原始表单数据）
    // These will be transformed by inputTransform | 这些会被 inputTransform 转换
    const params = {
      model: localModel.value
    }

    // Add prompt if provided | 如果有提示词则添加
    if (prompt) {
      params.prompt = prompt
    }

    // Add first frame image | 添加首帧图片
    if (normalizedImages.first_frame_image) {
      params.first_frame_image = normalizedImages.first_frame_image
    }

    // Add last frame image | 添加尾帧图片
    if (normalizedImages.last_frame_image) {
      params.last_frame_image = normalizedImages.last_frame_image
    }

    // Add reference images (input_reference) | 添加参考图
    if (normalizedImages.images.length > 0) {
      params.images = normalizedImages.images
    }

    // Add ratio/size | 添加比例参数
    if (localRatio.value) {
      params.ratio = localRatio.value
    }

    // Add duration | 添加时长
    if (localDuration.value) {
      params.dur = localDuration.value
    }

    if (isBatchCapable.value) {
      params.sizes = [...localBatchSizes.value]
      params.output_formats = localGenerateGif.value ? ['mp4', 'gif'] : ['mp4']
    }

    if (isScail2Model.value) {
      params.driving_video = await readFileAsDataUrl(drivingVideoFile.value)
      params.driving_video_name = drivingVideoFile.value.name
    }

    // 只创建任务，获取 taskId，不在这里轮询
    const { taskId: newTaskId, url, result } = await createVideoTaskOnly(params)

    // 如果有直接 URL，更新视频节点
    if (url) {
      updateNode(videoNodeId, {
        url: url,
        taskId: result?.task_id || result?.taskId || null,
        status: result?.status || 'completed',
        assets: result?.assets || [],
        zipUrl: result?.zip_url || '',
        outputFormats: result?.output_formats || params.output_formats,
        loading: false,
        label: isBatchCapable.value ? '批量视频结果' : '视频生成',
        model: localModel.value,
        updatedAt: Date.now()
      })
      window.$message?.success('视频生成成功')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
    } else if (newTaskId) {
      // 需要轮询，传递 taskId 给 VideoNode
      updateNode(videoNodeId, {
        taskId: newTaskId,
        loading: true,
        status: result?.status || (isBatchCapable.value ? 'queued' : undefined),
        progress: result?.progress || 0,
        currentStep: result?.current_step || '',
        assets: result?.assets || [],
        outputFormats: result?.output_formats || params.output_formats,
        label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...',
        model: localModel.value,
        updatedAt: Date.now()
      })
      window.$message?.success('视频任务已创建')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
    }
  } catch (err) {
    const message = getErrorMessage(err)
    // Update node to show error | 更新节点显示错误
    updateNode(videoNodeId, {
      loading: false,
      error: message,
      label: '生成失败',
      updatedAt: Date.now()
    })
    window.$message?.error(message || '视频生成失败')
  } finally {
    isGenerating.value = false
  }
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || '视频生成'
  isEditingLabel.value = true
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

// Finish editing label | 完成编辑 label
const finishEditLabel = () => {
  const newLabel = editingLabelValue.value.trim()
  if (newLabel && newLabel !== props.data?.label) {
    updateNode(props.id, { label: newLabel })
  }
  isEditingLabel.value = false
}

// Cancel editing label | 取消编辑 label
const cancelEditLabel = () => {
  isEditingLabel.value = false
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
}

// Initialize on mount | 挂载时初始化
onMounted(() => {
  const resolvedModel = resolveAvailableVideoModel()
  if (!localModel.value || localModel.value !== resolvedModel) {
    localModel.value = resolvedModel
    updateNode(props.id, { model: resolvedModel })
  }
})

// Watch for model changes from props | 监听 props 中模型变化
watch(() => props.data?.model, (newModel) => {
  if (newModel && newModel !== localModel.value) {
    localModel.value = newModel
  }
})

watch(() => modelStore.currentProvider, () => {
  const resolvedModel = resolveAvailableVideoModel()
  if (resolvedModel && resolvedModel !== localModel.value) {
    localModel.value = resolvedModel
    updateNode(props.id, { model: resolvedModel })
  }
})

// 修复 Vue Flow visibility: hidden 问题
// 当节点数据变化时，强制更新内部状态
watch(() => props.data, () => {
  nextTick(() => {
    updateNodeInternals(props.id)
  })
}, { deep: true })

// Watch for auto-execute flag | 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !loading.value) {
      // Clear the flag first to prevent re-triggering | 先清除标志防止重复触发
      updateNode(props.id, { autoExecute: false })
      // Delay to ensure node connections are established | 延迟确保节点连接已建立
      setTimeout(() => {
        handleGenerate()
      }, 100)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.video-config-node-wrapper {
  position: relative;
  padding-top: 20px;
}

.video-config-node {
  cursor: default;
  position: relative;
}
</style>
