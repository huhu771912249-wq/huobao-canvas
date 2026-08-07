<template>
  <main class="h-screen overflow-y-auto bg-[#050b16] text-slate-100">
    <header class="border-b border-cyan-950/80 bg-[#07101e]/95 px-6 py-4 backdrop-blur">
      <div class="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
        <div><div class="text-xs tracking-[.35em] text-cyan-400">冠希 VIDEO LAB</div><h1 class="text-2xl font-semibold">视频尺寸工作台</h1></div>
        <nav class="flex gap-2"><button class="nav" @click="router.push('/')">首页</button><button class="nav" @click="router.push('/canvas')">无限画布</button></nav>
      </div>
    </header>

    <section class="mx-auto grid max-w-[1500px] gap-5 p-6 xl:grid-cols-[390px_1fr]">
      <aside class="space-y-4">
        <section class="panel">
          <div class="step">01 · 导入素材</div>
          <div class="mt-3 grid grid-cols-2 gap-2"><button class="toggle" :class="sourceMode === 'url' && 'active'" @click="sourceMode='url'">公开 FB / Instagram 链接</button><button class="toggle" :class="sourceMode === 'file' && 'active'" @click="sourceMode='file'">上传 MP4 / MOV / WebM</button></div>
          <input v-if="sourceMode==='url'" v-model.trim="sourceUrl" class="field mt-3" placeholder="https://www.instagram.com/reel/..." />
          <div v-else>
            <button type="button" class="mt-3 flex w-full cursor-pointer flex-col items-center rounded-xl border border-dashed p-6 text-center transition" :class="dragActive ? 'border-cyan-300 bg-cyan-400/15' : 'border-cyan-700/60 bg-cyan-950/20'" @click="openFilePicker" @dragenter.prevent="dragActive=true" @dragover.prevent @dragleave.prevent="dragActive=false" @drop.prevent="handleDrop">
              <span class="text-2xl">↥</span><b>{{ file?.name || '点击选择或拖入视频' }}</b><small class="mt-1 text-slate-400">MP4 / MOV / WebM · 最大 90MB</small>
            </button>
            <input ref="fileInput" class="hidden" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" @change="selectFile" />
            <div v-if="file" class="mt-2 flex items-center justify-between rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300"><span>已选择：{{ file.name }}</span><button type="button" class="text-slate-300" @click="clearFile">移除</button></div>
          </div>
          <p class="mt-3 text-xs text-slate-500">只读取公开页面，不保存账号、Cookie 或登录信息；受限链接会明确失败。</p>
        </section>

        <section class="panel">
          <div class="step">02 · 画面适配</div>
          <div class="mt-3 space-y-2"><button v-for="mode in fitModes" :key="mode.key" class="choice" :class="fitMode===mode.key && 'active'" @click="fitMode=mode.key"><b>{{ mode.title }}</b><small>{{ mode.desc }}</small></button></div>
          <label class="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"><span><b>强制 AI 超分</b><small class="block text-slate-400">SeedVR2；关闭时仅低于目标尺寸才启用</small></span><input v-model="forceAi" type="checkbox" class="h-5 w-5 accent-emerald-400" /></label>
          <textarea v-model="overlayText" rows="2" class="field mt-3" placeholder="可选：字幕 / 文字叠加（成品底部居中）" />
        </section>
      </aside>

      <div class="space-y-5">
        <section class="panel">
          <div class="flex flex-wrap items-center justify-between gap-3"><div><div class="step">03 · 输出规格</div><h2 class="mt-1 text-xl font-semibold">一次生成全部投放尺寸</h2></div><div class="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">条件式 SeedVR2 · 如实回执</div></div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label v-for="preset in presets" :key="preset.value" class="preset" :class="targets.includes(preset.value) && 'active'"><input v-model="targets" :value="preset.value" type="checkbox" class="accent-cyan-400"/><span><b>{{ preset.value }}</b><small>{{ preset.label }}</small></span></label></div>
          <div class="mt-3 flex flex-wrap items-center gap-2"><input v-model.number="customWidth" type="number" class="mini" min="256" max="4096" step="2"><span>×</span><input v-model.number="customHeight" type="number" class="mini" min="256" max="4096" step="2"><button class="nav" @click="addCustom">添加自定义尺寸</button></div>
          <div class="mt-4 flex flex-wrap items-center gap-5 text-sm"><label><input v-model="outputs" value="mp4" type="checkbox" class="accent-cyan-400"> MP4</label><label><input v-model="outputs" value="gif" type="checkbox" class="accent-cyan-400"> GIF</label><button :disabled="submitting" class="ml-auto rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-3 font-semibold text-slate-950 disabled:opacity-40" @click="submit">{{ submitting ? '正在上传…' : '开始生成多尺寸视频' }}</button></div>
          <p v-if="error" role="alert" class="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{{ error }}</p>
        </section>

        <section class="panel min-h-[280px]">
          <div class="flex items-center justify-between"><div><div class="step">04 · 真实任务进度</div><h2 class="mt-1 text-xl font-semibold">{{ job ? job.current_step : '等待创建任务' }}</h2></div><span v-if="job" class="text-2xl font-semibold text-cyan-300">{{ job.progress || 0 }}%</span></div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" :style="{width:`${job?.progress || 0}%`}" /></div>
          <div v-if="job?.status==='upscaling'" class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-3 text-sm">
            <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"></span>
            <b class="text-emerald-300">SeedVR2 正在真实计算</b>
            <span>第 {{ job.active_target_index }} / {{ job.active_target_count }} 个</span>
            <span>{{ job.active_target }}</span>
            <span>已运行 {{ job.gpu_elapsed_seconds || 0 }} 秒</span>
          </div>
          <div v-if="job?.error" role="alert" class="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <b>后端错误：</b>{{ job.error }}
          </div>
          <p class="mt-2 text-xs text-slate-500">进度来自后端任务阶段，不用虚假倒计时。每个成品会显示实际尺寸与超分方式。</p>
          <div v-if="job?.results?.length" class="mt-5 grid gap-4 md:grid-cols-2"><article v-for="item in job.results" :key="item.mp4_url" class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950"><video class="aspect-video w-full bg-black object-contain" :src="item.mp4_url" controls/><div class="space-y-2 p-4 text-sm"><div class="flex justify-between"><b>{{ item.actual_width }} × {{ item.actual_height }}</b><span class="text-emerald-300">{{ item.upscale_method==='seedvr2' ? 'SeedVR2 AI 超分' : '高清转码（无需超分）' }}</span></div><div class="flex gap-2"><a class="nav" :href="item.mp4_url" download>下载 MP4</a><a v-if="item.gif_url" class="nav" :href="item.gif_url" download>下载 GIF</a></div></div></article></div>
          <div v-if="job" class="mt-5 flex flex-wrap gap-2"><button v-if="!terminal" class="nav" @click="cancel">取消任务</button><button v-if="['failed','cancelled'].includes(job.status)" class="nav" @click="retry">失败重试</button><button v-if="job.status==='completed'" class="nav" @click="save">保存到素材库</button><button v-if="job.status==='completed'" class="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" @click="handoff">送入无限画布</button></div>
        </section>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RESIZE_PRESETS, normalizeResizeTargets, validateSocialVideoUrl } from '../utils/videoResize'
import { cancelVideoResizeJob, createVideoResizeJob, getVideoResizeJob, handoffVideoResizeJob, retryVideoResizeJob, saveVideoResizeJob } from '../api/videoResize'
import { createProject, updateProject } from '../stores/projects'

const router = useRouter(); const sourceMode = ref('url'); const sourceUrl = ref(''); const file = ref(null); const fileInput = ref(null); const dragActive = ref(false); const fitMode = ref('smart'); const forceAi = ref(false); const overlayText = ref(''); const targets = ref(['720x1280','1080x1920','1080x1080','1280x720','1920x1080']); const outputs = ref(['mp4']); const customWidth = ref(1080); const customHeight = ref(1350); const error = ref(''); const job = ref(null); const submitting = ref(false); let pollTimer = 0
const presetLabels = {'720x1280':'FB/IG 竖版','1080x1920':'Reels / Stories','1080x1080':'社媒方图','1280x720':'常用横版','1920x1080':'Full HD 横版'}
const presets = RESIZE_PRESETS.map(value=>({value,label:presetLabels[value]})); const fitModes = [{key:'smart',title:'智能主体裁剪',desc:'主体优先；检测不可用时安全居中回退'},{key:'blur',title:'完整保留＋模糊背景',desc:'画面不裁切，空白区域使用模糊背景'},{key:'center',title:'居中裁剪',desc:'固定中心构图，适合主体居中的素材'}]
const terminal = computed(() => ['completed','failed','cancelled'].includes(job.value?.status))
const acceptFile = selected => {
  error.value = ''
  if (!selected) return
  if (!/\.(mp4|mov|webm)$/i.test(selected.name)) { error.value = '只支持 MP4、MOV、WebM 视频'; return }
  if (selected.size > 90 * 1024 * 1024) { error.value = '视频不能超过 90MB'; return }
  file.value = selected
}
const openFilePicker = () => fileInput.value?.click()
const selectFile = event => acceptFile(event.target.files?.[0])
const handleDrop = event => { dragActive.value = false; acceptFile(event.dataTransfer?.files?.[0]) }
const clearFile = () => { file.value = null; if (fileInput.value) fileInput.value.value = '' }
const toBase64 = selected => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]||''); reader.onerror=reject; reader.readAsDataURL(selected) })
const addCustom = () => { try { const value = `${customWidth.value}x${customHeight.value}`; normalizeResizeTargets([value]); if (!targets.value.includes(value)) targets.value.push(value) } catch (e) { error.value=e.message } }
const poll = async () => { if (!job.value?.job_id) return; try { job.value = await getVideoResizeJob(job.value.job_id); if (!terminal.value) pollTimer=window.setTimeout(poll,1500) } catch (e) { error.value=e?.response?.data?.error?.message||e.message } }
const submit = async () => { error.value=''; try { const normalized=normalizeResizeTargets(targets.value); if (!outputs.value.length) throw new Error('至少选择一个输出格式'); const payload={targets:normalized,fit_mode:fitMode.value,force_ai:forceAi.value,outputs:outputs.value,overlay_text:overlayText.value}; if(sourceMode.value==='url'){const valid=validateSocialVideoUrl(sourceUrl.value);if(!valid.ok)throw new Error(valid.message||'请输入公开 FB / Instagram 视频链接');payload.source_url=sourceUrl.value}else{if(!file.value)throw new Error('请选择本地视频');if(file.value.size>90*1024*1024)throw new Error('视频不能超过 90MB');payload.source_name=file.value.name;payload.source_base64=await toBase64(file.value)} submitting.value=true; job.value=await createVideoResizeJob(payload); poll() } catch(e){error.value=e?.response?.data?.error?.message||e.message||'任务创建失败'} finally{submitting.value=false} }
const cancel=async()=>{job.value=await cancelVideoResizeJob(job.value.job_id)}
const retry=async()=>{job.value=await retryVideoResizeJob(job.value.job_id);poll()}
const save=async()=>{const result=await saveVideoResizeJob(job.value.job_id);window.$message?.success(result.saved?'已保存到冠希素材库':'没有可保存的成品')}
const handoff=async()=>{const result=await handoffVideoResizeJob(job.value.job_id);const id=createProject('视频尺寸成品');const nodes=(result.canvas_payload?.results||[]).map((item,index)=>({id:`video-${index}`,type:'video',position:{x:80+index*40,y:80+index*40},data:{url:item.mp4_url,label:`${item.actual_width}×${item.actual_height}`}}));updateProject(id,{canvasData:{nodes,edges:[],viewport:{x:80,y:50,zoom:.8}}});router.push(`/canvas/${id}`)}
onBeforeUnmount(()=>window.clearTimeout(pollTimer))
</script>

<style scoped>
.panel{border:1px solid rgba(51,65,85,.75);border-radius:1rem;background:linear-gradient(145deg,rgba(15,23,42,.94),rgba(5,15,30,.9));padding:1.25rem;box-shadow:0 24px 60px rgba(0,0,0,.18)}.step{font-size:.72rem;letter-spacing:.2em;color:#22d3ee}.nav{border:1px solid #334155;border-radius:.65rem;padding:.5rem .85rem;font-size:.875rem;color:#cbd5e1}.field{width:100%;border:1px solid #334155;border-radius:.75rem;background:#050b16;padding:.75rem;outline:none}.field:focus{border-color:#22d3ee}.toggle,.choice,.preset{border:1px solid #334155;border-radius:.8rem;background:rgba(2,6,23,.55);padding:.75rem;text-align:left}.toggle.active,.choice.active,.preset.active{border-color:#22d3ee;background:rgba(34,211,238,.09)}.choice{display:flex;width:100%;flex-direction:column}.choice small,.preset small{display:block;margin-top:.2rem;color:#94a3b8}.preset{display:flex;align-items:center;gap:.75rem}.mini{width:100px;border:1px solid #334155;border-radius:.6rem;background:#050b16;padding:.55rem}
</style>
