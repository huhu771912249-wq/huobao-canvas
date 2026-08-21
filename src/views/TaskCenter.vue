<template>
  <WorkspaceShell
    active-section="tasks"
    project-title="任务中心"
    :service-status="serviceStatus"
    @navigate="handleWorkspaceNavigate"
    @open-status="refreshServiceHealth"
    @open-tasks="loadTasks"
  >
    <template #main>
      <section class="task-center-page">
        <header class="task-center-hero">
          <div>
            <div class="task-center-eyebrow">TASK CENTER</div>
            <h1>任务中心</h1>
            <p>集中查看视频、素材裂变、小说成片、DSP 和尺寸处理任务。</p>
          </div>
          <button type="button" class="refresh-button" :disabled="loading" @click="loadTasks">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
        </header>

        <TaskRail
          open
          variant="page"
          :tasks="tasks"
          :error="taskLoadError"
          @details="openTask"
          @view-results="openTask"
          @download="downloadTask"
        />
      </section>
    </template>
  </WorkspaceShell>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WorkspaceShell from '../components/workspace/WorkspaceShell.vue'
import TaskRail from '../components/workspace/TaskRail.vue'
import { listTaskCenterTasks } from '../api/taskCenter.js'
import { resolveTaskDetailsTarget, withTaskCenterActions } from '../utils/taskCenter.js'
import { useServiceStatus } from '../stores/serviceHealth.js'

const router = useRouter()
// Real `GET /health` probe shared with every other view; never a hardcoded "已连接".
const { serviceStatus, refreshServiceHealth } = useServiceStatus()
const tasks = ref([])
const loading = ref(false)
const taskLoadError = ref('')
const taskSourceLabels = {
  material: '普通素材',
  novel: '小说成片',
  dsp: 'DSP 素材',
  resize: '尺寸/文字处理'
}

const loadTasks = async () => {
  if (loading.value) return
  void refreshServiceHealth()
  loading.value = true
  taskLoadError.value = ''
  try {
    const result = await listTaskCenterTasks({ limit: 100 })
    tasks.value = result.tasks.map(withTaskCenterActions)
    if (result.sourceErrors.length) {
      const names = result.sourceErrors.map(source => taskSourceLabels[source] || source)
      taskLoadError.value = `部分分类暂时未读取：${names.join('、')}`
    }
  } catch (error) {
    taskLoadError.value = error?.message || '暂时无法读取后端任务，请稍后重试。'
  } finally {
    loading.value = false
  }
}

const openTask = task => {
  const target = resolveTaskDetailsTarget(task)
  if (target) router.push(target)
}

const downloadTask = task => {
  if (task?.download_url) window.open(task.download_url, '_blank', 'noopener')
}

const handleWorkspaceNavigate = item => {
  if (item.id === 'tasks') {
    loadTasks()
    return
  }
  router.push(item.to)
}

onMounted(loadTasks)
</script>

<style scoped>
.task-center-page {
  min-height: calc(100vh - 68px);
  padding: 32px clamp(18px, 4vw, 56px) 64px;
}

.task-center-hero {
  max-width: 1500px;
  margin: 0 auto 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.task-center-eyebrow {
  color: var(--accent-color);
  font-size: 12px;
  letter-spacing: 0.28em;
}

.task-center-hero h1 {
  margin: 8px 0 6px;
  font-size: clamp(28px, 4vw, 46px);
  line-height: 1.1;
}

.task-center-hero p {
  max-width: 760px;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.refresh-button {
  padding: 9px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.035);
}

.refresh-button:hover {
  border-color: rgba(72, 226, 208, 0.65);
  background: rgba(72, 226, 208, 0.09);
}

.refresh-button:disabled {
  opacity: 0.5;
}

@media (max-width: 640px) {
  .task-center-page {
    padding-top: 22px;
  }

  .task-center-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .refresh-button {
    align-self: stretch;
  }
}
</style>
