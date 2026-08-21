/**
 * Chat API | 对话 API
 */

import { request, getBaseUrl } from '@/utils'
import { getApiKey } from '@/utils/apiKeyVault'
import { getDefaultProvider, getProviderConfig, normalizeProviderKey } from '@/config/providers'

// 流式请求绕过 axios 拦截器，所以这里要自己取 Key —— 但取的是内存保管处，不是 localStorage。
// The streaming path bypasses the axios interceptor, so it resolves the key itself; it must
// use the same in-memory vault instead of re-reading clear-text storage.
const getCurrentApiKey = () => {
  let storedProvider = ''
  try {
    storedProvider = localStorage.getItem('api-provider') || ''
  } catch {
    storedProvider = ''
  }
  const currentProvider = normalizeProviderKey(storedProvider || getDefaultProvider())
  return getApiKey(currentProvider) || getProviderConfig(currentProvider).defaultApiKey || ''
}

// 对话补全
export const chatCompletions = (data) =>
  request({
    url: `/chat/completions`,
    method: 'post',
    data
  })

// 流式对话补全
export const streamChatCompletions = async function* (data, signal, options = {}) {
  const apiKey = getCurrentApiKey()
  // 优先使用传入的 baseUrl，否则使用默认的
  const baseUrl = options.baseUrl || getBaseUrl()
  // 使用 options.endpoint 或默认的 /chat/completions
  const endpoint = options.endpoint || '/chat/completions'

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ ...data, stream: true }),
    signal
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error?.message || error?.message || 'Stream request failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}
