<template>
  <WorkspaceShell
    active-section="home"
    project-title="创作首页"
    :service-status="serviceStatus"
    @navigate="handleWorkspaceNavigate"
    @open-settings="showApiSettings = true"
    @open-status="showApiSettings = true"
    @open-tasks="taskRailOpen = true"
  >
    <template #main>
      <CreationLauncher
        :suggestions="suggestions"
        @launch="handleLaunch"
        @submit="handlePromptSubmit"
        @refresh-suggestions="refreshSuggestions"
      />
      <RecentProjects
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
        @close="taskRailOpen = false"
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput, NModal, useDialog } from 'naive-ui'
import {
  projects,
  initProjectsStore,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
  renameProject
} from '../stores/projects'
import { useModelStore } from '../stores/pinia'
import {
  createImageToVideoTemplateFlow,
  createTextToVideoTemplateFlow
} from '../config/videoWorkflows'
import { nextSuggestionSetIndex } from '../utils/suggestions'
import ApiSettings from '../components/ApiSettings.vue'
import CreationLauncher from '../components/home/CreationLauncher.vue'
import RecentProjects from '../components/home/RecentProjects.vue'
import TaskRail from '../components/workspace/TaskRail.vue'
import WorkspaceShell from '../components/workspace/WorkspaceShell.vue'

const router = useRouter()
const dialog = useDialog()
const modelStore = useModelStore()

const showApiSettings = ref(false)
const taskRailOpen = ref(false)
const recentTasks = ref([])
const showRenameModal = ref(false)
const renameValue = ref('')
const renameTargetId = ref(null)
const isApiConfigured = computed(() => modelStore.isCurrentProviderConfigured)
const serviceStatus = computed(() => ({
  label: isApiConfigured.value ? '服务已连接' : '需要配置',
  tone: isApiConfigured.value ? 'success' : 'warning'
}))

const refreshApiConfig = () => {}

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
  callback()
  return true
}

const createNewProject = () => {
  checkApiKeyAndNavigate(() => {
    const id = createProject('未命名项目')
    router.push(`/canvas/${id}`)
  })
}

const createPromptProject = (prompt = '') => {
  checkApiKeyAndNavigate(() => {
    const cleanPrompt = String(prompt || '').trim()
    const id = createProject(cleanPrompt || '未命名项目')
    sessionStorage.setItem('ai-canvas-initial-prompt', cleanPrompt)
    router.push(`/canvas/${id}`)
  })
}

const videoEntries = {
  video: { id: 'text-to-video', title: '文生视频' },
  'image-to-video': { id: 'image-to-video', title: '图生视频' }
}

const buildVideoTemplateCanvas = (entry, prompt) => {
  const flow = entry.id === 'image-to-video'
    ? createImageToVideoTemplateFlow({ x: 120, y: 120 })
    : createTextToVideoTemplateFlow({ x: 120, y: 180 })

  return {
    nodes: flow.nodes.map((node) => node.type === 'text' && prompt
      ? { ...node, data: { ...node.data, content: prompt } }
      : node),
    edges: flow.edges,
    viewport: { x: 80, y: 60, zoom: 0.8 }
  }
}

const createVideoProject = (entry, prompt = '') => {
  checkApiKeyAndNavigate(() => {
    const cleanPrompt = String(prompt || '').trim()
    const id = createProject(cleanPrompt || entry.title)
    updateProject(id, { canvasData: buildVideoTemplateCanvas(entry, cleanPrompt) })
    router.push(`/canvas/${id}`)
  })
}

const createFlowProject = (flow) => {
  checkApiKeyAndNavigate(() => {
    const names = {
      variation: '素材裂变',
      dsp: '54DSP 优秀素材'
    }
    const id = createProject(names[flow] || '创作项目')
    if (flow === 'dsp') {
      updateProject(id, {
        canvasData: {
          nodes: [
            {
              id: `dsp-library-${id}`,
              type: 'dspCreativeLibrary',
              position: { x: 120, y: 100 },
              data: { label: '54DSP 优秀素材' }
            },
            {
              id: `dsp-tasks-${id}`,
              type: 'dspCreativeTaskCenter',
              position: { x: 1120, y: 100 },
              data: { label: '素材任务中心', jobIds: [] }
            }
          ],
          edges: [],
          viewport: { x: 40, y: 50, zoom: 0.68 }
        }
      })
    } else if (flow === 'variation') {
      updateProject(id, {
        canvasData: {
          nodes: [
            {
              id: `variation-${id}`,
              type: 'materialVariation',
              position: { x: 160, y: 100 },
              data: { label: '素材裂变' }
            }
          ],
          edges: [],
          viewport: { x: 100, y: 80, zoom: 0.8 }
        }
      })
    }
    sessionStorage.setItem('ai-canvas-launch-flow', flow)
    router.push({ path: `/canvas/${id}`, query: { flow } })
  })
}

const handleLaunch = (flow) => {
  if (flow === 'image') return createPromptProject()
  if (flow === 'video') return createVideoProject(videoEntries.video)
  if (flow === 'image-to-video') return createVideoProject(videoEntries['image-to-video'])
  createFlowProject(flow)
}

const handlePromptSubmit = (prompt) => {
  if (!String(prompt || '').trim()) {
    window.$message?.warning('先写一句创意描述')
    return
  }
  createPromptProject(prompt)
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
    taskRailOpen.value = true
    return
  }
  handleLaunch(item.id)
}

const openProject = (project) => {
  checkApiKeyAndNavigate(() => router.push(`/canvas/${project.id}`))
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

onMounted(initProjectsStore)
</script>
