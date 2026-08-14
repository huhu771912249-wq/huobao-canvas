import request from '../utils/request'

const requiredId = jobId => {
  const value = typeof jobId === 'string' || jobId instanceof String ? String(jobId).trim() : ''
  if (!value) throw new TypeError('jobId is required')
  return encodeURIComponent(value)
}

const positiveDuration = value => {
  const duration = Number(value)
  return Number.isFinite(duration) && duration > 0 ? duration : 0
}

const skipGifBlocks = (bytes, start) => {
  let offset = start
  while (offset < bytes.length) {
    const size = bytes[offset]
    offset += 1
    if (!size) return offset
    offset += size
  }
  return offset
}

export const getGifDurationFromBytes = input => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0)
  const signature = String.fromCharCode(...bytes.slice(0, 6))
  if (!['GIF87a', 'GIF89a'].includes(signature) || bytes.length < 13) {
    throw new TypeError('GIF 素材格式无效')
  }

  let offset = 13
  if (bytes[10] & 0x80) offset += 3 * (2 ** ((bytes[10] & 0x07) + 1))
  let pendingDelay = 0
  let duration = 0

  while (offset < bytes.length) {
    const marker = bytes[offset]
    offset += 1
    if (marker === 0x3b) break
    if (marker === 0x21) {
      const extension = bytes[offset]
      offset += 1
      if (extension === 0xf9) {
        const blockSize = bytes[offset]
        offset += 1
        if (blockSize >= 4 && offset + blockSize <= bytes.length) {
          pendingDelay = (bytes[offset + 1] | (bytes[offset + 2] << 8)) / 100
        }
        offset += blockSize
        if (bytes[offset] === 0) offset += 1
      } else {
        offset = skipGifBlocks(bytes, offset)
      }
      continue
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) break
    const packed = bytes[offset + 8]
    offset += 9
    if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1))
    offset += 1
    offset = skipGifBlocks(bytes, offset)
    duration += pendingDelay || 0.1
    pendingDelay = 0
  }

  if (!duration) throw new TypeError('GIF 素材未包含可读取的帧')
  return Number(duration.toFixed(3))
}

const probeVideoDuration = source => new Promise((resolve, reject) => {
  const media = document.createElement('video')
  const objectUrl = typeof source === 'string' ? '' : URL.createObjectURL(source)
  const cleanup = () => {
    media.removeAttribute('src')
    media.load()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
  media.preload = 'metadata'
  media.onloadedmetadata = () => {
    const duration = positiveDuration(media.duration)
    cleanup()
    if (duration) resolve(duration)
    else reject(new TypeError('视频素材时长无效'))
  }
  media.onerror = () => {
    cleanup()
    reject(new TypeError('无法探测视频素材时长'))
  }
  media.src = objectUrl || source
})

export const probeGifEditorMediaDuration = async (source, kind = '') => {
  const name = String(source?.name || (typeof source === 'string' ? source : ''))
  const mime = String(source?.type || '')
  const isGif = kind === 'gif' || mime.toLowerCase() === 'image/gif' || /\.gif(?:$|\?)/i.test(name)
  if (!isGif) return probeVideoDuration(source)

  const response = typeof source?.arrayBuffer === 'function'
    ? await source.arrayBuffer()
    : await request({ url: String(source || ''), method: 'get', responseType: 'arraybuffer' })
  return getGifDurationFromBytes(response)
}

export const getGifEditorJobDuration = job => positiveDuration(
  job?.results?.[0]?.duration ?? job?.result?.duration ?? job?.duration
)

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
