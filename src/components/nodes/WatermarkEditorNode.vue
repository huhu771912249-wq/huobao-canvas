<template>
  <div class="relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div class="nodrag nowheel w-[410px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
      <header class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div>
          <div class="text-sm font-semibold text-[var(--text-primary)]">水印与素材编辑</div>
          <div class="mt-0.5 text-[11px] text-[var(--text-secondary)]">快速设置水印，详情页编辑时间轴</div>
        </div>
        <div class="flex gap-1">
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="复制节点" @click="duplicateNode(id)"><n-icon :size="15"><CopyOutline /></n-icon></button>
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="删除节点" @click="removeNode(id)"><n-icon :size="15"><TrashOutline /></n-icon></button>
        </div>
      </header>

      <div class="space-y-3 p-4">
        <div class="overflow-hidden rounded-lg border border-cyan-400/20 bg-black/50">
          <img v-if="sourceUrl && sourceIsImage" :src="sourceUrl" class="h-36 w-full object-contain" alt="待编辑素材" />
          <video v-else-if="sourceUrl" :src="sourceUrl" muted class="h-36 w-full object-contain" />
          <div v-else class="grid h-28 place-items-center px-5 text-center text-xs text-[var(--text-secondary)]">连接图片、视频或 GIF 成品</div>
          <div v-if="sourceNode" class="truncate border-t border-white/10 px-3 py-2 text-[10px] text-emerald-300">已连接：{{ sourceNode.data?.label || '上游素材' }}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">水印预设</span><select v-model="watermarkId" class="control"><option v-for="item in watermarkOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label class="space-y-1"><span class="text-[var(--text-secondary)]">位置</span><select v-model="position" class="control"><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option><option value="center">居中</option></select></label>
        </div>
        <label class="block text-xs text-[var(--text-secondary)]">大小 {{ size }}%<input v-model.number="size" type="range" min="8" max="60" class="mt-1 w-full accent-cyan-400" /></label>
        <label class="block text-xs text-[var(--text-secondary)]">透明度 {{ opacity }}%<input v-model.number="opacity" type="range" min="10" max="100" class="mt-1 w-full accent-cyan-400" /></label>

        <div class="flex items-center justify-between rounded-lg bg-cyan-400/5 px-3 py-2 text-[10px]">
          <span class="text-[var(--text-secondary)]">编辑工程</span>
          <b class="text-cyan-300">已保存 {{ savedWatermarkCount }} 个水印</b>
        </div>
        <a :href="editorHref" class="block w-full rounded-lg bg-cyan-400 px-3 py-2.5 text-center text-sm font-semibold text-slate-950">进入详情编辑</a>
        <p class="text-[10px] leading-5 text-[var(--text-secondary)]">详情页支持视频/GIF 拼接、文字、图片水印、字体、转场、圆角和导出设置。当前先保存编辑工程，真实合成接口下一阶段接入。</p>
      </div>

      <Handle type="target" :position="Position.Left" id="left" class="!bg-cyan-400" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-emerald-400" />
      <NodeHandleMenu :nodeId="id" nodeType="watermarkEditor" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Handle, Position } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { CopyOutline, TrashOutline } from '@vicons/ionicons5'
import NodeHandleMenu from './NodeHandleMenu.vue'
import {
  currentProjectId,
  duplicateNode,
  edges,
  nodes,
  removeNode,
  updateNode
} from '../../stores/canvas'
import { createDefaultWatermarkEditorProject } from '../../utils/watermarkEditorProject.js'

const props = defineProps({ id: String, data: Object })
const router = useRouter()
const showHandleMenu = ref(false)
const initialProject = props.data?.editorProject || createDefaultWatermarkEditorProject()
const watermarkId = ref(props.data?.quickSettings?.watermarkId || initialProject.quickSettings?.watermarkId || 'image-1')
const position = ref(props.data?.quickSettings?.position || initialProject.quickSettings?.position || 'top-right')
const size = ref(Number(props.data?.quickSettings?.size || initialProject.quickSettings?.size || 22))
const opacity = ref(Number(props.data?.quickSettings?.opacity || initialProject.quickSettings?.opacity || 92))

const mediaUrlOf = node => node?.data?.gifUrl || node?.data?.videoGifUrl || node?.data?.url || ''
const incomingNodes = computed(() => edges.value
  .filter(edge => edge.target === props.id)
  .map(edge => nodes.value.find(node => node.id === edge.source))
  .filter(Boolean))
const sourceNode = computed(() => incomingNodes.value.find(node => ['image', 'video', 'videoGif', 'textOverlay', 'materialInput', 'materialExport'].includes(node.type) && mediaUrlOf(node)))
const sourceUrl = computed(() => mediaUrlOf(sourceNode.value) || props.data?.sourceUrl || '')
const sourceMime = computed(() => sourceNode.value?.data?.mime || props.data?.sourceMime || '')
const sourceIsImage = computed(() => sourceNode.value?.type === 'image'
  || sourceMime.value.startsWith('image/')
  || /\.(?:png|jpe?g|webp|gif)(?:$|\?)/i.test(sourceUrl.value))
const watermarkOptions = computed(() => {
  const saved = props.data?.editorProject?.watermarkLibrary || initialProject.watermarkLibrary || []
  return saved.length ? saved : [{ id: 'image-1', name: '品牌 Logo.png' }]
})
const savedWatermarkCount = computed(() => watermarkOptions.value.length)
const editorRoute = computed(() => {
  const query = { node: props.id, from: 'canvas' }
  if (currentProjectId.value) query.project = currentProjectId.value
  return { path: '/gif-editor', query }
})
const editorHref = computed(() => router.resolve(editorRoute.value).href)

const quickSettings = () => ({ watermarkId: watermarkId.value, position: position.value, size: size.value, opacity: opacity.value })
watch([watermarkId, position, size, opacity, sourceUrl, sourceMime], () => updateNode(props.id, {
  quickSettings: quickSettings(),
  sourceUrl: sourceUrl.value,
  sourceMime: sourceMime.value,
  sourceLabel: sourceNode.value?.data?.label || props.data?.sourceLabel || '',
  url: sourceUrl.value,
  gifUrl: sourceMime.value === 'image/gif' || /\.gif(?:$|\?)/i.test(sourceUrl.value) ? sourceUrl.value : '',
  mime: sourceMime.value || (/\.gif(?:$|\?)/i.test(sourceUrl.value) ? 'image/gif' : ''),
  updatedAt: Date.now()
}), { immediate: true })

</script>

<style scoped>
.control{width:100%;border:1px solid var(--border-color);border-radius:.5rem;background:var(--bg-tertiary);padding:.45rem .55rem;color:var(--text-primary)}
</style>
