<template>
  <main class="min-h-screen bg-[#07101e] text-slate-100">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
      <div><div class="text-xs tracking-[0.3em] text-cyan-400">HUOBAO VIDEO</div><h1 class="text-xl font-semibold">视频创作中心</h1></div>
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
        <aside class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><h2 class="font-semibold">智能设置</h2><div class="mt-4 space-y-2"><button v-for="size in sizes" :key="size.key" class="w-full rounded-xl border px-3 py-3 text-left text-sm" :class="selectedSize === size.key ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="selectedSize = size.key">{{ size.label }}</button></div><div class="mt-4 text-xs text-slate-400">模型按任务自动匹配；人物一致性默认开启；API 与底层参数放在高级设置。</div></aside>
      </div>
      <div v-else-if="activeTab === 'novel'" class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 class="text-xl font-semibold">小说成片</h2><p class="mt-2 text-slate-400">支持智能改编 1–3 分钟和完整原文长片。上传后先显示人物、场景、预计镜头数和任务量，再确认生成。</p><div class="mt-5 grid gap-3 md:grid-cols-2"><div class="rounded-xl border border-cyan-500/50 p-4"><b>智能改编</b><p class="text-sm text-slate-400">保留主线、转折与高潮。</p></div><div class="rounded-xl border border-slate-700 p-4"><b>完整原文</b><p class="text-sm text-slate-400">按旁白和对白自动估时。</p></div></div></div>
      <div v-else class="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 class="text-xl font-semibold">素材再创作</h2><p class="mt-2 text-slate-400">统一管理图片、视频、文档、人物、场景、品牌素材和生成历史；原 DSP 素材库继续保留独立入口。</p></div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { COMMON_VIDEO_SIZES } from '../config/videoSizes'
import { detectStudioIntent } from '../utils/studioIntent'

const route = useRoute(); const router = useRouter()
const tabs = [{ key: 'quick', label: '快速创作' }, { key: 'novel', label: '小说成片' }, { key: 'assets', label: '素材再创作' }]
const modes = [{ key: 'text-to-image', title: '文生图', description: '提示词生成图片变体' }, { key: 'image-to-video', title: '文生图＋视频', description: '先确认首帧，再生成动态镜头' }, { key: 'asset', title: '上传素材', description: '自动识别图片、视频和文档' }]
const activeTab = ref(String(route.query.tab || 'quick')); const selectedMode = ref('text-to-image'); const prompt = ref(''); const fileName = ref(''); const selectedSize = ref('1280x720'); const sizes = COMMON_VIDEO_SIZES
const intent = computed(() => detectStudioIntent({ prompt: prompt.value, fileName: fileName.value, wantsVideo: selectedMode.value === 'image-to-video' }))
const intentLabel = computed(() => ({ 'text-to-image': '文生图', 'image-to-video': '文生图＋视频', 'novel-video': '小说成片', asset: '素材再创作' }[intent.value]))
const setTab = key => { activeTab.value = key; router.replace({ query: key === 'quick' ? {} : { tab: key } }) }
const handleFile = event => { fileName.value = event.target?.files?.[0]?.name || ''; if (intent.value === 'novel-video') setTab('novel') }
const startCreate = () => { if (intent.value === 'novel-video') setTab('novel'); else window.$message?.info(`${intentLabel.value}工作流已准备，目标尺寸 ${selectedSize.value}`) }
</script>

<style scoped>.studio-chip{border:1px solid #334155;border-radius:999px;padding:.45rem .8rem;color:#cbd5e1}</style>
