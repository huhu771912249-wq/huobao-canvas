/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { refreshSession } from '@/stores/auth'
import { clearDynamicImportRecovery, recoverFromDynamicImportFailure } from './recovery.js'
import { resolveLegacyCanvasRoute } from '../config/workspaceLaunch.js'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/canvas/:id?',
    name: 'Canvas',
    component: () => import('../views/Canvas.vue')
  },
  {
    path: '/video-studio',
    name: 'VideoStudio',
    component: () => import('../views/VideoStudio.vue')
  },
  {
    path: '/video-resize',
    name: 'VideoResizeWorkbench',
    component: () => import('../views/VideoResizeWorkbench.vue')
  },
  {
    path: '/recent-generations',
    name: 'RecentGenerations',
    component: () => import('../views/RecentGenerations.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/huobao-canvas'),
  routes
})

router.beforeEach(async (to) => {
  const authenticated = await refreshSession()
  if (!to.meta.public && !authenticated) return { name: 'Login', query: { redirect: to.fullPath } }
  if (to.name === 'Login' && authenticated) return { name: 'Home' }
  if (to.name === 'Canvas') {
    const legacyTarget = resolveLegacyCanvasRoute({
      id: to.params.id,
      flow: to.query.flow,
      panel: to.query.panel
    })
    if (legacyTarget) return legacyTarget
  }
  return true
})

router.onError((error) => {
  recoverFromDynamicImportFailure(error)
})

router.afterEach((_to, _from, failure) => {
  if (!failure) clearDynamicImportRecovery()
})

export default router
