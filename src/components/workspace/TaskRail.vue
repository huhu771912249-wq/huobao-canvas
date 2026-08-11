<template>
  <Transition name="rail">
    <aside
      v-if="open"
      class="task-rail workspace-panel"
      :class="{ 'task-rail--page': variant === 'page' }"
      aria-label="任务中心"
    >
      <header class="task-rail__header">
        <div>
          <p class="task-rail__eyebrow">实时进度</p>
          <h2>任务中心</h2>
        </div>
        <button v-if="variant === 'drawer'" type="button" class="icon-button" aria-label="关闭任务中心" @click="$emit('close')">
          <n-icon :size="20"><CloseOutline /></n-icon>
        </button>
      </header>

      <div v-if="tasks.length" class="task-categories" aria-label="任务分类">
        <button
          v-for="category in categoryTabs"
          :key="category.id"
          type="button"
          :class="{ active: activeCategory === category.id }"
          @click="activeCategory = category.id"
        >
          {{ category.label }} <span>{{ category.count }}</span>
        </button>
      </div>

      <p v-if="error && tasks.length" class="task-rail__warning">{{ error }}</p>

      <div v-if="filteredTasks.length" class="task-rail__list">
        <article v-for="task in filteredTasks" :key="task.id" class="task-card">
          <div class="task-card__top">
            <div>
              <span class="task-card__category">{{ task.category_label || '素材任务' }}</span>
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
        <strong>{{ emptyTitle }}</strong>
        <p>{{ emptyMessage }}</p>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutline, SparklesOutline } from '@vicons/ionicons5'
import { buildTaskSummary } from '../../utils/workspaceUi'
import { buildTaskCategoryTabs, filterTaskCenterTasks } from '../../utils/taskCenter'

const props = defineProps({
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
  },
  variant: {
    type: String,
    default: 'drawer',
    validator: value => ['drawer', 'page'].includes(value)
  }
})

defineEmits(['close', 'retry', 'cancel', 'download', 'details', 'confirm', 'view-results'])

const activeCategory = ref('all')
const categoryTabs = computed(() => buildTaskCategoryTabs(props.tasks))
const filteredTasks = computed(() => filterTaskCenterTasks(props.tasks, activeCategory.value))
const emptyTitle = computed(() => {
  if (props.tasks.length) return '该分类暂无任务'
  return props.error ? '任务读取失败' : '暂无任务记录'
})
const emptyMessage = computed(() => {
  if (props.tasks.length) return '选择其他分类查看已有任务。'
  return props.error || '视频、素材裂变、小说成片、DSP 和尺寸处理任务会集中显示在这里。'
})

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

.task-rail--page {
  position: relative;
  z-index: 1;
  inset: auto;
  width: 100%;
  max-width: 1500px;
  min-height: 420px;
  margin: 0 auto;
  overflow: visible;
}

.task-rail--page .task-rail__list {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
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

.task-categories {
  display: flex;
  gap: 7px;
  margin-top: 16px;
  padding-bottom: 4px;
  overflow-x: auto;
}

.task-categories button {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 11px;
}

.task-categories button.active {
  border-color: var(--accent-color);
  color: var(--text-primary);
  background: rgba(101, 230, 189, 0.1);
}

.task-categories span {
  margin-left: 3px;
  color: var(--accent-color);
}

.task-rail__warning {
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 10px;
  color: var(--warning-color);
  background: rgba(245, 158, 11, 0.08);
  font-size: 11px;
}

.task-card {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.025);
}

.task-card__category {
  display: block;
  margin-bottom: 4px;
  color: var(--accent-color);
  font-size: 10px;
  letter-spacing: 0.08em;
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
