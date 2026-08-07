import request from '../utils/request'
import { buildMaterialApiUrl } from '../utils/apiBase'

export const createVideoTextOverlay = ({ video, ratio, segments }) => request({
  url: buildMaterialApiUrl('/v1/media/text-overlays'),
  method: 'post',
  data: { video, ratio, segments },
  timeout: 15 * 60 * 1000
})
