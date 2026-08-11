<template>
  <div class="relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div class="nowheel w-[380px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
      <header class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div><div class="text-sm font-semibold text-[var(--text-primary)]">{{ nodeLabel }}</div><div class="mt-0.5 text-[11px] text-[var(--text-secondary)]">连接图片、视频或 GIF 成品</div></div>
        <div class="flex gap-1"><button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" @click="duplicateNode(id)"><n-icon :size="15"><CopyOutline /></n-icon></button><button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" @click="removeNode(id)"><n-icon :size="15"><TrashOutline /></n-icon></button></div>
      </header>
      <div class="space-y-3 p-4">
        <div v-if="!sourceUrl" class="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-secondary)]">请从左侧连接一个成品节点</div>
        <img v-else-if="isImage" :src="sourceUrl" class="max-h-64 w-full rounded-lg bg-black object-contain" alt="导出素材" />
        <video v-else :src="sourceUrl" controls class="max-h-64 w-full rounded-lg bg-black object-contain" />
        <div v-if="sourceUrl" class="truncate text-xs text-emerald-300">{{ sourceLabel }}</div>
        <div v-if="isUnrenderedWatermarkDraft" class="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[10px] leading-5 text-amber-200">水印尚未合成：当前下载的是进入水印节点前的上游素材。</div>
        <button class="w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" :disabled="!sourceUrl || downloading" @click="downloadAsset">{{ downloading ? '正在准备下载…' : isUnrenderedWatermarkDraft ? '下载上游素材（未合成水印）' : '下载导出' }}</button>
        <button v-if="sourceJobId && !isUnrenderedWatermarkDraft" class="w-full rounded-lg border border-cyan-400/30 py-2 text-xs text-cyan-300 disabled:opacity-40" :disabled="saving" @click="saveToLibrary">{{ saving ? '正在保存…' : '保存到服务器素材库' }}</button>
        <div v-if="error" class="text-xs text-red-400">{{ error }}</div>
      </div>
      <Handle type="target" :position="Position.Left" id="left" class="!bg-emerald-400" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-emerald-400" />
      <NodeHandleMenu :nodeId="id" nodeType="materialExport" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { CopyOutline, TrashOutline } from '@vicons/ionicons5'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { saveVideoResizeJob } from '../../api/videoResize.js'
import { duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { startAssetDownload } from '../../utils/assetDownload.js'

const props = defineProps({ id: String, data: Object })
const showHandleMenu = ref(false)
const downloading = ref(false)
const saving = ref(false)
const error = ref('')
const incoming = computed(() => edges.value.filter(edge => edge.target === props.id).map(edge => nodes.value.find(node => node.id === edge.source)).filter(Boolean))
const sourceNode = computed(() => incoming.value.find(node => ['image', 'video', 'videoGif', 'textOverlay', 'watermarkEditor', 'materialInput'].includes(node.type)))
const sourceUrl = computed(() => sourceNode.value?.data?.gifUrl || sourceNode.value?.data?.videoGifUrl || sourceNode.value?.data?.url || '')
const sourceMime = computed(() => sourceNode.value?.data?.mime || (/\.gif(?:$|\?)/i.test(sourceUrl.value) ? 'image/gif' : sourceNode.value?.type === 'image' ? 'image/png' : 'video/mp4'))
const sourceLabel = computed(() => sourceNode.value?.data?.label || '可导出素材')
const sourceJobId = computed(() => sourceNode.value?.data?.jobId || sourceNode.value?.data?.videoJobId || '')
const nodeLabel = computed(() => props.data?.label === '素材导出' && sourceNode.value?.data?.label === '10 水印与细节编辑'
  ? '11 GIF 导出'
  : props.data?.label || '素材导出')
const isUnrenderedWatermarkDraft = computed(() => sourceNode.value?.type === 'watermarkEditor' && sourceNode.value?.data?.compositionReady !== true)
const isImage = computed(() => sourceMime.value.startsWith('image/'))
const extension = computed(() => sourceMime.value === 'image/gif' ? 'gif' : sourceMime.value.startsWith('image/') ? 'png' : 'mp4')

watch([sourceUrl, sourceMime, sourceJobId], () => updateNode(props.id, {
  url: sourceUrl.value,
  gifUrl: sourceMime.value === 'image/gif' ? sourceUrl.value : '',
  mime: sourceMime.value,
  sourceJobId: sourceJobId.value,
  label: nodeLabel.value,
  updatedAt: Date.now()
}), { immediate: true })

const downloadAsset = async () => {
  if (!sourceUrl.value) return
  downloading.value = true
  error.value = ''
  try {
    await startAssetDownload({ url: sourceUrl.value, fileName: `ad-material-${Date.now()}.${extension.value}`, label: sourceLabel.value })
  } catch (exception) { error.value = exception?.message || '下载失败' }
  finally { downloading.value = false }
}
const saveToLibrary = async () => {
  if (!sourceJobId.value) return
  saving.value = true
  error.value = ''
  try { await saveVideoResizeJob(sourceJobId.value); window.$message?.success('已保存到服务器素材库') }
  catch (exception) { error.value = exception?.response?.data?.error?.message || exception?.message || '保存失败' }
  finally { saving.value = false }
}
</script>
