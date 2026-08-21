<template>
  <WorkspaceShell
    active-section="recent"
    project-title="最近生成"
    :service-status="serviceStatus"
    @navigate="handleWorkspaceNavigate"
    @open-status="refreshServiceHealth"
    @open-tasks="router.push(resolveWorkspaceNavigationTarget('tasks'))"
  >
    <template #main>
      <section class="recent-page">
        <header class="recent-hero">
          <div>
            <div class="recent-eyebrow">CREATIVE LIBRARY</div>
            <h1>最近生成</h1>
            <p>直接查看生成结果，不需要先打开原项目。图片可以一键送入画布继续处理。</p>
          </div>
          <button type="button" class="refresh-button" :disabled="loading" @click="loadAssets">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
        </header>

        <div class="filter-row" aria-label="素材类型">
          <button
            v-for="filter in filters"
            :key="filter.value"
            type="button"
            :class="{ active: activeType === filter.value }"
            @click="selectType(filter.value)"
          >
            {{ filter.label }}
          </button>
        </div>

        <div v-if="error" class="state-card state-card--error" role="alert">
          <b>暂时无法读取最近生成</b>
          <span>{{ error }}</span>
          <button type="button" @click="loadAssets">重试</button>
        </div>
        <div v-else-if="loading && !assets.length" class="state-card">正在读取最近结果…</div>
        <div v-else-if="!assets.length" class="state-card">
          <b>还没有这类生成结果</b>
          <span>完成一次图片、视频或 GIF 生成后，会自动出现在这里。</span>
        </div>

        <div v-else class="asset-grid">
          <article v-for="asset in assets" :key="asset.id" class="asset-card">
            <div class="asset-preview">
              <video
                v-if="asset.media_type === 'video'"
                :src="asset.url"
                controls
                preload="metadata"
              />
              <audio
                v-else-if="asset.media_type === 'audio'"
                :src="asset.url"
                controls
                preload="metadata"
              />
              <img v-else :src="asset.url" :alt="asset.name" loading="lazy" />
              <span class="type-badge">{{ typeLabel(asset.media_type) }}</span>
            </div>
            <div class="asset-body">
              <h2 :title="asset.name">{{ asset.name }}</h2>
              <p>{{ formatDate(asset.created_at) }} · {{ formatRecentAssetSize(asset.size_bytes) }}</p>
              <div class="asset-actions">
                <button
                  v-if="asset.media_type === 'image'"
                  type="button"
                  class="primary-action"
                  @click="openImageInCanvas(asset)"
                >
                  去处理
                </button>
                <a :href="asset.download_url" :download="asset.name">下载</a>
                <a :href="asset.url" target="_blank" rel="noopener">查看原文件</a>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </WorkspaceShell>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WorkspaceShell from '../components/workspace/WorkspaceShell.vue'
import { listRecentGenerations } from '../api/recentGenerations.js'
import { createProject, initProjectsStore } from '../stores/projects.js'
import { buildRecentImageCanvas, formatRecentAssetSize } from '../utils/recentGenerations.js'
import { resolveWorkspaceNavigationTarget } from '../config/workspaceLaunch.js'
import { useServiceStatus } from '../stores/serviceHealth.js'

const router = useRouter()
// Real `GET /health` probe shared with every other view; never a hardcoded "已连接".
const { serviceStatus, refreshServiceHealth } = useServiceStatus()
const filters = [
  { label: '全部', value: '' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: 'GIF', value: 'gif' },
  { label: '音频', value: 'audio' }
]
const assets = ref([])
const activeType = ref('')
const loading = ref(false)
const error = ref('')

const loadAssets = async () => {
  void refreshServiceHealth()
  loading.value = true
  error.value = ''
  try {
    assets.value = await listRecentGenerations({ type: activeType.value, limit: 100 })
  } catch (loadError) {
    error.value = loadError?.message || '请稍后重试'
  } finally {
    loading.value = false
  }
}

const selectType = type => {
  if (activeType.value === type) return
  activeType.value = type
  loadAssets()
}

const typeLabel = type => ({ image: '图片', video: '视频', gif: 'GIF', audio: '音频' })[type] || '素材'
const formatDate = value => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const openImageInCanvas = async asset => {
  await initProjectsStore()
  const nodeId = `recent-image-${Date.now()}`
  const id = createProject(`图片处理 · ${asset.name}`, {
    name: `图片处理 · ${asset.name}`,
    thumbnail: asset.url,
    canvasData: buildRecentImageCanvas(asset, {
      nodeId,
      now: Date.now()
    })
  })
  router.push(`/canvas/${id}`)
}

const handleWorkspaceNavigate = item => {
  if (item.id === 'recent') return
  router.push(resolveWorkspaceNavigationTarget(item.id))
}

onMounted(() => {
  initProjectsStore().catch(() => {})
  loadAssets()
})
</script>

<style scoped>
.recent-page{min-height:calc(100vh - 68px);padding:32px clamp(18px,4vw,56px) 64px}.recent-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;max-width:1500px;margin:0 auto}.recent-eyebrow{font-size:12px;letter-spacing:.32em;color:#48e2d0}.recent-hero h1{margin:8px 0 6px;font-size:clamp(28px,4vw,46px);line-height:1.1}.recent-hero p{max-width:720px;margin:0;color:var(--text-secondary);line-height:1.7}.refresh-button,.filter-row button,.asset-actions a,.asset-actions button,.state-card button{border:1px solid var(--border-color);border-radius:12px;padding:9px 14px;color:var(--text-primary);background:rgba(255,255,255,.035);transition:160ms ease}.refresh-button:hover,.filter-row button:hover,.asset-actions a:hover,.asset-actions button:hover,.state-card button:hover{border-color:rgba(72,226,208,.65);background:rgba(72,226,208,.09)}.refresh-button:disabled{opacity:.5}.filter-row{display:flex;flex-wrap:wrap;gap:8px;max-width:1500px;margin:28px auto 18px}.filter-row button.active{border-color:#48e2d0;color:#05131a;background:#48e2d0}.asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px;max-width:1500px;margin:0 auto}.asset-card{min-width:0;overflow:hidden;border:1px solid var(--border-color);border-radius:20px;background:rgba(13,19,30,.88);box-shadow:0 20px 50px rgba(0,0,0,.18)}.asset-preview{position:relative;display:grid;place-items:center;aspect-ratio:16/11;overflow:hidden;background:#03060b}.asset-preview img,.asset-preview video{width:100%;height:100%;object-fit:contain}.asset-preview audio{width:calc(100% - 32px)}.type-badge{position:absolute;top:12px;left:12px;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:5px 9px;color:#e8fffb;background:rgba(4,11,18,.75);font-size:11px;backdrop-filter:blur(12px)}.asset-body{padding:16px}.asset-body h2{overflow:hidden;margin:0;color:var(--text-primary);font-size:15px;text-overflow:ellipsis;white-space:nowrap}.asset-body p{margin:7px 0 15px;color:var(--text-secondary);font-size:12px}.asset-actions{display:flex;flex-wrap:wrap;gap:8px}.asset-actions a,.asset-actions button{font-size:12px;text-decoration:none}.asset-actions .primary-action{border-color:#48e2d0;color:#041213;background:#48e2d0}.state-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;max-width:1500px;min-height:260px;margin:0 auto;border:1px dashed var(--border-color);border-radius:20px;color:var(--text-secondary);text-align:center}.state-card b{color:var(--text-primary)}.state-card--error{border-color:rgba(248,113,113,.4);color:#fca5a5}@media(max-width:640px){.recent-page{padding-top:22px}.recent-hero{align-items:flex-start;flex-direction:column}.refresh-button{align-self:stretch}.asset-grid{grid-template-columns:1fr}}
</style>
