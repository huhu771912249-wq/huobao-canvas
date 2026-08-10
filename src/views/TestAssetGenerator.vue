<template>
  <main class="test-asset-page h-screen overflow-y-auto overscroll-y-contain">
    <header class="page-header">
      <div class="header-inner">
        <button type="button" class="ghost-button" @click="router.push('/')">
          <span aria-hidden="true">←</span> 返回首页
        </button>
        <div class="header-copy">
          <span>TEST ASSET LAB</span>
          <h1>测试素材生成</h1>
          <p>不调用 AI，按广告位规格生成像素完全准确的测试文件。</p>
        </div>
        <button type="button" class="ghost-button" @click="router.push('/recent-generations')">
          最近生成
        </button>
      </div>
    </header>

    <div class="step-rail" aria-label="生成步骤">
      <div v-for="(step, index) in steps" :key="step" class="step-chip" :class="{ active: activeStep >= index + 1 }">
        <span>{{ String(index + 1).padStart(2, '0') }}</span>{{ step }}
      </div>
    </div>

    <section class="generator-layout">
      <div class="form-column">
        <section class="form-panel">
          <div class="section-heading">
            <span>01</span>
            <div><h2>填写尺寸</h2><p>实际输出严格使用这里的宽和高，支持 1–2000 px。</p></div>
          </div>

          <div class="mode-switch" role="group" aria-label="生成方式">
            <button type="button" :class="{ active: !batchMode }" @click="batchMode = false">单个生成</button>
            <button type="button" :class="{ active: batchMode }" @click="batchMode = true">批量生成</button>
          </div>

          <div class="dimension-row">
            <label><span>宽度（px）</span><input v-model="width" type="number" inputmode="numeric" min="1" max="2000" step="1"></label>
            <span class="dimension-times">×</span>
            <label><span>高度（px）</span><input v-model="height" type="number" inputmode="numeric" min="1" max="2000" step="1"></label>
            <button v-if="batchMode" type="button" class="secondary-button add-size" @click="addBatchSize">添加尺寸</button>
          </div>
          <p class="validation-message" :class="{ invalid: !dimensionValidation.ok }" role="status">
            {{ dimensionValidation.ok ? `✓ 尺寸有效：${dimensionValidation.size.width} × ${dimensionValidation.size.height} px` : dimensionValidation.message }}
          </p>

          <div class="preset-grid" aria-label="常用广告位尺寸">
            <button v-for="preset in presets" :key="preset.label" type="button" @click="applyPreset(preset)">
              <b>{{ preset.width }} × {{ preset.height }}</b><small>{{ preset.label }}</small>
            </button>
          </div>

          <div v-if="batchMode" class="batch-size-list">
            <div class="list-title"><b>已加入批量列表</b><span>{{ batchSizes.length }} 个尺寸</span></div>
            <div v-if="batchSizes.length" class="size-tags">
              <span v-for="(size, index) in batchSizes" :key="`${size.width}x${size.height}`">
                {{ size.width }}×{{ size.height }}
                <button type="button" :aria-label="`移除 ${size.width}×${size.height}`" @click="removeBatchSize(index)">×</button>
              </span>
            </div>
            <p v-else>点击预设尺寸或输入宽高后添加。</p>
          </div>
        </section>

        <section class="form-panel">
          <div class="section-heading">
            <span>02</span>
            <div><h2>选择类型</h2><p>单个模式选一种；批量模式可同时输出多种格式。</p></div>
          </div>
          <div class="format-grid">
            <button
              v-for="option in formatOptions"
              :key="option.value"
              type="button"
              :class="{ active: formats.includes(option.value) }"
              @click="toggleFormat(option.value)"
            >
              <span>{{ option.icon }}</span><b>{{ option.label }}</b><small>{{ option.description }}</small>
            </button>
          </div>
          <p class="format-note">※ GIF 会循环播放轻微水印呼吸效果；MP4 生成 2 秒循环测试画面。
          </p>
        </section>

        <section class="form-panel">
          <div class="section-heading">
            <span>03</span>
            <div><h2>设置水印</h2><p>默认自动带入当天日期，文字大小按素材尺寸自适应。</p></div>
          </div>

          <div class="field-grid">
            <label class="full-field"><span>水印文本</span><input v-model="watermarkText" maxlength="160" placeholder="[TEST] YYYY-MM-DD"></label>
            <label><span>水印位置</span><select v-model="watermarkPosition"><option v-for="position in positions" :key="position.value" :value="position.value">{{ position.label }}</option></select></label>
            <label><span>透明度 {{ watermarkOpacity }}%</span><input v-model.number="watermarkOpacity" class="range-input" type="range" min="0" max="100" step="1"></label>
            <label><span>背景颜色</span><div class="color-field"><input v-model="backgroundColor" type="color"><input v-model="backgroundColor" maxlength="7"></div></label>
            <label><span>文字颜色</span><div class="color-field"><input v-model="watermarkColor" type="color"><input v-model="watermarkColor" maxlength="7"></div></label>
          </div>

          <div class="color-swatches" aria-label="高可视度背景色">
            <button v-for="color in backgroundPresets" :key="color" type="button" :style="{ backgroundColor: color }" :aria-label="`使用颜色 ${color}`" @click="backgroundColor = color"></button>
          </div>

          <label class="slot-option">
            <input v-model="showAdSlot" type="checkbox">
            <span><b>在素材中显示广告位名称/ID</b><small>用于确认后台广告位与前端位置的对应关系。</small></span>
          </label>
          <input v-if="showAdSlot" v-model="adSlotId" class="slot-input" maxlength="80" placeholder="例如：home_banner_300x250">
        </section>
      </div>

      <aside class="preview-column">
        <section class="preview-panel">
          <div class="section-heading compact">
            <span>04</span>
            <div><h2>预览确认</h2><p>预览按实际宽高比等比缩放。</p></div>
          </div>
          <div class="preview-ruler">
            <span>{{ previewSize.width }} px</span><span>{{ previewSize.height }} px</span>
          </div>
          <div class="preview-viewport">
            <div
              class="asset-preview"
              :class="[{ animated: formats.includes('gif') || formats.includes('mp4') }, `position-${watermarkPosition}`]"
              :style="previewStyle"
            >
              <div v-if="previewSize.width > 1 && previewSize.height > 1" class="preview-watermark" :style="watermarkStyle">
                <b>{{ watermarkText }}</b><small v-if="showAdSlot && adSlotId">{{ adSlotId }}</small>
              </div>
            </div>
          </div>
          <div class="preview-facts">
            <span><small>实际尺寸</small><b>{{ previewSize.width }} × {{ previewSize.height }} px</b></span>
            <span><small>输出格式</small><b>{{ formats.map(value => value.toUpperCase()).join(' / ') || '未选择' }}</b></span>
            <span><small>预计大小</small><b>约 {{ estimatedSize }}</b></span>
            <span><small>生成数量</small><b>{{ generationCount }} 个</b></span>
          </div>
        </section>

        <section class="generate-panel">
          <div class="section-heading compact">
            <span>05</span>
            <div><h2>生成与下载</h2><p>生成后再核对真实文件尺寸和文件大小。</p></div>
          </div>
          <button type="button" class="generate-button" :disabled="generating || !canGenerate" @click="submit">
            <span v-if="generating" class="spinner" aria-hidden="true"></span>
            {{ generating ? '正在生成文件…' : batchMode ? `批量生成 ${generationCount} 个素材` : '生成测试素材' }}
          </button>
          <p v-if="formHint" class="generate-hint">{{ formHint }}</p>
          <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        </section>
      </aside>
    </section>

    <section v-if="results.length" class="results-section">
      <header>
        <div><span>GENERATED FILES</span><h2>已生成 {{ results.length }} 个素材</h2><p>下列尺寸来自服务器实际成品，可直接用于广告位测试。</p></div>
        <div class="result-header-actions">
          <button type="button" class="secondary-button" @click="returnToEdit">返回编辑</button>
          <button v-if="zipResult" type="button" class="zip-button" @click="download(zipResult)">下载全部 ZIP</button>
        </div>
      </header>
      <div class="result-grid">
        <article v-for="item in results" :key="item.filename" class="result-card">
          <div class="result-media">
            <video v-if="item.format === 'mp4'" :src="item.url" controls muted loop preload="metadata"></video>
            <img v-else :src="item.url" :alt="item.filename">
          </div>
          <div class="result-body">
            <b :title="item.filename">{{ item.filename }}</b>
            <div><span>{{ item.width }} × {{ item.height }} px</span><span>{{ item.format.toUpperCase() }}</span><span>{{ formatTestAssetBytes(item.bytes) }}</span></div>
            <button type="button" @click="download(item)">下载 {{ item.format.toUpperCase() }}</button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { generateTestAssets } from '../api/testAssets.js'
import { startAssetDownload } from '../utils/assetDownload.js'
import {
  buildTestAssetRequest,
  defaultTestWatermark,
  estimateTestAssetBytes,
  formatTestAssetBytes,
  normalizeTestAssetSize
} from '../utils/testAssetGenerator.js'

const router = useRouter()
const steps = ['填写尺寸', '选择类型', '设置水印', '预览确认', '生成与下载']
const presets = [
  { width: 300, height: 250, label: '中矩形' },
  { width: 728, height: 90, label: '横幅' },
  { width: 320, height: 50, label: '移动横幅' },
  { width: 300, height: 600, label: '半页' },
  { width: 160, height: 600, label: '宽幅摩天楼' },
  { width: 1, height: 1, label: '追踪像素' }
]
const formatOptions = [
  { value: 'png', label: 'PNG', icon: '▣', description: '无损静态图片' },
  { value: 'jpg', label: 'JPG', icon: '▧', description: '体积更小的静态图片' },
  { value: 'gif', label: 'GIF', icon: '◎', description: '循环动图测试素材' },
  { value: 'mp4', label: 'MP4', icon: '▶', description: '2 秒循环视频素材' }
]
const positions = [
  { value: 'top-left', label: '左上' }, { value: 'top-center', label: '上方居中' }, { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左侧居中' }, { value: 'center', label: '正中心' }, { value: 'center-right', label: '右侧居中' },
  { value: 'bottom-left', label: '左下' }, { value: 'bottom-center', label: '下方居中' }, { value: 'bottom-right', label: '右下' }
]
const backgroundPresets = ['#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#111827']

const batchMode = ref(false)
const width = ref(300)
const height = ref(250)
const batchSizes = ref([{ width: 300, height: 250 }, { width: 728, height: 90 }])
const formats = ref(['gif'])
const backgroundColor = ref('#ef4444')
const watermarkText = ref(defaultTestWatermark())
const watermarkPosition = ref('center')
const watermarkColor = ref('#ffffff')
const watermarkOpacity = ref(100)
const showAdSlot = ref(false)
const adSlotId = ref('')
const generating = ref(false)
const error = ref('')
const results = ref([])
const zipResult = ref(null)

const dimensionValidation = computed(() => {
  try {
    return { ok: true, size: normalizeTestAssetSize(width.value, height.value), message: '' }
  } catch (validationError) {
    return { ok: false, size: { width: 300, height: 250 }, message: validationError.message }
  }
})
const previewSize = computed(() => dimensionValidation.value.ok ? dimensionValidation.value.size : { width: 300, height: 250 })
const previewStyle = computed(() => ({
  aspectRatio: `${previewSize.value.width} / ${previewSize.value.height}`,
  width: `min(100%, ${Math.min(520, 360 * previewSize.value.width / previewSize.value.height)}px)`,
  backgroundColor: /^#[0-9a-f]{6}$/i.test(backgroundColor.value) ? backgroundColor.value : '#ef4444'
}))
const watermarkStyle = computed(() => ({
  color: /^#[0-9a-f]{6}$/i.test(watermarkColor.value) ? watermarkColor.value : '#ffffff',
  opacity: Number(watermarkOpacity.value) / 100,
  fontSize: `${Math.max(8, Math.min(54, Math.round(Math.min(previewSize.value.width, previewSize.value.height) * 0.16)))}px`
}))
const generationCount = computed(() => (batchMode.value ? batchSizes.value.length : 1) * formats.value.length)
const estimatedSize = computed(() => formatTestAssetBytes(
  formats.value.reduce((total, format) => total + estimateTestAssetBytes(previewSize.value.width, previewSize.value.height, format), 0)
))
const canGenerate = computed(() => (
  dimensionValidation.value.ok && formats.value.length > 0 && (!batchMode.value || batchSizes.value.length > 0) && generationCount.value <= 50
))
const formHint = computed(() => {
  if (!dimensionValidation.value.ok) return '请先修正宽度和高度'
  if (!formats.value.length) return '请至少选择一种输出格式'
  if (batchMode.value && !batchSizes.value.length) return '请先向批量列表添加尺寸'
  if (generationCount.value > 50) return '单次最多生成 50 个文件'
  return '最终文件将再次校验像素尺寸和格式'
})
const activeStep = computed(() => results.value.length ? 5 : generating.value ? 5 : 4)

const applyPreset = preset => {
  width.value = preset.width
  height.value = preset.height
  if (batchMode.value) addBatchSize()
}
const addBatchSize = () => {
  error.value = ''
  if (!dimensionValidation.value.ok) {
    error.value = dimensionValidation.value.message
    return
  }
  const size = dimensionValidation.value.size
  if (!batchSizes.value.some(item => item.width === size.width && item.height === size.height)) batchSizes.value.push(size)
}
const removeBatchSize = index => batchSizes.value.splice(index, 1)
const toggleFormat = value => {
  if (!batchMode.value) {
    formats.value = [value]
    return
  }
  formats.value = formats.value.includes(value)
    ? formats.value.filter(format => format !== value)
    : [...formats.value, value]
}

const submit = async () => {
  error.value = ''
  results.value = []
  zipResult.value = null
  try {
    const payload = buildTestAssetRequest({
      width: width.value,
      height: height.value,
      sizes: batchMode.value ? batchSizes.value : undefined,
      formats: formats.value,
      backgroundColor: backgroundColor.value,
      watermarkText: watermarkText.value,
      watermarkPosition: watermarkPosition.value,
      watermarkColor: watermarkColor.value,
      watermarkOpacity: watermarkOpacity.value,
      adSlotId: showAdSlot.value ? adSlotId.value : ''
    })
    generating.value = true
    const response = await generateTestAssets(payload)
    results.value = Array.isArray(response?.results) ? response.results : []
    zipResult.value = response?.zip || null
    if (!results.value.length) throw new Error('生成完成，但未返回可下载的文件')
    window.$message?.success(`已生成 ${results.value.length} 个精确尺寸素材`)
    window.setTimeout(() => document.querySelector('.results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  } catch (submitError) {
    error.value = submitError?.response?.data?.error?.message || submitError?.message || '素材生成失败'
  } finally {
    generating.value = false
  }
}

const download = async item => {
  try {
    await startAssetDownload({ url: item.download_url || item.url, fileName: item.filename, label: item.filename })
    window.$message?.success(`下载成功：${item.filename}`)
  } catch (downloadError) {
    window.$message?.error(downloadError?.message || '下载失败')
  }
}
const returnToEdit = () => document.querySelector('.generator-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<style scoped>
.test-asset-page{min-height:100vh;color:#f4f7fb;background:radial-gradient(circle at 14% 0%,rgba(36,99,235,.18),transparent 28rem),radial-gradient(circle at 85% 5%,rgba(45,212,191,.13),transparent 30rem),#080c14}.page-header{position:sticky;z-index:20;top:0;border-bottom:1px solid rgba(148,163,184,.14);background:rgba(8,12,20,.88);backdrop-filter:blur(20px)}.header-inner{display:grid;grid-template-columns:160px 1fr 160px;align-items:center;gap:24px;max-width:1500px;margin:auto;padding:18px 24px}.header-copy{text-align:center}.header-copy>span,.results-section header>div>span{color:#43dfcf;font-size:11px;letter-spacing:.34em}.header-copy h1{margin:3px 0 2px;font-size:24px}.header-copy p{margin:0;color:#8f9bae;font-size:12px}.ghost-button,.secondary-button{border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:10px 14px;color:#dce5ef;background:rgba(255,255,255,.035);transition:160ms ease}.ghost-button:hover,.secondary-button:hover{border-color:rgba(67,223,207,.65);background:rgba(67,223,207,.08)}.step-rail{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:1280px;margin:24px auto;padding:0 24px}.step-chip{display:flex;align-items:center;gap:8px;border:1px solid rgba(148,163,184,.14);border-radius:12px;padding:10px 12px;color:#748196;background:rgba(10,16,27,.7);font-size:12px}.step-chip span{display:grid;width:25px;height:25px;place-items:center;border-radius:8px;background:rgba(148,163,184,.08);font-size:10px}.step-chip.active{border-color:rgba(67,223,207,.28);color:#dffef8;background:rgba(67,223,207,.06)}.step-chip.active span{color:#041713;background:#43dfcf}.generator-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(380px,.9fr);gap:20px;max-width:1500px;margin:auto;padding:0 24px 48px}.form-column{display:grid;gap:16px}.preview-column{display:flex;flex-direction:column;gap:16px}.preview-panel{position:sticky;top:104px}.form-panel,.preview-panel,.generate-panel{border:1px solid rgba(148,163,184,.16);border-radius:22px;padding:22px;background:linear-gradient(145deg,rgba(17,25,39,.94),rgba(8,14,25,.93));box-shadow:0 24px 60px rgba(0,0,0,.2)}.section-heading{display:flex;gap:14px;align-items:flex-start}.section-heading>span{display:grid;flex:0 0 auto;width:36px;height:36px;place-items:center;border:1px solid rgba(67,223,207,.3);border-radius:11px;color:#43dfcf;background:rgba(67,223,207,.08);font-size:11px;letter-spacing:.12em}.section-heading h2{margin:0;color:#f6f8fb;font-size:18px}.section-heading p{margin:4px 0 0;color:#8794a7;font-size:12px;line-height:1.6}.section-heading.compact h2{font-size:17px}.mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:18px;padding:5px;border-radius:13px;background:#080d17}.mode-switch button{border-radius:9px;padding:9px;color:#7f8ca0;font-size:12px}.mode-switch button.active{color:#061511;background:#43dfcf;font-weight:700}.dimension-row{display:grid;grid-template-columns:1fr auto 1fr auto;align-items:end;gap:10px;margin-top:16px}.dimension-row label,.field-grid label{display:grid;gap:7px;color:#9aa6b7;font-size:12px}.dimension-row input,.field-grid input:not([type=color]):not([type=range]),.field-grid select,.slot-input{width:100%;border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:11px 12px;color:#f4f7fb;background:#080d17;outline:none}.dimension-row input:focus,.field-grid input:focus,.field-grid select:focus,.slot-input:focus{border-color:#43dfcf;box-shadow:0 0 0 3px rgba(67,223,207,.08)}.dimension-times{padding-bottom:10px;color:#667386}.add-size{min-height:42px}.validation-message{margin:10px 0 0;color:#66e6b9;font-size:12px}.validation-message.invalid{color:#fb7185}.preset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}.preset-grid button{display:grid;gap:2px;border:1px solid rgba(148,163,184,.15);border-radius:12px;padding:10px;color:#dbe4ef;background:rgba(255,255,255,.025);text-align:left}.preset-grid button:hover{border-color:rgba(67,223,207,.5);background:rgba(67,223,207,.06)}.preset-grid small{color:#758297}.batch-size-list{margin-top:14px;border:1px dashed rgba(148,163,184,.2);border-radius:13px;padding:12px}.list-title{display:flex;justify-content:space-between;color:#d7e0eb;font-size:12px}.list-title span,.batch-size-list>p{color:#748196}.size-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.size-tags>span{display:flex;align-items:center;gap:7px;border-radius:99px;padding:5px 8px 5px 10px;color:#c9fff4;background:rgba(67,223,207,.09);font-size:11px}.size-tags button{display:grid;width:18px;height:18px;place-items:center;border-radius:50%;color:#96a7b8;background:rgba(255,255,255,.07)}.format-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:18px}.format-grid button{display:grid;gap:4px;min-height:115px;border:1px solid rgba(148,163,184,.15);border-radius:14px;padding:12px;color:#ced7e3;background:rgba(255,255,255,.025);text-align:left}.format-grid button>span{color:#67e8f9;font-size:23px}.format-grid button small{color:#758297;font-size:10px;line-height:1.45}.format-grid button.active{border-color:#43dfcf;box-shadow:inset 0 0 0 1px rgba(67,223,207,.16);background:rgba(67,223,207,.08)}.format-note{margin:12px 0 0;color:#708096;font-size:11px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}.full-field{grid-column:1/-1}.range-input{width:100%;margin-top:7px;accent-color:#43dfcf}.color-field{display:grid;grid-template-columns:42px 1fr;gap:7px}.color-field input[type=color]{width:42px;height:42px;border:0;border-radius:9px;padding:3px;background:#080d17}.color-swatches{display:flex;gap:8px;margin-top:12px}.color-swatches button{width:28px;height:28px;border:2px solid rgba(255,255,255,.18);border-radius:9px}.slot-option{display:flex;align-items:flex-start;gap:10px;margin-top:16px;border:1px solid rgba(148,163,184,.14);border-radius:13px;padding:12px;color:#d7e0eb;background:rgba(255,255,255,.02);font-size:12px}.slot-option input{margin-top:2px;accent-color:#43dfcf}.slot-option span{display:grid;gap:2px}.slot-option small{color:#7f8ca0}.slot-input{margin-top:9px}.preview-ruler{display:flex;justify-content:space-between;margin:18px 0 7px;color:#66758a;font-size:10px}.preview-viewport{display:grid;min-height:340px;place-items:center;overflow:hidden;border:1px solid rgba(148,163,184,.13);border-radius:16px;padding:20px;background:repeating-conic-gradient(#111827 0 25%,#0c1320 0 50%) 50%/18px 18px}.asset-preview{position:relative;display:flex;width:min(100%,520px);max-height:370px;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.32)}.asset-preview[style*="1 / 1"]{max-width:340px}.preview-watermark{display:flex;max-width:88%;flex-direction:column;align-items:center;justify-content:center;overflow-wrap:anywhere;line-height:1.15;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.28)}.preview-watermark small{margin-top:.22em;font-size:.48em}.position-top-left{align-items:flex-start;justify-content:flex-start;padding:4%}.position-top-center{align-items:flex-start;justify-content:center;padding:4%}.position-top-right{align-items:flex-start;justify-content:flex-end;padding:4%}.position-center-left{justify-content:flex-start;padding:4%}.position-center-right{justify-content:flex-end;padding:4%}.position-bottom-left{align-items:flex-end;justify-content:flex-start;padding:4%}.position-bottom-center{align-items:flex-end;justify-content:center;padding:4%}.position-bottom-right{align-items:flex-end;justify-content:flex-end;padding:4%}.asset-preview.animated .preview-watermark{animation:watermark-pulse 1.02s ease-in-out infinite}.preview-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.preview-facts>span{display:grid;gap:3px;border:1px solid rgba(148,163,184,.12);border-radius:11px;padding:10px;background:rgba(255,255,255,.02)}.preview-facts small{color:#748196;font-size:10px}.preview-facts b{color:#dce5f0;font-size:12px}.generate-button{display:flex;width:100%;min-height:50px;align-items:center;justify-content:center;gap:10px;margin-top:18px;border-radius:13px;color:#041410;background:linear-gradient(90deg,#43dfcf,#67e8f9);font-weight:800}.generate-button:disabled{cursor:not-allowed;opacity:.4}.spinner{width:17px;height:17px;border:2px solid rgba(4,20,16,.25);border-top-color:#041410;border-radius:50%;animation:spin .7s linear infinite}.generate-hint{margin:10px 0 0;color:#738196;font-size:11px;text-align:center}.error-message{margin:12px 0 0;border:1px solid rgba(251,113,133,.3);border-radius:11px;padding:10px;color:#fda4af;background:rgba(251,113,133,.08);font-size:12px}.results-section{max-width:1500px;margin:0 auto 70px;padding:30px 24px 0;border-top:1px solid rgba(148,163,184,.14)}.results-section header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.results-section h2{margin:5px 0;color:#f6f8fb;font-size:25px}.results-section p{margin:0;color:#8290a3;font-size:12px}.result-header-actions{display:flex;gap:8px}.zip-button{border-radius:12px;padding:10px 15px;color:#041410;background:#43dfcf;font-weight:700}.result-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:20px}.result-card{overflow:hidden;border:1px solid rgba(148,163,184,.15);border-radius:17px;background:#0e1623}.result-media{display:grid;aspect-ratio:16/10;place-items:center;overflow:hidden;background:#03070c}.result-media img,.result-media video{width:100%;height:100%;object-fit:contain}.result-body{padding:13px}.result-body>b{display:block;overflow:hidden;color:#e7edf5;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.result-body>div{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 11px}.result-body span{border-radius:99px;padding:4px 7px;color:#93a2b5;background:rgba(255,255,255,.04);font-size:10px}.result-body button{width:100%;border:1px solid rgba(67,223,207,.35);border-radius:10px;padding:8px;color:#adfff0;background:rgba(67,223,207,.06);font-size:11px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes watermark-pulse{50%{opacity:.62}}@media(max-width:1000px){.generator-layout{grid-template-columns:1fr}.preview-panel{position:static}.header-inner{grid-template-columns:auto 1fr auto}.header-copy p{display:none}.step-rail{overflow-x:auto;grid-template-columns:repeat(5,minmax(150px,1fr))}}@media(max-width:640px){.header-inner{grid-template-columns:1fr 1fr;padding:12px 14px}.header-copy{grid-column:1/-1;grid-row:1;text-align:left}.header-copy h1{font-size:20px}.header-inner>.ghost-button:last-child{text-align:right}.step-rail{margin:14px auto;padding:0 14px}.generator-layout{padding:0 14px 36px}.form-panel,.preview-panel,.generate-panel{padding:16px}.dimension-row{grid-template-columns:1fr auto 1fr}.add-size{grid-column:1/-1}.preset-grid{grid-template-columns:repeat(2,1fr)}.format-grid{grid-template-columns:1fr 1fr}.field-grid{grid-template-columns:1fr}.full-field{grid-column:auto}.preview-viewport{min-height:260px}.results-section{padding-inline:14px}.results-section header{align-items:flex-start;flex-direction:column}.result-header-actions{width:100%}.result-header-actions button{flex:1}}@media(prefers-reduced-motion:reduce){.asset-preview.animated .preview-watermark{animation:none}}
.asset-preview{max-height:none}
.preview-panel{position:static}
</style>
