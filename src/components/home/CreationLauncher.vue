<template>
  <section class="creation-launcher workspace-reveal" :aria-busy="busy">
    <div class="creation-launcher__copy">
      <span class="creation-launcher__eyebrow">AI CREATIVE STUDIO</span>
      <h1>从灵感到投放素材，<br />在一个画布里完成</h1>
      <p>输入创意，或直接选择工作流。生成、逆向、裂变和下载都在同一个任务链路里。</p>
    </div>

    <form class="prompt-composer workspace-panel" @submit.prevent="$emit('submit', prompt)">
      <textarea
        v-model="prompt"
        placeholder="描述你想生成的广告画面、人物、场景和动作…"
        aria-label="创作提示词"
        @keydown.ctrl.enter.prevent="$emit('submit', prompt)"
      ></textarea>
      <div class="prompt-composer__footer">
        <span>Ctrl + Enter 快速创建</span>
        <button type="submit" :disabled="busy">
          {{ busy ? '正在打开…' : '开始创作' }}
          <n-icon :size="18"><ArrowForwardOutline /></n-icon>
        </button>
      </div>
    </form>

    <div class="creation-grid">
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        :disabled="busy"
        class="creation-card workspace-panel"
        :class="`creation-card--${entry.accent}`"
        @click="$emit('launch', entry.id)"
      >
        <span class="creation-card__icon">
          <n-icon :size="22"><component :is="entry.icon" /></n-icon>
        </span>
        <span class="creation-card__copy">
          <strong>{{ entry.title }}</strong>
          <small>{{ entry.description }}</small>
        </span>
        <n-icon :size="20" class="creation-card__arrow"><ArrowForwardOutline /></n-icon>
      </button>
    </div>

    <div class="suggestion-row">
      <span>试试这些</span>
      <button v-for="suggestion in suggestions" :key="suggestion" type="button" @click="prompt = suggestion">
        {{ suggestion }}
      </button>
      <button type="button" aria-label="换一批推荐" @click="$emit('refresh-suggestions')">
        <n-icon :size="16"><RefreshOutline /></n-icon>
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { NIcon } from 'naive-ui'
import {
  ArrowForwardOutline,
  GridOutline,
  ImagesOutline,
  RefreshOutline,
  SparklesOutline,
  VideocamOutline
} from '@vicons/ionicons5'

defineProps({
  suggestions: {
    type: Array,
    default: () => []
  },
  busy: {
    type: Boolean,
    default: false
  }
})

defineEmits(['launch', 'submit', 'refresh-suggestions'])

const prompt = ref('')
const entries = [
  { id: 'image', title: 'AI 作图', description: '中文提示词生成投放底图', accent: 'blue', icon: ImagesOutline },
  { id: 'video', title: '视频生成', description: '文生视频与图生视频', accent: 'violet', icon: VideocamOutline },
  { id: 'batch', title: '批量广告尺寸', description: '在画布中输出 GIF / MP4 多尺寸', accent: 'blue', icon: GridOutline },
  { id: 'background', title: '背景替换', description: '在画布中保留主体并替换环境', accent: 'violet', icon: ImagesOutline },
  { id: 'variation', title: '素材裂变', description: '逆向提示词与多尺寸 A-E 测试', accent: 'orange', icon: SparklesOutline },
  { id: 'dsp', title: '54DSP 优秀素材', description: '抓取高点击素材并进入裂变', accent: 'green', icon: GridOutline }
]
</script>

<style scoped>
.creation-launcher {
  max-width: 1180px;
  margin: 0 auto;
  padding: 64px 28px 32px;
}

.creation-launcher__copy {
  max-width: 720px;
}

.creation-launcher__eyebrow {
  color: var(--accent-color);
  font-size: 11px;
  letter-spacing: 0.18em;
}

.creation-launcher h1 {
  margin-top: 14px;
  font-size: clamp(36px, 5vw, 64px);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.creation-launcher__copy p {
  max-width: 620px;
  margin-top: 18px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.8;
}

.creation-launcher button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.prompt-composer {
  margin-top: 34px;
  padding: 16px;
  border-radius: 24px;
}

.prompt-composer:focus-within {
  border-color: rgba(101, 230, 189, 0.45);
  box-shadow: 0 0 0 1px rgba(101, 230, 189, 0.12), 0 28px 70px rgba(0, 0, 0, 0.24);
}

.prompt-composer textarea {
  width: 100%;
  min-height: 94px;
  padding: 4px 6px;
  resize: none;
  outline: none;
  color: var(--text-primary);
  background: transparent;
  font-size: 16px;
  line-height: 1.65;
}

.prompt-composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 12px;
}

.prompt-composer__footer button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 14px;
  color: #07110d;
  background: linear-gradient(135deg, var(--accent-color), #7dd3fc);
  font-weight: 700;
}

.creation-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.creation-card {
  min-height: 112px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  text-align: left;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.creation-card:hover {
  transform: translateY(-3px);
  border-color: rgba(101, 230, 189, 0.35);
  background: rgba(27, 38, 56, 0.92);
}

.creation-card__icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #dff9ff;
  background: rgba(110, 168, 255, 0.16);
}

.creation-card--green .creation-card__icon {
  color: #caffed;
  background: rgba(101, 230, 189, 0.16);
}

.creation-card--orange .creation-card__icon {
  color: #ffe4bd;
  background: rgba(240, 185, 90, 0.15);
}

.creation-card--violet .creation-card__icon {
  color: #eadcff;
  background: rgba(171, 123, 255, 0.15);
}

.creation-card__copy {
  display: grid;
  gap: 5px;
}

.creation-card__copy small {
  color: var(--text-secondary);
  line-height: 1.45;
}

.creation-card__arrow {
  color: var(--text-secondary);
}

.suggestion-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  overflow-x: auto;
  color: var(--text-secondary);
  font-size: 12px;
  scrollbar-width: none;
}

.suggestion-row button {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.025);
}

.suggestion-row button:hover {
  color: var(--text-primary);
  border-color: rgba(101, 230, 189, 0.3);
}

@media (max-width: 980px) {
  .creation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .creation-launcher {
    padding: 42px 16px 24px;
  }

  .creation-launcher h1 {
    font-size: 38px;
  }

  .creation-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .prompt-composer__footer span {
    display: none;
  }

  .prompt-composer__footer {
    justify-content: flex-end;
  }
}
</style>
