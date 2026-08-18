<template>
  <section class="workflow-shelf workspace-reveal">
    <header class="workflow-shelf__header">
      <div>
        <span>EDITABLE FLOWS</span>
        <h2>常用工作流</h2>
        <p>仅列出已有的内置可编辑工作流，打开后仍作为普通项目保存。</p>
      </div>
    </header>

    <div class="workflow-shelf__grid">
      <button
        v-for="workflow in workflows"
        :key="workflow.flow"
        type="button"
        class="workflow-card workspace-panel"
        :aria-busy="busy && pendingFlow === `launch:${workflow.flow}`"
        @click="emit('launch', workflow.flow)"
      >
        <span class="workflow-card__badge">内置可编辑工作流</span>
        <b>{{ workflow.title }}</b>
        <small>{{ workflow.description }}</small>
      </button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  busy: {
    type: Boolean,
    default: false
  },
  pendingFlow: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['launch'])

const workflows = [
  { flow: 'image', title: 'AI 作图', description: '文字提示词与图片节点可继续编辑' },
  { flow: 'image-to-video', title: '图生视频', description: '首帧图、动作描述与视频输出节点' },
  { flow: 'video', title: '文生视频', description: '提示词、视频配置与输出节点' },
  { flow: 'gifEditor', title: '水印与 GIF 编辑', description: '导入素材后编辑文字、图片水印与 GIF 输出' },
  { flow: 'batch', title: '批量广告尺寸', description: '同一创意保留多尺寸 MP4 / GIF 结果' },
  { flow: 'background', title: '背景替换', description: '保留主体并在画板中继续调整背景' },
  { flow: 'variation', title: '素材裂变', description: '从已有素材创建可追踪的多版本结果' },
  { flow: 'dsp', title: '54DSP 优秀素材', description: '选择高点击素材并交给已有 DSP 工作流' }
]
</script>

<style scoped>
.workflow-shelf{max-width:1180px;margin:0 auto;padding:28px}.workflow-shelf__header span{color:var(--accent-color);font-size:10px;letter-spacing:.16em}.workflow-shelf__header h2{margin-top:5px;font-size:24px}.workflow-shelf__header p{max-width:680px;margin-top:7px;color:var(--text-secondary);font-size:13px;line-height:1.7}.workflow-shelf__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.workflow-card{display:grid;gap:8px;min-height:142px;padding:16px;border-radius:18px;text-align:left}.workflow-card:hover{border-color:rgba(101,230,189,.55);transform:translateY(-2px)}.workflow-card__badge{width:max-content;border-radius:999px;padding:3px 7px;color:#a7f3d0;background:rgba(101,230,189,.1);font-size:9px}.workflow-card b{font-size:15px}.workflow-card small{color:var(--text-secondary);font-size:11px;line-height:1.55}@media(max-width:900px){.workflow-shelf__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.workflow-shelf{padding:22px 18px}.workflow-shelf__grid{grid-template-columns:1fr}}
</style>
