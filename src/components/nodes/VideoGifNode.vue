<template>
  <div class="relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div class="canvas-node-scroll-shell nowheel w-[460px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
      <header class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div><div class="text-sm font-semibold text-[var(--text-primary)]">视频转 GIF</div><div class="mt-0.5 text-[11px] text-[var(--text-secondary)]">可连接 H3 视频，也可直接上传</div></div>
        <div class="flex gap-1">
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="复制节点" @click="duplicateNode(id)"><n-icon :size="15"><CopyOutline /></n-icon></button>
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="删除节点" @click="handleDelete"><n-icon :size="15"><TrashOutline /></n-icon></button>
        </div>
      </header>

      <div class="space-y-3 p-4">
        <div class="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs">
          <div v-if="connectedMedia" class="truncate text-emerald-300">已连接：{{ connectedMedia.data?.label || '视频结果' }}</div>
          <label v-else class="block cursor-pointer text-center text-cyan-300">
            上传 MP4 / MOV / WebM / GIF
            <input class="hidden" type="file" accept="video/mp4,video/quicktime,video/webm,image/gif,.mp4,.mov,.webm,.gif" @change="handleFileUpload" />
          </label>
          <div v-if="selectedFile" class="mt-1 truncate text-[var(--text-secondary)]">已选：{{ selectedFile.name }}</div>
        </div>

        <VideoOutputSizePicker v-model:output-width="outputWidth" v-model:output-height="outputHeight" quality-hint="按目标尺寸输出 GIF" compact />
        <div class="grid grid-cols-3 gap-2 text-xs">
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">适配</span><select v-model="fitMode" class="control"><option value="blur">模糊背景</option><option value="contain">完整留边</option><option value="center">居中裁剪</option></select></label>
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">帧率</span><select v-model.number="fps" class="control"><option :value="8">8 FPS</option><option :value="12">12 FPS</option><option :value="15">15 FPS</option><option :value="20">20 FPS</option></select></label>
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">颜色</span><select v-model.number="colors" class="control"><option :value="64">64</option><option :value="128">128</option><option :value="256">256</option></select></label>
        </div>

        <div v-if="job && isWorking" class="space-y-1">
          <div class="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>{{ job.current_step || '处理中' }}</span><span>{{ job.progress || 0 }}%</span></div>
          <div class="h-1.5 overflow-hidden rounded-full bg-slate-800"><div class="h-full bg-cyan-400" :style="{ width: `${job.progress || 0}%` }" /></div>
        </div>
        <button class="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" :disabled="isWorking || !sourceReady" @click="generateGif">
          {{ isWorking ? '正在转换…' : '生成 GIF' }}
        </button>
        <button v-if="isWorking && job?.job_id" class="w-full rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300" @click="cancelJob">取消任务</button>
        <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

        <img v-if="gifUrl" :src="gifUrl" class="max-h-72 w-full rounded-lg bg-black object-contain" alt="GIF 输出" />
        <a v-if="gifUrl" :href="gifUrl" download class="block w-full rounded-lg border border-amber-400/30 py-2 text-center text-xs text-amber-300 hover:bg-amber-400/10">下载 GIF</a>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-cyan-400" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-amber-400" />
      <NodeHandleMenu :nodeId="id" nodeType="videoGif" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { CopyOutline, TrashOutline } from '@vicons/ionicons5'
import VideoOutputSizePicker from '../VideoOutputSizePicker.vue'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { cancelVideoResizeJob, createVideoResizeJob, getVideoResizeJob } from '../../api/videoResize.js'
import { duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { validateOverlayVideoFile } from '../../utils/videoTextOverlay.js'

const props = defineProps({ id: String, data: Object })
const showHandleMenu = ref(false)
const selectedFile = ref(null)
const outputWidth = ref(Number(props.data?.outputWidth || 720))
const outputHeight = ref(Number(props.data?.outputHeight || 1280))
const fitMode = ref(props.data?.fitMode || 'blur')
const fps = ref(Number(props.data?.fps || 12))
const colors = ref(Number(props.data?.colors || 256))
const job = ref(null)
const error = ref('')
const gifUrl = ref(props.data?.gifUrl || props.data?.url || '')
let pollGeneration = 0

const mediaUrlOf = node => node?.data?.gifUrl || node?.data?.videoGifUrl || node?.data?.url || ''
const incomingNodes = computed(() => edges.value.filter(edge => edge.target === props.id).map(edge => nodes.value.find(node => node.id === edge.source)).filter(Boolean))
const connectedMedia = computed(() => incomingNodes.value.find(node => ['video', 'materialInput', 'textOverlay', 'materialExport'].includes(node.type) && mediaUrlOf(node)))
const sourceReady = computed(() => Boolean(connectedMedia.value || selectedFile.value))
const isWorking = computed(() => ['queued', 'importing', 'probing', 'framing', 'upscaling', 'composing', 'encoding'].includes(String(job.value?.status || props.data?.jobStatus || '')))

const publicAssetName = value => {
  try {
    const match = new URL(value, window.location.origin).pathname.match(/\/public-assets\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : ''
  } catch { return '' }
}
const fileToBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.onerror = () => reject(new Error('读取视频失败'))
  reader.readAsDataURL(file)
})
const stopped = () => Object.assign(new Error('轮询已停止'), { code: 'POLLING_STOPPED' })
const waitForJob = async (jobId, generation) => {
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    if (generation !== pollGeneration) throw stopped()
    const current = await getVideoResizeJob(jobId)
    if (generation !== pollGeneration) throw stopped()
    job.value = current
    updateNode(props.id, { jobId: current.job_id, jobStatus: current.status })
    if (['completed', 'failed', 'cancelled'].includes(current.status)) return current
    await new Promise(resolve => window.setTimeout(resolve, 1500))
  }
  throw new Error('GIF 处理超时')
}
const applyCompleted = completed => {
  if (completed.status !== 'completed') throw new Error(completed.error || (completed.status === 'cancelled' ? '任务已取消' : 'GIF 转换失败'))
  const result = completed.results?.[0]
  if (!result?.gif_url) throw new Error('任务完成但没有 GIF 输出')
  gifUrl.value = result.gif_url
  updateNode(props.id, {
    url: result.gif_url,
    gifUrl: result.gif_url,
    mime: 'image/gif',
    assetName: publicAssetName(result.gif_url),
    jobId: completed.job_id,
    jobStatus: completed.status,
    outputWidth: outputWidth.value,
    outputHeight: outputHeight.value,
    fitMode: fitMode.value,
    fps: fps.value,
    colors: colors.value,
    updatedAt: Date.now()
  })
}

const generateGif = async () => {
  if (!sourceReady.value || isWorking.value) return
  error.value = ''
  try {
    const payload = {
      targets: [{ width: outputWidth.value, height: outputHeight.value }],
      fit_mode: fitMode.value,
      force_ai: false,
      outputs: ['gif'],
      gif_options: { fps: fps.value, colors: colors.value }
    }
    if (selectedFile.value) {
      payload.source_name = selectedFile.value.name
      payload.source_base64 = await fileToBase64(selectedFile.value)
    } else {
      const url = mediaUrlOf(connectedMedia.value)
      const assetName = connectedMedia.value?.data?.assetName || publicAssetName(url)
      if (assetName) payload.source_asset = assetName
      else if (/^https?:\/\//i.test(url)) payload.source_url = url
      else throw new Error('连接的视频不是可读取素材，请先经过“素材导入”节点')
    }
    job.value = await createVideoResizeJob(payload)
    updateNode(props.id, { jobId: job.value.job_id, jobStatus: job.value.status })
    const generation = ++pollGeneration
    applyCompleted(await waitForJob(job.value.job_id, generation))
    window.$message?.success('GIF 已生成')
  } catch (exception) {
    if (exception?.code === 'POLLING_STOPPED') return
    error.value = exception?.response?.data?.error?.message || exception?.message || 'GIF 转换失败'
    window.$message?.error(error.value)
  }
}
const cancelJob = async () => {
  if (!job.value?.job_id) return
  pollGeneration += 1
  job.value = await cancelVideoResizeJob(job.value.job_id)
  updateNode(props.id, { jobId: job.value.job_id, jobStatus: job.value.status })
}
const handleFileUpload = event => {
  const file = event.target.files?.[0] || null
  const validation = validateOverlayVideoFile(file)
  selectedFile.value = validation ? null : file
  error.value = validation
  event.target.value = ''
}
const handleDelete = async () => {
  if (isWorking.value && job.value?.job_id) {
    try { await cancelVideoResizeJob(job.value.job_id) } catch { /* node removal still succeeds */ }
  }
  pollGeneration += 1
  removeNode(props.id)
}

watch([outputWidth, outputHeight, fitMode, fps, colors], () => updateNode(props.id, {
  outputWidth: outputWidth.value,
  outputHeight: outputHeight.value,
  fitMode: fitMode.value,
  fps: fps.value,
  colors: colors.value
}))
onMounted(async () => {
  const jobId = String(props.data?.jobId || '')
  if (!jobId || ['completed', 'failed', 'cancelled'].includes(props.data?.jobStatus)) return
  try {
    const generation = ++pollGeneration
    applyCompleted(await waitForJob(jobId, generation))
  } catch (exception) {
    if (exception?.code !== 'POLLING_STOPPED') error.value = exception?.message || '恢复 GIF 任务失败'
  }
})
onBeforeUnmount(() => { pollGeneration += 1 })
</script>

<style scoped>.control{width:100%;border:1px solid var(--border-color);border-radius:.5rem;background:var(--bg-tertiary);padding:.45rem .55rem;color:var(--text-primary)}</style>
