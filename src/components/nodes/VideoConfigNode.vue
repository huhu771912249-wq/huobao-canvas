<template>
  <!-- Video config node wrapper | 视频配置节点包裹层 -->
  <div class="video-config-node-wrapper relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <!-- Video config node | 视频配置节点 -->
    <div ref="nodeRootRef" class="video-config-node nowheel flex w-[560px] max-w-[560px] flex-col overflow-hidden rounded-xl border bg-[var(--bg-secondary)] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'"
      :style="expandedNodeStyle">
      <!-- Header | 头部 -->
      <div ref="nodeHeaderRef" data-testid="video-config-sticky-header" class="z-20 flex shrink-0 items-center justify-between rounded-t-xl border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2">
        <span
          v-if="!isEditingLabel"
          @dblclick="startEditLabel"
          class="text-sm font-medium text-[var(--text-secondary)] cursor-text hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
          title="双击编辑名称"
        >{{ data.label || '视频生成' }}</span>
        <input
          v-else
          ref="labelInputRef"
          v-model="editingLabelValue"
          @blur="finishEditLabel"
          @keydown.enter="finishEditLabel"
          @keydown.escape="cancelEditLabel"
          class="text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1 rounded outline-none border border-blue-500"
        />
        <div class="nodrag flex items-center gap-1">
          <button
            data-testid="video-node-expand-toggle"
            type="button"
            class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            :title="isExpanded ? '收起节点' : '展开全部设置'"
            :aria-label="isExpanded ? '收起节点' : '展开全部设置'"
            @click="toggleExpanded"
          >
            <n-icon :size="14">
              <ContractOutline v-if="isExpanded" />
              <ExpandOutline v-else />
            </n-icon>
          </button>
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
      <div data-testid="video-config-scroll-content" class="video-config-node__scroll-content nowheel min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        <!-- Model selector | 模型选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">模型</span>
          <select data-testid="video-model-select" :value="localModel" class="nodrag nowheel max-w-[230px] rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleModelSelect($event.target.value)">
            <option v-for="option in modelOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
          </select>
        </div>

        <div class="space-y-2 rounded-lg border border-[var(--border-color)] p-2">
          <div class="text-xs text-[var(--text-secondary)]">清晰度</div>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="option in qualityOptions"
              :key="option.mode"
              type="button"
              class="rounded-lg border px-2 py-2 text-left text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              :class="localQualityMode === option.mode ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
              :disabled="option.mode !== 'fast' && Boolean(qualityUnavailableReason)"
              @click="handleQualitySelect(option.mode)"
            >
              <b class="block text-xs">{{ option.label }}</b><span>{{ option.description }}</span>
            </button>
          </div>
          <div v-if="qualityUnavailableReason" class="text-[10px] text-amber-400">高质量不可用：{{ qualityUnavailableReason }}</div>
          <div class="grid grid-cols-3 gap-1 text-[10px] text-[var(--text-secondary)]">
            <div><b class="block text-[var(--text-primary)]">原生分辨率</b>{{ nativeVideoSize.width }}×{{ nativeVideoSize.height }}</div>
            <div><b class="block text-[var(--text-primary)]">AI 超分</b>{{ qualityProfile.upscaler ? upscaleStatusLabel : '未启用' }}</div>
            <div><b class="block text-[var(--text-primary)]">最终输出</b>{{ actualOutputLabel }}</div>
          </div>
          <div class="text-[10px] text-[var(--text-secondary)]">输入图片会按 {{ nativeVideoSize.width }}×{{ nativeVideoSize.height }} 等比裁切或填充（crop_or_pad），不会拉伸。LTX 2.3 支持原生 latent 2× 放大。</div>
          <div class="text-[10px] text-[var(--text-secondary)]">TeaCache / KJ / EasyCache 仅保留能力提示，待 A/B 验证后再启用。</div>
        </div>

        <div v-if="localModel === 'ltx-2.3'" class="space-y-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[var(--text-primary)]">LTX 2.3 原生语音</span>
            <span class="text-[10px] text-cyan-400">48kHz · 双声道</span>
          </div>
          <p class="text-[11px] leading-relaxed text-[var(--text-secondary)]">使用已连接的提示词生成讲话、音乐或环境声。</p>
          <button type="button" :disabled="audioGenerating || !connectedPrompt" class="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40" @click="handleGenerateAudio">
            {{ audioGenerating ? '语音生成中…' : '生成原生语音' }}
          </button>
          <div v-if="audioError" class="text-[11px] text-red-400">{{ audioError }}</div>
          <audio v-if="audioUrl" :src="audioUrl" controls class="h-9 w-full" />
          <a v-if="audioUrl" :href="audioUrl" download class="block text-center text-[11px] text-cyan-400 hover:underline">下载 FLAC</a>
          <div class="border-t border-cyan-400/20 pt-2 space-y-2">
            <div class="text-[11px] font-medium text-[var(--text-primary)]">合成带声音和字幕的 MP4</div>
            <input v-model.trim="compositionVideoUrl" class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1.5 text-[11px] text-[var(--text-primary)]" placeholder="视频公网地址（连接输出节点时自动读取）" />
            <textarea v-model="subtitleText" rows="3" class="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1.5 text-[11px] text-[var(--text-primary)]" placeholder="输入字幕，每行一句；系统按音频时长生成时间轴" />
            <button type="button" :disabled="compositionGenerating || !audioUrl || !effectiveCompositionVideoUrl || !subtitleText.trim()" class="w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" @click="handleComposeMedia">
              {{ compositionGenerating ? '正在合成…' : '生成最终 MP4' }}
            </button>
            <div v-if="compositionError" class="text-[11px] text-red-400">{{ compositionError }}</div>
            <video v-if="compositionUrl" :src="compositionUrl" controls class="w-full rounded-lg" />
            <a v-if="compositionUrl" :href="compositionUrl" download class="block text-center text-[11px] text-violet-400 hover:underline">下载带音频字幕 MP4</a>
          </div>
        </div>

        <template v-if="localModel === 'minimax-h3'">
          <section class="space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <div class="flex items-center justify-between"><b class="text-xs text-[var(--text-primary)]">H3 采样模式</b><span class="text-[9px] text-amber-300">可随时切换</span></div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="option in H3_SAMPLING_OPTIONS"
                :key="option.mode"
                type="button"
                class="rounded-lg border px-2 py-2 text-left text-[10px] transition-colors"
                :class="localSamplingMode === option.mode ? 'border-amber-300 bg-amber-300/10 text-amber-200' : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
                @click="handleSamplingSelect(option.mode)"
              >
                <b class="block text-xs">{{ option.label }}</b><span>{{ option.description }}</span>
              </button>
            </div>
            <p v-if="localSamplingMode === 'turbo4'" class="text-[10px] leading-4 text-amber-300">4 步 Turbo 需要服务器安装 Turbo LoRA 和采样器；快速运动建议改回 20 步。</p>
          </section>
          <MultiViewReferencePanel :source-image="connectedFirstFrameSource" @confirmed="handleMultiViewConfirmed" />
          <H3DirectorPromptEditor
            :references="activeH3References"
            :source-prompt="connectedPrompt"
            :director-plan="directorPlan"
            :aspect-ratio="localRatio"
            :duration-seconds="localDuration"
            :output-width="outputWidth"
            :output-height="outputHeight"
            @update:state="handleDirectorStateUpdate"
          />
        </template>

        <div v-if="isBatchCapable" class="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[var(--text-primary)]">批量广告尺寸</span>
            <span class="text-[10px] text-emerald-400">3 个母版 → 4 个成品</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="size in VIDEO_BATCH_SIZES"
              :key="size"
              type="button"
              class="rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors"
              :class="localBatchSizes.includes(size)
                ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400'
                : 'border-[var(--border-color)] text-[var(--text-secondary)]'"
              @click="toggleBatchSize(size)"
            >
              {{ localBatchSizes.includes(size) ? '✓ ' : '' }}{{ size }}
            </button>
          </div>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs"
            @click="toggleGif"
          >
            <span class="text-[var(--text-secondary)]">输出 GIF（同时保留 MP4）</span>
            <span
              class="rounded-full px-2 py-0.5 font-medium"
              :class="localGenerateGif ? 'bg-amber-400/15 text-amber-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'"
            >
              {{ localGenerateGif ? '已开启' : '已关闭' }}
            </span>
          </button>
        </div>

        <!-- Aspect ratio selector | 宽高比选择 -->
        <VideoOutputSizePicker v-model:output-width="outputWidth" v-model:output-height="outputHeight" compact />
        <div v-if="!isBatchCapable" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">比例</span>
          <select data-testid="video-ratio-select" :value="localRatio" class="nodrag nowheel rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleRatioSelect($event.target.value)">
            <option v-for="option in ratioOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
          </select>
        </div>

        <!-- Duration selector | 时长选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">时长</span>
          <select data-testid="video-duration-select" :value="localDuration" class="nodrag nowheel rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-sm text-[var(--text-primary)]" @change="handleDurationSelect(Number($event.target.value))">
            <option v-for="option in durationOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
          </select>
        </div>

        <div v-if="isScail2Model" class="space-y-2 rounded-lg border border-[var(--border-color)] p-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-secondary)]">驱动视频</span>
            <button
              type="button"
              class="rounded-md bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] hover:text-[var(--accent-color)]"
              @click="drivingVideoInputRef?.click()"
            >
              选择本地视频
            </button>
          </div>
          <input
            ref="drivingVideoInputRef"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            class="hidden"
            @change="handleDrivingVideoSelect"
          />
          <div class="truncate text-[11px]" :class="drivingVideoFile ? 'text-green-500' : 'text-amber-500'">
            {{ drivingVideoFile ? `已选择：${drivingVideoFile.name}` : '必须选择动作来源视频（最大 100MB）' }}
          </div>
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]">
          <button type="button" class="px-2 py-0.5 rounded-full transition-colors hover:ring-1 hover:ring-current" @click="handleInputAction('prompt')"
            :class="connectedPrompt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompt ? '✓' : '○' }}
          </button>
          <button type="button" class="px-2 py-0.5 rounded-full transition-colors hover:ring-1 hover:ring-current" @click="handleInputAction('first_frame_image')"
            :class="imagesByRole.firstFrame ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            首帧 {{ imagesByRole.firstFrame ? '✓' : '○' }}
          </button>
          <button type="button" class="px-2 py-0.5 rounded-full transition-colors hover:ring-1 hover:ring-current" @click="handleInputAction('last_frame_image')"
            :class="imagesByRole.lastFrame ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            尾帧 {{ imagesByRole.lastFrame ? '✓' : '○' }}
          </button>
          <button type="button" class="px-2 py-0.5 rounded-full transition-colors hover:ring-1 hover:ring-current" @click="handleInputAction('input_reference')"
            :class="imagesByRole.referenceImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ imagesByRole.referenceImages.length > 0 ? `✓ ${imagesByRole.referenceImages.length}` : '○' }}
          </button>
          <input ref="firstFrameInputRef" type="file" accept="image/*" class="hidden" @change="handleImageInputSelect($event, 'first_frame_image')" />
          <input ref="lastFrameInputRef" type="file" accept="image/*" class="hidden" @change="handleImageInputSelect($event, 'last_frame_image')" />
          <input ref="referenceInputRef" type="file" accept="image/*" multiple class="hidden" @change="handleImageInputSelect($event, 'input_reference')" />
        </div>

        <!-- Progress bar | 进度条 -->
        <!-- <div v-if="status === 'polling'" class="space-y-1">
        <div class="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>生成中...</span>
          <span>{{ progress.percentage }}%</span>
        </div>
        <n-progress type="line" :percentage="progress.percentage" :show-indicator="false" :height="4" />
      </div> -->

        <!-- Generate button | 生成按钮 -->
        <button data-testid="video-generate-action" @click="handleGenerate" :disabled="isGenerating || !isConfigured || !isModelAvailable || (isScail2Model && !drivingVideoFile)"
          class="sticky top-0 z-10 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          <n-spin v-if="isGenerating" :size="14" />
          <template v-else>
            <n-icon :size="16">
              <VideocamOutline />
            </n-icon>
            {{ isBatchCapable ? '全部生成' : '生成视频' }}
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>
        <div v-else-if="!isModelAvailable" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前渠道 {{ modelStore.providerLabel }} 不支持 {{ displayModelName }}。切换到冠希 (Chatfire)，或改选当前渠道的视频模型。
        </div>
        <div v-else-if="isScail2Model && !scail2ReferenceInput" class="text-xs text-amber-500 mt-2 leading-relaxed">
          SCAIL-2 需要连接一张参考角色图，并在上方选择驱动视频。
        </div>
        <div v-else-if="isScail2Model && !connectedPrompt" class="text-xs text-amber-500 mt-2 leading-relaxed">
          请连接中文提示词，描述角色、动作和画面要求。
        </div>
        <div v-else-if="firstFrameNeedsPublicUrl" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前首帧是本地或内嵌图片，生成时会先自动发布成公网素材，再提交 FRW 视频。
        </div>
        <div v-else-if="!connectedPrompt" class="text-xs text-amber-500 mt-2 leading-relaxed">
          当前只连接了首帧图。建议再连接一个英文视频提示词，描述镜头运动和主体动作。
        </div>

        <!-- Generated video preview | 生成视频预览 -->
        <!-- <div v-if="generatedVideo?.url" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
        <div class="aspect-video rounded-lg overflow-hidden bg-black">
          <video :src="generatedVideo.url" controls class="w-full h-full object-contain" />
        </div>
      </div> -->
      </div>

    </div>

    <!-- Handles | 连接点 -->
    <div data-testid="video-config-handle-layer" class="pointer-events-none absolute inset-x-0 bottom-0 top-5 overflow-visible">
      <Handle type="target" :position="Position.Left" id="left" class="pointer-events-auto !bg-[var(--accent-color)]" />
      <NodeHandleMenu :nodeId="id" nodeType="videoConfig" :visible="showHandleMenu" :operations="[]" class="pointer-events-auto" />
    </div>
  </div>
</template>

<script setup>
/**
 * Video config node component | 视频配置节点组件
 * Configuration panel for video generation with API integration
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronForwardOutline, ChevronDownOutline, TrashOutline, VideocamOutline, CopyOutline, CreateOutline, ExpandOutline, ContractOutline } from '@vicons/ionicons5'
import { useVideoGeneration } from '../../hooks'
import { importImageAsset, publishImageAsset } from '../../api/image'
import { createLtxAudioTask, waitForLtxAudio } from '../../api/audio'
import { createMediaComposition } from '../../api/mediaComposition'
import { updateNode, removeNode, removeEdge, duplicateNode, addNode, addEdge, nodes, edges, scheduleCanvasSave } from '../../stores/canvas'
import NodeHandleMenu from './NodeHandleMenu.vue'
import VideoOutputSizePicker from '../VideoOutputSizePicker.vue'
import H3DirectorPromptEditor from '../video/H3DirectorPromptEditor.vue'
import MultiViewReferencePanel from '../video/MultiViewReferencePanel.vue'
import { useModelStore } from '../../stores/pinia'
import { getModelRatioOptions, getModelDurationOptions, getModelConfig, DEFAULT_VIDEO_MODEL } from '../../stores/models'
import {
  VIDEO_BATCH_SIZES,
  normalizeVideoBatchSizes,
  supportsVideoBatch
} from '../../utils/videoBatch'
import { getVideoInputCapabilities } from '../../utils/videoInputCapabilities'
import { getVideoQualityProfile } from '../../utils/videoQualityProfile'
import { getImageAlignmentSpec, getModelNativeVideoSize } from '../../config/studioProjectFlow'
import { isVerifiedTargetOutput } from '../../utils/videoTaskStatus'
import { bindH3ImagePrompt } from '../../utils/h3DirectorPrompt'
import { H3_SAMPLING_OPTIONS, normalizeH3SamplingMode } from '../../utils/h3GenerationOptions'
import {
  isLocalPublicAssetUrl,
  isReadyVideoImageNode,
  localizeGeneratedImageInput
} from '../../utils/generatedImageHandoff'

const VIDEO_NODE_VIEWPORT_BOTTOM_GAP = 24
const VIDEO_NODE_MIN_EXPANDED_HEIGHT = 160
const VIDEO_NODE_MIN_CONTENT_HEIGHT = 48
const getEffectiveVideoNodeZoom = value => {
  const zoom = Number(value)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}
const getExpandedVideoNodeViewportLayout = ({
  nodeTop,
  viewportHeight,
  zoom = 1,
  bottomGap = VIDEO_NODE_VIEWPORT_BOTTOM_GAP,
  minimumHeight = VIDEO_NODE_MIN_EXPANDED_HEIGHT,
  minimumContentHeight = VIDEO_NODE_MIN_CONTENT_HEIGHT,
  headerScreenHeight
} = {}) => {
  const safeNodeTop = Number.isFinite(Number(nodeTop)) ? Number(nodeTop) : 0
  const safeViewportHeight = Number.isFinite(Number(viewportHeight)) ? Math.max(0, Number(viewportHeight)) : 0
  const safeBottomGap = Number.isFinite(Number(bottomGap)) ? Math.max(0, Number(bottomGap)) : VIDEO_NODE_VIEWPORT_BOTTOM_GAP
  const viewportContentHeight = Math.max(0, safeViewportHeight - safeBottomGap)
  const safeMinimumHeight = Number.isFinite(Number(minimumHeight)) ? Math.max(0, Number(minimumHeight)) : VIDEO_NODE_MIN_EXPANDED_HEIGHT
  const safeMinimumContentHeight = Number.isFinite(Number(minimumContentHeight)) ? Math.max(0, Number(minimumContentHeight)) : VIDEO_NODE_MIN_CONTENT_HEIGHT
  const effectiveZoom = getEffectiveVideoNodeZoom(zoom)
  const safeHeaderScreenHeight = Number(headerScreenHeight)
  const requiredMinimumScreenHeight = Number.isFinite(safeHeaderScreenHeight) && safeHeaderScreenHeight > 0
    ? Math.max(safeMinimumHeight, safeHeaderScreenHeight + safeMinimumContentHeight * effectiveZoom)
    : safeMinimumHeight
  const operableMinimumHeight = Math.min(requiredMinimumScreenHeight, viewportContentHeight)
  const availableHeight = Math.max(0, viewportContentHeight - Math.max(0, safeNodeTop))
  const desiredScreenHeight = Math.min(viewportContentHeight, Math.max(operableMinimumHeight, availableHeight))
  const maxHeight = desiredScreenHeight / effectiveZoom
  const resolvedNodeTop = Math.min(safeNodeTop, viewportContentHeight - desiredScreenHeight)
  return {
    maxHeight,
    desiredScreenHeight,
    requiredMinimumScreenHeight,
    effectiveZoom,
    screenOffsetY: Math.min(0, resolvedNodeTop - safeNodeTop),
    resolvedNodeTop,
    viewportBottom: resolvedNodeTop + desiredScreenHeight
  }
}

const getExpandedVideoNodeMaxHeight = ({ nodeTop, viewportHeight, zoom = 1, bottomGap = VIDEO_NODE_VIEWPORT_BOTTOM_GAP } = {}) => {
  return getExpandedVideoNodeViewportLayout({ nodeTop, viewportHeight, zoom, bottomGap }).maxHeight
}

const createExpandedVideoNodeViewportLifecycle = ({
  getNodeTop,
  getViewportHeight,
  getZoom = () => 1,
  getHeaderScreenHeight = () => Number.NaN,
  setMaxHeight,
  moveNodeByScreenOffset = () => {},
  addResizeListener,
  removeResizeListener
}) => {
  let listening = false
  const recalculate = () => {
    const nodeTop = getNodeTop()
    const viewportHeight = getViewportHeight()
    if (!Number.isFinite(Number(nodeTop)) || !Number.isFinite(Number(viewportHeight))) return null
    const layout = getExpandedVideoNodeViewportLayout({
      nodeTop,
      viewportHeight,
      zoom: getZoom(),
      headerScreenHeight: getHeaderScreenHeight()
    })
    setMaxHeight(layout.maxHeight)
    if (layout.screenOffsetY < 0) moveNodeByScreenOffset(layout.screenOffsetY, layout.effectiveZoom)
    return layout
  }
  const handleResize = () => recalculate()

  return {
    recalculate,
    start: () => {
      recalculate()
      if (listening) return
      addResizeListener(handleResize)
      listening = true
    },
    stop: () => {
      if (!listening) return
      removeResizeListener(handleResize)
      listening = false
    }
  }
}

const createExpandedVideoNodeZoomLifecycle = ({
  isExpanded,
  afterRender,
  requestFrame,
  cancelFrame,
  recalculate
}) => {
  let pendingFrame = null
  let revision = 0

  const cancel = () => {
    revision += 1
    if (pendingFrame === null) return
    cancelFrame(pendingFrame)
    pendingFrame = null
  }
  const handleZoomChange = async () => {
    const currentRevision = ++revision
    if (!isExpanded()) {
      cancel()
      return
    }
    await afterRender()
    if (currentRevision !== revision || !isExpanded()) return
    if (pendingFrame !== null) cancelFrame(pendingFrame)
    pendingFrame = requestFrame(() => {
      pendingFrame = null
      if (currentRevision !== revision || !isExpanded()) return
      recalculate()
    })
  }

  return { handleZoomChange, cancel }
}

const createExpandedVideoNodeRestoreLifecycle = ({
  setExpanded,
  startViewport,
  stopViewport,
  scheduleStableRecalculation,
  cancelStableRecalculation,
  afterStateChange = () => {}
}) => {
  let active = false
  const sync = value => {
    const nextExpanded = Boolean(value)
    setExpanded(nextExpanded)
    if (active === nextExpanded) return false
    active = nextExpanded
    if (nextExpanded) {
      startViewport()
      scheduleStableRecalculation()
    } else {
      stopViewport()
      cancelStableRecalculation()
    }
    afterStateChange(nextExpanded)
    return true
  }
  const dispose = () => {
    active = false
    stopViewport()
    cancelStableRecalculation()
  }
  return { sync, dispose }
}

const normalizeH3DirectorNodeState = value => ({
  directorPlan: value?.directorPlan && typeof value.directorPlan === 'object' && !Array.isArray(value.directorPlan)
    ? value.directorPlan
    : null,
  compiledDirectorPrompt: String(value?.compiledDirectorPrompt || '')
})

const createH3DirectorNodeStateController = ({ setLocalState, persistState }) => {
  const restore = value => {
    const state = normalizeH3DirectorNodeState(value)
    setLocalState(state)
    return state
  }
  const handleEditorState = value => {
    const state = normalizeH3DirectorNodeState(value)
    setLocalState(state)
    persistState(state)
    return state
  }
  return { restore, handleEditorState }
}

// 使用 Pinia store 获取模型选项（根据渠道过滤）
const modelStore = useModelStore()

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { findNode, updateNodeInternals, updateNodePositions, viewport } = useVueFlow()

// API config state | API 配置状态
const isConfigured = computed(() => modelStore.isCurrentProviderConfigured)

// Video generation hook | 视频生成 hook
const { loading, error, status, video: generatedVideo, progress, createVideoTaskOnly } = useVideoGeneration()

// Local state | 本地状态
const showHandleMenu = ref(false)
const isExpanded = ref(Boolean(props.data?.expanded))
const nodeRootRef = ref(null)
const nodeHeaderRef = ref(null)
const expandedNodeMaxHeight = ref(getExpandedVideoNodeMaxHeight({
  nodeTop: 0,
  viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
  zoom: viewport.value.zoom
}))
const expandedNodeStyle = computed(() => isExpanded.value
  ? { maxHeight: `${expandedNodeMaxHeight.value}px`, overflow: 'hidden' }
  : undefined)
const expandedViewportLifecycle = createExpandedVideoNodeViewportLifecycle({
  getNodeTop: () => nodeRootRef.value?.getBoundingClientRect().top ?? Number.NaN,
  getViewportHeight: () => window.innerHeight,
  getZoom: () => viewport.value.zoom,
  getHeaderScreenHeight: () => nodeHeaderRef.value?.getBoundingClientRect().height ?? Number.NaN,
  setMaxHeight: value => {
    if (expandedNodeMaxHeight.value === value) return
    expandedNodeMaxHeight.value = value
    nextTick(() => updateNodeInternals(props.id))
  },
  moveNodeByScreenOffset: (screenOffsetY, effectiveZoom) => {
    const node = findNode(props.id)
    if (!node) return
    const position = {
      x: node.computedPosition.x,
      y: node.computedPosition.y + screenOffsetY / effectiveZoom
    }
    updateNodePositions([{
      id: node.id,
      position,
      from: node.position,
      distance: { x: 0, y: screenOffsetY / effectiveZoom },
      dimensions: node.dimensions,
      parentNode: node.parentNode
    }], true, false)
    scheduleCanvasSave()
  },
  addResizeListener: handler => window.addEventListener('resize', handler),
  removeResizeListener: handler => window.removeEventListener('resize', handler)
})
const expandedZoomLifecycle = createExpandedVideoNodeZoomLifecycle({
  isExpanded: () => isExpanded.value,
  afterRender: () => nextTick(),
  requestFrame: callback => window.requestAnimationFrame(callback),
  cancelFrame: frameId => window.cancelAnimationFrame(frameId),
  recalculate: () => expandedViewportLifecycle.recalculate()
})
const expandedRestoreLifecycle = createExpandedVideoNodeRestoreLifecycle({
  setExpanded: value => { isExpanded.value = value },
  startViewport: () => expandedViewportLifecycle.start(),
  stopViewport: () => expandedViewportLifecycle.stop(),
  scheduleStableRecalculation: () => expandedZoomLifecycle.handleZoomChange(),
  cancelStableRecalculation: () => expandedZoomLifecycle.cancel(),
  afterStateChange: () => nextTick(() => updateNodeInternals(props.id))
})
watch(() => viewport.value.zoom, () => expandedZoomLifecycle.handleZoomChange())
const isGenerating = ref(false)  // 任务创建中状态
const localModel = ref(props.data?.model || DEFAULT_VIDEO_MODEL)
const localRatio = ref(props.data?.ratio || '16:9')
const outputWidth = ref(Number(props.data?.outputWidth || 1920))
const outputHeight = ref(Number(props.data?.outputHeight || 1080))
const localDuration = ref(props.data?.dur || 5)
const allowedQualityModes = new Set(['fast', 'auto', 'quality'])
const localQualityMode = ref(allowedQualityModes.has(props.data?.qualityMode) ? props.data.qualityMode : 'fast')
const localSamplingMode = ref(normalizeH3SamplingMode(props.data?.samplingMode))
const qualityResult = ref(props.data?.qualityResult || {})
const localBatchSizes = ref(normalizeVideoBatchSizes(props.data?.batchSizes || []))
const localGenerateGif = ref(props.data?.generateGif !== false)
const drivingVideoInputRef = ref(null)
const drivingVideoFile = ref(null)
const firstFrameInputRef = ref(null)
const lastFrameInputRef = ref(null)
const referenceInputRef = ref(null)
const audioGenerating = ref(false)
const audioUrl = ref(props.data?.audioUrl || '')
const audioError = ref('')
const compositionVideoUrl = ref(props.data?.compositionVideoUrl || '')
const subtitleText = ref(props.data?.subtitleText || '')
const compositionGenerating = ref(false)
const compositionUrl = ref(props.data?.compositionUrl || '')
const compositionError = ref('')
const compiledDirectorPrompt = ref(props.data?.compiledDirectorPrompt || '')
const directorPlan = ref(props.data?.directorPlan || null)
const confirmedMultiViewReference = ref(props.data?.confirmedMultiViewReference || null)
const directorStateController = createH3DirectorNodeStateController({
  setLocalState: state => {
    directorPlan.value = state.directorPlan
    compiledDirectorPrompt.value = state.compiledDirectorPrompt
  },
  persistState: state => updateNode(props.id, state)
})
const handleDirectorStateUpdate = state => directorStateController.handleEditorState(state)

const handleMultiViewConfirmed = (reference) => {
  confirmedMultiViewReference.value = reference
  updateNode(props.id, { confirmedMultiViewReference: reference })
  window.$message?.success('多视图已确认，将作为 H3 主参考')
}

const qualityProfile = computed(() => getVideoQualityProfile(localQualityMode.value, localRatio.value))
const qualityOptions = [
  { mode: 'fast', label: '原生快速', description: '不跑 SeedVR2' },
  { mode: 'auto', label: '智能判断', description: '小图才超分' },
  { mode: 'quality', label: 'AI 高清', description: '强制 SeedVR2' }
]
const nativeVideoSize = computed(() => getModelNativeVideoSize(localModel.value, localRatio.value))
const imageAlignment = computed(() => getImageAlignmentSpec(localModel.value, localRatio.value))
const connectedQualityResult = computed(() => {
  const outputEdge = edges.value.find(edge => edge.source === props.id)
  return nodes.value.find(node => node.id === outputEdge?.target)?.data || {}
})
const qualityUnavailableReason = computed(() => {
  if (['minimax-h3', 'ltx-2.3'].includes(localModel.value)) return ''
  return '当前模型尚未接入已验证的 SeedVR2 超分链路'
})
const upscaleStatusLabel = computed(() => {
  const raw = connectedQualityResult.value?.upscale_status || qualityResult.value?.upscale_status || props.data?.upscale_status || ''
  return ({ queued: '等待中', running: '处理中', completed: '已完成', failed: '失败' }[String(raw).toLowerCase()] || '等待后端回报')
})
const actualOutputLabel = computed(() => {
  const width = Number(connectedQualityResult.value?.actual_width || qualityResult.value?.actual_width || props.data?.actual_width)
  const height = Number(connectedQualityResult.value?.actual_height || qualityResult.value?.actual_height || props.data?.actual_height)
  return width > 0 && height > 0 ? `${width}×${height}` : '等待实际尺寸'
})

// Label editing state | Label 编辑状态
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// Get connected images with roles | 获取连接的图片及其角色
const connectedImages = computed(() => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'image' && isReadyVideoImageNode(sourceNode.data)) {
      images.push({
        nodeId: sourceNode.id,
        edgeId: edge.id,
        url: sourceNode.data.url,
        base64: sourceNode.data.base64,
        publicUrl: sourceNode.data.publicUrl || sourceNode.data.public_url || '',
        localUrl: sourceNode.data.localUrl || sourceNode.data.local_url || '',
        assetRole: sourceNode.data.assetRole || sourceNode.data.asset_role || '',
        model: sourceNode.data.model || '',
        label: sourceNode.data.label || '',
        role: edge.data?.imageRole || 'first_frame_image' // Default to first frame | 默认首帧
      })
    }
  }

  return images
})

// Get images by role | 按角色获取图片
const imagesByRole = computed(() => {
  const firstFrame = connectedImages.value.find(img => img.role === 'first_frame_image')
  const lastFrame = connectedImages.value.find(img => img.role === 'last_frame_image')
  const referenceImages = connectedImages.value.filter(img => img.role === 'input_reference')

  return {
    firstFrame,
    lastFrame,
    referenceImages
  }
})

const isScail2Model = computed(() => localModel.value === 'scail2-action-transfer')
const isLocalCloudModel = computed(() => ['minimax-h3', 'ltx-2.3'].includes(localModel.value))
const inputCapabilities = computed(() => getVideoInputCapabilities(localModel.value))
const isBatchCapable = computed(() => supportsVideoBatch(localModel.value))
const scail2ReferenceInput = computed(() => {
  const image = imagesByRole.value.firstFrame || imagesByRole.value.referenceImages[0]
  return image ? pickVideoImageInput(image) : ''
})
const connectedFirstFrameSource = computed(() => {
  const image = imagesByRole.value.firstFrame || imagesByRole.value.referenceImages[0]
  return image ? pickVideoImageInput(image, { preferLocal: isLocalCloudModel.value }) : ''
})
const connectedH3Reference = computed(() => {
  const image = imagesByRole.value.firstFrame || imagesByRole.value.referenceImages[0]
  const source = image ? pickVideoImageInput(image, { preferLocal: true }) : ''
  return source ? { id: '图1', role: '连接图片主体', image: source } : null
})
const activeH3Reference = computed(() => confirmedMultiViewReference.value?.image ? confirmedMultiViewReference.value : connectedH3Reference.value)
const activeH3References = computed(() => activeH3Reference.value ? [activeH3Reference.value] : [])

const handleDrivingVideoSelect = (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > 100 * 1024 * 1024) {
    window.$message?.error('驱动视频不能超过 100MB')
    event.target.value = ''
    drivingVideoFile.value = null
    return
  }
  drivingVideoFile.value = file
}

const inputRoleLabel = { first_frame_image: '首帧', last_frame_image: '尾帧', input_reference: '参考图' }
const inputRoleRef = { first_frame_image: firstFrameInputRef, last_frame_image: lastFrameInputRef, input_reference: referenceInputRef }

const handleInputAction = (role) => {
  if (role === 'prompt') {
    if (connectedPrompt.value) { window.$message?.info('提示词已连接，可直接编辑左侧文字节点'); return }
    const current = nodes.value.find(node => node.id === props.id)
    const textId = addNode('text', { x: (current?.position?.x || 400) - 360, y: current?.position?.y || 100 }, { label: '视频提示词', content: '' })
    addEdge({ source: textId, target: props.id, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })
    window.$message?.success('已添加提示词节点')
    return
  }
  if ((role === 'last_frame_image' && !inputCapabilities.value.lastFrame) || (role === 'input_reference' && !inputCapabilities.value.references)) {
    window.$message?.warning('当前模型只支持提示词和单张首帧；请切换 FRW 视频等支持多图输入的模型。')
    return
  }
  inputRoleRef[role]?.value?.click()
}

const handleImageInputSelect = async (event, role) => {
  const files = Array.from(event.target?.files || [])
  event.target.value = ''
  if (!files.length) return
  for (const file of files) {
    if (!file.type.startsWith('image/')) { window.$message?.error(`${file.name} 不是图片`); continue }
    if (file.size > 20 * 1024 * 1024) { window.$message?.error(`${file.name} 超过 20MB`); continue }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const published = await publishImageAsset({ image: dataUrl, name: file.name })
      const imageUrl = published.public_url || published.url || dataUrl
      if (role !== 'input_reference') {
        const oldEdges = edges.value.filter(edge => edge.target === props.id && (edge.data?.imageRole || 'first_frame_image') === role)
        for (const oldEdge of oldEdges) {
          const oldNode = nodes.value.find(node => node.id === oldEdge.source)
          removeEdge(oldEdge.id)
          if (oldNode?.data?.autoVideoInputTarget === props.id) removeNode(oldNode.id)
        }
      }
      const current = nodes.value.find(node => node.id === props.id)
      const offset = role === 'first_frame_image' ? -120 : role === 'last_frame_image' ? 120 : 260
      const imageId = addNode('image', { x: (current?.position?.x || 400) - 360, y: (current?.position?.y || 100) + offset }, { url: imageUrl, publicUrl: published.public_url || '', label: inputRoleLabel[role], autoVideoInputTarget: props.id })
      addEdge({ source: imageId, target: props.id, sourceHandle: 'right', targetHandle: 'left', type: 'imageRole', data: { imageRole: role } })
      window.$message?.success(`${inputRoleLabel[role]}已添加`)
    } catch (error) {
      window.$message?.error(error?.message || `${inputRoleLabel[role]}上传失败`)
    }
  }
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('驱动视频读取失败'))
  reader.readAsDataURL(file)
})

const isPublicHttpUrl = (url) => {
  const value = String(url || '').trim()
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false
  try {
    const { hostname } = new URL(value)
    const host = String(hostname || '').toLowerCase()
    return Boolean(host) && !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)
  } catch {
    return false
  }
}

const isDataImageUrl = (url) => String(url || '').trim().startsWith('data:image/')

const pickVideoImageInput = (image = {}, { preferLocal = false } = {}) => {
  if (preferLocal && isLocalPublicAssetUrl(image.url)) return image.url
  if (isPublicHttpUrl(image.publicUrl)) return image.publicUrl
  if (isPublicHttpUrl(image.public_url)) return image.public_url
  if (isPublicHttpUrl(image.url)) return image.url
  if (isPublicHttpUrl(image.localUrl)) return image.localUrl
  if (isPublicHttpUrl(image.local_url)) return image.local_url
  return image.base64 || image.url || image.publicUrl || image.public_url || image.localUrl || image.local_url || ''
}

const publishVideoImageInput = async (value, roleLabel, { localOnly = false, assetRole = 'input' } = {}) => {
  const source = String(value || '').trim()
  if (!source) return ''
  if (localOnly) {
    return localizeGeneratedImageInput(source, {
      importAsset: importImageAsset,
      publishAsset: publishImageAsset,
      assetRole,
      name: `视频${roleLabel}`
    })
  }
  if (isPublicHttpUrl(source)) return source

  if (isDataImageUrl(source)) {
    const result = await publishImageAsset({
      image: source,
      name: `视频${roleLabel}`
    })
    const assetUrl = result.public_url || result.url || ''
    if (!isPublicHttpUrl(assetUrl)) {
      throw new Error(`${roleLabel}已转成本地素材，但还没有公网 URL；请先确认本地素材公网隧道可用后再生成视频。`)
    }
    return assetUrl
  }

  throw new Error(`${roleLabel}不是公网图片 URL，且没有可上传的 base64 图片；请重新上传图片或连接 FRW 作图输出。`)
}

const normalizeVideoImages = async ({ first_frame_image, last_frame_image, images }, options = {}) => {
  const normalized = {
    first_frame_image: await publishVideoImageInput(first_frame_image, '首帧', options),
    last_frame_image: await publishVideoImageInput(last_frame_image, '尾帧', options),
    images: []
  }

  for (const [index, image] of images.entries()) {
    const url = await publishVideoImageInput(image, `参考图${index + 1}`, options)
    if (url) normalized.images.push(url)
  }

  return normalized
}

const firstFrameNeedsPublicUrl = computed(() => {
  if (isScail2Model.value || isLocalCloudModel.value) return false
  const firstFrame = imagesByRole.value.firstFrame
  if (!firstFrame) return false
  return !isPublicHttpUrl(pickVideoImageInput(firstFrame))
})

// Get current model config | 获取当前模型配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))

// Model options from Pinia store (filtered by provider) | 从 Pinia store 获取模型选项（根据渠道过滤）
const modelOptions = computed(() => modelStore.allVideoModelOptions)
const isModelAvailable = computed(() => modelStore.allVideoModels.some(m => m.key === localModel.value))
const activateModelProvider = (modelKey) => {
  const config = getModelConfig(modelKey)
  const supportedProviders = Array.isArray(config?.provider) ? config.provider : []
  if (supportedProviders.length > 0 && !supportedProviders.includes(modelStore.currentProvider)) {
    modelStore.setProvider(supportedProviders[0])
  }
}

// Display model name | 显示模型名称
const displayModelName = computed(() => {
  const model = modelStore.allVideoModels.find(m => m.key === localModel.value)
  return model?.label || localModel.value || '选择模型'
})

// Ratio options based on model | 基于模型的比例选项
const ratioOptions = computed(() => {
  return getModelRatioOptions(localModel.value)
})

// Duration options based on model | 基于模型的时长选项
const durationOptions = computed(() => {
  return getModelDurationOptions(localModel.value)
})

// Handle model selection | 处理模型选择
const handleModelSelect = (key) => {
  localModel.value = key
  activateModelProvider(key)
  // Update ratio and duration to model's default | 更新为模型默认比例和时长
  const config = getModelConfig(key)
  const updates = { model: key }
  if (config?.defaultParams?.ratio) {
    localRatio.value = config.defaultParams.ratio
    updates.ratio = config.defaultParams.ratio
  }
  if (config?.defaultParams?.duration) {
    localDuration.value = config.defaultParams.duration
    updates.dur = config.defaultParams.duration
  }
  if (supportsVideoBatch(key)) {
    updates.batchSizes = [...localBatchSizes.value]
    updates.generateGif = localGenerateGif.value
  }
  updates.qualityProfile = qualityProfile.value
  updates.imageAlignment = imageAlignment.value
  updateNode(props.id, updates)
}

const toggleBatchSize = (size) => {
  if (localBatchSizes.value.includes(size)) {
    if (localBatchSizes.value.length === 1) {
      window.$message?.warning('至少保留一个输出尺寸')
      return
    }
    localBatchSizes.value = localBatchSizes.value.filter(item => item !== size)
  } else {
    localBatchSizes.value = VIDEO_BATCH_SIZES.filter(
      item => item === size || localBatchSizes.value.includes(item)
    )
  }
  updateNode(props.id, { batchSizes: [...localBatchSizes.value] })
}

const toggleGif = () => {
  localGenerateGif.value = !localGenerateGif.value
  updateNode(props.id, { generateGif: localGenerateGif.value })
}

const resolveAvailableVideoModel = () => {
  const availableModels = modelStore.allVideoModels
  if (availableModels.some(m => m.key === localModel.value)) {
    return localModel.value
  }
  if (availableModels.some(m => m.key === modelStore.selectedVideoModel)) {
    return modelStore.selectedVideoModel
  }
  return availableModels[0]?.key || DEFAULT_VIDEO_MODEL
}

const toggleExpanded = () => {
  const nextExpanded = !isExpanded.value
  expandedRestoreLifecycle.sync(nextExpanded)
  updateNode(props.id, { expanded: nextExpanded })
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

// Handle ratio selection | 处理比例选择
const handleRatioSelect = (key) => {
  localRatio.value = key
  updateNode(props.id, { ratio: key, qualityProfile: qualityProfile.value, imageAlignment: imageAlignment.value })
}

const handleQualitySelect = (mode) => {
  if (mode !== 'fast' && qualityUnavailableReason.value) {
    window.$message?.warning(qualityUnavailableReason.value)
    return
  }
  localQualityMode.value = allowedQualityModes.has(mode) ? mode : 'fast'
  updateNode(props.id, {
    qualityMode: localQualityMode.value,
    qualityProfile: qualityProfile.value,
    imageAlignment: imageAlignment.value
  })
}

const handleSamplingSelect = (mode) => {
  localSamplingMode.value = normalizeH3SamplingMode(mode)
  updateNode(props.id, { samplingMode: localSamplingMode.value })
}

// Handle duration selection | 处理时长选择
const handleDurationSelect = (key) => {
  localDuration.value = key
  updateNode(props.id, { dur: key })
}

// Get connected inputs by role | 根据角色获取连接的输入
const getConnectedInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)

  let prompt = ''
  let first_frame_image = ''
  let last_frame_image = ''
  const images = [] // input_reference images | 参考图

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      prompt = sourceNode.data?.content || ''
    } else if (sourceNode.type === 'llmConfig') {
      // LLM node output as prompt | LLM 节点输出作为提示词
      const content = sourceNode.data?.outputContent || ''
      if (content) prompt = content
    } else if (sourceNode.type === 'image' && isReadyVideoImageNode(sourceNode.data)) {
      const imageData = pickVideoImageInput(sourceNode.data, { preferLocal: isLocalCloudModel.value })
      const role = edge.data?.imageRole || 'first_frame_image'

      if (role === 'first_frame_image') {
        first_frame_image = imageData
      } else if (role === 'last_frame_image') {
        last_frame_image = imageData
      } else if (role === 'input_reference') {
        images.push(imageData)
      }
    }
  }

  return { prompt, first_frame_image, last_frame_image, images }
}

const getErrorMessage = (err) => {
  return err?.response?.data?.error?.message
    || err?.response?.data?.message
    || err?.data?.error?.message
    || err?.data?.message
    || err?.message
    || '生成失败'
}

// Computed connected prompt | 计算连接的提示词
const connectedPrompt = computed(() => {
  return getConnectedInputs().prompt
})

const handleGenerateAudio = async () => {
  if (!connectedPrompt.value) {
    window.$message?.warning('请先连接文本提示词')
    return
  }
  audioGenerating.value = true
  audioError.value = ''
  try {
    const created = await createLtxAudioTask(connectedPrompt.value, localDuration.value)
    const completed = await waitForLtxAudio(created.task_id || created.taskId)
    audioUrl.value = completed.audio_url || completed.url
    updateNode(props.id, { audioUrl: audioUrl.value, audioTaskId: completed.task_id })
    window.$message?.success('LTX 2.3 原生语音生成完成')
  } catch (err) {
    audioError.value = getErrorMessage(err)
    window.$message?.error(audioError.value)
  } finally {
    audioGenerating.value = false
  }
}

const connectedOutputVideoUrl = computed(() => {
  for (const edge of edges.value.filter(item => item.source === props.id)) {
    const target = nodes.value.find(node => node.id === edge.target)
    if (target?.type === 'video' && target.data?.url) return target.data.url
  }
  return ''
})

const effectiveCompositionVideoUrl = computed(() => compositionVideoUrl.value || connectedOutputVideoUrl.value)

const handleComposeMedia = async () => {
  compositionGenerating.value = true
  compositionError.value = ''
  try {
    const result = await createMediaComposition({
      videoUrl: effectiveCompositionVideoUrl.value,
      audioUrl: audioUrl.value,
      subtitleText: subtitleText.value
    })
    compositionUrl.value = result.output_url
    updateNode(props.id, {
      compositionVideoUrl: effectiveCompositionVideoUrl.value,
      subtitleText: subtitleText.value,
      compositionUrl: compositionUrl.value
    })
    window.$message?.success('带音频和字幕的 MP4 已生成')
  } catch (err) {
    compositionError.value = getErrorMessage(err)
    window.$message?.error(compositionError.value)
  } finally {
    compositionGenerating.value = false
  }
}

// Created video node ID | 创建的视频节点 ID
const createdVideoNodeId = ref(null)

const findConnectedEmptyOutputNode = (nodeType) => {
  const outputEdges = edges.value.filter(edge => edge.source === props.id)
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(node => node.id === edge.target)
    if (
      targetNode?.type === nodeType &&
      !targetNode.data?.url &&
      !targetNode.data?.taskId &&
      !targetNode.data?.loading
    ) {
      return targetNode.id
    }
  }
  return null
}

// Handle generate action | 处理生成操作
const handleGenerate = async () => {
  // 设置生成中状态
  isGenerating.value = true
  activateModelProvider(localModel.value)

  let prompt
  let first_frame_image
  let last_frame_image
  let images
  try {
    ({ prompt, first_frame_image, last_frame_image, images } = getConnectedInputs())
    if (localModel.value === 'minimax-h3' && compiledDirectorPrompt.value) {
      prompt = compiledDirectorPrompt.value
    }
    if (localModel.value === 'minimax-h3') {
      if (activeH3Reference.value?.image) first_frame_image = activeH3Reference.value.image
      prompt = bindH3ImagePrompt(prompt, activeH3References.value)
    }
  } catch (err) {
    window.$message?.error(getErrorMessage(err))
    isGenerating.value = false
    return
  }

  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('请先连接文本节点或图片节点')
    isGenerating.value = false
    return
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    isGenerating.value = false
    return
  }

  if (!isModelAvailable.value) {
    window.$message?.warning('当前渠道不支持这个视频模型，请切换渠道或更换模型')
    isGenerating.value = false
    return
  }

  if (isScail2Model.value) {
    if (!prompt) {
      window.$message?.warning('SCAIL-2 动作迁移需要连接中文提示词')
      isGenerating.value = false
      return
    }
    if (!scail2ReferenceInput.value) {
      window.$message?.warning('SCAIL-2 动作迁移需要连接一张参考角色图')
      isGenerating.value = false
      return
    }
    if (!drivingVideoFile.value) {
      window.$message?.warning('请先选择驱动视频')
      isGenerating.value = false
      return
    }
  }

  // Get current node position | 获取当前节点位置
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  const outputNodeType = isBatchCapable.value ? 'videoBatch' : 'video'
  let videoNodeId = findConnectedEmptyOutputNode(outputNodeType)
  if (videoNodeId) {
    updateNode(videoNodeId, {
      url: '',
      taskId: null,
      error: null,
      loading: true,
      status: isBatchCapable.value ? 'queued' : undefined,
      assets: isBatchCapable.value ? [] : undefined,
      zipUrl: isBatchCapable.value ? '' : undefined,
      progress: 0,
      attempt: 0,
      qualityProfile: qualityProfile.value,
      targetResolution: qualityProfile.value.label,
      label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...'
    })
  } else {
    // Create video node with loading state | 创建带加载状态的视频节点
    videoNodeId = addNode(outputNodeType, { x: nodeX + 350, y: nodeY }, {
      url: '',
      error: null,
      loading: true,
      status: isBatchCapable.value ? 'queued' : undefined,
      assets: isBatchCapable.value ? [] : undefined,
      zipUrl: isBatchCapable.value ? '' : undefined,
      outputFormats: isBatchCapable.value && localGenerateGif.value ? ['mp4', 'gif'] : ['mp4'],
      qualityProfile: qualityProfile.value,
      targetResolution: qualityProfile.value.label,
      label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...'
    })

    // Auto-connect videoConfig → video | 自动连接 视频配置 → 视频
    addEdge({
      source: props.id,
      target: videoNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }
  createdVideoNodeId.value = videoNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(videoNodeId)
  }, 50)

  try {
    const connectedReference = imagesByRole.value.firstFrame || imagesByRole.value.referenceImages[0]
    const connectedReferenceUrl = connectedReference
      ? pickVideoImageInput(connectedReference, { preferLocal: isLocalCloudModel.value })
      : ''
    const connectedAssetRole = connectedReference?.assetRole
      || (connectedReference?.model || /文生图|首帧结果/.test(connectedReference?.label || '') ? 'generated' : 'input')
    const normalizedImages = isScail2Model.value
      ? {
          first_frame_image: first_frame_image || images[0] || '',
          last_frame_image: '',
          images: []
        }
      : await normalizeVideoImages(
          { first_frame_image, last_frame_image, images },
          isLocalCloudModel.value
            ? {
                localOnly: true,
                assetRole: first_frame_image === connectedReferenceUrl ? connectedAssetRole : 'input'
              }
            : {}
        )

    if (
      isLocalCloudModel.value
      && connectedReference?.nodeId
      && first_frame_image === connectedReferenceUrl
      && normalizedImages.first_frame_image !== connectedReferenceUrl
    ) {
      updateNode(connectedReference.nodeId, {
        url: normalizedImages.first_frame_image,
        publicUrl: normalizedImages.first_frame_image,
        assetRole: connectedAssetRole
      })
    }
    if (
      isLocalCloudModel.value
      && confirmedMultiViewReference.value?.image === first_frame_image
      && normalizedImages.first_frame_image !== first_frame_image
    ) {
      confirmedMultiViewReference.value = {
        ...confirmedMultiViewReference.value,
        image: normalizedImages.first_frame_image
      }
      updateNode(props.id, { confirmedMultiViewReference: confirmedMultiViewReference.value })
    }

    // Build request params (raw form data) | 构建请求参数（原始表单数据）
    // These will be transformed by inputTransform | 这些会被 inputTransform 转换
    const params = {
      model: localModel.value,
      quality_profile: qualityProfile.value,
      image_alignment: imageAlignment.value,
      output_width: outputWidth.value,
      output_height: outputHeight.value
    }
    if (localModel.value === 'minimax-h3') params.sampling_mode = localSamplingMode.value
    if (localModel.value === 'minimax-h3' && directorPlan.value && compiledDirectorPrompt.value) {
      params.director_plan = directorPlan.value
    }

    // Add prompt if provided | 如果有提示词则添加
    if (prompt) {
      params.prompt = prompt
    }

    // Add first frame image | 添加首帧图片
    if (normalizedImages.first_frame_image) {
      params.first_frame_image = normalizedImages.first_frame_image
    }

    // Add last frame image | 添加尾帧图片
    if (normalizedImages.last_frame_image) {
      params.last_frame_image = normalizedImages.last_frame_image
    }

    // Add reference images (input_reference) | 添加参考图
    if (normalizedImages.images.length > 0) {
      params.images = normalizedImages.images
    }

    // Add ratio/size | 添加比例参数
    if (localRatio.value) {
      params.ratio = localRatio.value
    }

    // Add duration | 添加时长
    if (localDuration.value) {
      params.dur = localDuration.value
    }

    if (isBatchCapable.value) {
      params.sizes = [...localBatchSizes.value]
      params.output_formats = localGenerateGif.value ? ['mp4', 'gif'] : ['mp4']
    }

    if (isScail2Model.value) {
      params.driving_video = await readFileAsDataUrl(drivingVideoFile.value)
      params.driving_video_name = drivingVideoFile.value.name
    }

    // 只创建任务，获取 taskId，不在这里轮询
    const { taskId: newTaskId, url, result } = await createVideoTaskOnly(params)
    qualityResult.value = result || {}
    const qualityMetadata = {
      qualityProfile: qualityProfile.value,
      qualityMode: localQualityMode.value,
      samplingMode: localSamplingMode.value,
      upscale_status: result?.upscale_status || '',
      actual_width: result?.actual_width || null,
      actual_height: result?.actual_height || null
    }
    const verified1080p = isVerifiedTargetOutput(qualityMetadata, qualityProfile.value)

    // 如果有直接 URL，更新视频节点
    if (url) {
      updateNode(videoNodeId, {
        url: url,
        taskId: result?.task_id || result?.taskId || null,
        status: result?.status || 'completed',
        assets: result?.assets || [],
        zipUrl: result?.zip_url || '',
        outputFormats: result?.output_formats || params.output_formats,
        loading: false,
        label: isBatchCapable.value ? '批量视频结果' : (verified1080p ? '高质量 1080p 视频' : '视频结果'),
        model: localModel.value,
        ...qualityMetadata,
        updatedAt: Date.now()
      })
      window.$message?.success('视频生成成功')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId, qualityResult: result || {}, ...qualityMetadata })
    } else if (newTaskId) {
      // 需要轮询，传递 taskId 给 VideoNode
      updateNode(videoNodeId, {
        taskId: newTaskId,
        loading: true,
        status: result?.status || (isBatchCapable.value ? 'queued' : undefined),
        progress: result?.progress ?? null,
        progressScope: result?.progress_scope || '',
        currentStep: result?.current_step || '',
        assets: result?.assets || [],
        outputFormats: result?.output_formats || params.output_formats,
        label: isBatchCapable.value ? '批量视频生成中...' : '视频生成中...',
        model: localModel.value,
        ...qualityMetadata,
        updatedAt: Date.now()
      })
      window.$message?.success('视频任务已创建')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId, qualityResult: result || {}, ...qualityMetadata })
    }
  } catch (err) {
    const message = getErrorMessage(err)
    // Update node to show error | 更新节点显示错误
    updateNode(videoNodeId, {
      loading: false,
      error: message,
      label: '生成失败',
      updatedAt: Date.now()
    })
  } finally {
    isGenerating.value = false
  }
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || '视频生成'
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
}

// Initialize on mount | 挂载时初始化
onMounted(() => {
  const resolvedModel = resolveAvailableVideoModel()
  if (!localModel.value || localModel.value !== resolvedModel) {
    localModel.value = resolvedModel
    updateNode(props.id, { model: resolvedModel })
  }
  expandedRestoreLifecycle.sync(Boolean(props.data?.expanded))
})

onBeforeUnmount(() => {
  expandedRestoreLifecycle.dispose()
})

// Watch for model changes from props | 监听 props 中模型变化
watch(() => props.data?.expanded, value => {
  expandedRestoreLifecycle.sync(value)
})

watch(() => props.data?.model, (newModel) => {
  if (newModel && newModel !== localModel.value) {
    localModel.value = newModel
  }
})

watch(
  () => [props.data?.directorPlan, props.data?.compiledDirectorPrompt],
  ([nextDirectorPlan, nextCompiledPrompt]) => {
    directorStateController.restore({
      directorPlan: nextDirectorPlan,
      compiledDirectorPrompt: nextCompiledPrompt
    })
  },
  { deep: true }
)

// 修复 Vue Flow visibility: hidden 问题
// 当节点数据变化时，强制更新内部状态
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
.video-config-node-wrapper {
  position: relative;
  padding-top: 20px;
}

.video-config-node {
  cursor: default;
  position: relative;
}
</style>
