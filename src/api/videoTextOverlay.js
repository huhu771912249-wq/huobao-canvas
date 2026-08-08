import request from '../utils/request'
import { buildMaterialApiUrl } from '../utils/apiBase'

export const createVideoTextOverlay = ({ video, ratio, output_width, output_height, segments }) => request({
  url: buildMaterialApiUrl('/v1/media/text-overlays'),
  method: 'post',
  data: { video, ratio, output_width, output_height, segments },
  timeout: 15 * 60 * 1000
})
