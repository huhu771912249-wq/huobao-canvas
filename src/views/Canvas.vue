<template>
  <!-- Canvas page | 画布页面 -->
  <div class="canvas-studio h-screen w-screen flex flex-col bg-[var(--bg-primary)]">
    <!-- Header | 顶部导航 -->
    <AppHeader class="canvas-studio__header bg-[var(--bg-secondary)]">
      <template #left>
        <button 
          @click="goBack"
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        >
          <n-icon :size="20"><ChevronBackOutline /></n-icon>
        </button>
        <n-dropdown :options="projectOptions" @select="handleProjectAction">
          <button class="flex items-center gap-1 hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded-lg transition-colors">
            <span class="font-medium">{{ projectName }}</span>
            <n-icon :size="16"><ChevronDownOutline /></n-icon>
          </button>
        </n-dropdown>
      </template>
      <template #right>
        <ComputeStatusIndicator />
        <button 
          @click="showDownloadModal = true"
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          :class="{ 'text-[var(--accent-color)]': hasDownloadableAssets }"
          title="批量下载素材"
        >
          <n-icon :size="20"><DownloadOutline /></n-icon>
        </button>
        <button 
          @click="showApiSettings = true"
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          :class="{ 'text-[var(--accent-color)]': isApiConfigured }"
          title="API 设置"
        >
          <n-icon :size="20"><SettingsOutline /></n-icon>
        </button>
      </template>
    </AppHeader>

    <!-- Main canvas area | 主画布区域 -->
    <div class="canvas-studio__stage flex-1 relative overflow-hidden">
      <!-- Vue Flow canvas | Vue Flow 画布 -->
      <VueFlow
        :key="flowKey"
        v-model:nodes="nodes"
        v-model:edges="edges"
        v-model:viewport="viewport"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="canvasViewport"
        :min-zoom="0.1"
        :max-zoom="2"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        :connection-radius="44"
        :connect-on-click="true"
        :auto-pan-on-connect="true"
        :auto-pan-speed="18"
        @connect="onConnect"
        @connect-start="handleConnectionStart"
        @connect-end="handleConnectionEnd"
        @click-connect-start="handleConnectionStart"
        @click-connect-end="handleConnectionEnd"
        @node-click="onNodeClick"
        @node-drag-stop="handleNodeDragStop"
        @pane-click="onPaneClick"
        @viewport-change="handleViewportChange"
        @edges-change="onEdgesChange"
        class="canvas-flow"
      >
        <Background v-if="showGrid" :gap="20" :size="1" />
        <MiniMap 
          v-if="!isMobile && nodes.length > 0"
          position="bottom-right"
          :pannable="true"
          :zoomable="true"
        />
      </VueFlow>

      <section v-if="isProjectLoading" class="canvas-project-loading" role="status" aria-live="polite">
        <span class="canvas-project-loading__pulse"></span>
        <strong>正在打开项目</strong>
        <p>{{ projectName }}</p>
      </section>

      <!-- Left toolbar | 左侧工具栏 -->
      <aside class="canvas-tool-rail absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-lg z-10">
        <button 
          @click="showNodeMenu = !showNodeMenu"
          class="canvas-tool-rail__button w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          title="添加节点"
          aria-label="添加节点"
        >
          <n-icon :size="20"><AddOutline /></n-icon>
          <span class="canvas-tool-rail__tooltip" aria-hidden="true">添加节点</span>
        </button>
        <button 
          @click="showWorkflowPanel = true"
          class="canvas-tool-rail__button w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          title="工作流模板"
          aria-label="工作流模板"
        >
          <n-icon :size="20"><AppsOutline /></n-icon>
          <span class="canvas-tool-rail__tooltip" aria-hidden="true">工作流模板</span>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button 
          v-for="tool in tools" 
          :key="tool.id"
          @click="tool.action"
          :disabled="tool.disabled && tool.disabled()"
          class="canvas-tool-rail__button w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          :title="tool.name"
          :aria-label="tool.name"
        >
          <n-icon :size="20"><component :is="tool.icon" /></n-icon>
          <span class="canvas-tool-rail__tooltip" aria-hidden="true">{{ tool.name }}</span>
        </button>
      </aside>

      <!-- Node menu popup | 节点菜单弹窗 -->
      <div 
        v-if="showNodeMenu"
        class="canvas-node-menu absolute left-20 top-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-lg p-2 z-20"
      >
        <button 
          v-for="nodeType in nodeTypeOptions" 
          :key="nodeType.type"
          @click="addNewNode(nodeType.type)"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
        >
          <n-icon :size="20" :color="nodeType.color"><component :is="nodeType.icon" /></n-icon>
          <span class="text-sm">{{ nodeType.name }}</span>
        </button>
      </div>

      <section v-if="!isProjectLoading && nodes.length === 0" class="canvas-starter-panel">
        <div class="canvas-starter-panel__heading">
          <span>从业务目标开始</span>
          <h2>今天要做什么素材？</h2>
          <p>不用先搭节点。选择一个场景，系统会自动创建对应工作流。</p>
        </div>
        <div class="canvas-starter-panel__grid">
          <button
            v-for="item in starterActions"
            :key="item.id"
            type="button"
            class="canvas-starter-card"
            @click="handleStarterAction(item.id)"
          >
            <span class="canvas-starter-card__eyebrow">{{ item.eyebrow }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.description }}</small>
            <span class="canvas-starter-card__action">{{ item.actionLabel }} →</span>
          </button>
        </div>
      </section>

      <!-- Bottom controls | 底部控制 -->
      <div class="canvas-zoom-dock absolute bottom-4 left-4 flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-1">
        <!-- <button 
          @click="showGrid = !showGrid" 
          :class="showGrid ? 'bg-[var(--accent-color)] text-white' : 'hover:bg-[var(--bg-tertiary)]'"
          class="p-2 rounded transition-colors"
          title="切换网格"
        >
          <n-icon :size="16"><GridOutline /></n-icon>
        </button> -->
        <button 
          @click="fitView({ padding: 0.2 })" 
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="适应视图"
        >
          <n-icon :size="16"><LocateOutline /></n-icon>
        </button>
        <div class="flex items-center gap-1 px-2">
          <button @click="zoomOut" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><RemoveOutline /></n-icon>
          </button>
          <span class="text-xs min-w-[40px] text-center">{{ Math.round(viewport.zoom * 100) }}%</span>
          <button @click="zoomIn" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><AddOutline /></n-icon>
          </button>
        </div>
      </div>

      <!-- Bottom input panel (floating) | 底部输入面板（悬浮） -->
      <div
        class="canvas-prompt-dock absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20"
        :class="{
          'canvas-prompt-dock--collapsed': !promptDockExpanded,
          'canvas-prompt-dock--director': directorPlan,
          'canvas-prompt-dock--connection-active': connectionInProgress && promptDockExpanded
        }"
      >
        <button
          v-if="!promptDockExpanded"
          type="button"
          class="canvas-prompt-dock__launcher"
          aria-label="打开冠希 H3 导演"
          @click="setPromptDockExpanded(true)"
        >
          <n-icon :size="18"><ChatbubbleOutline /></n-icon>
          <span>
            <strong>冠希 H3 导演</strong>
            <small>说人话，自动补全人物、场景、景别和运镜</small>
          </span>
        </button>

        <template v-else>
        <!-- Processing indicator | 处理中指示器 -->
        <div 
          v-if="isProcessing" 
          class="mb-3 p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--accent-color)] animate-pulse"
        >
          <div class="flex items-center gap-2 text-sm text-[var(--accent-color)] mb-2">
            <n-spin :size="14" />
            <span>{{ directorStatusText || '正在生成专业 H3 方案…' }}</span>
          </div>
        </div>

        <section v-if="directorPlan" class="h3-director-card">
          <header class="h3-director-card__header">
            <div><span>冠希 H3 导演</span><strong>{{ directorPlan.title }}</strong></div>
            <div class="h3-director-card__chips">
              <span>{{ directorPlan.plan_source === 'gemma' ? '本地 Gemma' : '专业规则补全' }}</span>
              <span>H3</span><span>{{ directorPlan.aspect_ratio }}</span><span>{{ directorPlan.duration_seconds }}秒</span><span>1080p</span>
            </div>
          </header>
          <div class="h3-director-card__grid">
            <article><small>人物设定</small><strong>{{ directorPlan.character.identity }}</strong><p>{{ directorPlan.character.appearance }}；{{ directorPlan.character.wardrobe }}</p></article>
            <article><small>地点与布景</small><strong>{{ directorPlan.environment.location }} · {{ directorPlan.environment.time }}</strong><p>{{ directorPlan.environment.set_dressing }}</p></article>
            <article><small>景别与镜头</small><strong>{{ directorPlan.cinematography.shot_size }} · {{ directorPlan.cinematography.lens }}</strong><p>{{ directorPlan.cinematography.camera_angle }}；{{ directorPlan.cinematography.camera_movement }}</p></article>
            <article><small>光影与色彩</small><strong>{{ directorPlan.lighting.mood }}</strong><p>{{ directorPlan.lighting.key_light }}；{{ directorPlan.lighting.color_palette }}</p></article>
            <article class="h3-director-card__wide"><small>动作时间线</small><p>{{ directorPlan.action_timeline.join('；') }}</p></article>
            <article class="h3-director-card__wide"><small>声音设计</small><p>{{ directorPlan.audio_direction }}</p></article>
          </div>
          <details><summary>查看 H3 专业提示词</summary><p>{{ directorPlan.video_prompt }}</p></details>
          <div class="h3-director-card__actions">
            <button type="button" :disabled="isProcessing" @click="applyDirectorPlan(false)">只应用到画布</button>
            <button type="button" :disabled="isProcessing" class="primary" @click="applyDirectorPlan(true)">生成 H3 视频</button>
          </div>
        </section>

        <div v-if="directorError" class="h3-director-error">{{ directorError }}</div>

        <div class="canvas-prompt-dock__composer bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-3">
          <div class="canvas-prompt-dock__header">
            <span>冠希 H3 导演</span>
            <button
              type="button"
              aria-label="收起冠希 H3 导演"
              title="收起"
              @click="setPromptDockExpanded(false)"
            >
              <n-icon :size="16"><ChevronDownOutline /></n-icon>
            </button>
          </div>
          <textarea
            v-model="chatInput"
            :placeholder="inputPlaceholder"
            :disabled="isProcessing"
            class="w-full bg-transparent resize-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[40px] max-h-[120px] disabled:opacity-50"
            rows="1"
            @keydown.enter.exact="handleEnterKey"
            @keydown.enter.ctrl="sendMessage"
          />
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2">
              <button 
                @click="handlePolish"
                :disabled="isProcessing || !chatInput.trim()"
                class="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="生成专业 H3 导演方案"
              >
                ✨ 生成专业方案
              </button>
            </div>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <n-switch v-model:value="autoExecute" size="small" />
                发送后自动生成
              </label>
              <button 
                @click="sendMessage"
                :disabled="isProcessing"
                class="w-8 h-8 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <n-spin v-if="isProcessing" :size="16" />
                <n-icon v-else :size="20" color="white"><SendOutline /></n-icon>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Quick suggestions | 快捷建议 -->
        <div class="flex flex-wrap items-center justify-center gap-2 mt-2">
          <span class="text-xs text-[var(--text-secondary)]">推荐：</span>
          <button 
            v-for="tag in suggestions" 
            :key="tag"
            @click="chatInput = tag"
            class="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-colors"
          >
            {{ tag }}
          </button>
          <button
            @click="refreshSuggestions"
            class="p-1 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="换一批推荐"
            aria-label="换一批推荐"
          >
            <n-icon :size="14"><RefreshOutline /></n-icon>
          </button>
        </div>
        </template>
      </div>
    </div>

    <!-- API Settings Modal | API 设置弹窗 -->
    <ApiSettings v-model:show="showApiSettings" />

    <!-- Rename Modal | 重命名弹窗 -->
    <n-modal v-model:show="showRenameModal" preset="dialog" title="重命名项目">
      <n-input v-model:value="renameValue" placeholder="请输入项目名称" />
      <template #action>
        <n-button @click="showRenameModal = false">取消</n-button>
        <n-button type="primary" @click="confirmRename">确定</n-button>
      </template>
    </n-modal>

    <!-- Delete Confirm Modal | 删除确认弹窗 -->
    <n-modal v-model:show="showDeleteModal" preset="dialog" title="删除项目" type="warning">
      <p>确定要删除项目「{{ projectName }}」吗？此操作不可恢复。</p>
      <template #action>
        <n-button @click="showDeleteModal = false">取消</n-button>
        <n-button type="error" @click="confirmDelete">删除</n-button>
      </template>
    </n-modal>

    <!-- Download Modal | 下载弹窗 -->
    <DownloadModal v-model:show="showDownloadModal" />

    <!-- Workflow Panel | 工作流面板 -->
    <WorkflowPanel v-model:show="showWorkflowPanel" @add-workflow="handleAddWorkflow" />
  </div>
</template>

<script setup>
/**
 * Canvas view component | 画布视图组件
 * Main infinite canvas with Vue Flow integration
 */
import { ref, computed, defineAsyncComponent, onMounted, onUnmounted, watch, nextTick, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { NIcon, NSwitch, NDropdown, NMessageProvider, NSpin, NModal, NInput, NButton } from 'naive-ui'
import { 
  ChevronBackOutline,
  ChevronDownOutline,
  SettingsOutline,
  AddOutline,
  ImageOutline,
  SendOutline,
  RefreshOutline,
  TextOutline,
  VideocamOutline,
  ColorPaletteOutline,
  BookmarkOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
  GridOutline,
  LocateOutline,
  RemoveOutline,
  DownloadOutline,
  AppsOutline,
  ChatbubbleOutline
} from '@vicons/ionicons5'
import { nodes, edges, addNode, addNodes, addEdge, addEdges, updateNode, initSampleData, loadProject, saveProject, clearCanvas, canvasViewport, updateViewport, undo, redo, canUndo, canRedo, manualSaveHistory, scheduleCanvasSave, startBatchOperation, endBatchOperation, suspendCanvasSave } from '../stores/canvas'
import { loadAllModels } from '../stores/models'
import { useWorkflowOrchestrator } from '../hooks'
import { useModelStore } from '../stores/pinia'
import { projects, initProjectsStore, ensureProjectLoaded, activateProject, updateProject, renameProject, currentProject, currentProjectId, deleteProject, duplicateProject } from '../stores/projects'
import { nextSuggestionSetIndex } from '../utils/suggestions'
import { createLatestRequestGate } from '../utils/navigationState'
import {
  buildCanvasStarterActions,
  resolvePromptDockExpanded
} from '../utils/workspaceUi'
import { findOpenNodePosition, placeWorkflowWithoutOverlap } from '../utils/canvasLayout.js'

// API Settings component | API 设置组件
import ApiSettings from '../components/ApiSettings.vue'
import DownloadModal from '../components/DownloadModal.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'
import AppHeader from '../components/AppHeader.vue'
import ComputeStatusIndicator from '../components/ComputeStatusIndicator.vue'

// API Config state | API 配置状态
const modelStore = useModelStore()
const isApiConfigured = computed(() => modelStore.isCurrentProviderConfigured)

// Initialize models on page load | 页面加载时初始化模型
onMounted(() => {
  loadAllModels()
})

// Workflow orchestrator hook | 工作流编排 hook
const {
  isAnalyzing: workflowAnalyzing,
  isExecuting: workflowExecuting,
  currentStep: workflowStep,
  totalSteps: workflowTotalSteps,
  executionLog: workflowLog,
  analyzeIntent,
  executeWorkflow,
  createTextToImageWorkflow,
  createMultiAngleStoryboard,
  WORKFLOW_TYPES
} = useWorkflowOrchestrator()

// Custom node components | 自定义节点组件
import TextNode from '../components/nodes/TextNode.vue'
import ImageConfigNode from '../components/nodes/ImageConfigNode.vue'
import VideoNode from '../components/nodes/VideoNode.vue'
import ImageNode from '../components/nodes/ImageNode.vue'
import VideoConfigNode from '../components/nodes/VideoConfigNode.vue'
import LLMConfigNode from '../components/nodes/LLMConfigNode.vue'
import ImageRoleEdge from '../components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from '../components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from '../components/edges/ImageOrderEdge.vue'

const VideoBatchNode = defineAsyncComponent(
  () => import('../components/nodes/VideoBatchNode.vue')
)
const MaterialVariationNode = defineAsyncComponent(
  () => import('../components/nodes/MaterialVariationNode.vue')
)
const DspCreativeLibraryNode = defineAsyncComponent(
  () => import('../components/nodes/DspCreativeLibraryNode.vue')
)
const DspCreativeTaskCenterNode = defineAsyncComponent(
  () => import('../components/nodes/DspCreativeTaskCenterNode.vue')
)
const TextOverlayNode = defineAsyncComponent(
  () => import('../components/nodes/TextOverlayNode.vue')
)
const VideoGifNode = defineAsyncComponent(
  () => import('../components/nodes/VideoGifNode.vue')
)
const MaterialExportNode = defineAsyncComponent(
  () => import('../components/nodes/MaterialExportNode.vue')
)
const MaterialInputNode = defineAsyncComponent(
  () => import('../components/nodes/MaterialInputNode.vue')
)
const WatermarkEditorNode = defineAsyncComponent(
  () => import('../components/nodes/WatermarkEditorNode.vue')
)

const router = useRouter()
const route = useRoute()

// Vue Flow instance | Vue Flow 实例
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()

// Register custom node types | 注册自定义节点类型
const nodeTypes = {
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  video: markRaw(VideoNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  videoBatch: markRaw(VideoBatchNode),
  materialVariation: markRaw(MaterialVariationNode),
  dspCreativeLibrary: markRaw(DspCreativeLibraryNode),
  dspCreativeTaskCenter: markRaw(DspCreativeTaskCenterNode),
  llmConfig: markRaw(LLMConfigNode),
  materialInput: markRaw(MaterialInputNode),
  textOverlay: markRaw(TextOverlayNode),
  videoGif: markRaw(VideoGifNode),
  watermarkEditor: markRaw(WatermarkEditorNode),
  materialExport: markRaw(MaterialExportNode)
}

// Register custom edge types | 注册自定义边类型
const edgeTypes = {
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge)
}

// UI state | UI状态
const showNodeMenu = ref(false)
const chatInput = ref('')
const autoExecute = ref(true)
const isMobile = ref(false)
const showGrid = ref(true)
const showApiSettings = ref(false)
const isProcessing = ref(false)
const directorPlan = ref(null)
const directorError = ref('')
const directorStatusText = ref('')
const promptDockExpanded = ref(false)
const promptDockTouched = ref(false)
const connectionInProgress = ref(false)
const starterActions = buildCanvasStarterActions()

watch(
  () => nodes.value.length,
  (nodeCount) => {
    if (!promptDockTouched.value) {
      promptDockExpanded.value = resolvePromptDockExpanded({ nodeCount })
    }
  },
  { immediate: true }
)

const setPromptDockExpanded = (expanded) => {
  promptDockTouched.value = true
  promptDockExpanded.value = Boolean(expanded)
}

const handleConnectionStart = () => {
  connectionInProgress.value = true
}

const handleConnectionEnd = () => {
  connectionInProgress.value = false
}

// Flow key for forcing re-render on project switch | 项目切换时强制重新渲染的 key
const flowKey = ref(Date.now())
const isProjectLoading = ref(Boolean(route.params.id && route.params.id !== 'new'))
const loadedProjectId = ref(null)
const projectLoadGate = createLatestRequestGate()

// Modal state | 弹窗状态
const showRenameModal = ref(false)
const showDeleteModal = ref(false)
const showDownloadModal = ref(false)
const showWorkflowPanel = ref(false)
const renameValue = ref('')

// Check if has downloadable assets | 检查是否有可下载素材
const hasDownloadableAssets = computed(() => {
  return nodes.value.some(n => 
    (n.type === 'image' || n.type === 'video') && n.data?.url
  )
})


// Project info | 项目信息
const projectName = computed(() => {
  const project = projects.value.find(p => p.id === route.params.id)
  return project?.name || '未命名项目'
})

// Project dropdown options | 项目下拉选项
const projectOptions = [
  { label: '重命名', key: 'rename' },
  { label: '复制', key: 'duplicate' },
  { label: '删除', key: 'delete' }
]

// Toolbar tools | 工具栏工具
const tools = [
  { id: 'text', name: '文本', icon: TextOutline, action: () => addNewNode('text') },
  { id: 'image', name: '图片', icon: ImageOutline, action: () => addNewNode('image') },
  { id: 'imageConfig', name: '文生图', icon: ColorPaletteOutline, action: () => addNewNode('imageConfig') },
  { id: 'materialVariation', name: '素材裂变', icon: AppsOutline, action: () => addNewNode('materialVariation') },
  { id: 'materialInput', name: '素材导入', icon: DownloadOutline, action: () => addNewNode('materialInput') },
  { id: 'textOverlay', name: '文字叠加', icon: TextOutline, action: () => addNewNode('textOverlay') },
  { id: 'videoGif', name: '视频转 GIF', icon: VideocamOutline, action: () => addNewNode('videoGif') },
  { id: 'watermarkEditor', name: '水印与素材编辑', icon: ImageOutline, action: () => addNewNode('watermarkEditor') },
  { id: 'materialExport', name: '素材导出', icon: DownloadOutline, action: () => addNewNode('materialExport') },
  { id: 'videoConfig', name: '视频生成', icon: VideocamOutline, action: () => addNewNode('videoConfig') },
  { id: 'undo', name: '撤销', icon: ArrowUndoOutline, action: () => undo(), disabled: () => !canUndo() },
  { id: 'redo', name: '重做', icon: ArrowRedoOutline, action: () => redo(), disabled: () => !canRedo() }
]

// Node type options for menu | 节点类型菜单选项
const nodeTypeOptions = [
  { type: 'text', name: '文本节点', icon: TextOutline, color: '#3b82f6' },
  { type: 'llmConfig', name: 'LLM文本生成', icon: ChatbubbleOutline, color: '#a855f7' },
  { type: 'imageConfig', name: '文生图配置', icon: ColorPaletteOutline, color: '#22c55e' },
  { type: 'dspCreativeLibrary', name: '54DSP 优秀素材', icon: BookmarkOutline, color: '#22d3ee' },
  { type: 'dspCreativeTaskCenter', name: '素材任务中心', icon: AppsOutline, color: '#fbbf24' },
  { type: 'materialVariation', name: '素材裂变', icon: AppsOutline, color: '#10b981' },
  { type: 'materialInput', name: '素材导入', icon: DownloadOutline, color: '#38bdf8' },
  { type: 'textOverlay', name: '文字叠加', icon: TextOutline, color: '#06b6d4' },
  { type: 'videoGif', name: '视频转 GIF', icon: VideocamOutline, color: '#f59e0b' },
  { type: 'watermarkEditor', name: '水印与素材编辑', icon: ImageOutline, color: '#2dd4bf' },
  { type: 'materialExport', name: '素材导出', icon: DownloadOutline, color: '#10b981' },
  { type: 'videoConfig', name: '视频生成配置', icon: VideocamOutline, color: '#f59e0b' },
  { type: 'image', name: '图片节点', icon: ImageOutline, color: '#8b5cf6' },
  { type: 'video', name: '视频节点', icon: VideocamOutline, color: '#ef4444' }
]

// Input placeholder | 输入占位符
const inputPlaceholder = '例如：竖屏5秒，雨夜上海街头，年轻女设计师撑伞走向镜头'

// Quick suggestions | 快捷建议
const suggestionSets = [
  [
    '年轻女设计师在上海顶楼工作室展示新产品',
    '竖屏3秒，纽约咖啡师把咖啡递给镜头',
    '雨夜重庆街道，出租车驶过，电影感',
    '海边运动鞋广告，低机位跟拍'
  ],
  [
    '体育赛事高点击 GIF',
    '商品图生成四个广告尺寸',
    '上传素材后逆向提示词',
    '胜出素材二次裂变'
  ],
  [
    '东亚人物口播素材',
    '强利益点信息流广告',
    '同一创意生成五套版本',
    '参考图轻微运镜视频'
  ]
]
const suggestionSetIndex = ref(0)
const suggestions = computed(() => suggestionSets[suggestionSetIndex.value])
const refreshSuggestions = () => {
  suggestionSetIndex.value = nextSuggestionSetIndex(
    suggestionSetIndex.value,
    suggestionSets.length
  )
  window.$message?.success('已换一批推荐')
}

// Add new node | 添加新节点
const addNewNode = async (type, data = {}) => {
  // Calculate viewport center position | 计算视口中心位置
  const viewportCenterX = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const viewportCenterY = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  
  // Add node at viewport center | 在视口中心添加节点
  const preferredPosition = { x: viewportCenterX - 100, y: viewportCenterY - 100 }
  const nodeId = addNode(
    type,
    findOpenNodePosition(nodes.value, preferredPosition, type),
    data
  )
  
  // Set highest z-index | 设置最高层级
  const maxZIndex = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  updateNode(nodeId, { zIndex: maxZIndex + 1 })
  
  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(nodeId)
  }, 50)
  
  showNodeMenu.value = false
}

const handleStarterAction = async (actionId) => {
  promptDockTouched.value = false
  if (actionId === 'dsp') {
    const viewportCenterX = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
    const viewportCenterY = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
    addNodes([
      {
        type: 'dspCreativeLibrary',
        position: { x: viewportCenterX - 700, y: viewportCenterY - 280 }
      },
      {
        type: 'dspCreativeTaskCenter',
        position: { x: viewportCenterX + 120, y: viewportCenterY - 280 }
      }
    ])
  } else if (actionId === 'variation') {
    await addNewNode('materialVariation')
  } else if (actionId === 'background') {
    await addNewNode('imageConfig', {
      label: '按参考图更换背景',
      editMode: 'background_replace',
      subjectImage: '',
      backgroundReferenceImage: ''
    })
  }

  await nextTick()
  fitView({ padding: 0.18 })
}

// Handle add workflow from panel | 处理从面板添加工作流
const handleAddWorkflow = ({ workflow, options }) => {
  // Calculate viewport center position | 计算视口中心位置
  const viewportCenterX = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const viewportCenterY = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom

  // Create nodes from workflow template | 从工作流模板创建节点
  const startPosition = { x: viewportCenterX - 300, y: viewportCenterY - 200 }
  const { nodes: createdNodes, edges: newEdges } = workflow.createNodes(startPosition, options)
  const newNodes = placeWorkflowWithoutOverlap(nodes.value, createdNodes)

  // Start batch operation manually | 手动开始批量操作
  startBatchOperation()

  // Add nodes to canvas in batch | 批量将节点添加到画布
  const nodeSpecs = newNodes.map(node => ({
    type: node.type,
    position: node.position,
    data: node.data
  }))
  const nodeIds = addNodes(nodeSpecs, false)

  // Map old node IDs to new IDs | 映射旧节点ID到新ID
  const idMap = {}
  newNodes.forEach((node, index) => {
    idMap[node.id] = nodeIds[index]
  })

  // Add edges to canvas in batch | 批量将边添加到画布
  const edgeSpecs = newEdges.map(edge => ({
    source: idMap[edge.source] || edge.source,
    target: idMap[edge.target] || edge.target,
    sourceHandle: edge.sourceHandle || 'right',
    targetHandle: edge.targetHandle || 'left',
    type: edge.type,
    data: edge.data
  }))

  // Add edges (autoBatch=false to use manual batch) | 添加边（autoBatch=false 以使用手动批量）
  addEdges(edgeSpecs, false)

  // End batch operation and save to history | 结束批量操作并保存到历史
  endBatchOperation()

  // Delay node internals update | 延迟节点内部更新
  setTimeout(() => {
    // Update node internals | 更新节点内部
    nodeIds.forEach(nodeId => {
      updateNodeInternals(nodeId)
    })
  }, 100)

  window.$message?.success(`已添加工作流: ${workflow.name}`)
}

// Handle connection | 处理连接
const isDuplicateCanvasConnection = (existingEdges, params) => {
  const source = String(params?.source || '')
  const target = String(params?.target || '')
  const sourceHandle = String(params?.sourceHandle || '')
  const targetHandle = String(params?.targetHandle || '')
  const edgeId = String(params?.id || `edge_${source}_${target}`)

  return existingEdges.some(edge => {
    if (String(edge?.id || '') === edgeId) return true
    return String(edge?.source || '') === source &&
      String(edge?.target || '') === target &&
      String(edge?.sourceHandle || '') === sourceHandle &&
      String(edge?.targetHandle || '') === targetHandle
  })
}

const onConnect = (params) => {
  if (isDuplicateCanvasConnection(edges.value, params)) return

  // Check connection types | 检查连接类型
  const sourceNode = nodes.value.find(n => n.id === params.source)
  const targetNode = nodes.value.find(n => n.id === params.target)
  
  if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
    // Use imageRole edge type | 使用图片角色边类型
    addEdge({
      ...params,
      type: 'imageRole',
      data: { imageRole: 'first_frame_image' } // Default to first frame | 默认首帧
    })
  } else if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
    // Use promptOrder edge type | 使用提示词顺序边类型
    // Calculate next order number | 计算下一个顺序号
    const existingTextEdges = edges.value.filter(e => 
      e.target === params.target && e.type === 'promptOrder'
    )
    const nextOrder = existingTextEdges.length + 1
    
    addEdge({
      ...params,
      type: 'promptOrder',
      data: { promptOrder: nextOrder }
    })
  } else if (sourceNode?.type === 'image' && targetNode?.type === 'imageConfig') {
    // Use imageOrder edge type | 使用图片顺序边类型
    // Calculate next order number | 计算下一个顺序号
    const existingImageEdges = edges.value.filter(e =>
      e.target === params.target && e.type === 'imageOrder'
    )

    // Get @ mentioned image count from connected TextNodes | 获取已连接 TextNode 中 @ 提及的图片数量
    let mentionedImageCount = 0
    const connectedTextEdges = edges.value.filter(e => e.target === params.target)
    for (const edge of connectedTextEdges) {
      const sourceNode = nodes.value.find(n => n.id === edge.source)
      if (sourceNode?.type === 'text') {
        const content = sourceNode.data?.content || ''
        // Count @ mentions of image nodes | 统计图片节点的 @ 提及
        const mentionRegex = /@\[([^\]|]+)(?:\|([^\]]+))?\]/g
        let match
        while ((match = mentionRegex.exec(content)) !== null) {
          const mentionedNode = nodes.value.find(n => n.id === match[1])
          if (mentionedNode?.type === 'image') {
            mentionedImageCount++
          }
        }
      }
    }

    // Next order = existing edges + mentioned image count + 1 | 下一个序号 = 现有边数 + @提及图片数 + 1
    const nextOrder = existingImageEdges.length + mentionedImageCount + 1

    addEdge({
      ...params,
      type: 'imageOrder',
      data: { imageOrder: nextOrder }
    })
  } else if (sourceNode?.type === 'llmConfig' && targetNode?.type === 'imageConfig') {
    // LLM output as prompt for image generation | LLM 输出作为图片生成提示词
    const existingTextEdges = edges.value.filter(e =>
      e.target === params.target && e.type === 'promptOrder'
    )
    const nextOrder = existingTextEdges.length + 1

    addEdge({
      ...params,
      type: 'promptOrder',
      data: { promptOrder: nextOrder }
    })
  } else if (sourceNode?.type === 'llmConfig' && targetNode?.type === 'videoConfig') {
    // LLM output as prompt for video generation | LLM 输出作为视频生成提示词
    addEdge({
      ...params,
      type: 'promptOrder',
      data: { promptOrder: 1 }
    })
  } else {
    addEdge(params)
  }
}
const onNodeClick = (event) => {
  // nodes.value.forEach(node => {
  //   updateNode(node.id, { selected: false })
  // })
  
  // // Select clicked node | 选中的节点
  // const clickedNode = nodes.value.find(n => n.id === event.node.id)
  // if (clickedNode) {
  //   updateNode(event.node.id, { selected: true })
  // }
}

const handleNodeDragStop = () => {
  manualSaveHistory()
  scheduleCanvasSave()
}

// Handle viewport change | 处理视口变化
const handleViewportChange = (newViewport) => {
  updateViewport(newViewport)
}

// Handle edges change | 处理边变化
const onEdgesChange = (changes) => {
  // Check if any edge is being removed | 检查是否有边被删除
  const hasRemoval = changes.some(change => change.type === 'remove')
  
  if (hasRemoval) {
    // Trigger history save after edge removal | 边删除后触发历史保存
    nextTick(() => {
      manualSaveHistory()
    })
  }
}

// Handle pane click | 处理画布点击
const onPaneClick = () => {
  showNodeMenu.value = false
  // Clear all selections | 清除所有选中
  // nodes.value = nodes.value.map(node => ({
  //   ...node,
  //   selected: false
  // }))
}

// Handle project action | 处理项目操作
const handleProjectAction = (key) => {
  switch (key) {
    case 'rename':
      renameValue.value = projectName.value
      showRenameModal.value = true
      break
    case 'duplicate':
      {
        const projectId = route.params.id
        saveProject()
        const newId = duplicateProject(projectId)
        if (!newId) {
          window.$message?.error('项目复制失败')
          return
        }
        window.$message?.success('项目已复制')
        router.push(`/canvas/${newId}`)
      }
      break
    case 'delete':
      showDeleteModal.value = true
      break
  }
}

// Confirm rename | 确认重命名
const confirmRename = () => {
  const projectId = route.params.id
  if (renameValue.value.trim()) {
    renameProject(projectId, renameValue.value.trim())
    window.$message?.success('已重命名')
  }
  showRenameModal.value = false
}

// Confirm delete | 确认删除
const confirmDelete = () => {
  const projectId = route.params.id
  deleteProject(projectId)
  showDeleteModal.value = false
  window.$message?.success('项目已删除')
  router.push('/')
}

// Handle Enter key | 处理回车键
const handleEnterKey = (e) => {
  e.preventDefault()
  sendMessage()
}

// Handle AI polish | 处理 AI 润色
const handlePolish = async () => {
  const input = chatInput.value.trim()
  if (!input) return
  
  // Check API configuration | 检查 API 配置
  if (!isApiConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    showApiSettings.value = true
    return
  }

  isProcessing.value = true
  try {
    directorStatusText.value = '本地 Gemma 正在拆解人物、场景、景别、运镜和声音…'
    directorError.value = ''
    directorPlan.value = await analyzeIntent(input)
    window.$message?.success('专业 H3 方案已生成，可检查后应用')
  } catch (err) {
    directorError.value = err.message || '专业方案生成失败'
    window.$message?.error(directorError.value)
  } finally {
    isProcessing.value = false
    directorStatusText.value = ''
  }
}

const nextDirectorPosition = () => {
  const maxY = nodes.value.length ? Math.max(...nodes.value.map(node => node.position?.y || 0)) : -100
  return { x: 100, y: maxY + 200 }
}

const applyDirectorPlan = async (shouldGenerate = false) => {
  if (!directorPlan.value) return
  isProcessing.value = true
  directorError.value = ''
  directorStatusText.value = shouldGenerate ? '正在搭建工作流并提交 H3 任务…' : '正在把专业方案应用到画布…'
  try {
    await executeWorkflow(directorPlan.value, nextDirectorPosition(), { autoExecute: shouldGenerate })
    window.$message?.success(shouldGenerate ? 'H3 任务已提交，可在视频节点查看真实阶段' : 'H3 工作流已应用到画布')
    setTimeout(() => fitView({ padding: 0.2 }), 180)
  } catch (err) {
    directorError.value = err.message || 'H3 工作流创建失败'
    window.$message?.error(directorError.value)
  } finally {
    isProcessing.value = false
    directorStatusText.value = ''
  }
}

// Send message | 发送消息
const sendMessage = async () => {
  const input = chatInput.value.trim()
  if (!input) return

  // Check API configuration | 检查 API 配置
  if (!isApiConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    showApiSettings.value = true
    return
  }

  isProcessing.value = true
  const content = chatInput.value

  try {
    directorStatusText.value = '本地 Gemma 正在拆解人物、场景、景别、运镜和声音…'
    directorError.value = ''
    directorPlan.value = await analyzeIntent(content)
    chatInput.value = ''
    if (autoExecute.value) await applyDirectorPlan(true)
  } catch (err) {
    directorError.value = err.message || '专业方案生成失败'
    window.$message?.error(directorError.value)
  } finally {
    isProcessing.value = false
    directorStatusText.value = ''
  }
}

// Go back to home | 返回首页
const goBack = () => {
  router.push('/')
}

// Check if mobile | 检测是否移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// Load project by ID | 根据ID加载项目
const loadProjectById = async (projectId) => {
  const requestToken = projectLoadGate.begin()
  // Update flow key to force VueFlow re-render | 更新 key 强制 VueFlow 重新渲染
  flowKey.value = requestToken
  isProjectLoading.value = Boolean(projectId && projectId !== 'new')
  loadedProjectId.value = null
  suspendCanvasSave()
  clearCanvas()
  await nextTick()
  if (!projectLoadGate.isCurrent(requestToken)) return
  
  if (projectId && projectId !== 'new') {
    try {
      await ensureProjectLoaded(projectId, { activate: false })
      if (!projectLoadGate.isCurrent(requestToken) || route.params.id !== projectId) return
      activateProject(projectId)
      loadProject(projectId)
      loadedProjectId.value = projectId
    } catch (error) {
      if (!projectLoadGate.isCurrent(requestToken)) return
      window.$message?.error(error?.response?.status === 404 ? '项目不存在或已被删除' : '项目读取失败，请稍后重试')
    } finally {
      if (projectLoadGate.isCurrent(requestToken)) isProjectLoading.value = false
    }
  } else if (projectLoadGate.isCurrent(requestToken)) isProjectLoading.value = false
}

// Watch for route changes | 监听路由变化
watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      // Save current project before switching | 切换前保存当前项目
      if (oldId && loadedProjectId.value === oldId && !isProjectLoading.value && currentProjectId.value === oldId) {
        saveProject()
      }
      // Load new project | 加载新项目
      await loadProjectById(newId)
    }
  }
)

// Initialize | 初始化
onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // Initialize projects store | 初始化项目存储
  await initProjectsStore()
  
  // Load project data | 加载项目数据
  await loadProjectById(route.params.id)
  
  // Check for initial prompt from home page | 检查来自首页的初始提示词
  const initialPrompt = sessionStorage.getItem('ai-canvas-initial-prompt')
  if (initialPrompt) {
    sessionStorage.removeItem('ai-canvas-initial-prompt')
    chatInput.value = initialPrompt
    // Auto-send the message | 自动发送消息
    nextTick(() => {
      sendMessage()
    })
  }
})

// Cleanup on unmount | 卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  projectLoadGate.invalidate()
  // Save project before leaving | 离开前保存项目
  if (loadedProjectId.value && currentProjectId.value === loadedProjectId.value) saveProject()
})
</script>

<style>
/* Import Vue Flow styles | 引入 Vue Flow 样式 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';

.canvas-flow {
  width: 100%;
  height: 100%;
}

.canvas-studio {
  position: relative;
  background:
    radial-gradient(circle at 45% 15%, rgba(56, 189, 248, 0.07), transparent 30%),
    linear-gradient(180deg, #0a0e16 0%, #080b12 100%);
}

.canvas-studio__header {
  position: relative;
  z-index: 40;
  border-bottom: 1px solid rgba(159, 181, 215, 0.12);
  background: rgba(12, 17, 27, 0.86) !important;
  backdrop-filter: blur(22px);
}

.canvas-studio__stage {
  margin: 10px 12px 12px;
  overflow: hidden;
  border: 1px solid rgba(159, 181, 215, 0.12);
  border-radius: 24px;
  background: #0b1019;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.025), 0 24px 70px rgba(0, 0, 0, 0.26);
}

.canvas-flow {
  background:
    radial-gradient(circle at 50% 40%, rgba(55, 92, 136, 0.08), transparent 36%),
    #0b1019;
}

.canvas-flow .vue-flow__background {
  opacity: 0.38;
}

.canvas-flow .vue-flow__minimap {
  overflow: hidden;
  border: 1px solid rgba(159, 181, 215, 0.14);
  border-radius: 14px;
  background: rgba(12, 17, 27, 0.86);
  backdrop-filter: blur(18px);
}

.canvas-project-loading {
  position: absolute;
  z-index: 35;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: var(--text-primary);
  background: #0b1019;
  text-align: center;
}

.canvas-project-loading p {
  max-width: min(520px, 76vw);
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-project-loading__pulse {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(101, 230, 189, 0.16);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: canvas-project-loading-spin 700ms linear infinite;
}

@keyframes canvas-project-loading-spin {
  to { transform: rotate(360deg); }
}

.canvas-tool-rail,
.canvas-node-menu,
.canvas-zoom-dock,
.canvas-prompt-dock__composer {
  border-color: rgba(159, 181, 215, 0.15) !important;
  background: rgba(17, 24, 37, 0.86) !important;
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(22px);
}

.canvas-tool-rail {
  padding: 7px !important;
  border-radius: 18px !important;
}

.canvas-tool-rail button {
  border-radius: 13px;
}

.canvas-tool-rail__button {
  position: relative;
}

.canvas-tool-rail__tooltip {
  position: absolute;
  top: 50%;
  left: calc(100% + 12px);
  z-index: 40;
  padding: 7px 10px;
  transform: translate(5px, -50%);
  visibility: hidden;
  border: 1px solid rgba(159, 181, 215, 0.22);
  border-radius: 9px;
  background: rgba(8, 14, 24, 0.96);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.36);
  color: #f6f8fc;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
}

.canvas-tool-rail__button:hover > .canvas-tool-rail__tooltip,
.canvas-tool-rail__button:focus-visible > .canvas-tool-rail__tooltip {
  transform: translate(0, -50%);
  visibility: visible;
  opacity: 1;
}

.canvas-node-menu {
  min-width: 190px;
  padding: 8px !important;
  border-radius: 18px !important;
}

.canvas-starter-panel {
  position: absolute;
  top: 46%;
  left: 50%;
  z-index: 8;
  width: min(860px, calc(100% - 220px));
  transform: translate(-50%, -50%);
}

.canvas-starter-panel__heading {
  margin-bottom: 22px;
  text-align: center;
}

.canvas-starter-panel__heading > span {
  display: inline-flex;
  margin-bottom: 10px;
  color: #65e6bd;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.canvas-starter-panel__heading h2 {
  margin: 0;
  color: #f6f8fc;
  font-family: "Avenir Next", "PingFang SC", sans-serif;
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 750;
  letter-spacing: -0.04em;
}

.canvas-starter-panel__heading p {
  margin: 10px 0 0;
  color: rgba(194, 205, 224, 0.7);
  font-size: 14px;
}

.canvas-starter-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.canvas-starter-card {
  min-height: 190px;
  padding: 20px;
  border: 1px solid rgba(159, 181, 215, 0.14);
  border-radius: 20px;
  background:
    linear-gradient(145deg, rgba(26, 38, 57, 0.94), rgba(14, 21, 33, 0.94));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  color: #f6f8fc;
  text-align: left;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.canvas-starter-card:hover {
  transform: translateY(-4px);
  border-color: rgba(101, 230, 189, 0.5);
  box-shadow: 0 24px 75px rgba(0, 0, 0, 0.32);
}

.canvas-starter-card__eyebrow {
  display: block;
  margin-bottom: 28px;
  color: #65e6bd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.canvas-starter-card strong {
  display: block;
  margin-bottom: 8px;
  font-size: 18px;
}

.canvas-starter-card small {
  display: block;
  min-height: 42px;
  color: rgba(194, 205, 224, 0.68);
  font-size: 12px;
  line-height: 1.7;
}

.canvas-starter-card__action {
  display: block;
  margin-top: 18px;
  color: #f6f8fc;
  font-size: 13px;
  font-weight: 650;
}

.canvas-zoom-dock {
  bottom: 18px !important;
  left: 18px !important;
  border-radius: 14px !important;
}

.canvas-prompt-dock {
  bottom: 18px !important;
  max-width: 760px !important;
  transition: max-width 180ms ease;
}

.canvas-prompt-dock--connection-active {
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 24px) scale(0.98) !important;
}

.canvas-prompt-dock--collapsed {
  right: auto !important;
  left: 180px !important;
  max-width: 180px !important;
  padding: 0 !important;
  transform: none !important;
}

.canvas-prompt-dock--director {
  max-width: 980px !important;
}

.h3-director-card {
  margin-bottom: 12px;
  max-height: 56vh;
  overflow: auto;
  padding: 16px;
  border: 1px solid rgba(101, 230, 189, 0.28);
  border-radius: 20px;
  background: rgba(12, 20, 34, 0.96);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(24px);
}

.h3-director-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.h3-director-card__header > div:first-child { display: flex; flex-direction: column; gap: 4px; }
.h3-director-card__header span, .h3-director-card article small { color: #65e6bd; font-size: 11px; }
.h3-director-card__header strong { color: #f6f8fc; font-size: 17px; }
.h3-director-card__chips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.h3-director-card__chips span { padding: 4px 8px; border: 1px solid rgba(101, 230, 189, 0.2); border-radius: 999px; background: rgba(101, 230, 189, 0.08); }
.h3-director-card__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.h3-director-card article { padding: 10px 12px; border: 1px solid rgba(159, 181, 215, 0.12); border-radius: 12px; background: rgba(255, 255, 255, 0.025); }
.h3-director-card article strong, .h3-director-card article p { display: block; margin-top: 5px; color: #eef4ff; font-size: 12px; line-height: 1.55; }
.h3-director-card article p { color: rgba(194, 205, 224, 0.76); }
.h3-director-card__wide { grid-column: 1 / -1; }
.h3-director-card details { margin-top: 10px; color: rgba(194, 205, 224, 0.78); font-size: 12px; }
.h3-director-card details p { margin-top: 8px; line-height: 1.6; }
.h3-director-card__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.h3-director-card__actions button { padding: 8px 13px; border: 1px solid rgba(159, 181, 215, 0.18); border-radius: 10px; color: #dbe8fa; }
.h3-director-card__actions button.primary { border-color: transparent; background: #65e6bd; color: #07131d; font-weight: 700; }
.h3-director-card__actions button:disabled { opacity: 0.5; }
.h3-director-error { margin-bottom: 10px; padding: 10px 12px; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 12px; background: rgba(127, 29, 29, 0.28); color: #fecaca; font-size: 12px; }

.canvas-prompt-dock__launcher {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid rgba(101, 230, 189, 0.24);
  border-radius: 16px;
  background: rgba(17, 24, 37, 0.92);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.32);
  color: #65e6bd;
  text-align: left;
  backdrop-filter: blur(22px);
}

.canvas-prompt-dock__launcher span {
  display: flex;
  flex-direction: column;
}

.canvas-prompt-dock__launcher strong {
  color: #f6f8fc;
  font-size: 13px;
}

.canvas-prompt-dock__launcher small {
  color: rgba(194, 205, 224, 0.62);
  font-size: 10px;
}

.canvas-prompt-dock--collapsed .canvas-prompt-dock__launcher small {
  display: none;
}

.canvas-prompt-dock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -2px 0 8px;
  color: rgba(194, 205, 224, 0.72);
  font-size: 11px;
  font-weight: 650;
}

.canvas-prompt-dock__header button {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 8px;
}

.canvas-prompt-dock__header button:hover {
  background: rgba(159, 181, 215, 0.1);
}

.canvas-prompt-dock__composer {
  padding: 14px !important;
  border-radius: 20px !important;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.canvas-prompt-dock__composer:focus-within {
  border-color: rgba(101, 230, 189, 0.42) !important;
  box-shadow: 0 0 0 1px rgba(101, 230, 189, 0.1), 0 22px 70px rgba(0, 0, 0, 0.32);
}

@media (max-width: 760px) {
  .canvas-studio__stage {
    margin: 4px;
    border-radius: 16px;
  }

  .canvas-tool-rail {
    top: auto !important;
    right: 12px;
    bottom: 220px;
    left: 12px !important;
    flex-direction: row !important;
    transform: none !important;
    overflow-x: auto;
  }

  .canvas-tool-rail__tooltip {
    display: none;
  }

  .canvas-node-menu {
    top: auto !important;
    right: 12px;
    bottom: 286px;
    left: 12px !important;
    transform: none !important;
  }

  .canvas-starter-panel {
    top: 44%;
    width: calc(100% - 32px);
  }

  .canvas-starter-panel__heading h2 {
    font-size: 28px;
  }

  .canvas-starter-panel__grid {
    grid-template-columns: 1fr;
    max-height: 52vh;
    overflow-y: auto;
  }

  .canvas-starter-card {
    min-height: 132px;
  }

  .canvas-starter-card__eyebrow {
    margin-bottom: 14px;
  }

  .canvas-zoom-dock {
    display: none !important;
  }

  .canvas-prompt-dock {
    bottom: 8px !important;
    padding: 0 8px !important;
  }
  .h3-director-card { max-height: 48vh; }
  .h3-director-card__header { flex-direction: column; }
  .h3-director-card__chips { justify-content: flex-start; }
  .h3-director-card__grid { grid-template-columns: 1fr; }
  .h3-director-card__wide { grid-column: auto; }
}
</style>
