<template>
  <main class="h-screen overflow-y-auto overscroll-y-contain bg-[#07101e] text-slate-100">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
      <div><div class="text-xs tracking-[0.3em] text-cyan-400">冠希 VIDEO</div><h1 class="text-xl font-semibold">视频创作中心</h1></div>
      <nav class="flex items-center gap-2 text-sm"><ComputeStatusIndicator /><button class="studio-chip" @click="router.push('/')">首页</button><button class="studio-chip" @click="router.push('/canvas')">无限画布</button></nav>
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
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3"><label class="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-sm">📎 上传附件<input class="hidden" type="file" accept=".txt,.md,.docx,.pdf,image/*,video/*" @change="handleFile" /></label><button :disabled="creatingProject" class="rounded-lg bg-cyan-400 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50" @click="startCreate">{{ creatingProject ? '正在打开…' : '开始创作' }}</button></div>
            <div v-if="fileName" class="mt-2 text-xs text-cyan-300">已识别：{{ fileName }} → {{ intentLabel }}</div>
          </div>
          <div class="rounded-2xl border border-slate-700 bg-slate-900/50 p-4"><h2 class="font-semibold">生成结果与历史</h2><p class="mt-2 text-sm text-slate-400">结果将在这里预览、下载、重试、保存到素材库或送入无限画布。</p></div>
        </div>
        <aside class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <h2 class="font-semibold">智能设置</h2>
          <div v-if="selectedMode !== 'asset'" class="mt-4">
            <div class="mb-2 text-xs text-slate-400">文生图模型</div>
            <select v-model="selectedImageModel" data-testid="studio-image-model-select" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-400">
              <option v-for="model in localImageModels" :key="model.key" :value="model.key">{{ model.label }}</option>
            </select>
            <div v-if="selectedImageConfig?.tips" class="mt-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-xs leading-5 text-cyan-100">
              {{ selectedImageConfig.tips }}生成后可直接连到 H3 视频节点。
            </div>
            <div class="mb-2 mt-4 text-xs text-slate-400">图片尺寸</div>
            <select v-model="selectedSize" data-testid="studio-image-size-select" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-400">
              <option v-for="size in selectedImageSizes" :key="size" :value="size">{{ size }}</option>
            </select>
          </div>
          <div v-if="selectedMode === 'image-to-video'" class="mt-4">
            <div class="mb-2 text-xs text-slate-400">SeedVR2</div>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="option in qualityOptions" :key="option.mode" class="rounded-xl border p-2 text-left text-xs" :class="qualityMode === option.mode ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 text-slate-400'" @click="qualityMode = option.mode"><b class="block">{{ option.label }}</b><span>{{ option.description }}</span></button>
            </div>
          </div>
          <div v-if="selectedMode === 'image-to-video'" class="mt-4"><div class="mb-2 text-xs text-slate-400">云端视频模型</div><button v-for="model in cloudVideoModels" :key="model.key" class="mb-2 w-full rounded-xl border px-3 py-3 text-left text-sm" :class="selectedVideoModel === model.key ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="selectedVideoModel = model.key"><b>{{ model.label }}</b><div class="mt-1 text-xs text-slate-400">{{ model.description }}</div></button></div>
          <div v-if="selectedMode === 'image-to-video' && selectedVideoModel === 'minimax-h3'" class="mt-4">
            <div class="mb-2 text-xs text-slate-400">H3 采样</div>
            <button v-for="option in H3_SAMPLING_OPTIONS" :key="option.mode" class="mb-2 w-full rounded-xl border px-3 py-3 text-left text-sm" :class="samplingMode === option.mode ? 'border-amber-300 bg-amber-300/10' : 'border-slate-700'" @click="samplingMode = option.mode"><b>{{ option.label }}</b><div class="mt-1 text-xs text-slate-400">{{ option.description }}</div></button>
          </div>
          <VideoOutputSizePicker v-if="selectedMode === 'image-to-video'" class="mt-4" v-model:output-width="outputWidth" v-model:output-height="outputHeight" />
        </aside>
      </div>
      <div v-else-if="activeTab === 'novel'" class="space-y-5">
        <div class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <h2 class="text-xl font-semibold">小说成片</h2><p class="mt-2 text-slate-400">直接粘贴小说正文或上传附件，生成可编辑故事板；确认并保存后才消耗模型额度。</p>
          <textarea v-model="novelText" rows="9" maxlength="200000" class="mt-5 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none focus:border-cyan-400" placeholder="粘贴小说正文（最多 20 万字符）" />
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3"><label class="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-sm">📎 上传小说附件<input :key="novelFileKey" class="hidden" type="file" accept=".txt,.md,.docx" @change="handleNovelFile" /></label><span class="text-xs" :class="novelText.length > NOVEL_TEXT_LIMIT ? 'text-red-300' : 'text-slate-400'">{{ novelText.length.toLocaleString() }} / {{ NOVEL_TEXT_LIMIT.toLocaleString() }} 字符</span></div>
          <div v-if="parsingDocument" role="status" class="mt-4 text-cyan-300">正在识别附件和章节…</div><div v-if="documentError" role="alert" class="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{{ documentError }}</div>
          <div v-if="parsedDocument" class="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm"><b>{{ parsedDocument.filename }}</b><div class="mt-2 grid gap-2 sm:grid-cols-4"><span>{{ parsedDocument.characters }} 字符</span><span>{{ parsedDocument.chapters.length }} 章/节</span><span>智能改编约 {{ parsedDocument.estimates.compressed_seconds }} 秒</span><span>完整模式约 {{ parsedDocument.estimates.full_shots }} 镜头</span></div></div>
          <div class="mt-5 grid gap-3 md:grid-cols-2"><button :disabled="planningStoryboard" class="rounded-xl border border-cyan-500/50 p-4 text-left disabled:opacity-40" @click="prepareAndPlan('smart')"><b>{{ planningMode === 'smart' ? '正在生成智能故事板…' : '生成故事板（智能改编）' }}</b><p class="text-sm text-slate-400">保留主线、转折与高潮，生成 1–3 分钟故事板。</p></button><button :disabled="planningStoryboard" class="rounded-xl border border-slate-700 p-4 text-left disabled:opacity-40" @click="prepareAndPlan('full')"><b>{{ planningMode === 'full' ? '正在生成完整故事板…' : '生成故事板（完整原文）' }}</b><p class="text-sm text-slate-400">按原文顺序拆镜，不强塞进单个 5 秒任务。</p></button></div>
          <div v-if="planningStoryboard" role="status" class="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-sm text-cyan-200">正在分析正文并拆分镜头，请勿重复点击…</div>
        </div>
        <div id="storyboard-workspace"><NovelVideoWorkspace :key="`${storyboardKey}:${activeNovelJobId}`" :storyboard="storyboard" :title="novelTitle" :initial-job-id="activeNovelJobId" aspect-ratio="16:9" @new-job="clearNovelDraft" /></div>
      </div>
      <div v-else class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 class="text-xl font-semibold">素材再创作</h2><p class="mt-2 text-slate-400">统一管理图片、视频、文档、人物、场景、品牌素材和生成历史；原 DSP 素材库继续保留独立入口。</p></div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { COMMON_VIDEO_SIZES, normalizeVideoSize } from '../config/videoSizes'
import { detectStudioIntent } from '../utils/studioIntent'
import { createStudioStoryboard, parseStudioDocument } from '../api/studioDocument'
import { buildStudioCanvas } from '../config/studioProjectFlow'
import { getAspectRatioForSize } from '../utils/videoAspectRatio'
import { getVideoQualityProfile } from '../utils/videoQualityProfile'
import { createProject } from '../stores/projects'
import NovelVideoWorkspace from '../components/studio/NovelVideoWorkspace.vue'
import VideoOutputSizePicker from '../components/VideoOutputSizePicker.vue'
import ComputeStatusIndicator from '../components/ComputeStatusIndicator.vue'
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS } from '../config/models'
import { H3_SAMPLING_OPTIONS } from '../utils/h3GenerationOptions'
import { normalizeStudioTab } from '../utils/navigationState'

const route = useRoute(); const router = useRouter()
// 'assets'（素材再创作）已移除：模板里只有 quick 和 novel 两个渲染分支，
// 点它会切到一片空白。素材浏览走侧栏「素材库」→ /recent-generations。
const tabs = [{ key: 'quick', label: '快速创作' }, { key: 'novel', label: '小说成片' }]
const modes = [{ key: 'text-to-image', title: '文生图', description: '提示词生成图片变体' }, { key: 'image-to-video', title: '文生图＋视频', description: '先确认首帧，再生成动态镜头' }, { key: 'asset', title: '上传素材', description: '自动识别图片、视频和文档' }]
const activeTab = computed(() => normalizeStudioTab(route.query.tab)); const selectedMode = ref('text-to-image'); const prompt = ref(''); const fileName = ref(''); const selectedSize = ref('1024x1024'); const sizes = COMMON_VIDEO_SIZES
const activeNovelJobId = computed(() => String(route.query.job || ''))
const creatingProject = ref(false)
const localImageModels = IMAGE_MODELS.filter(model => model.provider?.includes('local-material'))
const selectedImageModel = ref(DEFAULT_IMAGE_MODEL)
const selectedImageConfig = computed(() => IMAGE_MODELS.find(model => model.key === selectedImageModel.value))
const selectedImageSizes = computed(() => selectedImageConfig.value?.sizes || ['1024x1024'])
watch(selectedImageModel, modelKey => {
  const model = IMAGE_MODELS.find(item => item.key === modelKey)
  if (!model?.sizes?.includes(selectedSize.value)) selectedSize.value = model?.defaultParams?.size || model?.sizes?.[0] || '1024x1024'
})
const cloudVideoModels = [{ key: 'minimax-h3', label: 'MiniMax H3', description: '默认｜人物与原生音频视频' }, { key: 'ltx-2.3', label: 'LTX 2.3', description: '开放版｜内置 2× 空间放大' }]
const selectedVideoModel = ref('minimax-h3')
const outputWidth = ref(1280)
const outputHeight = ref(720)
const qualityMode = ref('fast')
const samplingMode = ref('standard20')
const qualityOptions = [
  { mode: 'fast', label: '原生快速', description: '不启用超分' },
  { mode: 'auto', label: '智能判断', description: '仅需要时超分' },
  { mode: 'quality', label: 'AI 高清', description: '强制超分' }
]
const parsedDocument = ref(null); const parsingDocument = ref(false); const documentError = ref('')
const NOVEL_TEXT_LIMIT = 200000
const novelText = ref('')
const novelFileKey = ref(0)
const storyboard = ref(null); const storyboardKey = ref(0); const planningStoryboard = ref(false); const planningMode = ref(''); const customWidth = ref(1080); const customHeight = ref(1080)
const customSizeError = computed(() => { try { normalizeVideoSize(customWidth.value, customHeight.value); return '' } catch (error) { return error.message } })
const customSizeLabel = computed(() => `${customWidth.value} × ${customHeight.value}`)
const intent = computed(() => detectStudioIntent({ prompt: prompt.value, fileName: fileName.value, wantsVideo: selectedMode.value === 'image-to-video' }))
const intentLabel = computed(() => ({ 'text-to-image': '文生图', 'image-to-video': '文生图＋视频', 'novel-video': '小说成片', asset: '素材再创作' }[intent.value]))
const setTab = key => router.replace({ query: key === 'quick' ? {} : { tab: key } })
const handleFile = async event => {
  const file = event.target?.files?.[0]
  fileName.value = file?.name || ''
  if (!file || intent.value !== 'novel-video') return
  setTab('novel'); parsingDocument.value = true; documentError.value = ''; parsedDocument.value = null
  try { parsedDocument.value = await parseStudioDocument(file) }
  catch (error) { documentError.value = error?.response?.data?.error?.message || error?.message || '附件识别失败' }
  finally { parsingDocument.value = false }
}
const clearNovelDraft = () => { parsedDocument.value = null; novelText.value = ''; storyboard.value = null; fileName.value = ''; documentError.value = ''; novelFileKey.value += 1 }
const handleNovelFile = async event => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (!/\.(txt|md|docx)$/i.test(file.name)) { documentError.value = '仅支持 TXT、Markdown 和 DOCX 小说附件'; novelFileKey.value += 1; return }
  if (file.size > 10 * 1024 * 1024) { documentError.value = '附件不能超过 10MB'; novelFileKey.value += 1; return }
  parsingDocument.value = true; documentError.value = ''
  try {
    const parsed = await parseStudioDocument(file)
    if (Number(parsed?.characters || 0) > NOVEL_TEXT_LIMIT) throw new Error('小说正文不能超过 20 万字符')
    const parsedText = String(parsed.text || '')
    if (!parsedText.trim()) throw new Error('附件没有可识别正文')
    parsedDocument.value = parsed
    novelText.value = parsedText
    storyboard.value = null
    fileName.value = file.name
  } catch (error) { documentError.value = error?.response?.data?.error?.message || error?.message || '附件识别失败'; novelFileKey.value += 1 }
  finally { parsingDocument.value = false; event.target.value = '' }
}
const novelTitle = computed(() => {
  const firstLine = novelText.value.split(/\r?\n/).map(line => line.trim()).find(Boolean)
  return String(firstLine || parsedDocument.value?.filename?.replace(/\.[^.]+$/, '') || '').slice(0, 80)
})
const preparePastedDocument = () => {
  const text = novelText.value.trim()
  if (text.length < 20) throw new Error('小说正文至少需要 20 个字符')
  if (text.length > NOVEL_TEXT_LIMIT) throw new Error('小说正文不能超过 20 万字符')
  parsedDocument.value = { filename: novelTitle.value || '粘贴的小说正文', text, characters: text.length, chapters: [{ title: '正文', text }], estimates: { compressed_seconds: Math.min(180, Math.max(60, Math.round(text.length / 12))), full_shots: Math.max(1, Math.round(text.length / 80)) } }
}
const prepareAndPlan = async mode => { documentError.value = ''; try { if (parsedDocument.value?.text !== novelText.value) preparePastedDocument(); await planStoryboard(mode) } catch (error) { documentError.value = error?.response?.data?.error?.message || error?.message || '小说正文解析失败' } }
const resolvedSize = computed(() => selectedSize.value === 'custom' ? `${customWidth.value}x${customHeight.value}` : selectedSize.value)
const selectedAspectRatio = computed(() => getAspectRatioForSize(resolvedSize.value))
const qualityProfile = computed(() => getVideoQualityProfile(qualityMode.value, selectedAspectRatio.value))
const startCreate = async () => {
  if (creatingProject.value) return
  const cleanPrompt = prompt.value.trim()
  if (!cleanPrompt && !fileName.value) { window.$message?.warning('请先输入创意描述或上传附件'); return }
  if (intent.value === 'novel-video') {
    if (!parsedDocument.value) parsedDocument.value = { filename: '粘贴的小说正文', text: cleanPrompt, characters: cleanPrompt.length, chapters: [{ title: '正文', text: cleanPrompt }], estimates: { compressed_seconds: Math.min(180, Math.max(60, Math.round(cleanPrompt.length / 12))), full_shots: Math.max(1, Math.round(cleanPrompt.length / 80)) } }
    setTab('novel'); await planStoryboard('smart'); return
  }
  if (intent.value === 'asset') { window.$message?.warning('请上传图片或视频素材后再开始'); return }
  if (selectedSize.value === 'custom' && customSizeError.value) { window.$message?.error(customSizeError.value); return }
  creatingProject.value = true
  try {
    const id = createProject(cleanPrompt.slice(0, 28) || intentLabel.value, {
      canvasData: buildStudioCanvas({ mode: selectedMode.value, prompt: cleanPrompt, size: resolvedSize.value, imageModel: selectedImageModel.value, videoModel: selectedVideoModel.value, qualityMode: qualityMode.value, samplingMode: samplingMode.value })
    })
    await router.push(`/canvas/${id}`)
  } finally {
    creatingProject.value = false
  }
}
const planStoryboard = async mode => {
  if (!parsedDocument.value || planningStoryboard.value) return false
  planningStoryboard.value = true
  planningMode.value = mode
  documentError.value = ''
  try {
    const result = await createStudioStoryboard(parsedDocument.value.text, mode)
    if (!Array.isArray(result?.shots) || !result.shots.length) throw new Error('故事板没有生成有效镜头，请重试')
    storyboard.value = result
    storyboardKey.value += 1
    window.$message?.success('故事板已生成，可以编辑镜头并继续生成视频')
    requestAnimationFrame(() => document.getElementById('storyboard-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return true
  } catch (error) {
    documentError.value = error?.response?.data?.error?.message || error?.message || '故事板生成失败'
    return false
  } finally {
    planningStoryboard.value = false
    planningMode.value = ''
  }
}
</script>

<style scoped>.studio-chip{border:1px solid #334155;border-radius:999px;padding:.45rem .8rem;color:#cbd5e1}</style>
