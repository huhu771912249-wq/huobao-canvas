/**
 * HTTP Request Utility | HTTP 请求工具
 * Axios-based request with interceptors
 */

import axios from 'axios'
import { getDefaultProvider, getProviderConfig, normalizeProviderKey } from '@/config/providers'
import { isMaterialApiUrl } from './apiBase.js'
import { getApiKey } from './apiKeyVault.js'

// Base URL from environment or default
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.chatfire.site'

/**
 * Default timeout | 默认超时
 * A backend that hangs instead of erroring must still fail fast enough for the
 * UI to recover; an effectively infinite timeout turns any hang into a frozen
 * screen. Calls that legitimately run longer (media uploads, media jobs,
 * document parsing) override `timeout` per request — see src/api/materialInput.js,
 * src/api/mediaComposition.js, src/api/videoTextOverlay.js, src/api/gifEditor.js
 * and src/api/studioDocument.js.
 * 后端挂起时必须尽快失败，否则界面会一直冻结；确实耗时的调用在各自请求上单独放宽超时。
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120000

// Create axios instance | 创建 axios 实例
const instance = axios.create({
  baseURL: "/",
  timeout: DEFAULT_REQUEST_TIMEOUT_MS
})

// Request interceptor | 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // Get current provider | 获取当前渠道
    const currentProvider = normalizeProviderKey(localStorage.getItem('api-provider') || getDefaultProvider())

    // Get the API key from the in-memory vault | 从内存保管处获取 API Key
    // 这里以前直接读 localStorage['api-keys-by-provider']，等于把用户的第三方密钥长期留在设备上。
    // See src/utils/apiKeyVault.js for why the key is never persisted, and what that does
    // and does not protect against.
    const apiKey = getApiKey(currentProvider) || getProviderConfig(currentProvider).defaultApiKey || ''

    // Skip auth for certain endpoints | 跳过某些端点的认证
    const noAuthEndpoints = ['/model/page', '/model/fullName', '/model/types']
    const isNoAuth = noAuthEndpoints.some(ep => config.url?.includes(ep))
    const isLocalMaterial = isMaterialApiUrl(config.url || '')

    if (apiKey && !isNoAuth && !isLocalMaterial) {
      config.headers['Authorization'] = `Bearer ${apiKey}`
    }

    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor | 响应拦截器
instance.interceptors.response.use(
  (res) => {
    const { data, code, message } = res.data || {}
    
    // Handle stream response | 处理流响应
    if (res.config.responseType === 'stream') {
      return res.data
    }
    
    // Handle blob response | 处理 blob 响应
    if (res.data instanceof Blob) {
      return res.data
    }
    
    // Success response | 成功响应
    if (code === 200 || res.status === 200) {
      return res.data
    }
    
    // Error response | 错误响应
    window.$message?.error(message || 'Request failed')
    return Promise.reject(res.data)
  },
  (error) => {
    const { response } = error
    
    if (response) {
      const { status, data } = response
      const message = data?.message || data?.error?.message || error.message
      const isAuthRequest = String(error.config?.url || '').startsWith('/auth/')
      
      if (isAuthRequest) {
        // Login and session views render their own contextual errors.
      } else if (status === 401) {
        window.$message?.error('API Key 无效或已过期')
      } else if (status === 429) {
        window.$message?.error('请求过于频繁，请稍后再试')
      } else {
        window.$message?.error(message || '请求失败')
      }
    } else {
      window.$message?.error(error.message || '网络错误')
    }
    
    return Promise.reject(error)
  }
)

/**
 * Set API base URL | 设置 API 基础 URL
 * @param {string} url - Base URL
 */
export const setBaseUrl = (url) => {
  instance.defaults.baseURL = url
}

/**
 * Get current base URL | 获取当前基础 URL
 * @returns {string}
 */
export const getBaseUrl = () => {
  return instance.defaults.baseURL
}

export default instance
