<template>
  <!-- Image config node wrapper | 文生图配置节点包裹层 -->
  <div class="image-config-node-wrapper" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <!-- Image config node | 文生图配置节点 -->
    <div
      class="image-config-node canvas-node-scroll-shell nowheel relative bg-[var(--bg-secondary)] rounded-xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div data-testid="image-config-drag-handle" class="flex cursor-grab items-center justify-between border-b border-[var(--border-color)] px-3 py-2 active:cursor-grabbing">
        <span
          v-if="!isEditingLabel"
          @dblclick="startEditLabel"
          class="text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
          title="双击编辑名称"
        >{{ data.label }}</span>
        <input
          v-else
          ref="labelInputRef"
          v-model="editingLabelValue"
          @blur="finishEditLabel"
          @keydown.enter="finishEditLabel"
          @keydown.escape="cancelEditLabel"
          class="nodrag text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1 rounded outline-none border border-blue-500"
        />
        <div class="nodrag flex items-center gap-1">
          <button @click="handleDuplicate" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="复制节点">
            <n-icon :size="14">
              <CopyOutline />
            </n-icon>
          </button>
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="删除节点">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="image-config-node__controls nodrag p-3 space-y-3">
        <!-- Model selector | 模型选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">模型</span>
          <select data-testid="image-model-select" :value="localModel" class="nodrag nowheel max-w-[210px] rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleModelSelect($event.target.value)">
            <option v-for="option in modelOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
          </select>
        </div>

        <!-- Quality selector | 画质选择 -->
        <div v-if="hasQualityOptions" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">画质</span>
          <select data-testid="image-quality-select" :value="localQuality" class="nodrag nowheel rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleQualitySelect($event.target.value)">
            <option v-for="option in qualityOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
          </select>
        </div>

        <!-- Size selector | 尺寸选择 -->
        <div v-if="hasSizeOptions" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">尺寸</span>
          <div class="flex items-center gap-2">
            <select data-testid="image-size-select" :value="localSize" class="nodrag nowheel rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleSizeSelect($event.target.value)">
              <option v-for="option in sizeOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
            </select>
          </div>
        </div>

        <!-- Model tips | 模型提示 -->
        <div v-if="currentModelConfig?.tips" class="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-2 py-1">
          💡 {{ currentModelConfig.tips }}
        </div>
        <div v-if="nativeImageSettings" class="space-y-2 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-2" data-testid="local-image-native-settings">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-cyan-300">{{ currentModelConfig?.label }} 原生参数</span>
            <span class="text-[var(--text-tertiary)]">ComfyUI</span>
          </div>
          <textarea v-if="currentModelConfig?.supportsNegativePrompt" v-model="imageNegativePrompt" rows="2" class="control w-full resize-none text-xs" placeholder="负面提示词" @blur="persistNativeImageSettings" />
          <div v-else class="rounded-md bg-slate-950/40 px-2 py-1 text-[11px] text-[var(--text-tertiary)]">该蒸馏模型不使用负面提示词。</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="space-y-1"><span class="text-[var(--text-secondary)]">步数</span><input v-model.number="imageSteps" class="control w-full" type="number" :min="nativeDefaults.stepsMin || 1" :max="nativeDefaults.stepsMax || 60" :disabled="currentModelConfig?.fixedSteps" @change="persistNativeImageSettings" /></label>
            <label class="space-y-1"><span class="text-[var(--text-secondary)]">CFG</span><input v-model.number="imageCfg" class="control w-full" type="number" :min="nativeDefaults.cfgMin || 0.1" :max="nativeDefaults.cfgMax || 20" step="0.5" :disabled="currentModelConfig?.fixedCfg" @change="persistNativeImageSettings" /></label>
          </div>
          <label class="block space-y-1 text-xs"><span class="text-[var(--text-secondary)]">采样器</span><select v-model="imageSampler" class="control w-full" @change="persistNativeImageSettings"><option v-for="sampler in currentModelConfig?.samplers || []" :key="sampler.key" :value="sampler.key">{{ sampler.label }}</option></select></label>
          <label class="block space-y-1 text-xs"><span class="text-[var(--text-secondary)]">随机种子（-1 每次随机）</span><input v-model.number="imageSeed" class="control w-full" type="number" min="-1" max="2147483647" @change="persistNativeImageSettings" /></label>
        </div>
        <div v-if="!isConfigured" class="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
          当前模型所属 API 尚未配置，请先在右上角“API 设置”中补充密钥。
        </div>

        <div
          v-if="isBackgroundReplaceMode"
          class="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-[var(--text-primary)]">按参考图更换背景</div>
              <div class="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                锁定人物，只参考环境、家具、色调和光线。
              </div>
            </div>
            <span class="rounded-full bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-300">局部重绘</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="relative min-h-[116px] overflow-hidden rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)] text-left transition-colors hover:border-cyan-400"
              @click="subjectFileInputRef?.click()"
            >
              <img
                v-if="localSubjectImage"
                :src="localSubjectImage"
                class="absolute inset-0 h-full w-full object-cover"
                alt="主体图"
              />
              <div class="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-xs text-white">
                主体图 · {{ localSubjectImage ? '点击替换' : '点击上传' }}
              </div>
              <div v-if="!localSubjectImage" class="flex h-full min-h-[116px] items-center justify-center text-xs text-[var(--text-tertiary)]">
                人物原图
              </div>
            </button>
            <button
              type="button"
              class="relative min-h-[116px] overflow-hidden rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)] text-left transition-colors hover:border-cyan-400"
              @click="backgroundFileInputRef?.click()"
            >
              <img
                v-if="localBackgroundReferenceImage"
                :src="localBackgroundReferenceImage"
                class="absolute inset-0 h-full w-full object-cover"
                alt="背景参考图"
              />
              <div class="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-xs text-white">
                背景参考图 · {{ localBackgroundReferenceImage ? '点击替换' : '点击上传' }}
              </div>
              <div v-if="!localBackgroundReferenceImage" class="flex h-full min-h-[116px] items-center justify-center px-2 text-center text-xs text-[var(--text-tertiary)]">
                宿舍、办公室等环境图
              </div>
            </button>
          </div>

          <input
            ref="subjectFileInputRef"
            data-testid="background-replace-subject-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            @change="handleBackgroundFileUpload('subject', $event)"
          />
          <input
            ref="backgroundFileInputRef"
            data-testid="background-replace-reference-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            @change="handleBackgroundFileUpload('background', $event)"
          />

          <textarea
            v-model="backgroundInstruction"
            rows="3"
            class="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs leading-5 text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-cyan-400"
            placeholder="例如：换成中国大学四人宿舍，保留人物、桌面物品和拍摄角度"
            @blur="persistBackgroundInputs"
          />

          <div
            v-if="!backgroundReadiness.ready"
            class="rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300"
          >
            {{ backgroundReadiness.message }}
          </div>
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          v-if="!isBackgroundReplaceMode"
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]">
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedPrompts.length > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompts.length > 0 ? `${connectedPrompts.length}个` : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedRefImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ connectedRefImages.length > 0 ? `${connectedRefImages.length}张` : '○' }}
          </span>
        </div>

        <!-- Generate button | 生成按钮 -->
        <button
          v-if="isBackgroundReplaceMode"
          @click="handleGenerate('new')"
          :disabled="loading || !isConfigured || !backgroundReadiness.ready"
          class="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <n-icon :size="15"><ColorWandOutline /></n-icon>
            按参考图换背景
          </template>
        </button>
        <div v-else-if="hasConnectedImageWithContent" class="flex gap-2">
          <!-- Create new (primary) | 新建节点（主按钮） -->
          <button @click="handleGenerate('new')" :disabled="loading || !isConfigured"
            class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><AddOutline /></n-icon>
              新建生成
            </template>
          </button>
          <!-- Replace existing (secondary) | 替换现有（次按钮） -->
          <button @click="handleGenerate('replace')" :disabled="loading || !isConfigured"
            class="flex-shrink-0 flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><RefreshOutline /></n-icon>
              替换
            </template>
          </button>
        </div>
        <button v-else @click="handleGenerate('auto')" :disabled="loading || !isConfigured"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <span
              class="text-[var(--accent-color)] bg-white rounded-full w-4 h-4 flex items-center justify-center text-xs">◆</span>
            立即生成
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>

        <!-- Generated images preview | 生成图片预览 -->
        <!-- <div v-if="generatedImages.length > 0" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
        <div class="grid grid-cols-2 gap-2 max-w-[240px]">
          <div 
            v-for="(img, idx) in generatedImages" 
            :key="idx"
            class="aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)] max-w-[110px]"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
          </div>
        </div>
      </div> -->
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" style="width: 12px; height: 12px;" />
      <NodeHandleMenu :nodeId="id" nodeType="imageConfig" :visible="showHandleMenu" :operations="operations" @select="handleSelect" />
    </div>

  </div>
</template>

<script setup>
/**
 * Image config node component | 文生图配置节点组件
 * Configuration panel for text-to-image generation with API integration
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, CopyOutline, TrashOutline, RefreshOutline, AddOutline, ImageOutline, CreateOutline, ColorWandOutline } from '@vicons/ionicons5'
import { useImageGeneration } from '../../hooks'
import { updateNode, addNode, addEdge, nodes, edges, duplicateNode, removeNode } from '../../stores/canvas'
import NodeHandleMenu from './NodeHandleMenu.vue'
import { useModelStore } from '../../stores/pinia'
import { getModelSizeOptions, getModelQualityOptions, getModelConfig, DEFAULT_IMAGE_MODEL } from '../../stores/models'
import { normalizeImageModelKey } from '../../config/models'
import { parseMentions } from '../../hooks/useNodeRef'
import {
  DEFAULT_BACKGROUND_INSTRUCTION,
  buildBackgroundReplacePayload,
  getBackgroundReplaceReadiness
} from '../../utils/backgroundReplace'
import {
  clearGeneratedImageForRegeneration,
  normalizeGeneratedImageResult
} from '../../utils/generatedImageHandoff'

// 使用 Pinia store 获取模型选项（根据渠道过滤）
const modelStore = useModelStore()

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config state | API 配置状态
const isConfigured = computed(() => modelStore.isCurrentProviderConfigured)

// Image generation hook | 图片生成 hook
const { loading, error, images: generatedImages, generate } = useImageGeneration()

// Local state | 本地状态
const showHandleMenu = ref(false)
const localModel = ref(normalizeImageModelKey(props.data?.model))
const localSize = ref(props.data?.size || '2048x2048')
const localQuality = ref(props.data?.quality || 'standard')
const currentModelConfig = computed(() => getModelConfig(localModel.value))
const nativeDefaults = computed(() => currentModelConfig.value?.defaultParams || {})
const nativeImageSettings = computed(() => currentModelConfig.value?.nativeParams === true)
const imageNegativePrompt = ref(props.data?.negativePrompt ?? nativeDefaults.value.negativePrompt ?? '')
const imageSteps = ref(props.data?.steps ?? nativeDefaults.value.steps ?? 30)
const imageCfg = ref(props.data?.cfg ?? nativeDefaults.value.cfg ?? 4)
const imageSampler = ref(props.data?.samplerName ?? nativeDefaults.value.samplerName ?? 'euler')
const imageScheduler = ref(props.data?.scheduler ?? nativeDefaults.value.scheduler ?? 'simple')
const imageSeed = ref(props.data?.seed ?? nativeDefaults.value.seed ?? -1)
const isBackgroundReplaceMode = computed(() => props.data?.editMode === 'background_replace')
const localSubjectImage = ref(props.data?.subjectImage || '')
const localBackgroundReferenceImage = ref(props.data?.backgroundReferenceImage || '')
const backgroundInstruction = ref(
  props.data?.backgroundInstruction || DEFAULT_BACKGROUND_INSTRUCTION
)
const subjectFileInputRef = ref(null)
const backgroundFileInputRef = ref(null)

const backgroundReadiness = computed(() => getBackgroundReplaceReadiness({
  subjectImage: localSubjectImage.value,
  backgroundReferenceImage: localBackgroundReferenceImage.value
}))

const applyNativeDefaults = (config) => {
  const defaults = config?.defaultParams || {}
  imageNegativePrompt.value = defaults.negativePrompt || ''
  imageSteps.value = defaults.steps ?? 30
  imageCfg.value = defaults.cfg ?? 4
  imageSampler.value = defaults.samplerName || 'euler'
  imageScheduler.value = defaults.scheduler || 'simple'
  imageSeed.value = defaults.seed ?? -1
}

const persistNativeImageSettings = () => {
  const defaults = nativeDefaults.value
  const minSteps = Number(defaults.stepsMin ?? 1)
  const maxSteps = Number(defaults.stepsMax ?? 60)
  const minCfg = Number(defaults.cfgMin ?? 0.1)
  const maxCfg = Number(defaults.cfgMax ?? 20)
  imageSteps.value = Math.max(minSteps, Math.min(maxSteps, Number(imageSteps.value) || Number(defaults.steps) || 30))
  imageCfg.value = Math.max(minCfg, Math.min(maxCfg, Number(imageCfg.value) || Number(defaults.cfg) || 4))
  const parsedSeed = Number.parseInt(imageSeed.value, 10)
  imageSeed.value = Number.isFinite(parsedSeed) ? Math.max(-1, Math.min(2147483647, parsedSeed)) : -1
  updateNode(props.id, {
    negativePrompt: currentModelConfig.value?.supportsNegativePrompt ? imageNegativePrompt.value : '',
    steps: imageSteps.value,
    cfg: imageCfg.value,
    samplerName: imageSampler.value,
    scheduler: imageScheduler.value,
    seed: imageSeed.value
  })
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(file)
})

const persistBackgroundInputs = () => {
  updateNode(props.id, {
    subjectImage: localSubjectImage.value,
    backgroundReferenceImage: localBackgroundReferenceImage.value,
    backgroundInstruction: backgroundInstruction.value
  })
}

const handleBackgroundFileUpload = async (role, event) => {
  const input = event?.target
  const file = input?.files?.[0]
  if (!file) return
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
    window.$message?.warning('仅支持 JPG、PNG、WebP 图片')
    input.value = ''
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    window.$message?.warning('单张图片不能超过 20MB')
    input.value = ''
    return
  }

  try {
    const dataUrl = await fileToDataUrl(file)
    if (role === 'subject') {
      localSubjectImage.value = dataUrl
    } else {
      localBackgroundReferenceImage.value = dataUrl
    }
    persistBackgroundInputs()
    window.$message?.success(role === 'subject' ? '主体图已更新' : '背景参考图已添加')
  } catch (err) {
    window.$message?.error(err.message || '图片读取失败')
  } finally {
    input.value = ''
  }
}

// Label editing state | Label 编辑状态
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// ImageConfig node menu operations | 图片配置节点菜单操作
const operations = [
  // { type: 'imageConfig', label: '图生图', icon: ImageOutline, action: 'imageConfig_imageConfig' }
]

// Handle menu select | 处理菜单选择
const handleSelect = (item) => {
  const action = item.action

  if (action === 'imageConfig_imageConfig') {
    // Image-to-image (create new image node for editing) | 图生图（创建新图片节点用于编辑）
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0

    // Create new image node for editing
    const imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY }, {
      label: '图片编辑'
    })

    // Connect current config to new image node
    addEdge({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })

    setTimeout(() => updateNodeInternals(imageNodeId), 50)
    window.$message?.success('已创建图片编辑节点')
  }
}

const activateModelProvider = (modelKey) => {
  const config = getModelConfig(modelKey)
  const supportedProviders = Array.isArray(config?.provider) ? config.provider : []
  if (supportedProviders.length > 0 && !supportedProviders.includes(modelStore.currentProvider)) {
    modelStore.setProvider(supportedProviders[0])
  }
}

// Model options from Pinia store (filtered by provider) | 从 Pinia store 获取模型选项（根据渠道过滤）
const modelOptions = computed(() => modelStore.allImageModelOptions)

// Display model name | 显示模型名称
const displayModelName = computed(() => {
  const model = modelOptions.value.find(m => m.key === localModel.value)
  // 如果当前模型不在选项中，尝试从 allImageModels 找到
  if (!model) {
    const allModel = modelStore.allImageModels.find(m => m.key === localModel.value)
    return allModel?.label || localModel.value || '选择模型'
  }
  return model?.label || localModel.value || '选择模型'
})

// Quality options based on model | 基于模型的画质选项
const qualityOptions = computed(() => {
  return getModelQualityOptions(localModel.value)
})

// Check if model has quality options | 检查模型是否有画质选项
const hasQualityOptions = computed(() => {
  return qualityOptions.value && qualityOptions.value.length > 0
})

// Display quality | 显示画质
const displayQuality = computed(() => {
  const option = qualityOptions.value.find(o => o.key === localQuality.value)
  return option?.label || '标准画质'
})

// Size options based on model and quality | 基于模型和画质的尺寸选项
const sizeOptions = computed(() => {
  return getModelSizeOptions(localModel.value, localQuality.value)
})

// Check if model has size options | 检查模型是否有尺寸选项
const hasSizeOptions = computed(() => {
  const config = getModelConfig(localModel.value)
  return config?.sizes && config.sizes.length > 0
})

// Display size with label | 显示尺寸（带标签）
const displaySize = computed(() => {
  const option = sizeOptions.value.find(o => o.key === localSize.value)
  return option?.label || localSize.value
})

// Initialize on mount | 挂载时初始化
onMounted(() => {
  // 检查当前模型是否在可用模型列表中
  const availableModels = modelStore.allImageModels
  const isModelAvailable = availableModels.some(m => m.key === localModel.value)

  if (!localModel.value || !isModelAvailable) {
    const storedModel = normalizeImageModelKey(modelStore.selectedImageModel)
    localModel.value = availableModels.some(model => model.key === storedModel)
      ? storedModel
      : DEFAULT_IMAGE_MODEL
    applyNativeDefaults(getModelConfig(localModel.value))
    updateNode(props.id, { model: localModel.value, ...nativeDefaults.value })
  } else if (props.data?.model !== localModel.value) {
    updateNode(props.id, { model: localModel.value })
  }
})

// 解析 textNode 内容中的 @ 引用，转换为简短引用（如 图 1）并收集图片
const resolveTextMentionsForImage = (textNode) => {
  const content = textNode.data?.content || ''
  const mentions = parseMentions(content)

  if (mentions.length === 0) {
    return { resolvedContent: content, refImages: [] }
  }

  // 收集引用的图片节点
  const imageMentions = []
  for (const mention of mentions) {
    const referencedNode = nodes.value.find(n => n.id === mention.nodeId)
    if (referencedNode?.type === 'image') {
      const imageData = referencedNode.data?.base64 || referencedNode.data?.url
      if (imageData) {
        imageMentions.push({
          order: mention.order,
          nodeId: mention.nodeId,
          imageData
        })
      }
    }
  }

  if (imageMentions.length === 0) {
    return { resolvedContent: content, refImages: [] }
  }

  // 按出现顺序排序
  imageMentions.sort((a, b) => a.order - b.order)

  // 替换 @[nodeId] 为按顺序的 "图1"、"图2" 等
  let resolvedContent = content
  for (let i = 0; i < imageMentions.length; i++) {
    const mention = imageMentions[i]
    const placeholder = `@[${mention.nodeId}]`
    // 按排序后的索引替换为 "图1"、"图2" 等
    resolvedContent = resolvedContent.replace(placeholder, `图${i + 1}`)
  }

  // 返回解析后的内容和图片数组（按引用顺序）
  const refImages = imageMentions.map(m => m.imageData)

  return { resolvedContent, refImages }
}

// Computed connected prompts (sorted by order) | 计算连接的提示词（按顺序排列）
const connectedPrompts = computed(() => {
  return getConnectedInputs().prompts
})

// Computed connected reference images | 计算连接的参考图
const connectedRefImages = computed(() => {
  return getConnectedInputs().refImages
})

// 已连接的文本节点 ID 列表（用于 @ 提及时过滤）
const connectedTextNodeIds = computed(() => {
  const incomingEdges = edges.value.filter(e => e.target === props.id)
  const connectedIds = []
  for (const edge of incomingEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'text') {
      connectedIds.push(sourceNode.id)
    }
  }
  return connectedIds
})

// Get connected nodes | 获取连接的节点
const getConnectedInputs = () => {
  // 1. First check @ mentions | 首先检查 @ 引用
  // Only check connected TextNodes | 只检查已连接的 TextNode
  const textNodes = nodes.value.filter(n => n.type === 'text' && connectedTextNodeIds.value.includes(n.id))
  const mentionsPrompts = []
  const mentionsRefImages = []

  for (const textNode of textNodes) {
    const { resolvedContent, refImages: nodeRefImages } = resolveTextMentionsForImage(textNode)

    // 如果有解析出图片引用
    if (nodeRefImages.length > 0) {
      // 添加解析后的提示词内容
      mentionsPrompts.push({
        order: mentionsPrompts.length,
        content: resolvedContent,
        nodeId: textNode.id
      })

      // 添加参考图
      for (const imageData of nodeRefImages) {
        mentionsRefImages.push({
          order: mentionsRefImages.length,
          imageData,
          nodeId: textNode.id
        })
      }
    }
  }

  // 2. Get edge-connected ImageNodes | 获取边连接的 ImageNode
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const edgeRefImages = [] // Array of { order, imageData, nodeId } | 参考图数组

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'image') {
      // Prefer base64, fallback to url | 优先使用 base64，回退到 url
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (imageData) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        // Add offset of @ mentions count | 加上 @ 提及图片数量的偏移
        const baseOrder = edge.data?.imageOrder || 1
        const order = mentionsRefImages.length + baseOrder
        edgeRefImages.push({ order, imageData, nodeId: sourceNode.id })
      }
    }
  }

  // 3. Merge and sort refImages | 合并并排序参考图
  // Combine @ mentions refImages and edge-connected refImages | 合并 @ 提及和边连接的图片
  const allRefImages = [...mentionsRefImages, ...edgeRefImages]
  // Sort by order | 按顺序排序
  allRefImages.sort((a, b) => a.order - b.order)
  const sortedRefImages = allRefImages.map(r => r.imageData)

  // 4. If there are @ mentions, use them | 如果有 @ 提及，使用它们
  if (mentionsPrompts.length > 0) {
    // Sort prompts by order | 按顺序排序提示词
    mentionsPrompts.sort((a, b) => a.order - b.order)
    const combinedPrompt = mentionsPrompts.map(p => p.content).join('\n\n')

    return {
      prompt: combinedPrompt,
      prompts: mentionsPrompts,
      refImages: sortedRefImages,
      refImagesWithOrder: allRefImages,
      fromMentions: true
    }
  }

  // 5. Fallback to edge connections | 降级到边的连接
  // (only prompts, no @ mentions) （只有提示词，没有 @ 提及）
  const prompts = [] // Array of { order, content } | 提示词数组

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      const content = sourceNode.data?.content || ''
      if (content) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        const order = edge.data?.promptOrder || 1
        prompts.push({ order, content, nodeId: sourceNode.id })
      }
    } else if (sourceNode.type === 'llmConfig') {
      // LLM node output as prompt | LLM 节点输出作为提示词
      const content = sourceNode.data?.outputContent || ''
      if (content) {
        const order = edge.data?.promptOrder || 1
        prompts.push({ order, content, nodeId: sourceNode.id })
      }
    }
    // Note: ImageNode handling moved to step 2 above | 注意：ImageNode 处理已移至步骤 2
  }

  // Sort prompts by order and concatenate | 按顺序排序并拼接
  prompts.sort((a, b) => a.order - b.order)
  const combinedPrompt = prompts.map(p => p.content).join('\n\n')

  // Use edge-connected refImages (already sorted above) | 使用边连接的参考图（已在上面排序）
  return { prompt: combinedPrompt, prompts, refImages: sortedRefImages, refImagesWithOrder: allRefImages, fromMentions: false }
}

// Handle model selection | 处理模型选择
const handleModelSelect = (key) => {
  const normalizedKey = normalizeImageModelKey(key)
  localModel.value = normalizedKey
  const config = getModelConfig(normalizedKey)
  activateModelProvider(normalizedKey)
  if (config?.nativeParams) applyNativeDefaults(config)

  // 同步 Quality 到模型默认值
  if (config?.defaultParams?.quality) {
    localQuality.value = config.defaultParams.quality
  }

  // 同步 Size 到模型默认值
  const newSizeOptions = getModelSizeOptions(normalizedKey, localQuality.value)
  let defaultSize = config?.defaultParams?.size

  if (!defaultSize && newSizeOptions.length > 0) {
    // 备用逻辑：查找 2048 或最接近的尺寸
    defaultSize = newSizeOptions.find(o => o.key === '2048x2048')?.key
      || newSizeOptions.find(o => o.key.includes('1024'))?.key
      || newSizeOptions[0].key
  }

  localSize.value = defaultSize

  // 更新节点数据
  updateNode(props.id, {
    model: normalizedKey,
    quality: localQuality.value,
    size: defaultSize,
    ...(config?.nativeParams ? {
      negativePrompt: config.supportsNegativePrompt ? imageNegativePrompt.value : '',
      steps: imageSteps.value,
      cfg: imageCfg.value,
      samplerName: imageSampler.value,
      scheduler: imageScheduler.value,
      seed: imageSeed.value
    } : {})
  })
}

// Handle quality selection | 处理画质选择
const handleQualitySelect = (quality) => {
  localQuality.value = quality
  // Update size to first option of new quality | 更新尺寸为新画质的第一个选项
  const newSizeOptions = getModelSizeOptions(localModel.value, quality)
  if (newSizeOptions.length > 0) {
    const defaultSize = quality === '4k' ? newSizeOptions.find(o => o.key.includes('4096'))?.key || newSizeOptions[4]?.key : newSizeOptions[4]?.key
    localSize.value = defaultSize || newSizeOptions[0].key
    updateNode(props.id, { quality, size: localSize.value })
  } else {
    updateNode(props.id, { quality })
  }
}

// Handle size selection | 处理尺寸选择
const handleSizeSelect = (size) => {
  localSize.value = size
  updateNode(props.id, { size })
}

// Update size from manual input | 更新手动输入的尺寸
const updateSize = () => {
  updateNode(props.id, { size: localSize.value })
}

// Created image node ID | 创建的图片节点 ID
const createdImageNodeId = ref(null)

// Find connected output image node | 查找已连接的输出图片节点
const findConnectedOutputImageNode = (onlyEmpty = true) => {
  // Find edges where this node is the source | 查找以当前节点为源的边
  const outputEdges = edges.value.filter(e => e.source === props.id)
  
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(n => n.id === edge.target)
    if (targetNode?.type === 'image') {
      if (onlyEmpty) {
        // Check if target is an image node with empty or no url | 检查目标是否为空白图片节点
        if (!targetNode.data?.url || targetNode.data?.url === '') {
          return targetNode.id
        }
      } else {
        // Return any connected image node | 返回任意连接的图片节点
        return targetNode.id
      }
    }
  }
  return null
}

// Check if there's a connected image node with content | 检查是否有已连接且有内容的图片节点
const hasConnectedImageWithContent = computed(() => {
  const outputEdges = edges.value.filter(e => e.source === props.id)
  
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(n => n.id === edge.target)
    if (targetNode?.type === 'image' && targetNode.data?.url && targetNode.data.url !== '') {
      return true
    }
  }
  return false
})

// Handle generate action | 处理生成操作
// mode: 'auto' = 自动判断, 'replace' = 替换现有, 'new' = 新建节点
const handleGenerate = async (mode = 'auto') => {
  activateModelProvider(localModel.value)
  const { prompt, prompts, refImages, refImagesWithOrder } = getConnectedInputs()

  if (isBackgroundReplaceMode.value && !backgroundReadiness.value.ready) {
    window.$message?.warning(backgroundReadiness.value.message)
    return
  }

  if (!isBackgroundReplaceMode.value && !prompt && refImages.length === 0) {
    window.$message?.warning('请连接文本节点（提示词）或图片节点（参考图）')
    return
  }
  
  // Log prompt order for debugging | 记录提示词顺序用于调试
  if (prompts.length > 1) {
    console.log('[ImageConfigNode] 拼接提示词顺序:', prompts.map(p => `${p.order}: ${p.content.substring(0, 20)}...`))
  }
  
  // Log image order for debugging | 记录图片顺序用于调试
  if (refImagesWithOrder && refImagesWithOrder.length > 1) {
    console.log('[ImageConfigNode] 参考图顺序:', refImagesWithOrder.map(r => `${r.order}: ${r.nodeId}`))
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    return
  }

  let imageNodeId = null
  
  if (mode === 'replace') {
    // Replace mode: find any connected image node | 替换模式：查找任意连接的图片节点
    imageNodeId = findConnectedOutputImageNode(false)
    if (imageNodeId) {
      updateNode(imageNodeId, clearGeneratedImageForRegeneration())
    }
  } else if (mode === 'new') {
    // New mode: always create new node | 新建模式：始终创建新节点
    imageNodeId = null
  } else {
    // Auto mode: check for empty connected node first | 自动模式：先检查空白连接节点
    imageNodeId = findConnectedOutputImageNode(true)
    if (imageNodeId) {
      updateNode(imageNodeId, clearGeneratedImageForRegeneration())
    }
  }
  
  if (!imageNodeId) {
    // Get current node position | 获取当前节点位置
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0
    
    // Calculate Y offset if creating new node alongside existing | 如果是新建节点，计算Y偏移
    let yOffset = 0
    if (mode === 'new') {
      const outputEdges = edges.value.filter(e => e.source === props.id)
      yOffset = outputEdges.length * 280 // Stack below existing outputs | 在现有输出下方堆叠
    }

    // Create image node with loading state | 创建带加载状态的图片节点
    imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY + yOffset }, {
      url: '',
      loading: true,
      label: '图像生成结果'
    })

    // Auto-connect imageConfig → image | 自动连接 生图配置 → 图片
    addEdge({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }
  
  createdImageNodeId.value = imageNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(imageNodeId)
  }, 50)

  try {
    // Build request params | 构建请求参数
    const params = isBackgroundReplaceMode.value
      ? buildBackgroundReplacePayload({
          model: localModel.value,
          size: localSize.value,
          quality: localQuality.value,
          subjectImage: localSubjectImage.value,
          backgroundReferenceImage: localBackgroundReferenceImage.value,
          instruction: backgroundInstruction.value
        })
      : {
          model: localModel.value,
          prompt: prompt,
          size: localSize.value,
          quality: localQuality.value,
          n: 1,
          ...(nativeImageSettings.value ? {
            negative_prompt: currentModelConfig.value?.supportsNegativePrompt ? imageNegativePrompt.value : '',
            steps: imageSteps.value,
            cfg: imageCfg.value,
            sampler_name: imageSampler.value,
            scheduler: imageScheduler.value,
            seed: imageSeed.value
          } : {}),
          ...(refImages.length > 0 ? { image: refImages } : {})
        }

    const result = await generate(params)

    // Update image node with generated URL | 更新图片节点 URL
    if (result && result.length > 0) {
      const generated = normalizeGeneratedImageResult(result[0])
      updateNode(imageNodeId, {
        url: generated.url,
        publicUrl: generated.publicUrl,
        assetRole: generated.assetRole,
        loading: false,
        label: isBackgroundReplaceMode.value ? '背景替换结果' : '文生图',
        model: localModel.value,
        editMode: isBackgroundReplaceMode.value ? 'background_replace' : undefined,
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: imageNodeId })
    }
    window.$message?.success('图片生成成功')
  } catch (err) {
    // Update node to show error | 更新节点显示错误
    updateNode(imageNodeId, {
      loading: false,
      error: err.message || '生成失败',
      updatedAt: Date.now()
    })
    window.$message?.error(err.message || '图片生成失败')
  }
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('节点已复制')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || ''
  isEditingLabel.value = true
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

// Finish editing label | 完成编辑 label
const finishEditLabel = () => {
  const newLabel = editingLabelValue.value.trim()
  if (newLabel && newLabel !== props.data?.label) {
    updateNode(props.id, { label: newLabel })
  }
  isEditingLabel.value = false
}

// Cancel editing label | 取消编辑 label
const cancelEditLabel = () => {
  isEditingLabel.value = false
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
  window.$message?.success('节点已删除')
}

// 监听模型变化，同步 Quality 和 Size
watch(() => props.data?.model, (newModel) => {
  const normalizedModel = normalizeImageModelKey(newModel)
  if (normalizedModel && normalizedModel !== localModel.value) {
    localModel.value = normalizedModel
    const config = getModelConfig(normalizedModel)
    if (config?.nativeParams) applyNativeDefaults(config)

    // 同步 Quality
    if (config?.defaultParams?.quality) {
      localQuality.value = config.defaultParams.quality
    }

    // 同步 Size
    if (config?.defaultParams?.size) {
      localSize.value = config.defaultParams.size
    }
  }
})

// 修复 Vue Flow visibility: hidden 问题
watch(() => props.data, () => {
  nextTick(() => {
    updateNodeInternals(props.id)
  })
}, { deep: true })

// Watch for auto-execute flag | 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !loading.value) {
      // Clear the flag first to prevent re-triggering | 先清除标志防止重复触发
      updateNode(props.id, { autoExecute: false })
      // Delay to ensure node connections are established | 延迟确保节点连接已建立
      setTimeout(() => {
        handleGenerate()
      }, 100)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.image-config-node-wrapper {
  position: relative;
  padding-top: 20px;
}

.image-config-node {
  cursor: default;
  position: relative;
}

.control {
  border: 1px solid var(--border-color);
  border-radius: .5rem;
  background: var(--bg-tertiary);
  padding: .45rem .55rem;
  color: var(--text-primary);
}
</style>
