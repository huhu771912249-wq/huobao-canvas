import { request } from '@/utils'

export const createLtxAudioTask = (prompt, duration = 5) => request({
  url: '/v1/audio/generations', method: 'post',
  data: { prompt, duration },
  headers: { 'Content-Type': 'application/json' }
})

export const getLtxAudioTask = (taskId) => request({
  url: `/v1/audio/generations/${encodeURIComponent(taskId)}`, method: 'get'
})

export const waitForLtxAudio = async (taskId, attempts = 120, interval = 2000) => {
  for (let index = 0; index < attempts; index += 1) {
    const task = await getLtxAudioTask(taskId)
    if (task.status === 'completed' && (task.audio_url || task.url)) return task
    if (task.status === 'failed') throw new Error(task.error || 'LTX 2.3 语音生成失败')
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error('LTX 2.3 语音生成超时')
}
