<script setup>
import { computed, ref, watch } from 'vue'
import { VIDEO_OUTPUT_PRESETS, normalizeVideoOutputSize } from '../utils/videoOutputSizes.js'

const props = defineProps({
  outputWidth: { type: Number, default: 1920 },
  outputHeight: { type: Number, default: 1080 },
  compact: { type: Boolean, default: false },
  qualityHint: { type: String, default: '全部经过 SeedVR2' }
})
const emit = defineEmits(['update:outputWidth', 'update:outputHeight'])

const customWidth = ref(props.outputWidth)
const customHeight = ref(props.outputHeight)
const validationError = ref('')
const selected = computed(() => `${props.outputWidth}x${props.outputHeight}`)

watch(() => [props.outputWidth, props.outputHeight], ([width, height]) => {
  customWidth.value = width
  customHeight.value = height
})

function choose(item) {
  validationError.value = ''
  emit('update:outputWidth', item.width)
  emit('update:outputHeight', item.height)
}

function applyCustom() {
  try {
    const size = normalizeVideoOutputSize({
      output_width: customWidth.value,
      output_height: customHeight.value
    })
    validationError.value = ''
    emit('update:outputWidth', size.width)
    emit('update:outputHeight', size.height)
  } catch (error) {
    validationError.value = error.message
  }
}
</script>

<template>
  <section class="space-y-2" aria-label="最终视频尺寸">
    <div class="text-xs text-[var(--text-secondary)]">最终视频尺寸 · {{ qualityHint }}</div>
    <div class="grid gap-2" :class="compact ? 'grid-cols-2' : 'sm:grid-cols-2'">
      <button
        v-for="item in VIDEO_OUTPUT_PRESETS"
        :key="item.key"
        type="button"
        class="rounded-lg border px-2 py-2 text-left text-xs transition-colors"
        :class="selected === `${item.width}x${item.height}` ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
        :aria-pressed="selected === `${item.width}x${item.height}`"
        @click="choose(item)"
      >{{ item.label }}</button>
    </div>
    <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
      <input v-model.number="customWidth" type="number" min="256" max="4096" step="2" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs" aria-label="自定义视频宽度" />
      <input v-model.number="customHeight" type="number" min="256" max="4096" step="2" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs" aria-label="自定义视频高度" />
      <button type="button" class="rounded-lg border border-cyan-400/40 px-2 text-xs text-cyan-300" @click="applyCustom">应用</button>
    </div>
    <div v-if="validationError" role="alert" class="text-[10px] text-red-400">{{ validationError }}</div>
  </section>
</template>
