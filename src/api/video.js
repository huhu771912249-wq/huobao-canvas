/**
 * Video API | 视频生成 API
 */

import { request } from '@/utils'
import { buildVideoTaskStatusUrl, getVideoTaskPollingState } from '@/utils/videoTaskStatus'
import { buildVideoBatchRetryUrl } from '@/utils/videoBatch'

// 创建视频任务
export const createVideoTask = (data, options = {}) => {
  const { endpoint = '/videos', requestType = 'json' } = options
  return request({
    url: endpoint,
    method: 'post',
    data,
    headers: requestType === 'formdata'
      ? { 'Content-Type': 'multipart/form-data' }
      : { 'Content-Type': 'application/json' }
  })
}

// 查询视频任务状态
export const getVideoTaskStatus = (taskId, options = {}) => {
  const { endpoint = '/videos' } = options
  return request({
    url: buildVideoTaskStatusUrl(endpoint, taskId),
    method: 'get'
  })
}

export const retryVideoBatch = (taskId, options = {}) => {
  const { endpoint = '/v1/video/generations' } = options
  return request({
    url: buildVideoBatchRetryUrl(endpoint, taskId),
    method: 'post',
    data: {}
  })
}
// 轮询视频任务直到完成
export const pollVideoTask = async (taskId, maxAttempts = Number.POSITIVE_INFINITY, interval = 5000) => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getVideoTaskStatus(taskId)

    const taskState = getVideoTaskPollingState(result)

    if (taskState.state === 'completed') {
      return { ...result, url: taskState.url }
    }

    if (taskState.state === 'missing_url') {
      const taskError = new Error('视频任务已完成但未返回视频 URL')
      taskError.videoTaskTerminal = true
      taskError.videoTaskStatus = taskState.status || 'completed'
      throw taskError
    }

    if (taskState.state === 'failed') {
      const taskError = new Error(result.error?.message || '视频生成失败')
      taskError.videoTaskTerminal = true
      taskError.videoTaskStatus = taskState.status || 'failed'
      throw taskError
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  const pollingError = new Error('状态查询暂时停止，任务仍可能在后台运行')
  pollingError.videoTaskTerminal = false
  pollingError.taskId = taskId
  throw pollingError
}
