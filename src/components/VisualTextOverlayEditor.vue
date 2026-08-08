<template>
  <div class="visual-overlay-frame nodrag nowheel">
    <div
      ref="stage"
      class="visual-overlay-stage"
      :style="stageStyle"
    >
    <img
      v-if="isGif && fitMode === 'blur'"
      :src="sourceUrl"
      class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
      aria-hidden="true"
    />
    <video
      v-if="!isGif && fitMode === 'blur'"
      :src="sourceUrl"
      class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
      autoplay
      loop
      muted
      playsinline
      aria-hidden="true"
    />
    <img
      v-if="isGif"
      :src="sourceUrl"
      class="absolute inset-0 h-full w-full"
      :class="mediaFitClass"
      alt="GIF 素材预览"
    />
    <video
      v-else
      :src="sourceUrl"
      class="absolute inset-0 h-full w-full"
      :class="mediaFitClass"
      autoplay
      loop
      muted
      playsinline
    />
    <div
      class="visual-overlay-text"
      :style="textStyle"
      role="button"
      tabindex="0"
      title="拖动文字调整位置"
      @pointerdown.stop.prevent="startDrag"
    >
      <span class="visual-overlay-content" :style="contentStyle">{{ text || '在下方输入文案' }}</span>
    </div>
      <div class="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white/80">
        拖动文字调整位置
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  sourceUrl: { type: String, required: true },
  sourceMime: { type: String, default: 'video/mp4' },
  text: { type: String, default: '' },
  styleConfig: { type: Object, required: true },
  outputWidth: { type: Number, default: 1080 },
  outputHeight: { type: Number, default: 1920 },
  fitMode: { type: String, default: 'blur' }
})
const emit = defineEmits(['update:style-config'])
const stage = ref(null)
const dragging = ref(false)

const isGif = computed(() => props.sourceMime === 'image/gif' || /\.gif(?:$|\?)/i.test(props.sourceUrl))
const mediaFitClass = computed(() => props.fitMode === 'center' ? 'object-cover' : 'object-contain')
const stageStyle = computed(() => ({
  aspectRatio: `${props.outputWidth} / ${props.outputHeight}`,
  width: `min(100%, calc(440px * ${props.outputWidth} / ${props.outputHeight}))`
}))
const textStyle = computed(() => {
  const style = props.styleConfig
  const shadow = style.shadow ? '0 2px 6px rgba(0,0,0,.7)' : 'none'
  return {
    left: `${style.x}%`,
    top: `${style.y}%`,
    width: `${style.boxWidth}%`,
    color: style.color,
    fontSize: `${style.fontSize}cqh`,
    textAlign: style.align,
    textShadow: [
      `${style.strokeWidth}px 0 ${style.strokeColor}`,
      `-${style.strokeWidth}px 0 ${style.strokeColor}`,
      `0 ${style.strokeWidth}px ${style.strokeColor}`,
      `0 -${style.strokeWidth}px ${style.strokeColor}`,
      shadow
    ].join(',')
  }
})
const contentStyle = computed(() => ({
  backgroundColor: props.styleConfig.background
    ? `${props.styleConfig.backgroundColor}${Math.round(Number(props.styleConfig.backgroundOpacity || 0) * 255).toString(16).padStart(2, '0')}`
    : 'transparent'
}))

const move = event => {
  if (!dragging.value || !stage.value) return
  const rect = stage.value.getBoundingClientRect()
  const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
  const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
  emit('update:style-config', { ...props.styleConfig, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
}
const stopDrag = () => {
  dragging.value = false
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', stopDrag)
}
const startDrag = event => {
  dragging.value = true
  move(event)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stopDrag, { once: true })
}
onBeforeUnmount(stopDrag)
</script>

<style scoped>
.visual-overlay-frame{display:flex;width:100%;justify-content:center}.visual-overlay-stage{position:relative;container-type:size;overflow:hidden;border-radius:.75rem;background:#020617;touch-action:none}.visual-overlay-text{position:absolute;transform:translate(-50%,-50%);white-space:pre-wrap;overflow-wrap:anywhere;font-weight:700;line-height:1.18;cursor:grab;user-select:none}.visual-overlay-content{display:inline-block;max-width:100%;padding:.35em .5em}.visual-overlay-text:active{cursor:grabbing}
</style>
