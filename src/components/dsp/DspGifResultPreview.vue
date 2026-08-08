<template>
  <aside class="rounded-2xl border border-cyan-400/30 bg-[var(--bg-secondary)] p-4 shadow-2xl">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-[var(--text-primary)]">GIF 结果预览</h3>
        <p class="mt-1 text-[11px] text-[var(--text-secondary)]">
          {{
            activeItem
              ? `方案 ${activeItem.variant} · ${activeItem.experimentLabel || '未标实验轴'} · ${activeItem.size}`
              : '等待生成结果'
          }}
        </p>
      </div>
      <span class="rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-300">
        {{ expectedCount > 0 ? `${items.length}/${expectedCount}` : `${items.length} 个` }}
      </span>
    </div>

    <div
      class="mt-3 flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-color)] bg-black/30"
    >
      <img
        v-if="activeItem"
        :key="activeItem.key"
        :src="activeItem.gifUrl"
        :alt="`方案 ${activeItem.variant} ${activeItem.size}`"
        class="max-h-[420px] w-full object-contain"
      />
      <div v-else class="px-6 text-center text-xs leading-6 text-[var(--text-secondary)]">
        结果生成后会自动在这里播放
      </div>
    </div>

    <div v-if="activeItem" class="mt-3 rounded-xl bg-black/10 p-3 text-xs">
      <div class="font-medium text-[var(--text-primary)]">{{ activeItem.headline || '未命名方案' }}</div>
      <div class="mt-1 text-[var(--text-secondary)]">{{ activeItem.body || '无正文' }}</div>
      <div class="mt-2 flex flex-wrap gap-2 text-[11px]">
        <span class="rounded-full bg-cyan-400/10 px-2 py-1 text-cyan-300">
          方案 {{ activeItem.variant }} · {{ activeItem.experimentLabel || '未标实验轴' }}
        </span>
        <span
          v-if="activeItem.experimentAxis"
          class="rounded-full bg-white/5 px-2 py-1 font-mono text-[var(--text-secondary)]"
        >
          {{ activeItem.experimentAxis }}
        </span>
        <span class="rounded-full bg-white/5 px-2 py-1 text-[var(--text-secondary)]">{{ activeItem.size }}</span>
        <span class="rounded-full bg-white/5 px-2 py-1 text-[var(--text-secondary)]">{{ activeItem.category || '未分类' }}</span>
      </div>
      <div
        v-if="activeItem.visualAuditPassed === false"
        class="mt-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-red-300"
      >
        视觉重复未通过：与 A 原版画面过于相似，已从可投放 ZIP 排除。
      </div>
      <div
        v-if="activeItem.sourceMetrics"
        class="mt-3 grid grid-cols-5 gap-2 rounded-lg border border-[var(--border-color)] p-2 text-center text-[10px]"
      >
        <div><span class="block text-[var(--text-secondary)]">原曝光</span>{{ formatInteger(activeItem.sourceMetrics.impressions) }}</div>
        <div><span class="block text-[var(--text-secondary)]">原点击</span>{{ formatInteger(activeItem.sourceMetrics.clicks) }}</div>
        <div><span class="block text-[var(--text-secondary)]">原 CTR</span>{{ formatPercent(activeItem.sourceMetrics.ctr) }}</div>
        <div><span class="block text-[var(--text-secondary)]">Wilson</span>{{ formatScore(activeItem.sourceMetrics.wilsonCtr) }}</div>
        <div><span class="block text-[var(--text-secondary)]">原花费</span>{{ formatMoney(activeItem.sourceMetrics.spend) }}</div>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <button class="ghost-button" :disabled="items.length < 2" @click="$emit('previous')">上一张</button>
      <button class="ghost-button" :disabled="items.length < 2" @click="$emit('next')">下一张</button>
    </div>

    <div class="mt-2 grid gap-2">
      <a
        v-if="activeItem && activeItem.visualAuditPassed !== false"
        :href="activeItem.gifUrl"
        download
        class="secondary-button text-center"
      >
        下载当前 GIF
      </a>
      <a v-if="zipUrl" :href="zipUrl" download class="ghost-button text-center">下载全部 ZIP</a>
      <button
        class="ghost-button"
        :disabled="openingFolder"
        @click="$emit('open-folder')"
      >
        {{ openingFolder ? '正在打开…' : '打开下载文件夹' }}
      </button>
    </div>

    <div v-if="items.length" class="mt-3 flex max-h-32 flex-wrap gap-1 overflow-auto">
      <button
        v-for="item in items"
        :key="item.key"
        class="rounded-lg border px-2 py-1 text-[10px]"
        :class="item.key === activeKey
          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
          : item.visualAuditPassed === false
            ? 'border-red-400/40 bg-red-400/5 text-red-300'
            : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
        @click="$emit('select', item.key)"
      >
        {{ item.variant }} {{ item.experimentLabel || '' }} · {{ item.size }}
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  activeKey: { type: String, default: '' },
  expectedCount: { type: Number, default: 0 },
  zipUrl: { type: String, default: '' },
  openingFolder: { type: Boolean, default: false }
})

defineEmits(['select', 'previous', 'next', 'open-folder'])

const activeItem = computed(() => (
  props.items.find((item) => item.key === props.activeKey)
  || props.items[0]
  || null
))

const formatInteger = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
const formatPercent = (value) => `${(Number(value) || 0).toFixed(2)}%`
const formatScore = (value) => (Number(value) || 0).toFixed(4)
const formatMoney = (value) => (Number(value) || 0).toFixed(2)
</script>
