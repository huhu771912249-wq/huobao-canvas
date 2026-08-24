<template>
  <main class="gif-editor-page">
    <header class="editor-header">
      <div class="header-left">
        <button class="icon-button" type="button" :title="isLinkedEditor ? '返回画板' : '返回首页'" @click="handleBack">←</button>
        <div class="brand-mark">GIF</div>
        <div>
          <div class="eyebrow">冠希 CREATIVE CUT</div>
          <div class="project-line"><input v-model="projectName" aria-label="项目名称"><span>{{ saveStatus }}</span></div>
        </div>
      </div>
      <div class="header-center">
        <span>{{ jobStatusText }}</span>
      </div>
      <div class="header-actions">
        <button class="secondary" type="button" @click="showExport = true">导出设置</button>
        <button v-if="isLinkedEditor" class="secondary" type="button" @click="saveAndReturn">保存并返回画板</button>
        <button class="primary" type="button" @click="showExport = true">导出 GIF</button>
      </div>
    </header>

    <section class="editor-workspace">
      <aside class="asset-sidebar scroll-area">
        <div class="panel-title"><span>素材</span><small>{{ clips.length }} 段素材</small></div>
        <button class="import-card main-import" type="button" :disabled="uploadingMedia" @click="mediaInput?.click()">
          <span>＋</span><b>{{ uploadingMedia ? '正在上传…' : '导入视频 / GIF' }}</b><small>MP4、MOV、WebM、GIF · 最大 90MB</small>
        </button>
        <input ref="mediaInput" hidden type="file" accept="video/*,image/gif,.gif,.mp4,.mov,.webm" @change="importMedia">

        <div class="quick-actions">
          <button type="button" @click="mediaInput?.click()"><span>GIF</span><b>直接导入 GIF</b></button>
          <button type="button" @click="addText"><span>T</span><b>添加文字</b></button>
          <button type="button" @click="imageInput?.click()"><span>▧</span><b>添加图片</b></button>
          <button type="button" @click="fontInput?.click()"><span>Aa</span><b>导入字体</b></button>
        </div>
        <input ref="imageInput" hidden type="file" accept="image/png,image/jpeg,image/webp" @change="importImage">
        <input ref="fontInput" hidden type="file" accept=".ttf,.otf,.woff,.woff2,font/*" @change="importFont">

        <section class="asset-section">
          <div class="section-label">视频与 GIF</div>
          <p v-if="!clips.length" class="empty-watermark">暂无可编辑素材，请导入 GIF/视频，或从画板上游节点进入。</p>
          <button
            v-for="(clip, index) in clips"
            :key="clip.id"
            class="asset-item"
            :class="{ selected: selectedType === 'clip' && selectedId === clip.id }"
            type="button"
            @click="selectItem('clip', clip.id)"
          >
            <span class="asset-thumb" :style="{ background: clip.color }">{{ clip.kind === 'gif' ? 'GIF' : '▶' }}</span>
            <span><b>{{ clip.name }}</b><small>{{ clip.duration.toFixed(1) }} 秒 · 片段 {{ index + 1 }}</small></span>
          </button>
        </section>

        <section class="asset-section">
          <div class="section-label">叠加素材</div>
          <button v-for="item in textTracks" :key="item.id" class="asset-item" :class="{ selected: selectedType === 'text' && selectedId === item.id }" type="button" @click="selectItem('text', item.id)">
            <span class="asset-thumb text-thumb">T</span><span><b>{{ item.text }}</b><small>{{ formatGifEditorTrackTime(item.start) }}–{{ formatGifEditorTrackTime(item.end) }} 秒</small></span>
          </button>
          <button v-for="item in imageTracks" :key="item.id" class="asset-item" :class="{ selected: selectedType === 'image' && selectedId === item.id }" type="button" @click="selectItem('image', item.id)">
            <span class="asset-thumb image-thumb">▧</span><span><b>{{ item.name }}</b><small>{{ formatGifEditorTrackTime(item.start) }}–{{ formatGifEditorTrackTime(item.end) }} 秒</small></span>
          </button>
          <p v-if="watermarkOverflow" class="watermark-overflow" role="alert">{{ watermarkOverflow }}</p>
        </section>

        <section class="asset-section">
          <div class="section-label">我的水印 · {{ watermarkLibrary.length }}</div>
          <button v-for="item in watermarkLibrary" :key="`saved-${item.id}`" class="asset-item" type="button" @click="selectItem('image', item.id)">
            <span class="asset-thumb image-thumb">W</span><span><b>{{ item.name }}</b><small>已保存到当前编辑工程</small></span>
          </button>
          <p v-if="!watermarkLibrary.length" class="empty-watermark">选中图片后可保存为复用水印</p>
        </section>

        <p v-if="notice" class="notice">{{ notice }}</p>
      </aside>

      <section class="editor-center">
        <div class="preview-toolbar">
          <div class="canvas-size">{{ outputPreset.label }} · {{ outputPreset.scene }} · {{ fitModeLabel }}</div>
        </div>

        <div class="preview-area">
          <div class="stage-shadow">
            <div class="preview-stage" :style="stageStyle">
              <template v-if="activeClip?.url">
                <video v-if="showBlurBackdrop && activeClip.kind === 'video'" class="stage-backdrop" :src="activeClip.url" muted loop autoplay playsinline aria-hidden="true"></video>
                <img v-else-if="showBlurBackdrop" class="stage-backdrop" :src="activeClip.url" alt="" aria-hidden="true">
                <video v-if="activeClip.kind === 'video'" class="stage-media" :style="mediaStyle" :src="activeClip.url" muted loop autoplay playsinline></video>
                <img v-else class="stage-media" :style="mediaStyle" :src="activeClip.url" :alt="activeClip.name">
              </template>
              <div v-else class="placeholder-scene" :style="{ background: activeClip?.color }">
                <div class="scene-light"></div><b>{{ activeClip?.name || '暂无可编辑素材' }}</b><small>{{ activeClip ? '广告素材画面预览' : '请从画板连接上游，或在左侧导入 GIF / 视频' }}</small>
              </div>

              <button
                v-for="item in activeTextTracks"
                :key="item.id"
                class="stage-text"
                :class="{ selected: selectedType === 'text' && selectedId === item.id }"
                :style="textOverlayStyle(item)"
                type="button"
                @click.stop="selectItem('text', item.id)"
              >{{ item.text }}</button>

              <button
                v-for="item in activeImageTracks"
                :key="item.id"
                class="stage-image"
                :class="{ selected: selectedType === 'image' && selectedId === item.id }"
                :style="imageOverlayStyle(item)"
                type="button"
                @click.stop="selectItem('image', item.id)"
              ><img v-if="item.url" :src="item.url" :alt="item.name"><span v-else>LOGO</span></button>
            </div>
          </div>
        </div>

        <div class="transport-bar">
          <button type="button" @click="playhead = 0">|◀</button>
          <button class="play-button" type="button" @click="togglePlayback">{{ playing ? '❚❚' : '▶' }}</button>
          <button type="button" @click="stepForward">▶|</button>
          <strong>{{ formatTimelineTime(playhead) }}</strong><span>/ {{ formatTimelineTime(totalDuration) }}</span>
          <input v-model.number="playhead" type="range" min="0" :max="totalDuration" step="0.1" aria-label="播放位置">
        </div>

        <section class="timeline-panel">
          <header class="timeline-header">
            <div><b>时间轴</b><button type="button" @click="addText">＋ 文字轨道</button><button type="button" @click="imageInput?.click()">＋ 图片轨道</button></div>
          </header>
          <div class="timeline-scroll">
            <div class="timeline-labels">
              <span>时间</span><span>视频</span><span>文字</span><span>图片</span>
            </div>
            <div class="timeline-tracks">
              <div class="ruler-row">
                <span v-for="mark in rulerMarks" :key="mark" :style="{ left: `${mark / totalDuration * 100}%` }">{{ mark.toFixed(1) }}s</span>
              </div>
              <div class="track-row video-track">
                <button v-for="clip in clips" :key="clip.id" class="clip-block" :class="{ selected: selectedType === 'clip' && selectedId === clip.id }" :style="clipTimelineStyle(clip)" type="button" @click="selectItem('clip', clip.id)"><span>{{ clip.kind === 'gif' ? 'GIF' : 'VIDEO' }}</span><b>{{ clip.name }}</b></button>
              </div>
              <div class="track-row overlay-track">
                <button v-for="item in textTracks" :key="item.id" class="range-block text-range" :class="{ selected: selectedType === 'text' && selectedId === item.id }" :style="safeTimelineRangeStyle(item)" type="button" @click="selectItem('text', item.id)">T · {{ item.text }}</button>
              </div>
              <div class="track-row overlay-track">
                <button v-for="item in imageTracks" :key="item.id" class="range-block image-range" :class="{ selected: selectedType === 'image' && selectedId === item.id }" :style="safeTimelineRangeStyle(item)" type="button" @click="selectItem('image', item.id)">▧ · {{ item.name }}</button>
              </div>
              <div class="playhead" :style="{ left: `${playhead / totalDuration * 100}%` }"><span></span></div>
            </div>
          </div>
        </section>
      </section>

      <aside class="inspector-sidebar scroll-area">
        <div class="panel-title"><span>属性</span><button v-if="selectedItem" type="button" @click="removeSelected">删除</button></div>

        <section v-if="selectedText" class="inspector-section">
          <div class="section-label">文字内容</div>
          <textarea v-model="selectedText.text" rows="3" maxlength="80"></textarea>
          <label>套用预设样式<select v-model="selectedText.style" @change="applyTextStylePreset(selectedText)"><option v-for="styleName in textStyleNames" :key="styleName">{{ styleName }}</option></select></label>
          <div class="field-pair">
            <label>文字颜色<input v-model="selectedText.color" type="color" aria-label="文字颜色"></label>
            <label>描边颜色<input v-model="selectedText.strokeColor" type="color" aria-label="描边颜色"></label>
          </div>
          <label>描边宽度 {{ selectedText.strokeWidth }} px<input v-model.number="selectedText.strokeWidth" type="range" min="0" max="32" step="1"></label>
          <div class="field-pair"><label>开始（秒）<input :value="trackTimeInputValue('text', selectedText, 'start')" type="number" min="0" :max="totalDuration" step="0.1" @input="handleTrackTimeInput('text', selectedText, 'start', $event)" @blur="commitTrackTimeInput('text', selectedText, 'start')"></label><label>结束（秒）<input :value="trackTimeInputValue('text', selectedText, 'end')" type="number" min="0.1" :max="totalDuration" step="0.1" @input="handleTrackTimeInput('text', selectedText, 'end', $event)" @blur="commitTrackTimeInput('text', selectedText, 'end')"></label></div>
          <label>字号 {{ selectedText.fontSize }} px（{{ outputPreset.height }} px 高的成品上）<input v-model.number="selectedText.fontSize" type="range" min="14" max="72"></label>
          <label>横向位置 {{ selectedText.x }}%<input v-model.number="selectedText.x" type="range" min="5" max="95"></label>
          <label>纵向位置 {{ selectedText.y }}%<input v-model.number="selectedText.y" type="range" min="5" max="95"></label>
        </section>

        <section v-else-if="selectedImage" class="inspector-section">
          <div class="section-label">图片 / Logo</div>
          <p v-if="watermarkOverflow" class="inspector-warning" role="alert">{{ watermarkOverflow }}</p>
          <div class="selected-file">{{ selectedImage.name }}</div>
          <div class="field-pair"><label>开始（秒）<input :value="trackTimeInputValue('image', selectedImage, 'start')" type="number" min="0" :max="totalDuration" step="0.1" @input="handleTrackTimeInput('image', selectedImage, 'start', $event)" @blur="commitTrackTimeInput('image', selectedImage, 'start')"></label><label>结束（秒）<input :value="trackTimeInputValue('image', selectedImage, 'end')" type="number" min="0.1" :max="totalDuration" step="0.1" @input="handleTrackTimeInput('image', selectedImage, 'end', $event)" @blur="commitTrackTimeInput('image', selectedImage, 'end')"></label></div>
          <label>大小 {{ selectedImage.size }}%<input v-model.number="selectedImage.size" type="range" min="8" max="60"></label>
          <label>透明度 {{ selectedImage.opacity ?? 100 }}%<input v-model.number="selectedImage.opacity" type="range" min="10" max="100"></label>
          <label>横向位置 {{ selectedImage.x }}%<input v-model.number="selectedImage.x" type="range" min="5" max="95"></label>
          <label>纵向位置 {{ selectedImage.y }}%<input v-model.number="selectedImage.y" type="range" min="5" max="95"></label>
          <button class="save-watermark" type="button" @click="saveSelectedWatermark">{{ selectedImage.saved ? '水印已保存' : '保存到水印库' }}</button>
          <p>水印名称、位置、大小、透明度和显示时间会随编辑工程保存；本机临时上传的原文件在正式素材上传接口接入后再做永久存储。</p>
        </section>

        <section v-else-if="selectedClip" class="inspector-section">
          <div class="section-label">片段设置</div>
          <div class="selected-file">{{ selectedClip.name }}</div>
          <label>片段时长（秒）<input :value="selectedClip.duration.toFixed(1)" type="number" step="0.1" disabled aria-label="片段时长（秒）"></label>
          <p>时长由后端 ffprobe 从源素材直接读取，导出成功后会用真实结果回填，所以这里只读。想改时长请换素材，或在上游「视频转 GIF」节点裁剪。</p>
        </section>

        <section class="inspector-section export-settings">
          <div class="section-label">画布与导出</div>
          <div class="preset-buttons"><button v-for="(preset, key) in GIF_OUTPUT_PRESETS" :key="key" type="button" :class="{ active: presetKey === key }" @click="presetKey = key"><b>{{ preset.label }}</b><small>{{ preset.scene }}</small></button></div>
          <label>圆角 {{ cornerRadius }}%<input v-model.number="cornerRadius" type="range" min="0" max="50" step="1"></label>
          <div class="field-pair"><label>帧率<select v-model.number="fps"><option :value="8">8 FPS</option><option :value="12">12 FPS</option><option :value="15">15 FPS</option><option :value="24">24 FPS</option></select></label><label>颜色<select v-model.number="colors"><option :value="64">64 色</option><option :value="128">128 色</option><option :value="256">256 色</option></select></label></div>
          <label>循环<select v-model="loop"><option value="forever">无限循环</option><option value="once">播放一次</option><option value="three">循环 3 次</option></select></label>
          <label>画面适配<select v-model="fitMode"><option value="contain">完整保留＋黑色留边</option><option value="blur">完整保留＋模糊背景</option><option value="center">居中裁剪</option></select></label>
          <div class="export-summary"><span>预计输出</span><b>{{ outputPreset.label }} · {{ fps }} FPS</b><small>GIF · {{ totalDuration.toFixed(1) }} 秒 · {{ colors }} 色</small></div>
          <button class="primary wide" type="button" @click="showExport = true">导出 GIF</button>
        </section>
      </aside>
    </section>

    <div v-if="showExport" class="modal-backdrop" @click.self="showExport = false">
      <section class="export-modal">
        <button class="modal-close" type="button" @click="showExport = false">×</button>
        <div class="modal-icon">GIF</div><span class="eyebrow">REAL GIF EXPORT</span><h2>{{ exportResultUrl ? '编辑 GIF 已生成' : '生成编辑 GIF' }}</h2>
        <p v-if="!exportResultUrl">将调用后端 FFmpeg 真实合成。必须先导入一段 GIF/视频，并至少添加一条文字或一张图片水印。</p>
        <img v-if="exportResultUrl" :src="exportResultUrl" alt="水印 GIF 成品" class="result-preview">
        <dl><div><dt>画布</dt><dd>{{ outputPreset.label }}</dd></div><div><dt>时间</dt><dd>{{ displayedDuration.toFixed(1) }} 秒</dd></div><div><dt>质量</dt><dd>{{ fps }} FPS / {{ colors }} 色</dd></div><div><dt>圆角</dt><dd>{{ cornerRadius }}%</dd></div></dl>
        <div v-if="exporting || exportProgress" class="export-progress" role="status"><span :style="{ width: `${exportProgress}%` }"></span></div>
        <p v-if="exporting">实时进度：{{ exportProgress }}% · {{ exportStep || '后端正在处理' }}</p>
        <p v-if="!exportResultUrl && watermarkOverflow" class="export-error" role="alert">{{ watermarkOverflow }}</p>
        <p v-if="exportError" class="export-error" role="alert">{{ exportError }}</p>
        <template v-if="exportResultUrl">
          <button class="result-download" type="button" :disabled="downloadingResult" @click="downloadExportResult">{{ downloadingResult ? '正在准备下载…' : '下载编辑 GIF' }}</button>
          <button class="result-save" type="button" :disabled="savingToLibrary || !outputJobId" @click="saveExportToLibrary">{{ savingToLibrary ? '正在保存…' : '保存到素材库' }}</button>
          <p class="result-hint">成品放在有 24 小时有效期的临时目录里，保存到素材库才会长期留存。</p>
          <button class="secondary wide" type="button" @click="showExport = false">返回继续编辑</button>
        </template>
        <button v-else class="primary wide" type="button" :disabled="exporting || !canExport" @click="runExport">{{ exporting ? '正在生成…' : '开始真实导出' }}</button>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  buildGifEditorJobPayload,
  createGifEditorJob,
  getGifEditorJob,
  getGifEditorJobDuration,
  probeGifEditorMediaDuration,
  uploadGifEditorAsset,
  uploadGifEditorMedia
} from '../api/gifEditor.js'
import { startAssetDownload } from '../utils/assetDownload.js'
import {
  GIF_OUTPUT_PRESETS,
  calculateTimelineDuration,
  clampCornerRadius,
  detectEditorMediaKind,
  formatTimelineTime,
  timelineRangeStyle
} from '../utils/gifAdEditorPrototype'
import {
  GIF_TEXT_STYLE_PRESETS,
  createGifEditorTrackTimeDraftStore,
  createWatermarkEditorProjectForSource,
  buildGifEditorWatermarkPayload,
  createDefaultWatermarkEditorProject,
  findGifEditorWatermarkOverflow,
  formatGifEditorTrackTime,
  gifPreviewImageOverlayStyle,
  gifPreviewMediaFit,
  gifPreviewStageBackground,
  gifPreviewTextOverlayStyle,
  gifPreviewUsesBlurBackdrop,
  isGifEditorTrackActive,
  isWatermarkEditorJobTerminal,
  normalizeGifEditorTrackRange,
  resolveGifTextTrackStyle,
  restoreWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} from '../utils/watermarkEditorProject.js'
import { saveVideoResizeJob } from '../api/videoResize.js'
import {
  ensureProjectLoaded,
  getProjectCanvas,
  initProjectsStore,
  updateProjectCanvas
} from '../stores/projects.js'

const router = useRouter()
const route = useRoute()
const defaultEditorProject = createDefaultWatermarkEditorProject()
const quickSettings = ref({ ...defaultEditorProject.quickSettings })
const linkedProjectId = computed(() => String(route.query.project || ''))
const linkedNodeId = computed(() => String(route.query.node || ''))
const isLinkedEditor = computed(() => Boolean(linkedProjectId.value && linkedNodeId.value))
const projectName = ref(defaultEditorProject.title)
const mediaInput = ref(null)
const imageInput = ref(null)
const fontInput = ref(null)
const notice = ref('')
const showExport = ref(false)
const playhead = ref(0)
const playing = ref(false)
const presetKey = ref('vertical')
const cornerRadius = ref(6)
const fps = ref(12)
const colors = ref(128)
const loop = ref('forever')
const fitMode = ref('contain')
const importedFont = ref('system-ui')
const saveState = ref('saved')
const linkedReady = ref(false)
const uploadingMedia = ref(false)
const downloadingResult = ref(false)
const savingToLibrary = ref(false)
const exporting = ref(false)
const exportProgress = ref(0)
const exportStep = ref('')
const exportError = ref('')
const exportResultUrl = ref('')
const outputJobId = ref('')
const outputMetadata = ref({})
const exportStatus = ref('')
const expectedTextTrackCount = ref(0)
let playbackTimer = 0
let projectSaveTimer = 0
let exportPollGeneration = 0
let sequence = 10
const objectUrls = []

const clips = ref(defaultEditorProject.clips)
const textTracks = ref(defaultEditorProject.textTracks)
const imageTracks = ref(defaultEditorProject.imageTracks)
const trackTimeDrafts = createGifEditorTrackTimeDraftStore()

const selectedType = ref('')
const selectedId = ref('')
const textStyleNames = Object.keys(GIF_TEXT_STYLE_PRESETS)
const fitModeLabels = { contain: '完整保留＋黑色留边', blur: '完整保留＋模糊背景', center: '居中裁剪' }
const totalDuration = computed(() => calculateTimelineDuration(clips.value))
const displayedDuration = computed(() => {
  const resultDuration = Number(outputMetadata.value.duration)
  return exportResultUrl.value && Number.isFinite(resultDuration) && resultDuration > 0
    ? resultDuration
    : totalDuration.value
})
const outputPreset = computed(() => GIF_OUTPUT_PRESETS[presetKey.value])
const selectedText = computed(() => selectedType.value === 'text' ? textTracks.value.find(item => item.id === selectedId.value) : null)
const selectedImage = computed(() => selectedType.value === 'image' ? imageTracks.value.find(item => item.id === selectedId.value) : null)
const selectedClip = computed(() => selectedType.value === 'clip' ? clips.value.find(item => item.id === selectedId.value) : null)
const selectedItem = computed(() => selectedText.value || selectedImage.value || selectedClip.value)
const watermarkLibrary = computed(() => imageTracks.value.filter(item => item.saved))
const exportWatermark = computed(() => selectedImage.value?.url ? selectedImage.value : imageTracks.value.find(item => item.saved && item.url) || imageTracks.value.find(item => item.url))
// 后端 schema 只收一个 watermark 对象，导出时会静默只挑一张。宁可挡住也不要悄悄丢。
const watermarkOverflow = computed(() => findGifEditorWatermarkOverflow(imageTracks.value))
const canExport = computed(() => Boolean(
  clips.value[0]?.url
  && (exportWatermark.value?.url || textTracks.value.length)
  && !watermarkOverflow.value
))
const jobStatusText = computed(() => {
  if (exporting.value) return `真实 GIF 合成 ${exportProgress.value}% · ${exportStep.value || '等待后端状态'}`
  if (exportResultUrl.value) return '真实水印 GIF 已生成'
  return isLinkedEditor.value ? '画板节点详情编辑' : '独立 GIF 水印编辑'
})
const saveStatus = computed(() => {
  if (!isLinkedEditor.value) return '独立编辑草稿'
  if (!linkedReady.value) return '正在读取节点工程…'
  return saveState.value === 'saving' ? '正在保存到节点…' : '已保存到节点'
})
const normalizedTrackRange = item => normalizeGifEditorTrackRange(item, totalDuration.value)
const activeTextTracks = computed(() => textTracks.value.filter(item => isGifEditorTrackActive(item, playhead.value, totalDuration.value)))
const activeImageTracks = computed(() => imageTracks.value.filter(item => isGifEditorTrackActive(item, playhead.value, totalDuration.value)))
const safeTimelineRangeStyle = item => {
  const range = normalizedTrackRange(item)
  return timelineRangeStyle(range.start, range.end, totalDuration.value)
}
const trackTimeInputValue = (type, item, field) => trackTimeDrafts.get(type, item, field)
const handleTrackTimeInput = (type, item, field, event) => {
  if (!item) return
  trackTimeDrafts.set(type, item, field, event?.target?.value ?? '')
}
const commitTrackTimeInput = (type, item, field) => {
  if (!item) return
  const value = trackTimeDrafts.get(type, item, field)
  const range = normalizeGifEditorTrackRange(item, totalDuration.value, { [field]: value })
  item.start = range.start
  item.end = range.end
  trackTimeDrafts.clearField(type, item, field)
}
const rulerMarks = computed(() => Array.from({ length: 7 }, (_, index) => Number((totalDuration.value / 6 * index).toFixed(1))))

const activeClip = computed(() => {
  let elapsed = 0
  for (const clip of clips.value) {
    elapsed += Number(clip.duration) || 0
    if (playhead.value <= elapsed) return clip
  }
  return clips.value.at(-1)
})

// 舞台是输出画面的等比缩放：宽高比锁死输出尺寸，底色跟着 fit_mode 走
//（contain 的留边后端写死 color=black）。字号用 cqh，所以这里必须建立尺寸容器。
const stageStyle = computed(() => ({
  aspectRatio: `${outputPreset.value.width} / ${outputPreset.value.height}`,
  borderRadius: `${clampCornerRadius(cornerRadius.value)}%`,
  background: gifPreviewStageBackground(fitMode.value)
}))
const showBlurBackdrop = computed(() => gifPreviewUsesBlurBackdrop(fitMode.value))
const mediaStyle = computed(() => ({ objectFit: gifPreviewMediaFit(fitMode.value) }))
const fitModeLabel = computed(() => fitModeLabels[fitMode.value] || fitMode.value)

const editorSnapshot = () => sanitizeWatermarkEditorProject({
  title: projectName.value,
  clips: clips.value,
  textTracks: textTracks.value,
  imageTracks: imageTracks.value,
  watermarkLibrary: watermarkLibrary.value.map(item => ({ id: item.id, name: item.name, kind: 'image' })),
  output: { presetKey: presetKey.value, cornerRadius: cornerRadius.value, fps: fps.value, colors: colors.value, loop: loop.value, fitMode: fitMode.value },
  quickSettings: {
    ...quickSettings.value,
    watermarkId: quickSettings.value.watermarkId || watermarkLibrary.value[0]?.id || '',
    size: watermarkLibrary.value[0]?.size || 22,
    opacity: watermarkLibrary.value[0]?.opacity ?? 92
  },
  result: {
    jobId: outputJobId.value,
    status: exportStatus.value,
    progress: exportProgress.value,
    outputUrl: exportResultUrl.value,
    error: exportError.value,
    metadata: outputMetadata.value
  }
})

const applyEditorProject = value => {
  trackTimeDrafts.clearAll()
  const project = sanitizeWatermarkEditorProject(value)
  projectName.value = project.title
  const resultDuration = Number(project.result.metadata?.duration)
  clips.value = project.clips.map((clip, index) => index === 0 && Number.isFinite(resultDuration) && resultDuration > 0
    ? { ...clip, duration: resultDuration }
    : clip)
  textTracks.value = project.textTracks
  imageTracks.value = project.imageTracks
  quickSettings.value = { ...project.quickSettings }
  presetKey.value = project.output.presetKey
  cornerRadius.value = Number(project.output.cornerRadius)
  fps.value = Number(project.output.fps)
  colors.value = Number(project.output.colors)
  loop.value = project.output.loop
  fitMode.value = project.output.fitMode || 'contain'
  outputJobId.value = project.result.jobId
  exportStatus.value = project.result.status
  exportProgress.value = Number(project.result.progress || 0)
  exportResultUrl.value = project.result.outputUrl
  exportError.value = project.result.error
  outputMetadata.value = { ...project.result.metadata }
  selectedType.value = project.textTracks.length ? 'text' : project.imageTracks.length ? 'image' : 'clip'
  selectedId.value = project.textTracks[0]?.id || project.imageTracks[0]?.id || project.clips[0]?.id || ''
}

const persistLinkedProject = () => {
  if (!linkedReady.value || !linkedProjectId.value || !linkedNodeId.value) return false
  const canvas = getProjectCanvas(linkedProjectId.value)
  if (!canvas) return false
  const snapshot = editorSnapshot()
  const compositionReady = Boolean(exportResultUrl.value && outputJobId.value)
  const nodes = (canvas.nodes || []).map(node => node.id === linkedNodeId.value
    ? {
        ...node,
        data: {
          ...node.data,
          label: '水印与素材编辑',
          editorProject: snapshot,
          editorStatus: compositionReady ? 'completed' : exportStatus.value || (exporting.value ? 'running' : 'draft'),
          watermarkCount: snapshot.watermarkLibrary.length,
          quickSettings: snapshot.quickSettings,
          compositionReady,
          outputUrl: exportResultUrl.value,
          outputJobId: outputJobId.value,
          outputMetadata: outputMetadata.value,
          url: compositionReady ? exportResultUrl.value : '',
          gifUrl: compositionReady ? exportResultUrl.value : '',
          mime: compositionReady ? 'image/gif' : node.data?.sourceMime || '',
          updatedAt: Date.now()
        }
      }
    : node)
  saveState.value = 'saving'
  updateProjectCanvas(linkedProjectId.value, { ...canvas, nodes })
  saveState.value = 'saved'
  return true
}

const scheduleLinkedSave = () => {
  if (!linkedReady.value) return
  saveState.value = 'saving'
  window.clearTimeout(projectSaveTimer)
  projectSaveTimer = window.setTimeout(persistLinkedProject, 700)
}

const selectItem = (type, id) => { selectedType.value = type; selectedId.value = id }
const addText = () => {
  if (textTracks.value.length >= 8) { notice.value = '文字轨道最多 8 条'; return }
  const item = {
    id: `text-${++sequence}`,
    text: '双击修改广告文案',
    start: playhead.value,
    end: Math.min(totalDuration.value, playhead.value + 3),
    x: 50,
    y: 50,
    fontSize: 32,
    style: '爆款白字',
    ...resolveGifTextTrackStyle({ style: '爆款白字' })
  }
  textTracks.value.push(item); selectItem('text', item.id)
}

const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('读取上传文件失败'))
  reader.readAsDataURL(file)
})
const fileToBase64 = async file => (await fileToDataUrl(file)).split(',', 2)[1] || ''

const importMedia = async event => {
  notice.value = ''
  const files = [...(event.target.files || [])].slice(0, 1)
  event.target.value = ''
  if (!files.length) return
  uploadingMedia.value = true
  try {
    for (const file of files) {
      const kind = detectEditorMediaKind(file)
      if (!['video', 'gif'].includes(kind)) { notice.value = `${file.name} 不是支持的视频或 GIF`; continue }
      if (file.size > 90 * 1024 * 1024) { notice.value = `${file.name} 超过 90MB`; continue }
      const duration = await probeGifEditorMediaDuration(file, kind)
      const response = await uploadGifEditorMedia({ source_name: file.name, source_base64: await fileToBase64(file) })
      const asset = response?.assets?.[0]
      if (!asset?.url) throw new Error(`${file.name} 上传后未返回素材地址`)
      const clip = { id: `clip-${++sequence}`, name: asset.name || file.name, kind, duration, color: 'linear-gradient(135deg,#172554,#2563eb,#67e8f9)', url: asset.url, mime: asset.mime, width: asset.width, height: asset.height }
      clips.value = [clip]; selectItem('clip', clip.id)
      notice.value = `“${file.name}”已上传，导出任务可以安全读取。`
    }
  } catch (error) {
    notice.value = error?.response?.data?.error?.message || error?.message || '素材上传失败'
  } finally {
    uploadingMedia.value = false
  }
}

const importImage = async event => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || detectEditorMediaKind(file) !== 'image') return
  try {
    notice.value = '正在上传水印图片…'
    const response = await uploadGifEditorAsset(await fileToDataUrl(file))
    if (!response?.url) throw new Error('水印上传后未返回素材地址')
    const item = { id: `image-${++sequence}`, name: file.name, start: playhead.value, end: totalDuration.value, x: 82, y: 12, size: 22, opacity: 92, url: response.url, saved: false }
    imageTracks.value.push(item); selectItem('image', item.id)
    notice.value = `“${file.name}”已上传，可保存为当前工程水印。`
  } catch (error) {
    notice.value = error?.response?.data?.error?.message || error?.message || '水印图片上传失败'
  }
}

const saveSelectedWatermark = () => {
  if (!selectedImage.value) return
  selectedImage.value.saved = true
  selectedImage.value.opacity = Number(selectedImage.value.opacity ?? 100)
  quickSettings.value = {
    ...quickSettings.value,
    watermarkId: selectedImage.value.id,
    size: selectedImage.value.size,
    opacity: selectedImage.value.opacity
  }
  notice.value = `“${selectedImage.value.name}”已保存到当前编辑工程的水印库。`
  scheduleLinkedSave()
}

const importFont = async event => {
  const file = event.target.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file); objectUrls.push(url)
  const name = `ImportedAdFont${++sequence}`
  try {
    const font = new FontFace(name, `url(${url})`)
    await font.load(); document.fonts.add(font); importedFont.value = name
    notice.value = `字体“${file.name}”已用于画布预览。`
  } catch { notice.value = '字体无法预览，请换用 TTF、OTF、WOFF 或 WOFF2。' }
  event.target.value = ''
}

const removeSelected = () => {
  if (['text', 'image'].includes(selectedType.value) && selectedItem.value) {
    trackTimeDrafts.clearTrack(selectedType.value, selectedItem.value)
  }
  if (selectedType.value === 'clip') clips.value = clips.value.filter(item => item.id !== selectedId.value)
  if (selectedType.value === 'text') textTracks.value = textTracks.value.filter(item => item.id !== selectedId.value)
  if (selectedType.value === 'image') imageTracks.value = imageTracks.value.filter(item => item.id !== selectedId.value)
  selectedId.value = ''; selectedType.value = ''
  playhead.value = Math.min(playhead.value, totalDuration.value)
}

const clipTimelineStyle = clip => ({ width: `${Math.max(6, clip.duration / totalDuration.value * 100)}%`, background: clip.color })
// 两个 overlay 的换算都在 utils/watermarkEditorProject.js 里，和导出 payload 共用同一份实现，
// 由 tests/gifPreviewBackendParity.test.mjs 逐格和后端 ffmpeg 公式对拍。
const textOverlayStyle = item => gifPreviewTextOverlayStyle(item, {
  outputHeight: outputPreset.value.height,
  fontFamily: importedFont.value
})
const imageOverlayStyle = item => gifPreviewImageOverlayStyle(item)
const applyTextStylePreset = item => {
  if (!item) return
  Object.assign(item, resolveGifTextTrackStyle({ style: item.style }))
}
const stepForward = () => { playhead.value = Math.min(totalDuration.value, playhead.value + 0.5) }
const togglePlayback = () => {
  playing.value = !playing.value
  window.clearInterval(playbackTimer)
  if (!playing.value) return
  playbackTimer = window.setInterval(() => {
    playhead.value = Number((playhead.value + 0.1).toFixed(1))
    if (playhead.value >= totalDuration.value) playhead.value = 0
  }, 100)
}

const publicAssetPath = value => {
  const url = String(value || '')
  if (url.startsWith('/public-assets/')) return url
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.pathname.startsWith('/public-assets/') ? `${parsed.pathname}${parsed.search}` : url
  } catch { return url }
}
const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds))
const applyJobState = job => {
  exportStatus.value = String(job?.status || '')
  exportProgress.value = Math.min(100, Math.max(0, Number(job?.progress || 0)))
  exportStep.value = String(job?.current_step || job?.stage || '')
}
const normalizeTextTracksApplied = (value, expectedCount) => {
  const applied = Number(value)
  const count = Number.isInteger(applied) && applied >= 0 ? applied : 0
  if (expectedCount > 0 && count !== expectedCount) {
    throw new Error(`后端返回的文字轨道实际合成数量不足或不匹配（${count}/${expectedCount}），本次结果不会标记为成品`)
  }
  return count
}
const completeExport = job => {
  const result = job?.results?.[0] || {}
  const duration = getGifEditorJobDuration(job)
  const outputUrl = String(result.gif_url || '')
  if (!outputUrl) throw new Error('任务已完成，但没有返回 GIF 成品地址')
  if (exportWatermark.value?.url && result.watermark_applied !== true) throw new Error('后端未确认图片水印已合成，本次结果不会标记为成品')
  const textTracksApplied = normalizeTextTracksApplied(result.text_tracks_applied, expectedTextTrackCount.value)
  exportResultUrl.value = outputUrl
  exportStatus.value = 'completed'
  exportProgress.value = 100
  if (duration && clips.value[0]) clips.value[0].duration = duration
  outputMetadata.value = {
    width: Number(result.actual_width || 0),
    height: Number(result.actual_height || 0),
    duration,
    fps: Number(result.fps || fps.value),
    colors: Number(result.colors || colors.value),
    loop: result.loop ?? loop.value,
    cornerRadius: Number(result.corner_radius ?? cornerRadius.value),
    watermarkApplied: result.watermark_applied === true,
    textTracksApplied
  }
  persistLinkedProject()
}
const downloadExportResult = async () => {
  if (!exportResultUrl.value || downloadingResult.value) return
  downloadingResult.value = true
  exportError.value = ''
  try {
    const result = await startAssetDownload({
      url: exportResultUrl.value,
      fileName: `${projectName.value || '编辑 GIF'}.gif`,
      label: '编辑 GIF 成品'
    })
    notice.value = `已开始下载：${result.filename}`
  } catch (error) {
    exportError.value = error?.message || 'GIF 下载失败'
  } finally {
    downloadingResult.value = false
  }
}
// 成品落在 PUBLIC_ASSET_DIR，默认 24 小时 TTL（material_generation_api.py
// DEFAULT_MATERIAL_PUBLIC_ASSET_TTL_SECONDS）。只给「下载」按钮等于把长期留存的责任
// 全推给用户的下载目录，所以把后端本来就有的 /save 接上。
const saveExportToLibrary = async () => {
  if (!outputJobId.value || savingToLibrary.value) return
  savingToLibrary.value = true
  exportError.value = ''
  try {
    const result = await saveVideoResizeJob(outputJobId.value)
    notice.value = result?.saved
      ? `已保存到服务器素材库（${Number(result.saved_count || 0)} 个文件）`
      : '后端没有找到可保存的成品文件'
  } catch (error) {
    exportError.value = error?.response?.data?.error?.message || error?.message || '保存到素材库失败'
  } finally {
    savingToLibrary.value = false
  }
}
const followExportJob = async (jobId, generation) => {
  while (generation === exportPollGeneration) {
    const job = await getGifEditorJob(jobId)
    if (generation !== exportPollGeneration) return
    applyJobState(job)
    if (isWatermarkEditorJobTerminal(job.status)) {
      if (job.status !== 'completed') throw new Error(job.error || (job.status === 'cancelled' ? '任务已取消' : 'GIF 水印合成失败'))
      completeExport(job)
      return
    }
    await wait(1500)
  }
}
const runExport = async () => {
  exportError.value = ''
  exportResultUrl.value = ''
  outputMetadata.value = {}
  if (!clips.value[0]?.url) { exportError.value = '请先导入一段 GIF 或视频'; return }
  if (watermarkOverflow.value) { exportError.value = watermarkOverflow.value; return }
  const watermark = exportWatermark.value
  const watermarkRange = watermark ? normalizedTrackRange(watermark) : null
  const normalizedTextTracks = textTracks.value.map(item => ({ ...item, ...normalizedTrackRange(item) }))
  let payload
  try {
    payload = buildGifEditorJobPayload({
      source_url: publicAssetPath(clips.value[0].url),
      watermark: buildGifEditorWatermarkPayload(watermark, {
        imageUrl: watermark?.url ? publicAssetPath(watermark.url) : '',
        range: watermarkRange,
        sourceDuration: totalDuration.value
      }),
      text_tracks: normalizedTextTracks,
      duration: totalDuration.value,
      output: {
        width: outputPreset.value.width,
        height: outputPreset.value.height,
        fit_mode: fitMode.value,
        fps: fps.value,
        colors: colors.value,
        loop: loop.value,
        corner_radius: cornerRadius.value
      }
    })
  } catch (error) {
    exportError.value = error?.message || '导出设置无效'
    return
  }
  expectedTextTrackCount.value = payload.text_tracks?.length || 0
  exporting.value = true
  const generation = ++exportPollGeneration
  try {
    const created = await createGifEditorJob(payload)
    if (!created?.job_id) throw new Error('后端未返回任务 ID')
    outputJobId.value = created.job_id
    applyJobState(created)
    persistLinkedProject()
    await followExportJob(created.job_id, generation)
  } catch (error) {
    if (generation !== exportPollGeneration) return
    exportStatus.value = 'failed'
    exportError.value = error?.response?.data?.error?.message || error?.message || 'GIF 水印合成失败'
    persistLinkedProject()
  } finally {
    if (generation === exportPollGeneration) exporting.value = false
  }
}

const saveAndReturn = () => {
  window.clearTimeout(projectSaveTimer)
  persistLinkedProject()
  linkedReady.value = false
  router.push(`/canvas/${linkedProjectId.value}`)
}

const handleBack = () => {
  if (isLinkedEditor.value) saveAndReturn()
  else router.push('/')
}

watch(projectName, scheduleLinkedSave)
watch(
  [clips, textTracks, imageTracks, presetKey, cornerRadius, fps, colors, loop, fitMode],
  () => {
    if (linkedReady.value && exportStatus.value === 'completed' && !exporting.value) {
      exportStatus.value = ''
      exportResultUrl.value = ''
      outputJobId.value = ''
      outputMetadata.value = {}
      notice.value = '编辑设置已改变，请重新导出水印 GIF。'
    }
    scheduleLinkedSave()
  },
  { deep: true }
)

onMounted(async () => {
  if (!linkedProjectId.value || !linkedNodeId.value) return
  try {
    await initProjectsStore()
    await ensureProjectLoaded(linkedProjectId.value)
    const canvas = getProjectCanvas(linkedProjectId.value)
    const node = canvas?.nodes?.find(item => item.id === linkedNodeId.value)
    if (!node) throw new Error('画板中找不到对应的水印节点')
    const sanitizedBase = sanitizeWatermarkEditorProject(node.data?.editorProject || createDefaultWatermarkEditorProject({ title: node.data?.label || projectName.value }))
    const knownSourceDuration = Number(node.data?.duration || sanitizedBase.result.metadata?.duration || 0)
    const sourceProject = createWatermarkEditorProjectForSource({
      title: sanitizedBase.title,
      url: node.data?.sourceUrl || (node.data?.compositionReady ? '' : node.data?.gifUrl || node.data?.url),
      mime: node.data?.sourceMime || node.data?.mime,
      label: node.data?.sourceLabel || '画板上游素材',
      duration: knownSourceDuration,
      width: node.data?.width,
      height: node.data?.height
    })
    const { project: restoredProject, sourceChanged } = restoreWatermarkEditorProject({
      savedProject: sanitizedBase,
      sourceProject,
      nodeData: node.data
    })
    if (!(knownSourceDuration > 0) && restoredProject.clips[0]?.url) {
      restoredProject.clips[0].duration = await probeGifEditorMediaDuration(
        restoredProject.clips[0].url,
        restoredProject.clips[0].kind
      )
    }
    applyEditorProject(restoredProject)
    await nextTick()
    linkedReady.value = true
    saveState.value = 'saved'
    if (sourceChanged) persistLinkedProject()
    if (outputJobId.value && !isWatermarkEditorJobTerminal(exportStatus.value)) {
      exporting.value = true
      const generation = ++exportPollGeneration
      followExportJob(outputJobId.value, generation)
        .catch(error => {
          if (generation !== exportPollGeneration) return
          exportStatus.value = 'failed'
          exportError.value = error?.response?.data?.error?.message || error?.message || '恢复 GIF 任务失败'
          persistLinkedProject()
        })
        .finally(() => { if (generation === exportPollGeneration) exporting.value = false })
    }
  } catch (error) {
    notice.value = error?.message || '节点编辑工程读取失败，已打开默认草稿。'
  }
})

onBeforeUnmount(() => {
  window.clearInterval(playbackTimer)
  window.clearTimeout(projectSaveTimer)
  exportPollGeneration += 1
  persistLinkedProject()
  objectUrls.forEach(url => URL.revokeObjectURL(url))
})
</script>

<style scoped>
.gif-editor-page{height:100vh;overflow:hidden;background:#070a11;color:#e7ecf5;font-family:Inter,"PingFang SC",system-ui,sans-serif}.editor-header{height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #252b37;background:#0b0f17;padding:0 18px}.header-left,.header-actions,.header-center,.project-line{display:flex;align-items:center}.header-left{gap:12px}.header-actions{gap:8px}.header-center{gap:7px;color:#717b8e;font-size:12px}.header-center button{border:0;background:#161c27;color:#818b9d;border-radius:7px;padding:7px 10px}.brand-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;background:linear-gradient(135deg,#5eead4,#22d3ee);color:#051116;font-size:12px;font-weight:900}.eyebrow{font-size:10px;letter-spacing:.22em;color:#5eead4}.project-line{gap:8px;margin-top:3px}.project-line input{width:210px;border:0;background:transparent;color:#f8fafc;font-size:14px;font-weight:650;outline:none}.project-line span{font-size:10px;color:#697386}.icon-button,.secondary,.primary{border-radius:9px;padding:9px 13px;border:1px solid #2b3443;background:#111722;color:#d6deeb;cursor:pointer}.icon-button{width:38px;height:38px;padding:0}.primary{border-color:#5eead4;background:#5eead4;color:#06201e;font-weight:800}.primary:disabled{cursor:not-allowed;opacity:.45}.secondary:hover,.icon-button:hover{border-color:#4b596d}.editor-workspace{height:calc(100vh - 68px);display:grid;grid-template-columns:238px minmax(620px,1fr) 286px;min-width:1150px;min-height:0}.asset-sidebar,.inspector-sidebar{min-height:0;background:#0d121b}.asset-sidebar{border-right:1px solid #252b37;padding:14px}.inspector-sidebar{border-left:1px solid #252b37;padding:14px}.scroll-area{overflow-y:auto;overscroll-behavior:contain}.panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-weight:750}.panel-title small{color:#697386;font-size:10px}.panel-title button{border:0;background:transparent;color:#fb7185;font-size:11px;cursor:pointer}.import-card{width:100%;border:1px dashed #385167;border-radius:12px;background:#101a24;color:#dce7f4;padding:16px;cursor:pointer}.import-card:disabled{cursor:wait;opacity:.6}.main-import span{display:block;color:#5eead4;font-size:25px}.main-import b,.main-import small{display:block}.main-import small{margin-top:4px;color:#718096}.quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 16px}.quick-actions button{min-height:65px;border:1px solid #293344;border-radius:10px;background:#131a25;color:#dce4ef;cursor:pointer}.quick-actions span,.quick-actions b{display:block}.quick-actions span{color:#5eead4;font-weight:900}.quick-actions b{margin-top:4px;font-size:11px}.asset-section{border-top:1px solid #202735;padding-top:13px;margin-top:13px}.section-label{margin-bottom:9px;color:#778298;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.asset-item{width:100%;display:flex;align-items:center;gap:9px;border:1px solid transparent;border-radius:9px;background:transparent;color:#d7deea;padding:6px;text-align:left;cursor:pointer}.asset-item:hover,.asset-item.selected{border-color:#2dd4bf;background:#122126}.asset-thumb{display:grid;flex:0 0 42px;height:36px;place-items:center;border-radius:7px;color:white;font-size:9px;font-weight:900}.text-thumb{background:#4c1d95}.image-thumb{background:#164e63}.asset-item b,.asset-item small{display:block;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-item b{font-size:11px}.asset-item small{margin-top:3px;color:#687386;font-size:9px}.empty-watermark{color:#687386;font-size:10px;line-height:1.5}.watermark-overflow,.inspector-warning{margin-top:8px;border:1px solid #7c4a52;border-radius:8px;background:#2a1417;padding:8px;color:#fda4af;font-size:10px;line-height:1.6}.notice{border:1px solid #2b645f;border-radius:9px;background:#0f2826;padding:9px;color:#8ce7dc;font-size:10px}.editor-center{min-width:0;min-height:0;display:grid;grid-template-rows:42px minmax(220px,1fr) 46px 256px;background:#080c13}.preview-toolbar,.transport-bar,.timeline-header{display:flex;align-items:center;justify-content:space-between}.preview-toolbar{justify-content:center;border-bottom:1px solid #202735;padding:0 14px;color:#8d98aa;font-size:10px}.transport-bar button,.timeline-header button{border:1px solid transparent;border-radius:6px;background:#121925;color:#98a4b7;padding:5px 8px;cursor:pointer}.canvas-size{color:#657187}.preview-area{min-height:0;display:grid;place-items:center;overflow:hidden;padding:12px;background:radial-gradient(circle at 50% 45%,#17202e,#080c13 64%)}.stage-shadow{height:100%;max-height:440px;max-width:100%;display:grid;place-items:center}.preview-stage{position:relative;height:100%;max-width:100%;container-type:size;overflow:hidden;background:#000;box-shadow:0 20px 70px rgba(0,0,0,.55);transition:border-radius .2s}.stage-media,.stage-backdrop,.placeholder-scene{position:absolute;inset:0;width:100%;height:100%}.stage-backdrop{object-fit:cover;transform:scale(1.1);filter:blur(20px);opacity:.75;pointer-events:none}.placeholder-scene{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;overflow:hidden}.placeholder-scene b{z-index:1;font-size:clamp(14px,2vw,27px)}.placeholder-scene small{z-index:1;margin-top:7px;opacity:.7}.scene-light{position:absolute;width:60%;height:45%;border-radius:50%;background:rgba(255,255,255,.22);filter:blur(35px);transform:rotate(-22deg)}.stage-text,.stage-image{position:absolute;box-sizing:border-box;border:0;background:transparent;cursor:pointer}.stage-text{color:white;font-weight:900;line-height:1.15}.stage-text.selected,.stage-image.selected{outline:1px dashed #5eead4;box-shadow:0 0 0 3px rgba(94,234,212,.13)}.stage-image{padding:0;line-height:0}.stage-image img{display:block;width:100%;height:auto}.stage-image span{display:grid;aspect-ratio:1;place-items:center;border-radius:18%;background:linear-gradient(135deg,#fb7185,#7c3aed);color:white;font-size:10px;font-weight:900}.transport-bar{justify-content:center;gap:8px;border-top:1px solid #202735;border-bottom:1px solid #202735;padding:0 14px;color:#778298;font-size:11px}.transport-bar strong{color:#e2e8f0}.transport-bar input{max-width:240px;accent-color:#5eead4}.transport-bar .play-button{display:grid;width:30px;height:30px;place-items:center;border-radius:50%;background:#e8edf5;color:#121720}.timeline-panel{min-height:0;overflow:hidden}.timeline-header{height:43px;border-bottom:1px solid #202735;padding:0 12px;font-size:11px}.timeline-header>div{display:flex;align-items:center;gap:7px}.timeline-header input{width:70px;accent-color:#5eead4}.timeline-scroll{height:213px;display:grid;grid-template-columns:78px 1fr;overflow:auto}.timeline-labels{display:grid;grid-template-rows:30px repeat(3,60px);border-right:1px solid #202735;background:#0c111a;color:#687386;font-size:9px;text-align:center}.timeline-labels span{display:grid;place-items:center;border-bottom:1px solid #202735}.timeline-tracks{position:relative;min-width:620px}.ruler-row,.track-row{position:relative;border-bottom:1px solid #202735}.ruler-row{height:30px;background:#0b1018}.ruler-row span{position:absolute;bottom:6px;color:#596477;font-size:8px;transform:translateX(-50%)}.track-row{height:60px;background:linear-gradient(90deg,transparent 24.9%,#161d29 25%,transparent 25.1%,transparent 49.9%,#161d29 50%,transparent 50.1%,transparent 74.9%,#161d29 75%,transparent 75.1%)}.video-track{display:flex;padding:7px 3px;gap:3px}.clip-block{min-width:0;height:46px;border:1px solid #3b4b60;border-radius:7px;color:#fff;overflow:hidden;text-align:left;padding:5px 7px;cursor:pointer}.clip-block.selected,.range-block.selected{border-color:#5eead4;box-shadow:0 0 0 2px rgba(94,234,212,.16)}.clip-block span,.clip-block b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.clip-block span{font-size:7px;opacity:.7}.clip-block b{font-size:9px;margin-top:3px}.range-block{position:absolute;top:10px;height:39px;border:1px solid #6d4ec4;border-radius:6px;color:#f3e8ff;overflow:hidden;padding:0 8px;text-align:left;font-size:9px;white-space:nowrap}.text-range{background:#42206f}.image-range{border-color:#0e7490;background:#164e63}.playhead{position:absolute;z-index:8;top:0;bottom:0;width:1px;background:#fb7185;pointer-events:none}.playhead span{position:absolute;top:0;left:50%;width:9px;height:9px;background:#fb7185;transform:translate(-50%,-35%) rotate(45deg)}.inspector-section{border-top:1px solid #222b38;padding:14px 0}.inspector-section:first-of-type{border-top:0}.inspector-section label{display:block;margin:10px 0;color:#8c98ab;font-size:10px}.inspector-section input,.inspector-section select,.inspector-section textarea{width:100%;margin-top:5px;border:1px solid #2b3545;border-radius:8px;background:#080d15;color:#e7edf6;padding:8px;outline:none}.inspector-section input:disabled{cursor:not-allowed;opacity:.55}.inspector-section input[type=color]{height:34px;padding:2px}.inspector-section input[type=range]{padding:0;accent-color:#5eead4}.inspector-section textarea{resize:vertical}.inspector-section p{color:#667286;font-size:10px;line-height:1.5}.save-watermark{width:100%;margin:5px 0 10px;border:1px solid #2dd4bf;border-radius:8px;padding:8px;color:#a7f3d0;background:#0f2826;cursor:pointer}.field-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.selected-file{border-radius:8px;background:#141c27;padding:9px;color:#dbe4ef;font-size:11px}.preset-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px}.preset-buttons button{border:1px solid #293344;border-radius:8px;background:#111822;color:#cad4e2;padding:8px 5px;cursor:pointer}.preset-buttons button.active{border-color:#5eead4;background:#102725}.preset-buttons b,.preset-buttons small{display:block}.preset-buttons b{font-size:10px}.preset-buttons small{margin-top:3px;color:#6d788b;font-size:8px}.export-summary{margin:12px 0;border:1px solid #2f3b4b;border-radius:10px;background:#111925;padding:11px}.export-summary span,.export-summary b,.export-summary small{display:block}.export-summary span{color:#667286;font-size:9px}.export-summary b{margin:4px 0;color:#5eead4;font-size:12px}.export-summary small{color:#8a96a9;font-size:9px}.wide{width:100%}.modal-backdrop{position:fixed;z-index:100;inset:0;display:grid;place-items:center;background:rgba(1,4,9,.78);backdrop-filter:blur(7px)}.export-modal{position:relative;width:min(460px,calc(100vw - 32px));border:1px solid #344154;border-radius:18px;background:#101722;padding:28px;box-shadow:0 30px 100px rgba(0,0,0,.6)}.modal-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#8a96a9;font-size:24px;cursor:pointer}.modal-icon{display:grid;width:56px;height:56px;place-items:center;border-radius:15px;background:linear-gradient(135deg,#5eead4,#22d3ee);color:#08201f;font-weight:950}.export-modal h2{margin:8px 0}.export-modal p{color:#8f9bad;font-size:12px;line-height:1.7}.export-modal dl{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:18px 0}.export-modal dl div{border-radius:9px;background:#171f2b;padding:10px}.export-modal dt{color:#6d788b;font-size:9px}.export-modal dd{margin:4px 0 0;font-size:11px;font-weight:700}.result-preview{display:block;max-height:260px;width:100%;border-radius:12px;background:#05070b;object-fit:contain}.export-progress{height:7px;overflow:hidden;border-radius:999px;background:#283141}.export-progress span{display:block;height:100%;border-radius:inherit;background:#5eead4;transition:width .25s}.export-error{color:#fda4af!important}.result-download{display:block;border:0;cursor:pointer;width:100%;border-radius:9px;background:#5eead4;padding:10px;text-align:center;color:#06201e;font-size:13px;font-weight:800}.result-save{display:block;width:100%;margin-top:8px;border:1px solid #2dd4bf;border-radius:9px;background:#0f2826;padding:10px;text-align:center;color:#a7f3d0;font-size:13px;font-weight:700;cursor:pointer}.result-save:disabled{cursor:not-allowed;opacity:.5}.result-hint{margin:8px 0 0;color:#7c8496;font-size:10px;line-height:1.6}.result-download+.secondary,.result-hint+.secondary{margin-top:8px}@media(max-width:1250px){.editor-workspace{grid-template-columns:210px minmax(600px,1fr) 260px}.asset-sidebar,.inspector-sidebar{padding:10px}}
</style>
