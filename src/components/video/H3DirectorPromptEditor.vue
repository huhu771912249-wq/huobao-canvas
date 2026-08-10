<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { compileH3DirectorPrompt, normalizeH3DirectorPrompt } from '../../utils/h3DirectorPrompt.js'
import { streamChatCompletions } from '../../api/chat.js'
import { getMaterialApiBase } from '../../utils/apiBase.js'
import { buildOfficialH3PromptSystemInstruction } from '../../utils/h3GenerationOptions.js'

const props = defineProps({
  references: { type: Array, default: () => [] },
  sourcePrompt: { type: String, default: '' },
  aspectRatio: { type: String, default: '16:9' },
  durationSeconds: { type: Number, default: 5 },
  outputWidth: { type: Number, default: 1920 },
  outputHeight: { type: Number, default: 1080 }
})
const emit = defineEmits(['update:prompt', 'update:plan'])
const plan = reactive({
  subject_definitions: '',
  summary: '',
  dialogue: '',
  required: '',
  flexible: '',
  detailed_description: [{ start: 0, end: 5, action: '', camera: '[Tracking shot]' }],
  overall_soundscape: '',
  non_diegetic_music: ''
})
const aiLoading = ref(false)
const aiError = ref('')
const generationMode = computed(() => props.references.length ? '参考生视频' : '文生视频')
const outputLabel = computed(() => `${props.outputWidth}×${props.outputHeight}`)
const compiledPreview = computed(() => {
  try { return compileH3DirectorPrompt(toPlan()) } catch { return '' }
})
const error = computed(() => {
  const hasContent = plan.subject_definitions || plan.summary || plan.dialogue || plan.detailed_description.some(item => item.action)
  if (!hasContent) return ''
  try { compileH3DirectorPrompt(toPlan()); return '' } catch (reason) { return reason.message }
})

function toPlan() {
  return normalizeH3DirectorPrompt({
    references: props.references,
    subject_definitions: plan.subject_definitions,
    summary: plan.summary,
    dialogue: plan.dialogue,
    retention_analysis: {
      required: plan.required.split(/[，,]/).map(value => value.trim()).filter(Boolean),
      flexible: plan.flexible.split(/[，,]/).map(value => value.trim()).filter(Boolean)
    },
    detailed_description: plan.detailed_description.filter(item => String(item.action || '').trim()),
    overall_soundscape: plan.overall_soundscape,
    non_diegetic_music: plan.non_diegetic_music
  })
}

function addShot() {
  const last = plan.detailed_description.at(-1)
  plan.detailed_description.push({ start: Number(last?.end || 0), end: Number(last?.end || 0) + 2, action: '', camera: '[Static shot]' })
}

function extractJson(content) {
  const match = String(content).match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 未返回可编辑的导演 JSON')
  return JSON.parse(match[0])
}

async function generateDirectorPlan() {
  if (!props.sourcePrompt.trim() || aiLoading.value) return
  aiLoading.value = true
  aiError.value = ''
  try {
    const referenceNames = props.references.length
      ? props.references.map(item => `@${item.id} ${item.role}`).join('；')
      : '无（文生视频，不得虚构引用）'
    let response = ''
    for await (const chunk of streamChatCompletions({
      model: 'gemma4-31b-heretic',
      messages: [
        { role: 'system', content: buildOfficialH3PromptSystemInstruction({ hasReference: props.references.length > 0 }) },
        { role: 'user', content: `参考绑定：${referenceNames}\n时长：${props.durationSeconds} 秒\n比例：${props.aspectRatio}\n原始创意：${props.sourcePrompt}` }
      ],
      temperature: 0.4
    }, undefined, { baseUrl: getMaterialApiBase(), endpoint: '/v1/chat/completions' })) response += chunk
    const official = extractJson(response)
    const generatedPlan = normalizeH3DirectorPrompt({
      ...official,
      summary: official.integrated_multimodal_description || official.summary,
      references: props.references
    })
    plan.subject_definitions = generatedPlan.subject_definitions
    plan.summary = generatedPlan.summary
    plan.dialogue = generatedPlan.dialogue
    plan.required = generatedPlan.retention_analysis.required.join('，')
    plan.flexible = generatedPlan.retention_analysis.flexible.join('，')
    plan.detailed_description.splice(0, plan.detailed_description.length, ...generatedPlan.detailed_description)
    plan.overall_soundscape = generatedPlan.overall_soundscape
    plan.non_diegetic_music = generatedPlan.non_diegetic_music
  } catch (reason) {
    aiError.value = reason?.message || 'AI 导演提示生成失败'
  } finally {
    aiLoading.value = false
  }
}

function insertReference(reference) {
  const mention = `@${reference.id}`
  if (plan.subject_definitions.includes(mention)) return
  plan.subject_definitions = [plan.subject_definitions.trim(), `${mention} ${reference.role || '保持主体一致'}`]
    .filter(Boolean)
    .join('；')
}

watch([plan, () => props.references], () => {
  if (error.value) return
  const normalized = toPlan()
  emit('update:plan', normalized)
  emit('update:prompt', compileH3DirectorPrompt(normalized))
}, { deep: true, immediate: true })
</script>

<template>
  <section class="space-y-2 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
    <div class="flex items-start justify-between gap-2">
      <div><b class="text-xs text-[var(--text-primary)]">冠希 H3 极简导演</b><p class="text-[10px] text-[var(--text-secondary)]">按 MiniMax H3 官方 Prompt Writing Skill 编写 T2VA / I2VA 提示词。</p></div>
      <span class="shrink-0 rounded-full bg-violet-400/15 px-2 py-1 text-[9px] text-violet-300">{{ generationMode }}</span>
    </div>
    <div class="grid grid-cols-4 gap-1 text-center text-[9px] text-[var(--text-secondary)]">
      <span class="summary-chip">{{ aspectRatio }}</span><span class="summary-chip">{{ durationSeconds }} 秒</span><span class="summary-chip">24 FPS</span><span class="summary-chip">{{ outputLabel }}</span>
    </div>
    <div class="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2">
      <div class="flex items-center justify-between"><b class="text-[10px] text-cyan-300">引用素材</b><span class="text-[9px] text-[var(--text-secondary)]">点击插入 @ 引用</span></div>
      <div v-if="references.length" class="mt-2 flex flex-wrap gap-2">
        <button v-for="reference in references" :key="reference.id" type="button" class="reference-chip" @click="insertReference(reference)">
          <img v-if="reference.image" :src="reference.image" alt="" /><span>@{{ reference.id }}</span><small>{{ reference.role }}</small>
        </button>
      </div>
      <p v-else class="mt-1 text-[10px] text-[var(--text-secondary)]">没有参考图也可以直接生成文生视频；确认多视图参考板后可一键插入 @图1。</p>
    </div>
    <button type="button" :disabled="!sourcePrompt.trim() || aiLoading" class="w-full rounded-lg border border-violet-400 bg-violet-400/10 px-2 py-2 text-xs font-semibold text-violet-300 disabled:opacity-40" @click="generateDirectorPlan">{{ aiLoading ? '官方 Skill 正在优化…' : '使用官方 Skill 优化 H3 提示词' }}</button>
    <div v-if="aiError" role="alert" class="text-[10px] text-red-400">{{ aiError }}</div>
    <textarea v-model="plan.subject_definitions" rows="2" class="field" placeholder="主体与引用：@图1 保持人脸、服装和产品结构" />
    <textarea v-model="plan.summary" rows="2" class="field" placeholder="summary：比例、场景、主体动作、风格" />
    <textarea v-model="plan.dialogue" rows="2" class="field" placeholder="台词/口播（可选）：只写台词，提交时自动转换成 <d>…</d>" />
    <details class="rounded-lg border border-[var(--border-color)] p-2">
      <summary class="cursor-pointer text-[10px] font-semibold text-violet-300">高级导演控制：时间线、保留项与声音</summary>
      <div class="mt-2 space-y-2">
        <div class="grid grid-cols-2 gap-2"><input v-model="plan.required" class="field" placeholder="必须保留：身份，服装" /><input v-model="plan.flexible" class="field" placeholder="允许变化：机位，表情" /></div>
        <div v-for="(shot, index) in plan.detailed_description" :key="index" class="grid grid-cols-[52px_52px_1fr] gap-1">
          <input v-model.number="shot.start" type="number" min="0" step="0.1" class="field" aria-label="镜头开始秒" />
          <input v-model.number="shot.end" type="number" min="0.1" step="0.1" class="field" aria-label="镜头结束秒" />
          <input v-model="shot.action" class="field" placeholder="动作；镜头指令写在下一行" />
          <input v-model="shot.camera" class="field col-span-3" placeholder="[Tracking shot] / [Push in,Pan right]" />
        </div>
        <button type="button" class="text-xs text-violet-300" @click="addShot">＋ 添加时间段</button>
        <textarea v-model="plan.overall_soundscape" rows="2" class="field" placeholder="overall_soundscape：现场声音" />
        <textarea v-model="plan.non_diegetic_music" rows="2" class="field" placeholder="non_diegetic_music：画外音乐" />
      </div>
    </details>
    <div v-if="compiledPreview" class="rounded-lg bg-black/20 p-2"><b class="text-[9px] text-emerald-300">实际提交格式</b><pre class="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[9px] text-[var(--text-secondary)]">{{ compiledPreview }}</pre></div>
    <div v-if="error" role="alert" class="text-[10px] text-red-400">{{ error }}</div>
  </section>
</template>

<style scoped>.field{width:100%;border:1px solid var(--border-color);border-radius:.5rem;background:var(--bg-tertiary);padding:.4rem .5rem;font-size:.7rem;color:var(--text-primary)}.summary-chip{border-radius:.45rem;background:rgba(255,255,255,.04);padding:.35rem .2rem}.reference-chip{display:grid;grid-template-columns:24px auto;grid-template-rows:auto auto;align-items:center;column-gap:.4rem;border:1px solid rgba(34,211,238,.3);border-radius:.6rem;padding:.35rem .5rem;text-align:left}.reference-chip:hover{border-color:rgb(34 211 238)}.reference-chip img{grid-row:1/3;width:24px;height:24px;border-radius:.35rem;object-fit:cover}.reference-chip span{font-size:.65rem;color:rgb(103 232 249)}.reference-chip small{font-size:.55rem;color:var(--text-secondary)}</style>
