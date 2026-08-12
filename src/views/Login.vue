<template>
  <main class="login-shell">
    <div class="login-grid"></div>
    <section class="login-story">
      <div class="brand-mark"><img :src="logoUrl" alt="冠希" /><span>冠希 CANVAS</span></div>
      <div>
        <p class="eyebrow">AI CREATIVE OPERATING SYSTEM</p>
        <h1>把灵感，变成<br /><em>可投放的素材。</em></h1>
        <p class="lead">H3 视频、LTX 2.3 原生音频、素材裂变与数据回流，都在一张无限画布里完成。</p>
      </div>
      <div class="signal-row"><span><i></i> GPU STATUS · 登录后实时查看</span><span>LTX 2.3</span><span>H3</span></div>
    </section>
    <section class="login-panel">
      <form class="login-card" @submit.prevent="submit">
        <div class="card-heading"><span class="pulse"></span><div><p>SECURE ACCESS</p><h2>登录工作台</h2></div></div>
        <label>账号<input v-model.trim="username" autocomplete="username" placeholder="请输入账号" /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button :disabled="loading">{{ loading ? '正在验证…' : '进入冠希画布' }}<span>→</span></button>
        <p class="privacy">本机安全会话 · 12 小时自动失效</p>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { markSessionAuthenticated } from '@/stores/auth'
import logoUrl from '@/assets/logo.png'
const route = useRoute(); const router = useRouter()
const username = ref(''); const password = ref(''); const loading = ref(false); const error = ref('')
const submit = async () => {
  if (!username.value || !password.value) { error.value = '请输入账号和密码'; return }
  loading.value = true; error.value = ''
  try { const result = await login(username.value, password.value); markSessionAuthenticated(result.user); await router.replace(String(route.query.redirect || '/')) }
  catch (err) { error.value = err?.response?.data?.error?.message || '登录失败，请重试' }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-shell{height:100%;min-height:100%;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(420px,.8fr);position:relative;overflow-x:hidden;overflow-y:auto;background:#060910;color:#f5f7fb}.login-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(101,230,189,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(101,230,189,.04) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to right,#000,transparent 78%)}.login-story{z-index:1;padding:7vh 8vw;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(circle at 28% 42%,rgba(34,211,238,.14),transparent 32%),radial-gradient(circle at 62% 75%,rgba(101,230,189,.12),transparent 28%)}.brand-mark{display:flex;align-items:center;gap:12px;font:700 12px/1 ui-monospace;letter-spacing:.22em}.brand-mark img{width:38px;height:38px;border-radius:12px;box-shadow:0 0 32px rgba(101,230,189,.25)}.eyebrow{color:#65e6bd;font:600 12px/1 ui-monospace;letter-spacing:.2em;margin-bottom:24px}.login-story h1{font-size:clamp(48px,5.6vw,92px);line-height:.98;letter-spacing:-.055em;max-width:850px}.login-story em{font-style:normal;background:linear-gradient(90deg,#65e6bd,#6ea8ff);-webkit-background-clip:text;color:transparent}.lead{max-width:620px;margin-top:32px;color:#8d98aa;font-size:17px;line-height:1.8}.signal-row{display:flex;gap:14px;flex-wrap:wrap;color:#8d98aa;font:600 11px/1 ui-monospace}.signal-row span{border:1px solid rgba(148,163,184,.16);padding:10px 14px;border-radius:999px;background:rgba(16,22,33,.7)}.signal-row i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#65e6bd;box-shadow:0 0 12px #65e6bd;margin-right:7px}.login-panel{z-index:1;display:grid;place-items:center;padding:40px;background:rgba(9,13,22,.72);border-left:1px solid rgba(148,163,184,.12);backdrop-filter:blur(24px)}.login-card{width:min(100%,440px);padding:38px;border:1px solid rgba(148,163,184,.16);border-radius:28px;background:linear-gradient(145deg,rgba(23,33,49,.82),rgba(10,15,25,.94));box-shadow:0 30px 100px rgba(0,0,0,.45)}.card-heading{display:flex;align-items:center;gap:14px;margin-bottom:34px}.card-heading p{font:600 10px/1 ui-monospace;letter-spacing:.18em;color:#65e6bd}.card-heading h2{font-size:26px;margin-top:6px}.pulse{width:42px;height:42px;border-radius:14px;background:radial-gradient(circle,#65e6bd 0 12%,rgba(101,230,189,.12) 15% 100%);box-shadow:0 0 28px rgba(101,230,189,.18)}label{display:block;color:#aab4c3;font-size:12px;margin:18px 0 0}input{display:block;width:100%;margin-top:9px;padding:15px 16px;border:1px solid rgba(148,163,184,.18);border-radius:13px;background:#090e18;color:#fff;outline:none;font-size:14px;transition:.2s}input:focus{border-color:#65e6bd;box-shadow:0 0 0 3px rgba(101,230,189,.1)}button{width:100%;margin-top:26px;padding:15px 18px;border:0;border-radius:14px;background:linear-gradient(90deg,#65e6bd,#6ea8ff);color:#061019;font-weight:800;font-size:14px;display:flex;justify-content:space-between;cursor:pointer}button:disabled{opacity:.55}.login-error{margin-top:15px;color:#ff727d;font-size:12px}.privacy{text-align:center;color:#596579;font-size:11px;margin-top:18px}@media(max-width:900px){.login-shell{grid-template-columns:1fr}.login-story{display:none}.login-panel{border:0}}
</style>
