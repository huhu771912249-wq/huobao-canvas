/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { refreshSession } from '@/stores/auth'

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
  return true
})

export default router
