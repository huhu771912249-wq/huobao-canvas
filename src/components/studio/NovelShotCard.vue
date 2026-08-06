<template>
  <article class="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div><b>{{ model.title || `镜头 ${index + 1}` }}</b><span class="ml-2 text-xs" :class="statusTone">{{ statusLabel }}</span></div>
      <span class="text-xs text-slate-500">{{ model.duration_seconds }} 秒</span>
    </div>
    <div class="space-y-3">
      <label class="field-label">原文<textarea v-model="model.source_text" rows="3" class="field-input" @input="changed" /></label>
      <label class="field-label">图像提示词<textarea v-model="model.image_prompt" rows="3" class="field-input" @input="changed" /></label>
      <label class="field-label">动态提示词<textarea v-model="model.motion_prompt" rows="2" class="field-input" @input="changed" /></label>
      <label class="field-label">镜头字幕<textarea v-model="model.subtitle" rows="2" class="field-input" @input="changed" /></label>
      <label class="field-label">时长（秒）<input v-model.number="model.duration_seconds" type="number" min="1" max="30" step="0.5" class="field-input" @input="changed" /></label>
    </div>
    <div v-if="model.error" role="alert" class="mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{{ model.error }}</div>
    <video v-if="model.video_url" :src="model.video_url" controls preload="metadata" class="mt-3 w-full rounded-xl" />
    <button v-if="model.status === 'failed'" type="button" class="mt-3 rounded-lg border border-amber-400/50 px-3 py-2 text-sm text-amber-200" @click="$emit('retry', model.id)">仅重试此镜头</button>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ shot: { type: Object, required: true }, index: { type: Number, required: true } })
const emit = defineEmits(['change', 'retry'])
const model = computed(() => props.shot)
const statusLabel = computed(() => ({ queued: '等待生成', generating: '正在生成', upscaling: 'AI 超分中', completed: '已完成', failed: '生成失败', cancelled: '已取消' }[model.value.status] || '未提交'))
const statusTone = computed(() => model.value.status === 'failed' ? 'text-red-300' : model.value.status === 'completed' ? 'text-emerald-300' : 'text-cyan-300')
const changed = () => emit('change')
</script>

<style scoped>
.field-label{display:block;font-size:.75rem;color:#94a3b8}.field-input{margin-top:.35rem;width:100%;border:1px solid #334155;border-radius:.6rem;background:#07101e;padding:.6rem;color:#e2e8f0;outline:none}.field-input:focus{border-color:#22d3ee}
</style>
