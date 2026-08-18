<template>
  <section class="recent-generation-strip workspace-reveal">
    <header class="recent-generation-strip__header">
      <div><span>GENERATED ASSETS</span><h2>最近生成</h2></div>
      <button type="button" @click="emit('view-all')">查看全部</button>
    </header>

    <div v-if="error" class="recent-generation-state recent-generation-state--error" role="alert">
      <b>暂时无法读取最近生成</b>
      <span>{{ error }}</span>
      <button type="button" @click="emit('retry')">重试</button>
    </div>
    <div v-else-if="loading && !assets.length" class="recent-generation-state" role="status">正在读取最近生成…</div>
    <div v-else-if="!assets.length" class="recent-generation-state">
      <b>还没有生成结果</b>
      <span>完成生成后，图片、视频、GIF 和音频会出现在这里。</span>
    </div>

    <div v-else class="recent-generation-list">
      <article v-for="asset in assets" :key="asset.id || asset.url" class="recent-generation-card workspace-panel">
        <div class="recent-generation-card__preview">
          <video v-if="asset.media_type === 'video'" :src="asset.url" controls preload="metadata"></video>
          <audio v-else-if="asset.media_type === 'audio'" :src="asset.url" controls preload="metadata"></audio>
          <img v-else :src="asset.url" :alt="asset.name" loading="lazy" />
          <span>{{ typeLabel(asset.media_type) }}</span>
        </div>
        <div class="recent-generation-card__body">
          <b :title="asset.name">{{ asset.name }}</b>
          <button v-if="asset.media_type === 'image'" type="button" @click="emit('process-image', asset)">去处理</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  assets: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['retry', 'view-all', 'process-image'])
const typeLabel = type => ({ image: '图片', video: '视频', gif: 'GIF', audio: '音频' })[type] || '素材'
</script>

<style scoped>
.recent-generation-strip{max-width:1180px;margin:0 auto;padding:28px}.recent-generation-strip__header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.recent-generation-strip__header span{color:var(--accent-color);font-size:10px;letter-spacing:.16em}.recent-generation-strip__header h2{margin-top:5px;font-size:24px}.recent-generation-strip__header button,.recent-generation-state button,.recent-generation-card__body button{border:1px solid var(--border-color);border-radius:10px;padding:7px 11px;color:var(--text-primary);font-size:12px}.recent-generation-list{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:18px}.recent-generation-card{min-width:0;overflow:hidden;border-radius:16px}.recent-generation-card__preview{position:relative;display:grid;place-items:center;aspect-ratio:1/1;overflow:hidden;background:#03060b}.recent-generation-card__preview img,.recent-generation-card__preview video{width:100%;height:100%;object-fit:contain}.recent-generation-card__preview audio{width:calc(100% - 16px)}.recent-generation-card__preview>span{position:absolute;top:8px;left:8px;border-radius:999px;padding:3px 6px;color:#dffdfa;background:rgba(3,6,11,.75);font-size:9px}.recent-generation-card__body{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px}.recent-generation-card__body b{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.recent-generation-card__body button{flex:none;padding:5px 7px;border-color:rgba(101,230,189,.45);color:#a7f3d0}.recent-generation-state{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;min-height:170px;margin-top:18px;border:1px dashed var(--border-color);border-radius:18px;color:var(--text-secondary);font-size:13px;text-align:center}.recent-generation-state b{color:var(--text-primary)}.recent-generation-state--error{border-color:rgba(248,113,113,.38);color:#fca5a5}@media(max-width:1050px){.recent-generation-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.recent-generation-strip{padding:22px 18px}.recent-generation-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
