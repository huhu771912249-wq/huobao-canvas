import { request } from '@/utils'

const root = '/v1/video-resize/jobs'

export const createVideoResizeJob = data => request({ url: root, method: 'post', data })
export const getVideoResizeJob = jobId => request({ url: `${root}/${encodeURIComponent(jobId)}`, method: 'get' })
export const cancelVideoResizeJob = jobId => request({ url: `${root}/${encodeURIComponent(jobId)}/cancel`, method: 'post', data: {} })
export const retryVideoResizeJob = jobId => request({ url: `${root}/${encodeURIComponent(jobId)}/retry`, method: 'post', data: {} })
export const saveVideoResizeJob = jobId => request({ url: `${root}/${encodeURIComponent(jobId)}/save`, method: 'post', data: {} })
export const handoffVideoResizeJob = jobId => request({ url: `${root}/${encodeURIComponent(jobId)}/handoff`, method: 'post', data: {} })
