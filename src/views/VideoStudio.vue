<template>
  <main class="min-h-screen bg-[#07101e] text-slate-100">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
      <div><div class="text-xs tracking-[0.3em] text-cyan-400">冠希 VIDEO</div><h1 class="text-xl font-semibold">视频创作中心</h1></div>
      <nav class="flex gap-2 text-sm"><button class="studio-chip" @click="router.push('/')">首页</button><button class="studio-chip" @click="router.push('/canvas')">无限画布</button></nav>
    </header>
    <section class="mx-auto max-w-[1500px] p-6">
      <div class="mb-6 flex flex-wrap gap-2">
        <button v-for="item in tabs" :key="item.key" class="rounded-full px-4 py-2 text-sm" :class="activeTab === item.key ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300'" @click="setTab(item.key)">{{ item.label }}</button>
      </div>
      <div v-if="activeTab === 'quick'" class="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div class="space-y-4">
          <div class="grid gap-3 md:grid-cols-3">
            <button v-for="mode in modes" :key="mode.key" class="rounded-2xl border p-4 text-left" :class="selectedMode === mode.key ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 bg-slate-900/60'" @click="selectedMode = mode.key"><div class="font-semibold">{{ mode.title }}</div><div class="mt-1 text-xs text-slate-400">{{ mode.description }}</div></button>
          </div>
          <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <textarea v-model="prompt" rows="6" class="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none focus:border-cyan-400" placeholder="描述画面，或上传小说、脚本、图片、视频，系统会自动识别工作流。" />
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3"><label class="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-sm">📎 上传附件<input class="hidden" type="file" accept=".txt,.md,.docx,.pdf,image/*,video/*" @change="handleFile" /></label><button class="rounded-lg bg-cyan-400 px-5 py-2 font-semibold text-slate-950" @click="startCreate">开始创作</button></div>
            <div v-if="fileName" class="mt-2 text-xs text-cyan-300">已识别：{{ fileName }} → {{ intentLabel }}</div>
          </div>
          <div class="rounded-2xl border border-slate-700 bg-slate-900/50 p-4"><h2 class="font-semibold">生成结果与历史</h2><p class="mt-2 text-sm text-slate-400">结果将在这里预览、下载、重试、保存到素材库或送入无限画布。</p></div>
        </div>
        <aside class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><h2 class="font-semibold">智能设置</h2><div v-if="selectedMode === 'image-to-video'" class="mt-4"><div class="mb-2 text-xs text-slate-400">云端视频模型</div><button v-for="model in cloudVideoModels" :key="model.key" class="mb-2 w-full rounded-xl border px-3 py-3 text-left text-sm" :class="selectedVideoModel === model.key ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="selectedVideoModel = model.key"><b>{{ model.label }}</b><div class="mt-1 text-xs text-slate-400">{{ model.description }}</div></button></div><div class="mt-4 space-y-2"><div class="text-xs text-slate-400">画面比例与首帧尺寸</div><button v-for="size in sizes" :key="size.key" class="w-full rounded-xl border px-3 py-3 text-left text-sm" :class="selectedSize === size.key ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="selectedSize = size.key">{{ size.label }}</button><button class="w-full rounded-xl border px-3 py-3 text-left text-sm" :class="selectedSize === 'custom' ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="selectedSize = 'custom'">自定义尺寸</button><div v-if="selectedSize === 'custom'" class="grid grid-cols-2 gap-2"><input v-model.number="customWidth" class="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm" placeholder="宽" /><input v-model.number="customHeight" class="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm" placeholder="高" /><div class="col-span-2 text-xs" :class="customSizeError ? 'text-red-300' : 'text-cyan-300'">{{ customSizeError || customSizeLabel }}</div></div></div><div class="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-xs text-emerald-200"><b>导出最低 1080p</b><div class="mt-1 text-slate-400">云端按模型安全分辨率生成，再放大并导出 1920×1080 或 1080×1920。</div></div></aside>
      </div>
      <div v-else-if="activeTab === 'novel'" class="space-y-5"><div class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 class="text-xl font-semibold">小说成片</h2><p class="mt-2 text-slate-400">支持智能改编 1–3 分钟和完整原文长片。先生成故事板，确认并保存后才消耗模型额度。</p><div v-if="parsingDocument" role="status" class="mt-4 text-cyan-300">正在识别附件和章节…</div><div v-if="documentError" role="alert" class="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{{ documentError }}</div><div v-if="parsedDocument" class="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm"><b>{{ parsedDocument.filename }}</b><div class="mt-2 grid gap-2 sm:grid-cols-4"><span>{{ parsedDocument.characters }} 字符</span><span>{{ parsedDocument.chapters.length }} 章/节</span><span>智能改编约 {{ parsedDocument.estimates.compressed_seconds }} 秒</span><span>完整模式约 {{ parsedDocument.estimates.full_shots }} 镜头</span></div></div><div class="mt-5 grid gap-3 md:grid-cols-2"><button :disabled="!parsedDocument || planningStoryboard" class="rounded-xl border border-cyan-500/50 p-4 text-left disabled:opacity-40" @click="planStoryboard('smart')"><b>智能改编</b><p class="text-sm text-slate-400">保留主线、转折与高潮，生成 1–3 分钟故事板。</p></button><button :disabled="!parsedDocument || planningStoryboard" class="rounded-xl border border-slate-700 p-4 text-left disabled:opacity-40" @click="planStoryboard('full')"><b>完整原文</b><p class="text-sm text-slate-400">按原文顺序拆镜，不强塞进单个 5 秒任务。</p></button></div></div><NovelVideoWorkspace :storyboard="storyboard" aspect-ratio="16:9" /></div>
      <div v-else class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 class="text-xl font-semibold">素材再创作</h2><p class="mt-2 text-slate-400">统一管理图片、视频、文档、人物、场景、品牌素材和生成历史；原 DSP 素材库继续保留独立入口。</p></div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { COMMON_VIDEO_SIZES, normalizeVideoSize } from '../config/videoSizes'
import { detectStudioIntent } from '../utils/studioIntent'
import { createStudioStoryboard, parseStudioDocument } from '../api/studioDocument'
import { buildStudioCanvas } from '../config/studioProjectFlow'
import { createProject, updateProject } from '../stores/projects'
import NovelVideoWorkspace from '../components/studio/NovelVideoWorkspace.vue'

const route = useRoute(); const router = useRouter()
const tabs = [{ key: 'quick', label: '快速创作' }, { key: 'novel', label: '小说成片' }, { key: 'assets', label: '素材再创作' }]
const modes = [{ key: 'text-to-image', title: '文生图', description: '提示词生成图片变体' }, { key: 'image-to-video', title: '文生图＋视频', description: '先确认首帧，再生成动态镜头' }, { key: 'asset', title: '上传素材', description: '自动识别图片、视频和文档' }]
const activeTab = ref(String(route.query.tab || 'quick')); const selectedMode = ref('text-to-image'); const prompt = ref(''); const fileName = ref(''); const selectedSize = ref('1280x720'); const sizes = COMMON_VIDEO_SIZES
const cloudVideoModels = [{ key: 'minimax-h3', label: 'MiniMax H3', description: '默认｜人物与原生音频视频' }, { key: 'ltx-2.3', label: 'LTX 2.3', description: '开放版｜内置 2× 空间放大' }]
const selectedVideoModel = ref('minimax-h3')
const parsedDocument = ref(null); const parsingDocument = ref(false); const documentError = ref('')
const storyboard = ref(null); const planningStoryboard = ref(false); const customWidth = ref(1080); const customHeight = ref(1080)
const customSizeError = computed(() => { try { normalizeVideoSize(customWidth.value, customHeight.value); return '' } catch (error) { return error.message } })
const customSizeLabel = computed(() => `${customWidth.value} × ${customHeight.value}`)
const intent = computed(() => detectStudioIntent({ prompt: prompt.value, fileName: fileName.value, wantsVideo: selectedMode.value === 'image-to-video' }))
const intentLabel = computed(() => ({ 'text-to-image': '文生图', 'image-to-video': '文生图＋视频', 'novel-video': '小说成片', asset: '素材再创作' }[intent.value]))
const setTab = key => { activeTab.value = key; router.replace({ query: key === 'quick' ? {} : { tab: key } }) }
const handleFile = async event => {
  const file = event.target?.files?.[0]
  fileName.value = file?.name || ''
  if (!file || intent.value !== 'novel-video') return
  setTab('novel'); parsingDocument.value = true; documentError.value = ''; parsedDocument.value = null
  try { parsedDocument.value = await parseStudioDocument(file) }
  catch (error) { documentError.value = error?.response?.data?.error?.message || error?.message || '附件识别失败' }
  finally { parsingDocument.value = false }
}
const resolvedSize = computed(() => selectedSize.value === 'custom' ? `${customWidth.value}x${customHeight.value}` : selectedSize.value)
const startCreate = async () => {
  const cleanPrompt = prompt.value.trim()
  if (!cleanPrompt && !fileName.value) { window.$message?.warning('请先输入创意描述或上传附件'); return }
  if (intent.value === 'novel-video') {
    if (!parsedDocument.value) parsedDocument.value = { filename: '粘贴的小说正文', text: cleanPrompt, characters: cleanPrompt.length, chapters: [{ title: '正文', text: cleanPrompt }], estimates: { compressed_seconds: Math.min(180, Math.max(60, Math.round(cleanPrompt.length / 12))), full_shots: Math.max(1, Math.round(cleanPrompt.length / 80)) } }
    setTab('novel'); await planStoryboard('smart'); return
  }
  if (intent.value === 'asset') { window.$message?.warning('请上传图片或视频素材后再开始'); return }
  if (selectedSize.value === 'custom' && customSizeError.value) { window.$message?.error(customSizeError.value); return }
  const id = createProject(cleanPrompt.slice(0, 28) || intentLabel.value)
  updateProject(id, { canvasData: buildStudioCanvas({ mode: selectedMode.value, prompt: cleanPrompt, size: resolvedSize.value, videoModel: selectedVideoModel.value }) })
  router.push(`/canvas/${id}`)
}
const planStoryboard = async mode => { if (!parsedDocument.value) return; planningStoryboard.value = true; documentError.value = ''; try { storyboard.value = await createStudioStoryboard(parsedDocument.value.text, mode) } catch (error) { documentError.value = error?.response?.data?.error?.message || error?.message || '故事板生成失败' } finally { planningStoryboard.value = false } }
</script>

<style scoped>.studio-chip{border:1px solid #334155;border-radius:999px;padding:.45rem .8rem;color:#cbd5e1}</style>
