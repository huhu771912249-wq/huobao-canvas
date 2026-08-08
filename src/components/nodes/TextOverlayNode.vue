<template>
  <div class="text-overlay-node-wrapper relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div
      class="text-overlay-node w-[520px] bg-[var(--bg-secondary)] rounded-xl border transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span class="text-sm font-medium text-[var(--text-primary)]">文字叠加</span>
        <div class="flex items-center gap-1">
          <button @click="handleDuplicate" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="复制节点">
            <n-icon :size="14"><CopyOutline /></n-icon>
          </button>
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="删除节点">
            <n-icon :size="14"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>

      <div class="p-3 space-y-3">
        <section class="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3 nodrag nowheel">
          <div>
            <div class="text-xs font-semibold text-[var(--text-primary)]">视频 / GIF 可视化加字</div>
            <div class="mt-1 text-[10px] text-[var(--text-secondary)]">连接左侧“素材导入”节点，或直接上传；在预览画面里拖动文字定位。</div>
          </div>
          <label class="block cursor-pointer rounded-lg border border-dashed border-cyan-300/40 p-3 text-center text-xs text-cyan-300">
            也可直接上传 MP4 / MOV / WebM / GIF
            <input class="hidden" type="file" accept="video/mp4,video/quicktime,video/webm,image/gif,.mp4,.mov,.webm,.gif" @change="handleVideoUpload" />
          </label>
          <div v-if="connectedMedia" class="truncate text-[10px] text-emerald-300">已连接：{{ connectedMedia.data?.label || '素材导入节点' }}</div>
          <div v-else-if="overlayVideoFile" class="truncate text-[10px] text-[var(--text-secondary)]">已选：{{ overlayVideoFile.name }}</div>
          <VisualTextOverlayEditor
            v-if="videoPreviewUrl"
            :source-url="videoPreviewUrl"
            :source-mime="videoSourceMime"
            :text="overlayText"
            :style-config="videoStyle"
            :output-width="outputWidth"
            :output-height="outputHeight"
            :fit-mode="videoFitMode"
            @update:style-config="applyVideoStyle"
          />
          <VideoOutputSizePicker v-model:output-width="outputWidth" v-model:output-height="outputHeight" quality-hint="必要时自动 AI 超分" compact />
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="space-y-1"><span class="text-[var(--text-secondary)]">画面适配</span><select v-model="videoFitMode" class="control"><option value="blur">完整保留＋模糊背景</option><option value="contain">完整保留＋黑色留边</option><option value="center">居中裁剪</option></select></label>
            <label class="space-y-1"><span class="text-[var(--text-secondary)]">输出</span><select v-model="videoOutputFormat" class="control"><option value="mp4">MP4</option><option value="both">MP4 + GIF</option></select></label>
          </div>
          <div v-if="videoJob" class="space-y-1">
            <div class="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>{{ videoJob.current_step }}</span><span>{{ videoJob.progress || 0 }}%</span></div>
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-800"><div class="h-full bg-cyan-400 transition-all" :style="{ width: `${videoJob.progress || 0}%` }" /></div>
          </div>
          <button type="button" class="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" :disabled="videoRendering || !overlayVideoReady || !overlayText.trim()" @click="handleVideoRender">
            {{ videoRendering ? '正在适配并合成…' : '生成加字素材' }}
          </button>
          <button v-if="videoRendering && videoJob?.job_id" type="button" class="w-full rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300" @click="cancelVideoRender">取消任务</button>
          <div v-if="videoError" class="text-xs text-red-400">{{ videoError }}</div>
          <video v-if="videoOutputUrl" :src="videoOutputUrl" controls class="w-full rounded-lg bg-black" />
          <div v-if="videoOutputUrl" class="flex justify-center gap-3 text-xs"><a :href="videoOutputUrl" download class="text-cyan-300">下载 MP4</a><a v-if="videoGifUrl" :href="videoGifUrl" download class="text-cyan-300">下载 GIF</a></div>
        </section>

        <div class="border-t border-[var(--border-color)] pt-3 text-xs font-semibold text-[var(--text-primary)]">文案与样式（视频 / GIF / 图片共用）</div>
        <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span class="px-2 py-0.5 rounded-full" :class="sourceImage ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            图片输入 {{ sourceImage ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full" :class="overlayText ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            文案 {{ overlayText ? '✓' : '○' }}
          </span>
        </div>

        <textarea
          v-model="localText"
          rows="3"
          class="w-full px-2 py-2 text-xs rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] outline-none resize-none"
          placeholder="未连接文本节点时，可在这里直接输入中文文案"
        />

        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">位置 X</span>
            <input v-model.number="localX" type="range" min="0" max="100" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">位置 Y</span>
            <input v-model.number="localY" type="range" min="0" max="100" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">字号</span>
            <input v-model.number="localFontSize" type="range" min="18" max="120" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">行宽</span>
            <input v-model.number="localBoxWidth" type="range" min="20" max="90" class="w-full" />
          </label>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs">
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">文字</span>
            <input v-model="localColor" type="color" class="w-full h-8 rounded border border-[var(--border-color)] bg-transparent" />
          </label>
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">描边</span>
            <input v-model="localStrokeColor" type="color" class="w-full h-8 rounded border border-[var(--border-color)] bg-transparent" />
          </label>
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">描边宽</span>
            <input v-model.number="localStrokeWidth" type="number" min="0" max="12" class="w-full h-8 px-2 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="space-y-1">
            <span class="text-[var(--text-secondary)]">对齐</span>
            <select v-model="localAlign" class="w-full h-8 px-2 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]">
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </label>
          <label class="flex items-center gap-2 pt-5 text-[var(--text-secondary)]">
            <input v-model="localShadow" type="checkbox" />
            阴影
          </label>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center gap-2 text-[var(--text-secondary)]"><input v-model="localBackground" type="checkbox" />文字背景</label>
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">背景颜色</span><input v-model="localBackgroundColor" type="color" class="h-8 w-full rounded border border-[var(--border-color)] bg-transparent" /></label>
        </div>

        <div v-if="lastError" class="text-xs text-red-500 leading-relaxed">{{ lastError }}</div>

        <button
          @click="handleRender"
          :disabled="isRendering || !sourceImage || !overlayText"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <n-spin v-if="isRendering" :size="14" />
          <template v-else>
            <n-icon :size="16"><TextOutline /></n-icon>
            生成加字图
          </template>
        </button>

        <button
          @click="handleCreateFusion"
          :disabled="!outputNodeId"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <n-icon :size="16"><ImageOutline /></n-icon>
          可选图生图融合
        </button>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-cyan-400" />
      <NodeHandleMenu :nodeId="id" nodeType="textOverlay" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { CopyOutline, ImageOutline, TextOutline, TrashOutline } from '@vicons/ionicons5'
import NodeHandleMenu from './NodeHandleMenu.vue'
import VideoOutputSizePicker from '../VideoOutputSizePicker.vue'
import VisualTextOverlayEditor from '../VisualTextOverlayEditor.vue'
import { addEdge, addNode, duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SIZE } from '../../config/models'
import request from '../../utils/request'
import { buildMaterialApiUrl } from '@/utils/apiBase'
import { cancelVideoResizeJob, createVideoResizeJob, getVideoResizeJob } from '../../api/videoResize.js'
import { validateOverlayVideoFile } from '../../utils/videoTextOverlay.js'

const props = defineProps({
  id: String,
  data: Object
})

const { updateNodeInternals } = useVueFlow()

const showHandleMenu = ref(false)
const isRendering = ref(false)
const lastError = ref('')
const overlayVideoFile = ref(null)
const outputWidth = ref(Number(props.data?.outputWidth || 1920))
const outputHeight = ref(Number(props.data?.outputHeight || 1080))
const videoRendering = ref(false)
const videoError = ref('')
const videoOutputUrl = ref(props.data?.videoOutputUrl || '')
const videoGifUrl = ref(props.data?.videoGifUrl || '')
const videoFitMode = ref(props.data?.videoFitMode || 'blur')
const videoOutputFormat = ref(props.data?.videoOutputFormat || 'mp4')
const videoJob = ref(null)
const uploadPreviewUrl = ref('')
let videoPollGeneration = 0

const localText = ref(props.data?.text || '')
const localX = ref(props.data?.x ?? 50)
const localY = ref(props.data?.y ?? 78)
const localFontSize = ref(props.data?.fontSize ?? 48)
const localBoxWidth = ref(props.data?.boxWidth ?? 76)
const localColor = ref(props.data?.color || '#ffffff')
const localStrokeColor = ref(props.data?.strokeColor || '#111111')
const localStrokeWidth = ref(props.data?.strokeWidth ?? 4)
const localAlign = ref(props.data?.align || 'center')
const localShadow = ref(props.data?.shadow ?? true)
const localBackground = ref(props.data?.background ?? false)
const localBackgroundColor = ref(props.data?.backgroundColor || '#000000')

const outputNodeId = computed(() => props.data?.outputNodeId || '')
const videoOutputNodeId = computed(() => props.data?.videoOutputNodeId || '')

const incomingNodes = computed(() => {
  return edges.value
    .filter(edge => edge.target === props.id)
    .map(edge => nodes.value.find(node => node.id === edge.source))
    .filter(Boolean)
})

const sourceImage = computed(() => {
  return incomingNodes.value.find(node => node.type === 'image' && node.data?.url)
})

const connectedMedia = computed(() => incomingNodes.value.find(node => (
  ['materialInput', 'video'].includes(node.type) && node.data?.url
)))

const connectedText = computed(() => {
  return incomingNodes.value
    .filter(node => node.type === 'text' || node.type === 'llmConfig')
    .map(node => node.type === 'llmConfig' ? node.data?.outputContent : node.data?.content)
    .filter(Boolean)
    .join('\n')
})

const overlayText = computed(() => connectedText.value || localText.value)
const videoPreviewUrl = computed(() => connectedMedia.value?.data?.url || uploadPreviewUrl.value)
const videoSourceMime = computed(() => connectedMedia.value?.data?.mime || overlayVideoFile.value?.type || 'video/mp4')
const overlayVideoReady = computed(() => Boolean(connectedMedia.value?.data?.url || overlayVideoFile.value))
const videoStyle = computed(() => ({
  x: localX.value,
  y: localY.value,
  fontSize: Math.max(1.8, Number(localFontSize.value) / 10),
  boxWidth: localBoxWidth.value,
  color: localColor.value,
  strokeColor: localStrokeColor.value,
  strokeWidth: localStrokeWidth.value,
  align: localAlign.value,
  shadow: localShadow.value,
  background: localBackground.value,
  backgroundColor: localBackgroundColor.value,
  backgroundOpacity: 0.45
}))

const applyVideoStyle = style => {
  localX.value = style.x
  localY.value = style.y
}

const handleVideoUpload = (event) => {
  const file = event.target.files?.[0] || null
  const error = validateOverlayVideoFile(file)
  if (error) {
    overlayVideoFile.value = null
    if (uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
    uploadPreviewUrl.value = ''
    videoError.value = error
    event.target.value = ''
    return
  }
  overlayVideoFile.value = file
  if (uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
  uploadPreviewUrl.value = file ? URL.createObjectURL(file) : ''
  videoError.value = ''
}

const toBase64 = selected => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.onerror = () => reject(new Error('读取上传素材失败'))
  reader.readAsDataURL(selected)
})
const publicAssetName = value => {
  try {
    const pathname = new URL(value, window.location.origin).pathname
    const match = pathname.match(/\/public-assets\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : ''
  } catch {
    return ''
  }
}
const pollingStopped = () => Object.assign(new Error('任务轮询已停止'), { code: 'POLLING_STOPPED' })
const waitForVideoJob = async (jobId, generation) => {
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    if (generation !== videoPollGeneration) throw pollingStopped()
    const current = await getVideoResizeJob(jobId)
    if (generation !== videoPollGeneration) throw pollingStopped()
    videoJob.value = current
    if (['completed', 'failed', 'cancelled'].includes(current.status)) {
      updateNode(props.id, { videoJobId: current.job_id, videoJobStatus: current.status })
      return current
    }
    await new Promise(resolve => window.setTimeout(resolve, 1500))
  }
  throw new Error('素材处理超时，请稍后查看任务')
}

const ensureVideoOutputNode = result => {
  const currentNode = nodes.value.find(node => node.id === props.id)
  const existingOutput = nodes.value.find(node => node.id === videoOutputNodeId.value)
  const outputData = {
    url: result.mp4_url,
    gifUrl: result.gif_url || '',
    assetName: publicAssetName(result.mp4_url),
    mime: 'video/mp4',
    label: `${result.actual_width}×${result.actual_height} 加字素材`,
    width: result.actual_width,
    height: result.actual_height,
    qualityVerified: true,
    updatedAt: Date.now()
  }
  if (existingOutput) {
    updateNode(existingOutput.id, outputData)
    return existingOutput.id
  }
  const nextOutputId = addNode('video', {
    x: (currentNode?.position?.x || 0) + 560,
    y: currentNode?.position?.y || 0
  }, outputData)
  addEdge({ source: props.id, target: nextOutputId, sourceHandle: 'right', targetHandle: 'left' })
  setTimeout(() => updateNodeInternals(nextOutputId), 50)
  return nextOutputId
}

const applyCompletedVideoJob = completed => {
  if (completed.status !== 'completed') throw new Error(completed.error || (completed.status === 'cancelled' ? '任务已取消' : '素材处理失败'))
  const result = completed.results?.[0]
  if (!result?.mp4_url) throw new Error('任务完成但没有生成 MP4')
  videoOutputUrl.value = result.mp4_url
  videoGifUrl.value = result.gif_url || ''
  const nextOutputId = ensureVideoOutputNode(result)
  updateNode(props.id, {
    outputWidth: outputWidth.value,
    outputHeight: outputHeight.value,
    videoFitMode: videoFitMode.value,
    videoOutputFormat: videoOutputFormat.value,
    videoOutputUrl: videoOutputUrl.value,
    videoGifUrl: videoGifUrl.value,
    videoOutputNodeId: nextOutputId,
    videoJobId: completed.job_id,
    videoJobStatus: completed.status
  })
  return result
}

const followVideoJob = async jobId => {
  const generation = ++videoPollGeneration
  return applyCompletedVideoJob(await waitForVideoJob(jobId, generation))
}

const handleVideoRender = async () => {
  if (!overlayVideoReady.value || videoRendering.value) return
  videoRendering.value = true
  videoError.value = ''
  try {
    const payload = {
      targets: [{ width: outputWidth.value, height: outputHeight.value }],
      fit_mode: videoFitMode.value,
      force_ai: false,
      outputs: videoOutputFormat.value === 'both' ? ['mp4', 'gif'] : ['mp4'],
      overlay_text: overlayText.value.trim(),
      overlay_style: {
        x: localX.value,
        y: localY.value,
        font_size: Number(localFontSize.value) / 10,
        box_width: localBoxWidth.value,
        color: localColor.value,
        stroke_color: localStrokeColor.value,
        stroke_width: localStrokeWidth.value,
        align: localAlign.value,
        shadow: localShadow.value,
        background: localBackground.value,
        background_color: localBackgroundColor.value,
        background_opacity: 0.45
      }
    }
    if (connectedMedia.value) {
      payload.source_asset = connectedMedia.value.data?.assetName || publicAssetName(connectedMedia.value.data?.url)
      if (!payload.source_asset) throw new Error('连接的视频不是已导入素材，请先经过“素材导入”节点')
    } else {
      payload.source_name = overlayVideoFile.value.name
      payload.source_base64 = await toBase64(overlayVideoFile.value)
    }
    videoJob.value = await createVideoResizeJob(payload)
    updateNode(props.id, {
      videoJobId: videoJob.value.job_id,
      videoJobStatus: videoJob.value.status,
      outputWidth: outputWidth.value,
      outputHeight: outputHeight.value,
      videoFitMode: videoFitMode.value,
      videoOutputFormat: videoOutputFormat.value
    })
    const result = await followVideoJob(videoJob.value.job_id)
    window.$message?.success(`已生成 ${result.actual_width}×${result.actual_height} 加字素材`)
  } catch (error) {
    if (error?.code === 'POLLING_STOPPED') return
    videoError.value = error?.response?.data?.error?.message || error?.message || '素材合成失败'
    window.$message?.error(videoError.value)
  } finally {
    videoRendering.value = false
  }
}

const cancelVideoRender = async () => {
  if (!videoJob.value?.job_id) return
  videoJob.value = await cancelVideoResizeJob(videoJob.value.job_id)
  updateNode(props.id, { videoJobId: videoJob.value.job_id, videoJobStatus: videoJob.value.status })
}

onMounted(async () => {
  const jobId = String(props.data?.videoJobId || '')
  if (!jobId || ['completed', 'failed', 'cancelled'].includes(props.data?.videoJobStatus)) return
  videoRendering.value = true
  videoError.value = ''
  try {
    const result = await followVideoJob(jobId)
    window.$message?.success(`任务已恢复：${result.actual_width}×${result.actual_height}`)
  } catch (error) {
    if (error?.code !== 'POLLING_STOPPED') {
      videoError.value = error?.response?.data?.error?.message || error?.message || '恢复素材任务失败'
    }
  } finally {
    videoRendering.value = false
  }
})

watch([localText, localX, localY, localFontSize, localBoxWidth, localColor, localStrokeColor, localStrokeWidth, localAlign, localShadow, localBackground, localBackgroundColor], () => {
  updateNode(props.id, {
    text: localText.value,
    x: localX.value,
    y: localY.value,
    fontSize: localFontSize.value,
    boxWidth: localBoxWidth.value,
    color: localColor.value,
    strokeColor: localStrokeColor.value,
    strokeWidth: localStrokeWidth.value,
    align: localAlign.value,
    shadow: localShadow.value,
    background: localBackground.value,
    backgroundColor: localBackgroundColor.value
  })
})

onBeforeUnmount(() => {
  videoPollGeneration += 1
  if (uploadPreviewUrl.value) URL.revokeObjectURL(uploadPreviewUrl.value)
})

const loadImage = async (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败，可能是图片源不允许 Canvas 读取'))
    image.src = src
  })
}

const wrapText = (ctx, text, maxWidth) => {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const char of paragraph) {
      const testLine = line + char
      if (line && ctx.measureText(testLine).width > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

const renderOverlay = async () => {
  const imageUrl = sourceImage.value?.data?.base64 || sourceImage.value?.data?.url
  if (!imageUrl) throw new Error('请连接一张图片')
  if (!overlayText.value.trim()) throw new Error('请连接文本节点或输入文案')

  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const fontSize = Math.round((localFontSize.value / 1024) * Math.max(canvas.width, canvas.height))
  const lineHeight = Math.round(fontSize * 1.18)
  const maxWidth = canvas.width * (localBoxWidth.value / 100)
  const x = canvas.width * (localX.value / 100)
  const y = canvas.height * (localY.value / 100)

  ctx.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
  ctx.textAlign = localAlign.value
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'

  if (localShadow.value) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = Math.max(8, fontSize * 0.18)
    ctx.shadowOffsetX = Math.max(2, fontSize * 0.04)
    ctx.shadowOffsetY = Math.max(2, fontSize * 0.04)
  }

  const lines = wrapText(ctx, overlayText.value.trim(), maxWidth)
  const totalHeight = lines.length * lineHeight
  const startY = y - totalHeight / 2
  const textX = localAlign.value === 'left' ? x - maxWidth / 2 : localAlign.value === 'right' ? x + maxWidth / 2 : x

  if (localBackground.value && lines.length) {
    const blockWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
    const paddingX = fontSize * 0.5
    const paddingY = fontSize * 0.35
    const blockX = localAlign.value === 'left' ? textX : localAlign.value === 'right' ? textX - blockWidth : textX - blockWidth / 2
    ctx.save()
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 0.45
    ctx.fillStyle = localBackgroundColor.value
    ctx.fillRect(blockX - paddingX, startY - paddingY, blockWidth + paddingX * 2, totalHeight + paddingY * 2)
    ctx.restore()
  }

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    if (localStrokeWidth.value > 0) {
      ctx.strokeStyle = localStrokeColor.value
      ctx.lineWidth = localStrokeWidth.value
      ctx.strokeText(line, textX, lineY)
    }
    ctx.fillStyle = localColor.value
    ctx.fillText(line, textX, lineY)
  })

  return canvas.toDataURL('image/png')
}

const publishOverlayImage = async (dataUrl) => {
  const result = await request({
    url: buildMaterialApiUrl('/v1/assets/images'),
    method: 'post',
    data: {
      image: dataUrl,
      name: '加字图'
    }
  })
  return {
    url: result.url || dataUrl,
    base64: dataUrl,
    publicUrl: result.public_url || '',
    localUrl: result.local_url || '',
    published: Boolean(result.public)
  }
}

const ensureOutputNode = (asset) => {
  const currentNode = nodes.value.find(node => node.id === props.id)
  const existingOutput = nodes.value.find(node => node.id === outputNodeId.value)
  const data = {
    url: asset.url,
    base64: asset.base64,
    publicUrl: asset.publicUrl,
    localUrl: asset.localUrl,
    published: asset.published,
    label: '加字图',
    updatedAt: Date.now(),
    sourceUrl: sourceImage.value?.data?.url || '',
    overlayText: overlayText.value,
    overlayConfig: {
      x: localX.value,
      y: localY.value,
      fontSize: localFontSize.value,
      boxWidth: localBoxWidth.value,
      color: localColor.value,
      strokeColor: localStrokeColor.value,
      strokeWidth: localStrokeWidth.value,
      align: localAlign.value,
      shadow: localShadow.value,
      background: localBackground.value,
      backgroundColor: localBackgroundColor.value
    }
  }
  if (existingOutput) {
    updateNode(existingOutput.id, data)
    return existingOutput.id
  }

  const newNodeId = addNode('image', {
    x: (currentNode?.position?.x || 0) + 430,
    y: currentNode?.position?.y || 0
  }, {
    ...data,
    label: '加字图',
    publicProps: { name: '加字图' }
  })
  addEdge({ source: props.id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' })
  updateNode(props.id, { outputNodeId: newNodeId })
  setTimeout(() => updateNodeInternals(newNodeId), 50)
  return newNodeId
}

const handleRender = async () => {
  isRendering.value = true
  lastError.value = ''
  try {
    const dataUrl = await renderOverlay()
    const asset = await publishOverlayImage(dataUrl)
    ensureOutputNode(asset)
    window.$message?.success(asset.published ? '已生成加字图并发布公网图' : '已生成加字图；公网发布未就绪')
  } catch (err) {
    lastError.value = err.message || '叠字失败'
    window.$message?.error(lastError.value)
  } finally {
    isRendering.value = false
  }
}

const handleCreateFusion = () => {
  const outputNode = nodes.value.find(node => node.id === outputNodeId.value)
  if (!outputNode?.data?.url) {
    window.$message?.warning('请先生成加字图')
    return
  }

  const nodeX = outputNode.position?.x || 0
  const nodeY = outputNode.position?.y || 0
  const promptNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 90 }, {
    label: '融合提示词',
    content: 'Lightly harmonize the composited Chinese typography with the image lighting and texture. Keep every Chinese character exactly unchanged, preserve layout, preserve readability, no extra text.'
  })
  const configNodeId = addNode('imageConfig', { x: nodeX + 620, y: nodeY }, {
    model: DEFAULT_IMAGE_MODEL,
    size: DEFAULT_IMAGE_SIZE,
    label: '可选融合'
  })
  addEdge({ source: outputNode.id, target: configNodeId, sourceHandle: 'right', targetHandle: 'left' })
  addEdge({ source: promptNodeId, target: configNodeId, sourceHandle: 'right', targetHandle: 'left' })
  setTimeout(() => updateNodeInternals([promptNodeId, configNodeId]), 50)
  window.$message?.success('已创建可选图生图融合节点')
}

const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  if (newNodeId) setTimeout(() => updateNodeInternals(newNodeId), 50)
}

const handleDelete = async () => {
  videoPollGeneration += 1
  const jobId = videoJob.value?.job_id || props.data?.videoJobId
  const status = videoJob.value?.status || props.data?.videoJobStatus
  if (jobId && !['completed', 'failed', 'cancelled'].includes(status)) {
    try {
      await cancelVideoResizeJob(jobId)
    } catch {
      window.$message?.warning('节点已删除，但后台任务取消请求未确认')
    }
  }
  removeNode(props.id)
}
</script>

<style scoped>
.control{width:100%;height:2rem;border:1px solid var(--border-color);border-radius:.45rem;background:var(--bg-tertiary);padding:0 .45rem;color:var(--text-primary);outline:none}.control:focus{border-color:#22d3ee}
</style>
