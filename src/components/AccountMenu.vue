<template>
  <!-- Sign out entry | 退出登录入口 -->
  <button
    type="button"
    class="account-signout"
    data-testid="sign-out-action"
    :disabled="pending"
    :title="signedInAs"
    aria-label="退出登录"
    @click="signOut"
  >
    <n-icon :size="18"><LogOutOutline /></n-icon>
    <span>{{ pending ? '退出中…' : '退出登录' }}</span>
  </button>
</template>

<script setup>
/**
 * Account menu | 账号菜单
 * The only place in the app that calls `logout()`; mounted from AppHeader (Canvas)
 * and WorkspaceShell (Home / Tasks / Recent).
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon } from 'naive-ui'
import { LogOutOutline } from '@vicons/ionicons5'
import { logout } from '../api/auth'
import { currentUser, invalidateSessionCache, markSessionAuthenticated } from '../stores/auth'
import { performSignOut } from '../utils/authSession'

const router = useRouter()
const pending = ref(false)
const signedInAs = computed(() => (
  currentUser.value ? `退出登录（当前账号：${currentUser.value}）` : '退出登录'
))

const clearLocalSession = () => {
  markSessionAuthenticated(null)
  invalidateSessionCache()
}

const signOut = async () => {
  if (pending.value) return
  pending.value = true
  try {
    const result = await performSignOut({
      requestLogout: logout,
      clearLocalSession,
      redirect: target => router.replace(target)
    })
    if (!result.ok) {
      window.$message?.warning('后端未确认退出，已在本机清除登录状态。')
    }
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.account-signout {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.035);
  font-size: 12px;
  transition: color 180ms ease, border-color 180ms ease;
}

.account-signout:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--border-color);
}

.account-signout:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 899px) {
  .account-signout span {
    display: none;
  }
}
</style>
