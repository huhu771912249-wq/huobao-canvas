<script>
const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export const shouldPollNovelJob = job => Boolean(job?.status) && !TERMINAL_JOB_STATUSES.has(job.status)
export const shouldClearPollingLoading = (requestGeneration, currentGeneration, isPolling) => requestGeneration === currentGeneration || !isPolling

export const safeDownloadUrl = value => {
  const url = String(value || '').trim()
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? url : ''
  } catch { return '' }
}

export const validateSubtitleTimeline = (segments, totalDuration) => {
  const limit = Number(totalDuration)
  let previousEnd = 0
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const start = Number(segment.start)
    const end = Number(segment.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return { valid: false, message: `第 ${index + 1} 条字幕时间无效` }
    if (start < previousEnd) return { valid: false, message: `第 ${index + 1} 条字幕与上一条重叠` }
    if (Number.isFinite(limit) && limit > 0 && end > limit) return { valid: false, message: `第 ${index + 1} 条字幕超过成片总时长` }
    if (!String(segment.text || '').trim()) return { valid: false, message: `第 ${index + 1} 条字幕不能为空` }
    if (String(segment.speaker || '').length > 200) return { valid: false, message: `第 ${index + 1} 条字幕说话人不能超过 200 字` }
    previousEnd = end
  }
  return { valid: true, message: '' }
}

export const buildSubtitlesFromShots = shots => {
  let cursor = 0
  return (shots || []).map((shot, index) => {
    const duration = Math.max(0.1, Number(shot.duration_seconds || 5))
    const segment = {
      id: `subtitle-${shot.id || index + 1}`,
      start: cursor,
      end: cursor + duration,
      text: String(shot.subtitle || shot.source_text || '').trim(),
      speaker: ''
    }
    cursor += duration
    return segment
  })
}
</script>

<template>
  <section class="space-y-5">
    <div v-if="!editableShots.length" class="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">先上传小说或粘贴正文，再生成故事板。</div>
    <template v-else>
      <div class="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div class="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-semibold">小说成片工作区</h2><p class="mt-1 text-sm text-slate-400">逐镜修改后先保存故事板，再提交生成；系统不会自动消耗额度。</p></div><span class="rounded-full px-3 py-1 text-xs" :class="dirty ? 'bg-amber-400/10 text-amber-200' : 'bg-emerald-400/10 text-emerald-200'">{{ dirty ? '有未保存修改' : '故事板已保存' }}</span></div>
          <div class="mt-5 grid gap-3 sm:grid-cols-2"><button v-for="option in qualityOptions" :key="option.mode" type="button" class="rounded-xl border p-4 text-left" :class="qualityMode === option.mode ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700'" @click="qualityMode = option.mode; dirty = true"><b>{{ option.label }}</b><p class="mt-1 text-xs text-slate-400">{{ option.description }}</p></button></div>
          <div class="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div class="metric"><span>原生分辨率</span><b>{{ nativeResolution }}</b></div><div class="metric"><span>AI 超分</span><b>{{ aiUpscaleResolution }}</b></div><div class="metric"><span>最终输出</span><b>{{ finalResolution }}</b></div></div>
          <div class="mt-5 flex flex-wrap gap-3"><button type="button" class="action-secondary" @click="saveStoryboard">保存故事板</button><button type="button" class="action-primary" :disabled="busy || dirty || Boolean(job)" @click="generateAll">生成全部镜头</button><button v-if="polling" type="button" class="action-secondary" @click="pausePolling">取消跟踪</button><button v-else-if="job && shouldPollNovelJob(job)" type="button" class="action-secondary" @click="resumePolling">恢复跟踪</button></div>
        </div>
        <aside class="rounded-2xl border border-slate-700 bg-slate-900/60 p-5"><h3 class="font-semibold">真实任务状态</h3><div v-if="loading" role="status" class="mt-4 text-cyan-300">正在读取任务状态…</div><div v-else-if="job" class="mt-4 space-y-3 text-sm"><div class="flex justify-between"><span class="text-slate-400">任务</span><b>{{ job.job_id }}</b></div><div class="flex justify-between"><span class="text-slate-400">阶段</span><b>{{ jobStatusLabel }}</b></div><div class="h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full bg-cyan-400 transition-all" :style="{ width: `${realProgress}%` }" /></div><p class="text-xs text-slate-400">{{ completedShots }}/{{ jobShots.length }} 个镜头由后端确认完成</p></div><p v-else class="mt-4 text-sm text-slate-400">尚未提交任务。</p></aside>
      </div>
      <div v-if="error" role="alert" class="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{{ error }}</div>
      <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"><NovelShotCard v-for="(shot, index) in displayShots" :key="shot.id" :shot="shot" :index="index" @change="dirty = true" @retry="retryShot" /></div>
      <SubtitleEditor v-if="job" aria-label="字幕校对" :segments="subtitles" :error="subtitleError" :saving="savingSubtitles" @change="subtitleDirty = true" @save="saveSubtitles" />
      <section v-if="job" class="rounded-2xl border border-slate-700 bg-slate-900/60 p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">最终成片</h3><p class="text-xs text-slate-400">全部镜头完成并校对字幕后，再生成拼接成片。</p></div><button type="button" class="action-primary" :disabled="!canFinalize || busy" @click="finalize">生成最终成片</button></div><div v-if="job.status === 'completed'" class="mt-5 grid gap-3 sm:grid-cols-3"><a v-if="artifactUrl('clean_video_url')" class="download-card" :href="artifactUrl('clean_video_url')" download>下载无字幕 MP4</a><a v-if="artifactUrl('captioned_video_url')" class="download-card" :href="artifactUrl('captioned_video_url')" download>下载带字幕 MP4</a><a v-if="artifactUrl('subtitle_url')" class="download-card" :href="artifactUrl('subtitle_url')" download>下载 SRT 字幕</a></div></section>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import NovelShotCard from './NovelShotCard.vue'
import SubtitleEditor from './SubtitleEditor.vue'
import { createNovelVideoJob, finalizeNovelVideoJob, getNovelVideoJob, retryNovelVideoShot, updateNovelSubtitles } from '../../api/novelVideo'
import { getVideoQualityProfile } from '../../utils/videoQualityProfile'

const props = defineProps({ storyboard: { type: Object, default: null }, aspectRatio: { type: String, default: '16:9' } })
const editableShots = ref([]); const dirty = ref(true); const qualityMode = ref('quality'); const job = ref(null); const loading = ref(false); const busy = ref(false); const error = ref(''); const polling = ref(false); const subtitles = ref([]); const subtitleDirty = ref(false); const subtitleError = ref(''); const savingSubtitles = ref(false)
let pollTimer = null; let pollGeneration = 0

const cloneShots = shots => (shots || []).map((shot, index) => ({ id: String(shot.id || `shot-${index + 1}`), title: shot.title || `镜头 ${index + 1}`, source_text: shot.source_text || '', image_prompt: shot.image_prompt || '', motion_prompt: shot.motion_prompt || '', subtitle: shot.subtitle || shot.source_text || '', duration_seconds: Number(shot.duration_seconds || 5), status: shot.status || 'draft' }))
watch(() => props.storyboard, value => { if (!job.value) { editableShots.value = cloneShots(value?.shots); dirty.value = Boolean(editableShots.value.length) } }, { immediate: true })

const qualityOptions = [{ mode: 'quality', label: '高质量 1080p', description: '原生生成后使用 SeedVR2 AI 超分，适合正式投放。' }, { mode: 'fast', label: '快速导出', description: '跳过 AI 超分，适合预览分镜和快速校对。' }]
const profile = computed(() => getVideoQualityProfile(qualityMode.value, props.aspectRatio))
const nativeResolution = computed(() => props.aspectRatio === '9:16' ? '352 × 608' : '608 × 352')
const aiUpscaleResolution = computed(() => qualityMode.value === 'fast' ? '不启用（保持原生数值）' : props.aspectRatio === '9:16' ? 'SeedVR2 约 1080 × 1864；交付 1080 × 1920' : 'SeedVR2 约 1864 × 1080；交付 1920 × 1080')
const finalResolution = computed(() => `${profile.value.width} × ${profile.value.height}`)
const jobShots = computed(() => job.value?.shots || [])
const displayShots = computed(() => job.value ? jobShots.value : editableShots.value)
const completedShots = computed(() => jobShots.value.filter(shot => shot.status === 'completed').length)
const realProgress = computed(() => jobShots.value.length ? Math.round((completedShots.value / jobShots.value.length) * 100) : 0)
const jobStatusLabel = computed(() => ({ queued: '排队中', generating: '逐镜生成中', upscaling: 'AI 超分中', composing: '拼接中', subtitling: '字幕处理中', completed: '已完成', failed: '失败', cancelled: '已取消' }[job.value?.status] || job.value?.status || '未知'))
const totalDuration = computed(() => displayShots.value.reduce((sum, shot) => sum + Number(shot.duration_seconds || 0), 0))
const canFinalize = computed(() => jobShots.value.length > 0 && jobShots.value.every(shot => shot.status === 'completed') && !subtitleDirty.value && !['composing', 'subtitling', 'completed', 'cancelled'].includes(job.value?.status))

const errorMessage = value => value?.response?.data?.error?.message || value?.message || '操作失败，请稍后重试'
const syncJob = value => { job.value = value; if (!subtitleDirty.value) { const saved = value?.subtitles?.segments || []; subtitles.value = (saved.length ? saved : buildSubtitlesFromShots(value?.shots)).map(segment => ({ ...segment })) } }
const saveStoryboard = () => { error.value = ''; if (!editableShots.value.length) return; const invalid = editableShots.value.find(shot => !shot.source_text.trim() || !shot.image_prompt.trim() || !shot.motion_prompt.trim() || !shot.subtitle.trim() || !(shot.duration_seconds > 0)); if (invalid) { error.value = `${invalid.title} 仍有必填项未完成`; return } dirty.value = false }
const stopPolling = () => { pollGeneration += 1; polling.value = false; if (pollTimer) clearTimeout(pollTimer); pollTimer = null; loading.value = false }
const schedulePoll = generation => { if (generation !== pollGeneration || !polling.value) return; pollTimer = setTimeout(() => pollJob(generation), 2500) }
const pollJob = async generation => { if (!job.value?.job_id || generation !== pollGeneration || !polling.value) return; loading.value = true; try { const fresh = await getNovelVideoJob(job.value.job_id); if (generation !== pollGeneration) return; syncJob(fresh); if (shouldPollNovelJob(fresh)) schedulePoll(generation); else stopPolling() } catch (cause) { if (generation === pollGeneration) { error.value = errorMessage(cause); stopPolling() } } finally { if (shouldClearPollingLoading(generation, pollGeneration, polling.value)) loading.value = false } }
const resumePolling = () => { if (!job.value || !shouldPollNovelJob(job.value)) return; stopPolling(); polling.value = true; const generation = pollGeneration; pollJob(generation) }
const pausePolling = () => stopPolling()
const generateAll = async () => { if (dirty.value) { error.value = '请先保存故事板，再生成全部镜头'; return } busy.value = true; error.value = ''; try { const created = await createNovelVideoJob({ shots: editableShots.value.map(({ status, error: shotError, video_url, ...shot }) => shot), quality_profile: profile.value, aspect_ratio: props.aspectRatio }); syncJob(created); resumePolling() } catch (cause) { error.value = errorMessage(cause) } finally { busy.value = false } }
const retryShot = async shotId => { busy.value = true; error.value = ''; try { syncJob(await retryNovelVideoShot(job.value.job_id, shotId)); resumePolling() } catch (cause) { error.value = errorMessage(cause) } finally { busy.value = false } }
const saveSubtitles = async () => { const validation = validateSubtitleTimeline(subtitles.value, totalDuration.value); subtitleError.value = validation.message; if (!validation.valid) return; savingSubtitles.value = true; try { const saved = await updateNovelSubtitles(job.value.job_id, subtitles.value); subtitleDirty.value = false; syncJob(saved) } catch (cause) { subtitleError.value = errorMessage(cause) } finally { savingSubtitles.value = false } }
const finalize = async () => { busy.value = true; error.value = ''; try { syncJob(await finalizeNovelVideoJob(job.value.job_id, { quality_profile: profile.value })); resumePolling() } catch (cause) { error.value = errorMessage(cause) } finally { busy.value = false } }
const artifactUrl = name => safeDownloadUrl(job.value?.artifacts?.[name] || job.value?.[name])
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.metric{display:flex;min-height:4.5rem;flex-direction:column;justify-content:space-between;border:1px solid #334155;border-radius:.75rem;padding:.75rem;color:#94a3b8}.metric b{color:#e2e8f0}.action-primary{border-radius:.6rem;background:#22d3ee;padding:.65rem 1rem;font-weight:600;color:#082f49}.action-primary:disabled,.action-secondary:disabled{cursor:not-allowed;opacity:.4}.action-secondary{border:1px solid #475569;border-radius:.6rem;padding:.65rem 1rem;color:#cbd5e1}.download-card{border:1px solid rgba(34,211,238,.35);border-radius:.75rem;padding:1rem;text-align:center;color:#67e8f9}
</style>
