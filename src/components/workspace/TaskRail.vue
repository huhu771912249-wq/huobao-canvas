<template>
  <Transition name="rail">
    <aside v-if="open" class="task-rail workspace-panel" aria-label="任务中心">
      <header class="task-rail__header">
        <div>
          <p class="task-rail__eyebrow">实时进度</p>
          <h2>任务中心</h2>
        </div>
        <button type="button" class="icon-button" aria-label="关闭任务中心" @click="$emit('close')">
          <n-icon :size="20"><CloseOutline /></n-icon>
        </button>
      </header>

      <div v-if="tasks.length" class="task-rail__list">
        <article v-for="task in tasks" :key="task.id" class="task-card">
          <div class="task-card__top">
            <div>
              <strong>{{ taskSummary(task).title }}</strong>
              <p>{{ task.name || task.id }}</p>
            </div>
            <span class="task-tone" :class="`task-tone--${taskSummary(task).tone}`">
              {{ task.progress ?? 0 }}%
            </span>
          </div>
          <div class="task-progress">
            <span :style="{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }"></span>
          </div>
          <p class="task-card__detail">{{ taskSummary(task).detail }}</p>
          <div class="task-card__actions">
            <button
              v-for="action in taskSummary(task).actions"
              :key="action"
              type="button"
              @click="$emit(actionEvent(action), task)"
            >
              {{ actionLabel(action) }}
            </button>
          </div>
        </article>
      </div>

      <div v-else class="task-rail__empty">
        <n-icon :size="36"><SparklesOutline /></n-icon>
        <strong>{{ error ? '任务读取失败' : '当前没有运行任务' }}</strong>
        <p>{{ error || '生成、逆向和裂变任务会集中显示在这里。' }}</p>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { CloseOutline, SparklesOutline } from '@vicons/ionicons5'
import { buildTaskSummary } from '../../utils/workspaceUi'

defineProps({
  open: {
    type: Boolean,
    default: false
  },
  tasks: {
    type: Array,
    default: () => []
  },
  error: {
    type: String,
    default: ''
  }
})

defineEmits(['close', 'retry', 'cancel', 'download', 'details', 'confirm', 'view-results'])

const taskSummary = (task) => buildTaskSummary(task)

const actionEvent = (action) => ({
  retry_failed: 'retry',
  retry: 'retry',
  view_results: 'view-results'
})[action] || action

const actionLabel = (action) => ({
  retry_failed: '重试失败项',
  retry: '重试',
  view_results: '查看结果',
  details: '查看详情',
  download: '下载',
  confirm: '确认生成',
  cancel: '取消'
})[action] || action
</script>

<style scoped>
.task-rail {
  position: fixed;
  z-index: 80;
  top: 72px;
  right: 16px;
  bottom: 16px;
  width: min(390px, calc(100vw - 32px));
  padding: 18px;
  border-radius: 24px;
  overflow: auto;
}

.task-rail__header,
.task-card__top,
.task-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-rail__eyebrow {
  color: var(--accent-color);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.task-rail h2 {
  margin-top: 3px;
  font-size: 18px;
}

.icon-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.task-rail__list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.task-card {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.025);
}

.task-card p {
  color: var(--text-secondary);
  font-size: 12px;
}

.task-tone {
  color: var(--accent-color);
  font-variant-numeric: tabular-nums;
}

.task-tone--warning {
  color: var(--warning-color);
}

.task-tone--danger {
  color: var(--danger-color);
}

.task-progress {
  height: 4px;
  margin: 14px 0 10px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--bg-tertiary);
}

.task-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-color));
}

.task-card__actions {
  justify-content: flex-start;
  margin-top: 12px;
}

.task-card__actions button {
  color: var(--text-primary);
  font-size: 12px;
}

.task-rail__empty {
  min-height: 300px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: var(--text-secondary);
  text-align: center;
}

.task-rail__empty strong {
  color: var(--text-primary);
}

.rail-enter-active,
.rail-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.rail-enter-from,
.rail-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
