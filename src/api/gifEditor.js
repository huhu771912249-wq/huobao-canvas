import request from '../utils/request'

const requiredId = jobId => {
  const value = typeof jobId === 'string' || jobId instanceof String ? String(jobId).trim() : ''
  if (!value) throw new TypeError('jobId is required')
  return encodeURIComponent(value)
}

export const uploadGifEditorAsset = image => request({
  url: '/v1/assets/images',
  method: 'post',
  data: { image }
})

export const uploadGifEditorMedia = data => request({
  url: '/v1/material-inputs',
  method: 'post',
  data,
  timeout: 15 * 60 * 1000
})

export const createGifEditorJob = data => request({
  url: '/v1/media/gif-watermarks',
  method: 'post',
  data
})

export const getGifEditorJob = jobId => request({
  url: `/v1/video-resize/jobs/${requiredId(jobId)}`,
  method: 'get'
})
