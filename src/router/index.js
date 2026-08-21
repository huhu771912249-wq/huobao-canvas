/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, refreshSession } from '@/stores/auth'
import { clearDynamicImportRecovery, recoverFromDynamicImportFailure } from './recovery.js'
import { createSessionProbe, resolveSessionRoute } from './sessionGuard.js'
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
    path: '/test-assets',
    name: 'TestAssetGenerator',
    component: () => import('../views/TestAssetGenerator.vue')
  },
  {
    path: '/gif-editor',
    name: 'GifAdEditor',
    component: () => import('../views/GifAdEditor.vue')
  },
  {
    path: '/recent-generations',
    name: 'RecentGenerations',
    component: () => import('../views/RecentGenerations.vue')
  },
  {
    path: '/tasks',
    name: 'TaskCenter',
    component: () => import('../views/TaskCenter.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/huobao-canvas'),
  routes
})

// Bounded session probe: navigation must never depend on an unbounded promise.
// 有界的会话探测：导航不能依赖一个永不 resolve 的 promise。
const probeSession = createSessionProbe({
  refreshSession,
  readCachedUser: () => currentUser.value
})

router.beforeEach(async (to) => {
  const sessionRoute = resolveSessionRoute(await probeSession(), to)
  if (sessionRoute !== true) return sessionRoute
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
