<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { compileH3DirectorPrompt, normalizeH3DirectorPrompt } from '../../utils/h3DirectorPrompt.js'
import { streamChatCompletions } from '../../api/chat.js'
import { getMaterialApiBase } from '../../utils/apiBase.js'

const props = defineProps({
  references: { type: Array, default: () => [] },
  sourcePrompt: { type: String, default: '' }
})
const emit = defineEmits(['update:prompt', 'update:plan'])
const plan = reactive({
  subject_definitions: '',
  summary: '',
  required: '',
  flexible: '',
  detailed_description: [{ start: 0, end: 5, action: '', camera: '[Tracking shot]' }],
  overall_soundscape: '',
  non_diegetic_music: ''
})
const aiLoading = ref(false)
const aiError = ref('')
const error = computed(() => {
  try { compileH3DirectorPrompt(toPlan()); return '' } catch (reason) { return reason.message }
})

function toPlan() {
  return normalizeH3DirectorPrompt({
    references: props.references,
    subject_definitions: plan.subject_definitions,
    summary: plan.summary,
    retention_analysis: {
      required: plan.required.split(/[，,]/).map(value => value.trim()).filter(Boolean),
      flexible: plan.flexible.split(/[，,]/).map(value => value.trim()).filter(Boolean)
    },
    detailed_description: plan.detailed_description,
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
    const referenceNames = props.references.map(item => `@${item.id} ${item.role}`).join('；') || '@图1 主体多视图'
    let response = ''
    for await (const chunk of streamChatCompletions({
      model: 'gemma4-31b-heretic',
      messages: [
        { role: 'system', content: '你是专业 MiniMax H3 视频导演。只输出 JSON，不要 Markdown。字段必须为 subject_definitions, summary, retention_analysis(required/flexible 数组), detailed_description(start/end/action/camera 数组), overall_soundscape, non_diegetic_music。镜头连续不重叠；相机指令使用英文方括号；明确使用 @图N 保持身份、脸部和服装一致。' },
        { role: 'user', content: `参考绑定：${referenceNames}\n原始创意：${props.sourcePrompt}` }
      ],
      temperature: 0.4
    }, undefined, { baseUrl: getMaterialApiBase(), endpoint: '/v1/chat/completions' })) response += chunk
    const generatedPlan = normalizeH3DirectorPrompt({ ...extractJson(response), references: props.references })
    plan.subject_definitions = generatedPlan.subject_definitions
    plan.summary = generatedPlan.summary
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

watch([plan, () => props.references], () => {
  if (error.value) return
  const normalized = toPlan()
  emit('update:plan', normalized)
  emit('update:prompt', compileH3DirectorPrompt(normalized))
}, { deep: true, immediate: true })
</script>

<template>
  <section class="space-y-2 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
    <div><b class="text-xs text-[var(--text-primary)]">冠希 H3 导演提示模板</b><p class="text-[10px] text-[var(--text-secondary)]">结构化编辑，提交时编译成 H3 普通提示词。</p></div>
    <button type="button" :disabled="!sourcePrompt.trim() || aiLoading" class="w-full rounded-lg border border-violet-400 bg-violet-400/10 px-2 py-2 text-xs font-semibold text-violet-300 disabled:opacity-40" @click="generateDirectorPlan">{{ aiLoading ? 'AI 正在识图并编写导演稿…' : 'AI 生成六段式 H3 导演提示词' }}</button>
    <div v-if="aiError" role="alert" class="text-[10px] text-red-400">{{ aiError }}</div>
    <textarea v-model="plan.subject_definitions" rows="2" class="field" placeholder="subject_definitions：@图1 保持人脸；@图2 保持服装" />
    <textarea v-model="plan.summary" rows="2" class="field" placeholder="summary：比例、场景、主体动作、风格" />
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
    <div v-if="error" role="alert" class="text-[10px] text-red-400">{{ error }}</div>
  </section>
</template>

<style scoped>.field{width:100%;border:1px solid var(--border-color);border-radius:.5rem;background:var(--bg-tertiary);padding:.4rem .5rem;font-size:.7rem;color:var(--text-primary)}</style>
