<template>
  <WorkspaceShell
    active-section="home"
    project-title="创作首页"
    :service-status="serviceStatus"
    @navigate="handleWorkspaceNavigate"
    @open-settings="showApiSettings = true"
    @open-status="showApiSettings = true"
    @open-tasks="openTaskCenter"
  >
    <template #main>
      <section class="mb-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-5">
        <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="text-xs tracking-[0.25em] text-cyan-400">冠希 VIDEO</div><h2 class="mt-1 text-2xl font-semibold">视频创作中心</h2><p class="mt-2 text-sm text-[var(--text-secondary)]">文生图、文生图＋视频、小说成片和素材再创作。</p></div><n-button type="primary" :aria-busy="navigationPending && navigationIntent === 'video-center'" @click="openVideoCenter">{{ navigationPending && navigationIntent === 'video-center' ? '正在打开…' : '进入视频中心' }}</n-button></div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><button v-for="entry in studioEntries" :key="entry.key" :aria-busy="navigationPending && navigationIntent === `studio:${entry.key}`" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-left hover:border-cyan-400" @click="openStudioEntry(entry)"><b>{{ entry.title }}</b><div class="mt-1 text-xs text-[var(--text-secondary)]">{{ entry.description }}</div></button></div>
      </section>
      <CreationLauncher
        :busy="navigationPending"
        :pending-entry="launcherPendingEntry"
        :suggestions="suggestions"
        @launch="handleLaunch"
        @submit="handlePromptSubmit"
        @refresh-suggestions="refreshSuggestions"
      />
      <section v-if="projectsLoading" id="projects" class="mx-auto max-w-[1180px] px-7 py-12" role="status" aria-live="polite">
        <div class="workspace-panel grid min-h-[240px] place-content-center rounded-[22px] text-center text-[var(--text-secondary)]">正在读取最近项目…</div>
      </section>
      <RecentProjects
        v-else
        :busy="navigationPending"
        :projects="projects"
        :format-date="formatDate"
        @create="createNewProject"
        @open="openProject"
        @action="handleProjectAction"
      />
    </template>

    <template #inspector>
      <TaskRail
        :open="taskRailOpen"
        :tasks="recentTasks"
        :error="taskLoadError"
        @close="taskRailOpen = false"
        @details="openTask"
        @view-results="openTask"
        @download="downloadTask"
      />
    </template>
  </WorkspaceShell>

  <ApiSettings v-model:show="showApiSettings" @saved="refreshApiConfig" />

  <n-modal v-model:show="showRenameModal" preset="dialog" title="重命名项目">
    <n-input v-model:value="renameValue" placeholder="请输入项目名称" />
    <template #action>
      <n-button @click="showRenameModal = false">取消</n-button>
      <n-button type="primary" @click="confirmRename">确定</n-button>
    </template>
  </n-modal>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NModal, useDialog } from 'naive-ui'
import {
  projects,
  initProjectsStore,
  createProject,
  deleteProject,
  duplicateProject,
  renameProject
} from '../stores/projects'
import { useModelStore } from '../stores/pinia'
import { buildCanvasLaunch, WORKSPACE_LAUNCH_LABELS } from '../config/workspaceLaunch'
import { nextSuggestionSetIndex } from '../utils/suggestions'
import { createGuardedUrlLaunchAction, createLatestNavigationRunner } from '../utils/navigationState'
import ApiSettings from '../components/ApiSettings.vue'
import CreationLauncher from '../components/home/CreationLauncher.vue'
import RecentProjects from '../components/home/RecentProjects.vue'
import TaskRail from '../components/workspace/TaskRail.vue'
import WorkspaceShell from '../components/workspace/WorkspaceShell.vue'
import { STUDIO_ENTRIES } from '../config/studioEntries'
import { listTaskCenterTasks } from '../api/taskCenter'
import { resolveTaskDetailsTarget, withTaskCenterActions } from '../utils/taskCenter'

const router = useRouter()
const route = useRoute()
const dialog = useDialog()
const modelStore = useModelStore()
const studioEntries = STUDIO_ENTRIES
const navigationPending = ref(false)
const navigationIntent = ref('')
const projectsLoading = ref(true)
const latestNavigationRunner = createLatestNavigationRunner({
  setPending: (pending, intent) => {
    navigationPending.value = pending
    navigationIntent.value = pending ? intent : ''
  }
})
const runNavigation = latestNavigationRunner
const launcherPendingEntry = computed(() => navigationIntent.value.startsWith('launch:')
  ? navigationIntent.value.slice('launch:'.length)
  : '')
const openVideoCenter = () => runNavigation('video-center', ({ commit }) => commit(() => router.push('/video-studio')))
const openStudioEntry = entry => runNavigation(`studio:${entry.key}`, ({ commit }) => commit(() => {
  if (entry.route) return router.push(entry.route)
  if (entry.flow === 'video') return createVideoProject(videoEntries.video)
  if (entry.flow) return createFlowProject(entry.flow)
  return false
}))

const showApiSettings = ref(false)
const taskRailOpen = ref(false)
const recentTasks = ref([])
const taskLoadError = ref('')
const showRenameModal = ref(false)
const renameValue = ref('')
const renameTargetId = ref(null)
const isApiConfigured = computed(() => modelStore.isCurrentProviderConfigured)
const serviceStatus = computed(() => ({
  label: isApiConfigured.value ? '服务已连接' : '需要配置',
  tone: isApiConfigured.value ? 'success' : 'warning'
}))

const refreshApiConfig = () => {}
const taskSourceLabels = {
  material: '普通素材',
  novel: '小说成片',
  dsp: 'DSP 素材',
  resize: '尺寸/文字处理'
}
const loadTaskCenter = async () => {
  taskLoadError.value = ''
  try {
    const result = await listTaskCenterTasks({ limit: 100 })
    recentTasks.value = result.tasks.map(withTaskCenterActions)
    if (result.sourceErrors.length) {
      const names = result.sourceErrors.map(source => taskSourceLabels[source] || source)
      taskLoadError.value = `部分分类暂时未读取：${names.join('、')}`
    }
  } catch (error) {
    taskLoadError.value = error?.message || '暂时无法读取后端任务，请稍后重试。'
  }
}
const openTaskCenter = () => {
  taskRailOpen.value = true
  loadTaskCenter()
}
const openTask = task => {
  const target = resolveTaskDetailsTarget(task)
  if (!target) return
  taskRailOpen.value = false
  router.push(target)
}
const downloadTask = task => {
  if (task?.download_url) window.open(task.download_url, '_blank', 'noopener')
}

const suggestionSets = [
  ['文生视频：赛博城市镜头推进', '图生视频：上传商品图后轻微运镜', '素材广告：高点击率开场', '人物口播：镜头缓慢拉近'],
  ['体育素材：生成五套 GIF 广告', '商品素材：生成四个投放尺寸', '参考素材：逆向提示词后裂变', '优秀素材：根据点击率二次优化'],
  ['东亚人物：真实场景口播', '信息流广告：强利益点前三秒', '图生视频：保持主体完整不裁切', '批量测试：同一方向十个版本']
]
const suggestionSetIndex = ref(0)
const suggestions = computed(() => suggestionSets[suggestionSetIndex.value])

const refreshSuggestions = () => {
  suggestionSetIndex.value = nextSuggestionSetIndex(suggestionSetIndex.value, suggestionSets.length)
  window.$message?.success('已换一批推荐')
}

const formatDate = (date) => {
  if (!date) return ''
  const value = new Date(date)
  const diff = Date.now() - value.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return `${value.getMonth() + 1}/${value.getDate()}`
}

const checkApiKeyAndNavigate = (callback) => {
  if (!isApiConfigured.value) {
    dialog.warning({
      title: '未配置 API Key',
      content: '请先在设置中配置 API Key 才能使用画布功能。',
      positiveText: '打开设置',
      onPositiveClick: () => {
        showApiSettings.value = true
      }
    })
    return false
  }
  return callback()
}

const createNewProject = () => runNavigation('new-project', ({ commit }) => commit(() => (
  checkApiKeyAndNavigate(() => {
    const id = createProject('未命名项目')
    return router.push(`/canvas/${id}`)
  })
)))

const createPromptProject = (prompt = '') => {
  return checkApiKeyAndNavigate(() => {
    const cleanPrompt = String(prompt || '').trim()
    const id = createProject(cleanPrompt || WORKSPACE_LAUNCH_LABELS.image, {
      canvasData: buildCanvasLaunch('image', { prompt: cleanPrompt })
    })
    return router.push(`/canvas/${id}`)
  })
}

const videoEntries = {
  video: { id: 'text-to-video', title: '文生视频' },
  'image-to-video': { id: 'image-to-video', title: '图生视频' }
}

const createVideoProject = (entry, prompt = '') => {
  return checkApiKeyAndNavigate(() => {
    const cleanPrompt = String(prompt || '').trim()
    const flow = entry.id === 'image-to-video' ? 'image-to-video' : 'video'
    const id = createProject(cleanPrompt || entry.title, {
      canvasData: buildCanvasLaunch(flow, { prompt: cleanPrompt })
    })
    return router.push(`/canvas/${id}`)
  })
}

const buildFlowProjectCanvas = flow => {
  if (flow === 'dsp') {
    return {
      nodes: [
        {
          id: 'dsp-library',
          type: 'dspCreativeLibrary',
          position: { x: 120, y: 100 },
          data: { label: '54DSP 优秀素材' }
        },
        {
          id: 'dsp-tasks',
          type: 'dspCreativeTaskCenter',
          position: { x: 1120, y: 100 },
          data: { label: '素材任务中心', jobIds: [] }
        }
      ],
      edges: [],
      viewport: { x: 40, y: 50, zoom: 0.68 }
    }
  }
  if (flow === 'variation') {
    return {
      nodes: [
        {
          id: 'variation-main',
          type: 'materialVariation',
          position: { x: 160, y: 100 },
          data: { label: '素材裂变' }
        }
      ],
      edges: [],
      viewport: { x: 100, y: 80, zoom: 0.8 }
    }
  }
  if (flow === 'gifEditor') {
    return {
      nodes: [
        {
          id: 'watermark-editor',
          type: 'watermarkEditor',
          position: { x: 160, y: 100 },
          data: { label: '水印与素材编辑', editorStatus: 'draft' }
        }
      ],
      edges: [],
      viewport: { x: 100, y: 80, zoom: 0.8 }
    }
  }
  return { nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 } }
}

const createFlowProject = (flow) => {
  const create = () => {
    const names = {
      variation: '素材裂变',
      dsp: '54DSP 优秀素材',
      batch: '批量广告尺寸',
      background: '背景替换',
      gifEditor: '水印与 GIF 素材编辑'
    }
    const canvasData = flow === 'gifEditor'
      ? buildFlowProjectCanvas(flow)
      : buildCanvasLaunch(flow)
    const id = createProject(names[flow] || '创作项目', { canvasData })
    if (flow === 'gifEditor') {
      return router.push({ path: '/gif-editor', query: { project: id, node: 'watermark-editor', from: 'home' } })
    }
    return router.push({ path: `/canvas/${id}`, query: { flow } })
  }
  if (flow === 'gifEditor') return create()
  return checkApiKeyAndNavigate(create)
}

const launchFlow = flow => {
  if (flow === 'image') return createPromptProject()
  if (flow === 'video') return createVideoProject(videoEntries.video)
  if (flow === 'image-to-video') return createVideoProject(videoEntries['image-to-video'])
  return createFlowProject(flow)
}

const handleLaunch = flow => runNavigation(
  `launch:${flow}`,
  ({ commit }) => commit(() => launchFlow(flow))
)

const handlePromptSubmit = (prompt) => {
  if (!String(prompt || '').trim()) {
    window.$message?.warning('先写一句创意描述')
    return
  }
  return runNavigation('prompt', ({ commit }) => commit(() => createPromptProject(prompt)))
}

const handleWorkspaceNavigate = (item) => {
  if (item.id === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  if (item.id === 'projects') {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (item.id === 'tasks') {
    router.push(item.to)
    return
  }
  if (item.id === 'recent') {
    runNavigation('recent', ({ commit }) => commit(() => router.push('/recent-generations')))
    return
  }
  handleLaunch(item.id)
}

const openProject = (project) => {
  return runNavigation(`project:${project.id}`, ({ commit }) => commit(() => (
    checkApiKeyAndNavigate(() => router.push(`/canvas/${project.id}`))
  )))
}

const handleProjectAction = (key, project) => {
  if (key === 'rename') {
    renameTargetId.value = project.id
    renameValue.value = project.name
    showRenameModal.value = true
    return
  }
  if (key === 'duplicate') {
    if (duplicateProject(project.id)) window.$message?.success('项目已复制')
    return
  }
  if (key === 'delete') {
    dialog.warning({
      title: '删除项目',
      content: `确定要删除项目「${project.name}」吗？此操作不可恢复。`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: () => {
        deleteProject(project.id)
        window.$message?.success('项目已删除')
      }
    })
  }
}

const confirmRename = () => {
  if (renameTargetId.value && renameValue.value.trim()) {
    renameProject(renameTargetId.value, renameValue.value.trim())
    window.$message?.success('已重命名')
  }
  showRenameModal.value = false
  renameTargetId.value = null
  renameValue.value = ''
}

onMounted(async () => {
  await initProjectsStore()
  projectsLoading.value = false
  loadTaskCenter()
  const launch = String(route.query.launch || '')
  const panel = String(route.query.panel || '')
  const section = String(route.query.section || '')
  if (launch && WORKSPACE_LAUNCH_LABELS[launch]) {
    await runNavigation(`url-launch:${launch}`, createGuardedUrlLaunchAction({
      replace: () => router.replace({ path: '/' }),
      launch: () => launchFlow(launch)
    }))
    return
  }
  if (panel === 'tasks') {
    await router.replace({ path: '/' })
    openTaskCenter()
    return
  }
  if (section === 'projects') {
    await router.replace({ path: '/' })
    await nextTick()
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>
