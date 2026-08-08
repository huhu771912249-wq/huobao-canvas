import request from '../utils/request'
import { buildMaterialApiUrl } from '../utils/apiBase'

export const createMaterialInput = data => request({
  url: buildMaterialApiUrl('/v1/material-inputs'),
  method: 'post',
  data,
  timeout: 15 * 60 * 1000
})
