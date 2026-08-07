<template>
  <div class="text-overlay-node-wrapper relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div
      class="text-overlay-node bg-[var(--bg-secondary)] rounded-xl border min-w-[400px] max-w-[440px] transition-all duration-200"
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
        <section class="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3">
          <div>
            <div class="text-xs font-semibold text-[var(--text-primary)]">视频字幕叠加 · 真实 1080p 输出</div>
            <div class="mt-1 text-[10px] text-[var(--text-secondary)]">上传原视频，按时间轴烧录字幕；原有图片加字功能继续保留。</div>
          </div>
          <label class="block cursor-pointer rounded-lg border border-dashed border-cyan-300/40 p-3 text-center text-xs text-cyan-300">
            上传需要叠字的视频
            <input class="hidden" type="file" accept="video/mp4,video/quicktime,video/webm" @change="handleVideoUpload" />
          </label>
          <div v-if="overlayVideoFile" class="truncate text-[10px] text-[var(--text-secondary)]">已选：{{ overlayVideoFile.name }}</div>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="rounded-lg border p-2 text-xs" :class="videoRatio === '16:9' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-[var(--border-color)]'" @click="videoRatio = '16:9'">1920×1080 横屏</button>
            <button type="button" class="rounded-lg border p-2 text-xs" :class="videoRatio === '9:16' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-[var(--border-color)]'" @click="videoRatio = '9:16'">1080×1920 竖屏</button>
          </div>
          <textarea v-model="subtitleTimeline" rows="4" class="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 text-xs text-[var(--text-primary)]" placeholder="0-2 | 第一条字幕&#10;2-5 | 第二条字幕" />
          <div class="text-[10px] text-[var(--text-secondary)]">格式示例：0-2 | 第一条字幕；每行一条，可精确到 0.1 秒。</div>
          <button type="button" class="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" :disabled="videoRendering || !overlayVideoFile || !subtitleTimeline.trim()" @click="handleVideoRender">
            {{ videoRendering ? '正在上传并合成…' : '生成 1080p 叠字视频' }}
          </button>
          <div v-if="videoError" class="text-xs text-red-400">{{ videoError }}</div>
          <video v-if="videoOutputUrl" :src="videoOutputUrl" controls class="w-full rounded-lg bg-black" />
          <a v-if="videoOutputUrl" :href="videoOutputUrl" download class="block text-center text-xs text-cyan-300">下载叠字 MP4</a>
        </section>

        <div class="border-t border-[var(--border-color)] pt-3 text-xs font-semibold text-[var(--text-primary)]">图片加字（原功能）</div>
        <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span class="px-2 py-0.5 rounded-full" :class="sourceImage ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            图片 {{ sourceImage ? '✓' : '○' }}
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
import { computed, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { CopyOutline, ImageOutline, TextOutline, TrashOutline } from '@vicons/ionicons5'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { addEdge, addNode, duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SIZE } from '../../config/models'
import request from '../../utils/request'
import { buildMaterialApiUrl } from '@/utils/apiBase'
import { createVideoTextOverlay } from '../../api/videoTextOverlay.js'
import { parseSubtitleTimeline, readFileAsDataUrl, validateOverlayVideoFile } from '../../utils/videoTextOverlay.js'

const props = defineProps({
  id: String,
  data: Object
})

const { updateNodeInternals } = useVueFlow()

const showHandleMenu = ref(false)
const isRendering = ref(false)
const lastError = ref('')
const overlayVideoFile = ref(null)
const subtitleTimeline = ref(props.data?.subtitleTimeline || '')
const videoRatio = ref(props.data?.videoRatio || '16:9')
const videoRendering = ref(false)
const videoError = ref('')
const videoOutputUrl = ref(props.data?.videoOutputUrl || '')

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

const connectedText = computed(() => {
  return incomingNodes.value
    .filter(node => node.type === 'text' || node.type === 'llmConfig')
    .map(node => node.type === 'llmConfig' ? node.data?.outputContent : node.data?.content)
    .filter(Boolean)
    .join('\n')
})

const overlayText = computed(() => connectedText.value || localText.value)

const handleVideoUpload = (event) => {
  const file = event.target.files?.[0] || null
  const error = validateOverlayVideoFile(file)
  if (error) {
    overlayVideoFile.value = null
    videoError.value = error
    event.target.value = ''
    return
  }
  overlayVideoFile.value = file
  videoError.value = ''
}

const handleVideoRender = async () => {
  if (!overlayVideoFile.value || videoRendering.value) return
  videoRendering.value = true
  videoError.value = ''
  try {
    const segments = parseSubtitleTimeline(subtitleTimeline.value)
    const video = await readFileAsDataUrl(overlayVideoFile.value)
    const result = await createVideoTextOverlay({ video, ratio: videoRatio.value, segments })
    videoOutputUrl.value = result.output_url
    const currentNode = nodes.value.find(node => node.id === props.id)
    const existingOutput = nodes.value.find(node => node.id === videoOutputNodeId.value)
    const outputData = {
      url: result.output_url,
      label: '1080p 叠字视频',
      width: result.width,
      height: result.height,
      qualityVerified: true,
      updatedAt: Date.now()
    }
    let nextOutputId = existingOutput?.id
    if (existingOutput) {
      updateNode(existingOutput.id, outputData)
    } else {
      nextOutputId = addNode('video', {
        x: (currentNode?.position?.x || 0) + 500,
        y: currentNode?.position?.y || 0
      }, outputData)
      addEdge({ source: props.id, target: nextOutputId, sourceHandle: 'right', targetHandle: 'left' })
      setTimeout(() => updateNodeInternals(nextOutputId), 50)
    }
    updateNode(props.id, {
      subtitleTimeline: subtitleTimeline.value,
      videoRatio: videoRatio.value,
      videoOutputUrl: videoOutputUrl.value,
      videoOutputNodeId: nextOutputId
    })
    window.$message?.success(`已生成 ${result.width}×${result.height} 叠字视频`)
  } catch (error) {
    videoError.value = error?.message || '视频字幕合成失败'
    window.$message?.error(videoError.value)
  } finally {
    videoRendering.value = false
  }
}

watch([localText, localX, localY, localFontSize, localBoxWidth, localColor, localStrokeColor, localStrokeWidth, localAlign, localShadow], () => {
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
    shadow: localShadow.value
  })
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
      shadow: localShadow.value
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

const handleDelete = () => {
  removeNode(props.id)
}
</script>
