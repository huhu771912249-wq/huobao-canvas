<template>
  <section class="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">字幕校对</h3><p class="text-xs text-slate-400">时间必须连续递增，且不能超过成片总时长。</p></div><button type="button" class="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" :disabled="saving" @click="$emit('save')">{{ saving ? '保存中…' : '保存字幕' }}</button></div>
    <div class="max-h-80 space-y-2 overflow-auto">
      <div v-for="(segment, index) in segments" :key="segment.id || index" class="grid gap-2 rounded-xl border border-slate-800 p-3 md:grid-cols-[90px_90px_120px_1fr]">
        <label class="text-xs text-slate-400">开始<input v-model.number="segment.start" type="number" min="0" step="0.1" class="subtitle-input" @input="$emit('change')" /></label>
        <label class="text-xs text-slate-400">结束<input v-model.number="segment.end" type="number" min="0" step="0.1" class="subtitle-input" @input="$emit('change')" /></label>
        <label class="text-xs text-slate-400">说话人<input v-model="segment.speaker" class="subtitle-input" @input="$emit('change')" /></label>
        <label class="text-xs text-slate-400">字幕<input v-model="segment.text" class="subtitle-input" @input="$emit('change')" /></label>
      </div>
    </div>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-300">{{ error }}</p>
  </section>
</template>

<script setup>
defineProps({ segments: { type: Array, required: true }, error: { type: String, default: '' }, saving: Boolean })
defineEmits(['save', 'change'])
</script>

<style scoped>.subtitle-input{margin-top:.3rem;width:100%;border:1px solid #334155;border-radius:.5rem;background:#07101e;padding:.5rem;color:#e2e8f0}</style>
