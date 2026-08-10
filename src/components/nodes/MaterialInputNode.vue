<template>
  <div class="relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div class="canvas-node-scroll-shell nodrag nowheel w-[420px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div class="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-2">
        <span class="text-sm font-medium text-[var(--text-primary)]">素材导入</span>
        <div class="flex gap-1">
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="复制节点" @click="handleDuplicate"><n-icon :size="14"><CopyOutline /></n-icon></button>
          <button class="rounded p-1 hover:bg-[var(--bg-tertiary)]" title="删除节点" @click="removeNode(id)"><n-icon :size="14"><TrashOutline /></n-icon></button>
        </div>
      </div>
      <div class="space-y-3 p-3 nodrag nowheel">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <button class="mode-button" :class="mode === 'url' && 'active'" @click="mode = 'url'">复制的视频链接</button>
          <button class="mode-button" :class="mode === 'file' && 'active'" @click="mode = 'file'">上传素材 / ZIP</button>
        </div>

        <div v-if="mode === 'url'" class="space-y-2">
          <input v-model.trim="sourceUrl" class="field" placeholder="粘贴公开 Facebook / Instagram 链接" />
          <p class="text-[10px] text-[var(--text-secondary)]">仅处理无需登录的公开链接，不读取账号或 Cookie。</p>
        </div>
        <label v-else class="block cursor-pointer rounded-lg border border-dashed border-cyan-400/35 p-4 text-center text-xs text-cyan-300">
          选择 MP4 / MOV / WebM / GIF / ZIP
          <input class="hidden" type="file" accept="video/mp4,video/quicktime,video/webm,image/gif,.mp4,.mov,.webm,.gif,.zip" @change="selectFile" />
          <span v-if="file" class="mt-2 block truncate text-[var(--text-secondary)]">{{ file.name }}</span>
        </label>

        <button class="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40" :disabled="loading" @click="submit">
          {{ loading ? '正在读取素材…' : '导入并预览' }}
        </button>
        <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

        <template v-if="activeAsset">
          <img v-if="activeAsset.mime === 'image/gif'" :src="activeAsset.url" class="max-h-72 w-full rounded-lg bg-black object-contain" alt="GIF 预览" />
          <video v-else :src="activeAsset.url" class="max-h-72 w-full rounded-lg bg-black" controls loop muted playsinline />
          <select v-if="assets.length > 1" v-model.number="selectedIndex" class="field" @change="persistSelection">
            <option v-for="(asset, index) in assets" :key="asset.asset_name" :value="index">{{ index + 1 }}. {{ asset.name }}</option>
          </select>
          <div class="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span>{{ activeAsset.width }}×{{ activeAsset.height }}</span>
            <span>{{ assets.length > 1 ? `ZIP 共 ${assets.length} 个素材` : activeAsset.name }}</span>
          </div>
        </template>
      </div>
      <Handle type="source" :position="Position.Right" id="right" class="!bg-cyan-400" />
      <NodeHandleMenu :nodeId="id" nodeType="materialInput" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { CopyOutline, TrashOutline } from '@vicons/ionicons5'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { createMaterialInput } from '../../api/materialInput'
import { duplicateNode, removeNode, updateNode } from '../../stores/canvas'
import { validateSocialVideoUrl } from '../../utils/videoResize'

const props = defineProps({ id: String, data: Object })
const { updateNodeInternals } = useVueFlow()
const showHandleMenu = ref(false)
const mode = ref(props.data?.sourceMode || 'url')
const sourceUrl = ref(props.data?.sourceUrl || '')
const file = ref(null)
const assets = ref(Array.isArray(props.data?.assets) ? props.data.assets : [])
const selectedIndex = ref(Number(props.data?.selectedIndex || 0))
const loading = ref(false)
const error = ref('')
const activeAsset = computed(() => assets.value[selectedIndex.value] || null)

const selectFile = event => {
  const selected = event.target.files?.[0] || null
  error.value = ''
  file.value = null
  if (!selected) return
  if (!/\.(mp4|mov|webm|gif|zip)$/i.test(selected.name)) {
    error.value = '只支持 MP4、MOV、WebM、GIF 或 ZIP'
    event.target.value = ''
    return
  }
  if (selected.size > 90 * 1024 * 1024) {
    error.value = '上传文件不能超过 90MB'
    event.target.value = ''
    return
  }
  file.value = selected
}
const toBase64 = selected => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.onerror = () => reject(new Error('读取上传文件失败'))
  reader.readAsDataURL(selected)
})
const persistSelection = () => {
  const asset = activeAsset.value
  if (!asset) return
  updateNode(props.id, {
    sourceMode: mode.value,
    sourceUrl: sourceUrl.value,
    assets: assets.value,
    selectedIndex: selectedIndex.value,
    url: asset.url,
    assetName: asset.asset_name,
    mime: asset.mime,
    width: asset.width,
    height: asset.height,
    label: asset.name
  })
}
const submit = async () => {
  error.value = ''
  try {
    const payload = {}
    if (mode.value === 'url') {
      if (!validateSocialVideoUrl(sourceUrl.value).ok) throw new Error('请输入公开 Facebook / Instagram HTTPS 链接')
      payload.source_url = sourceUrl.value
    } else {
      if (!file.value) throw new Error('请选择素材或 ZIP')
      payload.source_name = file.value.name
      payload.source_base64 = await toBase64(file.value)
    }
    loading.value = true
    const result = await createMaterialInput(payload)
    assets.value = result.assets || []
    selectedIndex.value = 0
    if (!assets.value.length) throw new Error('没有读取到可用素材')
    persistSelection()
    window.$message?.success(assets.value.length > 1 ? `已导入 ${assets.value.length} 个素材` : '素材导入完成')
  } catch (cause) {
    error.value = cause?.response?.data?.error?.message || cause?.message || '素材导入失败'
  } finally {
    loading.value = false
  }
}
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals(newId), 50)
}
</script>

<style scoped>
.mode-button{border:1px solid var(--border-color);border-radius:.55rem;padding:.55rem;color:var(--text-secondary)}.mode-button.active{border-color:#22d3ee;background:rgba(34,211,238,.1);color:#67e8f9}.field{width:100%;border:1px solid var(--border-color);border-radius:.55rem;background:var(--bg-tertiary);padding:.55rem;color:var(--text-primary);outline:none}.field:focus{border-color:#22d3ee}
</style>
