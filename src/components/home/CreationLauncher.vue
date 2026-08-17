<template>
  <section class="creation-launcher workspace-reveal" :aria-busy="busy">
    <div class="creation-launcher__copy">
      <span class="creation-launcher__eyebrow">AI CREATIVE STUDIO</span>
      <h1>从灵感到投放素材，<br />在一个画布里完成</h1>
      <p>输入创意，或直接选择工作流。生成、逆向、裂变和下载都在同一个任务链路里。</p>
    </div>

    <form
      class="prompt-composer workspace-panel"
      :class="{ 'prompt-composer--dragging': dragActive }"
      @submit.prevent="requestIntentReview"
      @dragenter.prevent="dragActive = true"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="handleAttachmentDrop"
    >
      <textarea
        v-model="prompt"
        placeholder="说说你想处理什么，也可以拖入一个图片、视频或 GIF…"
        aria-label="创作提示词"
        @input="notifyDraftChange"
        @keydown.ctrl.enter.prevent="requestIntentReview"
      ></textarea>
      <div class="prompt-composer__attachment-row">
        <button type="button" class="attachment-picker" @click="attachmentInput?.click()">＋ 选择图片 / 视频 / GIF</button>
        <input
          ref="attachmentInput"
          class="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          @change="handleAttachmentInput"
        />
        <span class="attachment-help">支持单个素材；图片最大 20MB，视频 / GIF 最大 90MB</span>
      </div>
      <div v-if="attachmentSelection" class="attachment-chip">
        <span><b>{{ attachmentSelection.attachment.name }}</b> · {{ attachmentSelection.attachment.kindLabel }} · {{ attachmentSelection.attachment.sizeLabel }}</span>
        <button type="button" aria-label="移除附件" @click="removeAttachment">移除</button>
      </div>
      <p v-if="attachmentError" class="attachment-error" role="alert">{{ attachmentError }}</p>
      <div class="prompt-composer__footer">
        <span>Ctrl + Enter 识别需求；确认前不会创建项目</span>
        <button type="submit">
          {{ busy ? '识别最新需求' : '识别需求' }}
          <n-icon :size="18"><ArrowForwardOutline /></n-icon>
        </button>
      </div>
    </form>

    <section v-if="intentPreview" class="intent-confirmation workspace-panel" aria-live="polite">
      <div class="intent-confirmation__heading">
        <div><span>需求确认</span><h2>{{ intentPreview.intent.label }}</h2></div>
        <button type="button" @click="$emit('cancel-intent')">取消</button>
      </div>
      <div class="intent-summary-grid">
        <div><small>素材摘要</small><b>{{ intentPreview.attachment ? `${intentPreview.attachment.name} · ${intentPreview.attachment.kindLabel} · ${intentPreview.attachment.sizeLabel}` : '未添加附件' }}</b></div>
        <div><small>识别意图</small><b>{{ intentPreview.intent.label }}</b><span>{{ intentPreview.intent.reason }}</span></div>
        <div><small>推荐去向</small><b>{{ intentPreview.destinations[intentPreview.recommendation].title }}</b><span>{{ intentPreview.destinations[intentPreview.recommendation].label }}</span></div>
      </div>
      <div class="intent-destinations">
        <button
          v-for="key in ['quick', 'workflow']"
          :key="key"
          type="button"
          class="intent-destination"
          :class="{ 'intent-destination--selected': intentPreview.selectedDestination === key }"
          :disabled="intentPreview.destinations[key].disabled"
          @click="$emit('select-intent-destination', key)"
        >
          <span>{{ intentPreview.destinations[key].title }}<em v-if="intentPreview.recommendation === key">推荐</em></span>
          <b>{{ intentPreview.destinations[key].label }}</b>
          <small>{{ intentPreview.destinations[key].explanation }}</small>
        </button>
      </div>
      <div class="intent-steps"><small>将执行步骤</small><ol><li v-for="step in intentPreview.steps" :key="step">{{ step }}</li></ol></div>
      <button type="button" class="intent-confirmation__confirm" :aria-busy="busy" @click="$emit('confirm-intent')">
        {{ busy ? '正在准备最新去向…' : '确认并继续' }}
      </button>
    </section>

    <div class="creation-grid">
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        :aria-busy="busy && pendingEntry === entry.id"
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
      <button v-for="suggestion in suggestions" :key="suggestion" type="button" @click="useSuggestion(suggestion)">
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
import { createHomeIntentAttachmentState } from '../../utils/homeIntent.js'

defineProps({
  suggestions: {
    type: Array,
    default: () => []
  },
  busy: {
    type: Boolean,
    default: false
  },
  pendingEntry: {
    type: String,
    default: ''
  },
  intentPreview: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'launch',
  'review-intent',
  'select-intent-destination',
  'confirm-intent',
  'cancel-intent',
  'draft-change',
  'refresh-suggestions'
])

const prompt = ref('')
const attachmentInput = ref(null)
const attachmentSelection = ref(null)
const attachmentError = ref('')
const dragActive = ref(false)
const attachmentState = createHomeIntentAttachmentState({
  onChange: ({ attachment, error }) => {
    attachmentSelection.value = attachment
    attachmentError.value = error
  }
})
const notifyDraftChange = () => emit('draft-change')
const applyAttachment = file => {
  const result = attachmentState.select(file)
  notifyDraftChange()
  return result
}
const handleAttachmentInput = event => {
  applyAttachment(event.target.files?.[0] || null)
  event.target.value = ''
}
const handleAttachmentDrop = event => {
  dragActive.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length !== 1) {
    attachmentState.clear()
    attachmentError.value = '一次只能添加一个素材'
    notifyDraftChange()
    return
  }
  applyAttachment(files[0])
}
const removeAttachment = () => {
  attachmentState.clear()
  if (attachmentInput.value) attachmentInput.value.value = ''
  notifyDraftChange()
}
const requestIntentReview = () => {
  if (!prompt.value.trim() && !attachmentSelection.value) {
    attachmentError.value = '请先输入需求或添加一个素材'
    return
  }
  emit('review-intent', {
    prompt: prompt.value,
    attachment: attachmentSelection.value?.file || null
  })
}
const useSuggestion = suggestion => {
  prompt.value = suggestion
  notifyDraftChange()
}
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

.prompt-composer--dragging {
  border-color: rgba(101, 230, 189, 0.75);
  background: rgba(101, 230, 189, 0.08);
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

.prompt-composer__attachment-row,
.attachment-chip,
.intent-confirmation__heading,
.intent-destination > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.prompt-composer__attachment-row {
  margin: 4px 0 12px;
}

.attachment-picker {
  padding: 8px 11px;
  border: 1px dashed rgba(101, 230, 189, 0.4);
  border-radius: 10px;
  color: #a7f3d0;
  font-size: 12px;
}

.attachment-help,
.intent-summary-grid span,
.intent-destination small {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.attachment-chip {
  margin-bottom: 10px;
  padding: 9px 11px;
  border-radius: 12px;
  background: rgba(101, 230, 189, 0.08);
  color: var(--text-secondary);
  font-size: 12px;
}

.attachment-chip b {
  color: var(--text-primary);
}

.attachment-chip button,
.intent-confirmation__heading > button {
  color: #fda4af;
  font-size: 12px;
}

.attachment-error {
  margin: -2px 0 10px;
  color: #fda4af;
  font-size: 12px;
}

.intent-confirmation {
  margin-top: 16px;
  padding: 20px;
  border-radius: 22px;
}

.intent-confirmation__heading span,
.intent-summary-grid small,
.intent-steps > small {
  color: var(--accent-color);
  font-size: 10px;
  letter-spacing: 0.12em;
}

.intent-confirmation__heading h2 {
  margin-top: 3px;
  font-size: 20px;
}

.intent-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.intent-summary-grid > div,
.intent-steps {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
}

.intent-summary-grid b {
  font-size: 13px;
}

.intent-destinations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.intent-destination {
  display: grid;
  gap: 7px;
  padding: 13px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  text-align: left;
}

.intent-destination--selected {
  border-color: rgba(101, 230, 189, 0.72);
  background: rgba(101, 230, 189, 0.08);
}

.intent-destination:disabled {
  cursor: not-allowed;
}

.intent-destination em {
  padding: 2px 6px;
  border-radius: 999px;
  color: #07110d;
  background: var(--accent-color);
  font-size: 9px;
  font-style: normal;
}

.intent-steps {
  margin-top: 12px;
}

.intent-steps ol {
  display: grid;
  gap: 4px;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 12px;
  list-style: decimal;
}

.intent-confirmation__confirm {
  width: 100%;
  min-height: 42px;
  margin-top: 12px;
  border-radius: 13px;
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

  .intent-summary-grid,
  .intent-destinations {
    grid-template-columns: minmax(0, 1fr);
  }

  .prompt-composer__attachment-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .prompt-composer__footer span {
    display: none;
  }

  .prompt-composer__footer {
    justify-content: flex-end;
  }
}
</style>
