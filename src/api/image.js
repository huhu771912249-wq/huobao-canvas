/**
 * Image API | 图片生成 API
 */

import { request } from '@/utils'
import { buildMaterialApiUrl } from '@/utils/apiBase'

// 生成图片
export const generateImage = (data, options = {}) => {
  const { requestType = 'json', endpoint = '/images/generations' } = options
  
  return request({
    url: endpoint,
    method: 'post',
    data,
    headers: requestType === 'formdata' ? { 'Content-Type': 'multipart/form-data' } : {}
  })
}

// 发布本地/内嵌图片为可被远端视频服务读取的素材 URL
export const publishImageAsset = (data, options = {}) => {
  const { endpoint = buildMaterialApiUrl('/v1/assets/images') } = options

  return request({
    url: endpoint,
    method: 'post',
    data,
    headers: { 'Content-Type': 'application/json' }
  })
}
