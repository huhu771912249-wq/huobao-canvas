/**
 * API Hooks | API Hooks
 * Simplified hooks for open source version | 开源版简化 hooks
 */

import { ref, reactive, onUnmounted } from 'vue'
import {
  generateImage,
  createVideoTask,
  getVideoTaskStatus,
  streamChatCompletions
} from '@/api'
import { getModelByName } from '@/config/models'
import { useApiConfig } from './useApiConfig'
import { useProvider } from './useProvider'
import { useModelStore } from '@/stores/pinia'
import { extractVideoTaskProgress, getVideoTaskPollingState } from '@/utils/videoTaskStatus'
import { normalizeVideoImageAlignmentRequest, normalizeVideoQualityRequestProfile } from '@/config/studioProjectFlow'

/**
 * Base API state hook | 基础 API 状态 Hook
 */
export const useApiState = () => {
  const loading = ref(false)
  const error = ref(null)
  const status = ref('idle')

  const reset = () => {
    loading.value = false
    error.value = null
    status.value = 'idle'
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
    status.value = isLoading ? 'running' : status.value
  }

  const setError = (err) => {
    error.value = err
    status.value = 'error'
    loading.value = false
  }

  const setSuccess = () => {
    status.value = 'success'
    loading.value = false
    error.value = null
  }

  return { loading, error, status, reset, setLoading, setError, setSuccess }
}

/**
 * Chat composable | 问答组合式函数
 */
export const useChat = (options = {}) => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()
  const { adaptRequest, adaptResponse } = useProvider()
  const modelStore = useModelStore()

  const messages = ref([])
  const currentResponse = ref('')
  let abortController = null

  const send = async (content, stream = true, chatOptions = {}) => {
    setLoading(true)
    currentResponse.value = ''

    try {
      // 构建用户消息内容（支持参考图片）
      let userContent
      const images = chatOptions.images || options.images || []

      if (images.length > 0) {
        // 多模态消息：文本 + 图片
        userContent = [
          { type: 'text', text: content },
          ...images.map(img => ({
            type: 'image_url',
            image_url: { url: img.url || img }
          }))
        ]
      } else {
        userContent = content
      }

      const msgList = [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        ...messages.value,
        { role: 'user', content: userContent }
      ]

      // 适配请求参数
      const adaptedParams = adaptRequest('chat', {
        model: options.model || 'gpt-4o-mini',
        messages: msgList
      })

      if (stream) {
        status.value = 'streaming'
        abortController = new AbortController()
        let fullResponse = ''

        // 使用 modelStore 获取完整 URL
        const chatUrl = modelStore.getChatEndpoint()
        const endpoint = new URL(chatUrl).pathname

        for await (const chunk of streamChatCompletions(
          adaptedParams,
          abortController.signal,
          { baseUrl: new URL(chatUrl).origin, endpoint }
        )) {
          fullResponse += chunk
          currentResponse.value = fullResponse
        }

        messages.value.push({ role: 'user', content })
        messages.value.push({ role: 'assistant', content: fullResponse })
        setSuccess()
        return fullResponse
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err)
        throw err
      }
    }
  }

  const stop = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const clear = () => {
    messages.value = []
    currentResponse.value = ''
    reset()
  }

  onUnmounted(() => stop())

  return { loading, error, status, messages, currentResponse, send, stop, clear, reset }
}

/**
 * Image generation composable | 图片生成组合式函数
 * Simplified for open source - fixed input/output format
 */
export const useImageGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()
  const { adaptRequest, adaptResponse } = useProvider()
  const modelStore = useModelStore()

  const images = ref([])
  const currentImage = ref(null)

  /**
   * Generate image with fixed params | 固定参数生成图片
   * @param {Object} params - { model, prompt, size, n, image (optional ref image) }
   */
  const generate = async (params) => {
    setLoading(true)
    images.value = []
    currentImage.value = null

    try {
      const modelConfig = getModelByName(params.model)

      // Build request data | 构建请求数据
      const requestData = {
        model: params.model,
        prompt: params.prompt,
        size: params.size || modelConfig?.defaultParams?.size || '2048x2048',
        // n: params.n || 1
      }

      // Add reference image if provided | 添加参考图
      if (params.image) {
        requestData.image = params.image
      }
      if (params.edit_mode) requestData.edit_mode = params.edit_mode
      if (params.subject_image) requestData.subject_image = params.subject_image
      if (params.background_reference_image) {
        requestData.background_reference_image = params.background_reference_image
      }
      if (params.background_instruction) {
        requestData.background_instruction = params.background_instruction
      }
      for (const key of ['negative_prompt', 'steps', 'cfg', 'sampler_name', 'scheduler', 'seed']) {
        if (params[key] !== undefined) requestData[key] = params[key]
      }

      // 适配请求参数
      const adaptedParams = adaptRequest('image', requestData)

      // Call API | 调用 API
      const response = await generateImage(adaptedParams, {
        requestType: 'json',
        endpoint: modelStore.getImageEndpoint()
      })

      // 适配响应数据
      const adaptedData = adaptResponse('image', response)

      images.value = adaptedData
      currentImage.value = adaptedData[0] || null
      setSuccess()
      return adaptedData
    } catch (err) {
      setError(err)
      throw err
    }
  }

  return { loading, error, status, images, currentImage, generate, reset }
}

/**
 * Video generation composable | 视频生成组合式函数
 * Simplified for open source - fixed input/output format
 */

export const useVideoGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()
  const { adaptRequest, adaptResponse } = useProvider()
  const modelStore = useModelStore()

  const video = ref(null)
  const taskId = ref(null)
  const progress = reactive({
    attempt: 0,
    percentage: 0
  })

  const isTaskNotReadyError = (err) => {
    const status = err?.response?.status || err?.status
    const message = String(err?.response?.data?.message || err?.response?.data?.error?.message || err?.message || '')
    return status === 404 || /404|not found|不存在|未找到/i.test(message)
  }

  /**
   * Create video task only (no polling) | 仅创建视频任务（不轮询）
   */
  const createVideoTaskOnly = async (params) => {
    const modelConfig = getModelByName(params.model)

    // Build request data | 构建请求数据
    const requestData = {
      model: params.model,
      prompt: params.prompt || ''
    }
    // Add optional params | 添加可选参数
    if (params.first_frame_image) requestData.first_frame_image = params.first_frame_image
    if (params.last_frame_image) requestData.last_frame_image = params.last_frame_image
    if (params.images) requestData.images = params.images
    if (params.driving_video) requestData.driving_video = params.driving_video
    if (params.driving_video_name) requestData.driving_video_name = params.driving_video_name
    if (params.ratio) requestData.size = params.ratio
    if (params.dur) requestData.seconds = params.dur
    if (params.sizes) requestData.sizes = params.sizes
    if (params.output_formats) requestData.output_formats = params.output_formats
    if (params.output_width) requestData.output_width = params.output_width
    if (params.output_height) requestData.output_height = params.output_height
    if (params.sampling_mode) requestData.sampling_mode = params.sampling_mode
    if (params.director_plan) requestData.director_plan = params.director_plan
    const qualityProfile = normalizeVideoQualityRequestProfile(params.quality_profile)
    const imageAlignment = normalizeVideoImageAlignmentRequest(params.image_alignment)
    if (qualityProfile) requestData.quality_profile = qualityProfile
    if (imageAlignment) requestData.image_alignment = imageAlignment

    // 适配请求参数
    const adaptedParams = adaptRequest('video', requestData)

    // Call API to create task | 调用 API 创建任务
    const task = await createVideoTask(adaptedParams, {
      requestType: 'json',
      endpoint: modelStore.getVideoEndpoint()
    })
    const taskResult = task?.data?.task_id ? task.data : task

    // Check if async (need polling) | 检查是否异步
    const isAsync = modelConfig?.async !== false

    // If has video URL directly, return | 如果直接有视频 URL，返回
    if (!isAsync || task.data?.url || task.url || task.content?.video_url) {
      return {
        taskId: taskResult?.task_id || taskResult?.taskId || null,
        url: task.data?.url || task.url || task.content?.video_url,
        result: taskResult
      }
    }

    // Get task ID | 获取任务 ID
    const newTaskId = task.id || task.task_id || task.taskId || task.data?.task_id || task.data?.id
    if (!newTaskId) {
      throw new Error('未获取到任务 ID')
    }

    return { taskId: newTaskId, result: taskResult }
  }

  /**
   * Poll video task | 轮询视频任务
   */
  const pollVideoTask = async (pollTaskId, onProgress = () => {}) => {
    const interval = 5000
    let attempt = 0

    while (true) {
      attempt += 1
      // 获取任务查询端点，支持 {taskId} 占位符替换
      let taskEndpoint = modelStore.getVideoTaskEndpoint()
      if (taskEndpoint.includes('{taskId}')) {
        taskEndpoint = taskEndpoint.replace('{taskId}', pollTaskId)
      }

      let result
      try {
        result = await getVideoTaskStatus(pollTaskId, {
          endpoint: taskEndpoint
        })
      } catch (err) {
        if (isTaskNotReadyError(err)) {
          await new Promise(resolve => setTimeout(resolve, interval))
          continue
        }
        throw err
      }

      // 适配轮询响应
      const adaptedResult = adaptResponse('video', result)
      const progressInfo = extractVideoTaskProgress(result, adaptedResult)
      onProgress(attempt, progressInfo.percent, progressInfo)

      const taskState = getVideoTaskPollingState(result, adaptedResult)

      // Check for completion | 检查是否完成
      if (taskState.state === 'completed') {
        return { ...result, ...adaptedResult, url: taskState.url }
      }

      if (taskState.state === 'partial') {
        return { ...result, ...adaptedResult, url: taskState.url, status: 'partial' }
      }

      if (taskState.state === 'missing_url') {
        const taskError = new Error('视频任务已完成但未返回视频 URL')
        taskError.videoTaskTerminal = true
        taskError.videoTaskStatus = taskState.status || 'completed'
        throw taskError
      }

      // Check for failure | 检查是否失败
      if (taskState.state === 'failed') {
        const taskError = new Error(result.error?.message || result.message || '视频生成失败')
        taskError.videoTaskTerminal = true
        taskError.videoTaskStatus = taskState.status || 'failed'
        throw taskError
      }

      // Wait before next poll | 等待下次轮询
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  /**
   * Generate video with fixed params (includes polling) | 固定参数生成视频（含轮询）
   * @param {Object} params - { model, prompt, first_frame_image, last_frame_image, ratio, duration }
   */
  const generate = async (params) => {
    setLoading(true)
    video.value = null
    taskId.value = null
    progress.attempt = 0
    progress.percentage = 0

    try {
      // 创建任务
      const { taskId: newTaskId, url } = await createVideoTaskOnly(params)

      // 如果有直接 URL，返回
      if (url) {
        video.value = { url }
        setSuccess()
        return video.value
      }

      // 需要轮询
      taskId.value = newTaskId
      status.value = 'polling'

      // 轮询获取结果
      const result = await pollVideoTask(newTaskId, (attempt, percentage) => {
        progress.attempt = attempt
        progress.percentage = percentage
      })

      video.value = result
      setSuccess()
      return result
    } catch (err) {
      setError(err)
      throw err
    }
  }

  return { loading, error, status, video, taskId, progress, generate, reset, createVideoTaskOnly, pollVideoTask }
}

/**
 * Combined API composable | 综合 API 组合式函数
 */
export const useApi = () => {
  const config = useApiConfig()
  const chat = useChat()
  const image = useImageGeneration()
  const videoGen = useVideoGeneration()

  return { config, chat, image, video: videoGen }
}
