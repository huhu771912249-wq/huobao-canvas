import request from '../utils/request'

const JOBS_API = '/v1/studio/novel-video/jobs'
const encodeRequiredId = (id, name) => {
  const value = String(id ?? '')
  if (!value.trim()) {
    throw new TypeError(`${name} is required`)
  }
  return encodeURIComponent(value)
}
const jobUrl = jobId => `${JOBS_API}/${encodeRequiredId(jobId, 'jobId')}`

export const createNovelVideoJob = data => request({
  url: JOBS_API,
  method: 'post',
  data
})

export const listNovelVideoJobs = ({ limit = 20, cursor = 0 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit), cursor: String(cursor) })
  return request({
    url: `${JOBS_API}?${params.toString()}`,
    method: 'get'
  })
}

export const getNovelVideoJob = jobId => request({
  url: jobUrl(jobId),
  method: 'get'
})

export const retryNovelVideoShot = (jobId, shotId) => request({
  url: `${jobUrl(jobId)}/shots/${encodeRequiredId(shotId, 'shotId')}/retry`,
  method: 'post',
  data: {}
})

const serializeSubtitle = subtitle => {
  const segment = {
    start: subtitle?.start,
    end: subtitle?.end,
    text: subtitle?.text
  }
  const speaker = String(subtitle?.speaker ?? '').trim()
  if (speaker) segment.speaker = speaker
  return segment
}

export const updateNovelSubtitles = (jobId, subtitles) => request({
  url: `${jobUrl(jobId)}/subtitles`,
  method: 'put',
  data: { segments: (Array.isArray(subtitles) ? subtitles : []).map(serializeSubtitle) }
})

export const finalizeNovelVideoJob = (jobId, data = {}) => request({
  url: `${jobUrl(jobId)}/finalize`,
  method: 'post',
  data
})

export const cancelNovelVideoJob = jobId => request({
  url: `${jobUrl(jobId)}/cancel`,
  method: 'post',
  data: {}
})
