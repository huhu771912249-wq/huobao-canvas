<script setup>
import { ref, watch } from 'vue'
import { generateImage } from '../../api/image.js'

const props = defineProps({ sourceImage: { type: String, default: '' } })
const emit = defineEmits(['confirmed'])
const source = ref('')
const generated = ref('')
const loading = ref(false)
const error = ref('')

watch(() => props.sourceImage, (value) => {
  if (!source.value && value) source.value = value
}, { immediate: true })

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('参考图读取失败'))
    reader.readAsDataURL(file)
  })
}

async function selectSource(event) {
  const file = event.target.files?.[0]
  if (!file) return
  source.value = await readFile(file)
  generated.value = ''
}

async function createMultiView() {
  if (!source.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await generateImage({
      model: 'frw-qwen-image-edit',
      image: source.value,
      prompt: '基于输入主体生成专业多视图角色参考板：正面、左侧面、背面、全身，纯净中性背景；严格保持同一人物身份、脸部五官、发型、服装、体型和颜色；各视图互不遮挡，不添加文字、水印或额外人物。',
      size: '1024x1024'
    }, { endpoint: '/v1/images/generations' })
    generated.value = response?.data?.[0]?.url || response?.data?.url || response?.url || ''
    if (!generated.value) throw new Error('AI 没有返回多视图图片')
  } catch (reason) {
    error.value = reason?.message || '多视图生成失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3">
    <div><b class="text-xs text-[var(--text-primary)]">AI 多视图参考</b><p class="text-[10px] text-[var(--text-secondary)]">先生成正面、侧面、背面、全身参考板，审核后再交给 H3。</p></div>
    <label class="block cursor-pointer rounded-lg border border-dashed border-cyan-400/40 p-2 text-center text-xs text-cyan-300">{{ source ? '更换人物/产品主参考' : '上传人物/产品主参考' }}<input type="file" accept="image/*" class="hidden" @change="selectSource" /></label>
    <img v-if="source" :src="source" class="max-h-32 w-full rounded-lg object-contain" alt="原始参考" />
    <button type="button" :disabled="!source || loading" class="w-full rounded-lg bg-cyan-400 px-2 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40" @click="createMultiView">{{ loading ? 'AI 正在生成多视图…' : '生成多视图参考板' }}</button>
    <div v-if="error" role="alert" class="text-[10px] text-red-400">{{ error }}</div>
    <img v-if="generated" :src="generated" class="max-h-64 w-full rounded-lg object-contain" alt="AI 多视图参考板" />
    <button v-if="generated" type="button" class="w-full rounded-lg border border-emerald-400 px-2 py-2 text-xs text-emerald-300" @click="emit('confirmed', { id: '图1', role: '主体多视图', image: generated })">确认作为 H3 参考</button>
  </section>
</template>
