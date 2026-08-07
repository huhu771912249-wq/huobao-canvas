<template>
  <section class="mt-3 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold text-[var(--text-primary)]">H3 获胜视频</div>
        <div class="mt-1 text-[11px] text-[var(--text-secondary)]">
          胜出 {{ winner?.variant || '-' }} · {{ formatInteger(winner?.impressions) }} 曝光 · CTR {{ formatPercent(winner?.ctr) }}
        </div>
      </div>
      <span class="rounded-full border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-200">
        5 秒 · 1080p
      </span>
    </div>

    <template v-if="upgrade">
      <div class="mt-3 flex items-center justify-between text-[11px]">
        <span>{{ viewState.label }}</span>
        <span>{{ viewState.progress }}%</span>
      </div>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-black/20">
        <div class="h-full bg-cyan-400 transition-all" :style="{ width: `${viewState.progress}%` }" />
      </div>
      <div v-if="upgrade.error" class="mt-2 text-[11px] text-red-300">{{ upgrade.error }}</div>
      <video
        v-if="upgrade.status === 'completed' && upgrade.url"
        :src="upgrade.url"
        class="mt-3 w-full rounded-lg bg-black"
        controls
        playsinline
      />
      <div class="mt-3 flex flex-wrap gap-2">
        <a
          v-if="upgrade.status === 'completed' && upgrade.url"
          :href="upgrade.url"
          download
          class="secondary-button"
        >下载 MP4</a>
        <button
          v-if="['failed', 'cancelled'].includes(upgrade.status)"
          class="secondary-button"
          :disabled="busy"
          @click="$emit('retry')"
        >重试</button>
        <button
          v-if="!viewState.terminal"
          class="ghost-button"
          :disabled="busy"
          @click="$emit('cancel')"
        >取消</button>
      </div>
    </template>
    <button
      v-else
      class="secondary-button mt-3 w-full"
      :disabled="busy || !winner"
      @click="showConfirm = true"
    >用 H3 生成获胜视频</button>

    <n-modal v-model:show="showConfirm">
      <n-card title="确认生成 H3 获胜视频" class="max-w-[520px]" :bordered="false">
        <div class="space-y-3 text-sm text-[var(--text-secondary)]">
          <p>将使用服务端确认的 {{ winner?.variant }} 方案作为参考首帧。</p>
          <p>输出固定为 5 秒、1920×1080；H3 原片经 SeedVR2 超分，再在本地叠加获胜文案。</p>
          <p class="rounded-lg border border-amber-300/30 bg-amber-300/5 p-3 text-amber-200">
            确认后才会消耗 H3 / SeedVR2 资源。
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button class="ghost-button" @click="showConfirm = false">返回</button>
            <button class="secondary-button" :disabled="busy" @click="confirmCreate">确认生成</button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NCard, NModal } from 'naive-ui'
import { getDspH3ViewState } from '../../utils/dspCreativeLibrary.js'

const props = defineProps({
  winner: { type: Object, default: null },
  upgrade: { type: Object, default: null },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['create', 'retry', 'cancel'])
const showConfirm = ref(false)
const viewState = computed(() => getDspH3ViewState(props.upgrade || {}))
const formatInteger = value => new Intl.NumberFormat('zh-CN').format(Number(value || 0))
const formatPercent = value => `${Number(value || 0).toFixed(2)}%`

const confirmCreate = () => {
  showConfirm.value = false
  emit('create')
}
</script>
