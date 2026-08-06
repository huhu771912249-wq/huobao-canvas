<template>
  <button
    type="button"
    class="service-pill"
    :class="`service-pill--${tone}`"
    :aria-label="`服务状态：${label}`"
    @click="$emit('click')"
  >
    <span class="service-pill__dot"></span>
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: '服务正常'
  },
  tone: {
    type: String,
    default: 'success'
  }
})

defineEmits(['click'])
</script>

<style scoped>
.service-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.035);
  font-size: 12px;
  transition: border-color 180ms ease, color 180ms ease, background 180ms ease;
}

.service-pill:hover {
  border-color: rgba(101, 230, 189, 0.42);
  color: var(--text-primary);
  background: rgba(101, 230, 189, 0.08);
}

.service-pill__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-color);
  box-shadow: 0 0 12px rgba(101, 230, 189, 0.78);
}

.service-pill--warning .service-pill__dot {
  background: var(--warning-color);
  box-shadow: 0 0 12px rgba(240, 185, 90, 0.64);
}

.service-pill--danger .service-pill__dot {
  background: var(--danger-color);
  box-shadow: 0 0 12px rgba(255, 114, 125, 0.64);
}
</style>
