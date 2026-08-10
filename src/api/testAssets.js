import { request } from '@/utils'

export const generateTestAssets = data => request({
  url: '/v1/test-assets/generate',
  method: 'post',
  data
})
