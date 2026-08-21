/**
 * Hooks Entry | Hooks 入口
 * Exports all hooks for easy import
 */

// API Configuration Hook | API 配置 Hook
// 已删除：`useApiConfig` 把 API Key 明文写进 localStorage['apiKey']，而且没有任何代码读它
// （请求路径读的是 `@/utils/apiKeyVault`）。渠道配置统一走 `useModelStore()`。
// Removed: `useApiConfig` wrote the API key to localStorage in clear text and nothing read
// it back. Provider config lives in `useModelStore()`; the key itself lives in
// `@/utils/apiKeyVault`, in memory only.

// Model Configuration Hook | 模型配置 Hook
export { useModelConfig } from './useModelConfig'

// Provider Hook | 渠道管理 Hook
export { useProvider } from './useProvider'

// API Operation Hooks | API 操作 Hooks
export {
  useApiState,
  useChat,
  useImageGeneration,
  useVideoGeneration
} from './useApi'

// Workflow Orchestrator Hook | 工作流编排 Hook
export { useWorkflowOrchestrator } from './useWorkflowOrchestrator'
