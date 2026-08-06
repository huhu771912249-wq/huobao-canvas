import request from '../utils/request'

const readAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',', 2)[1] || '')
  reader.onerror = () => reject(new Error('附件读取失败'))
  reader.readAsDataURL(file)
})

export const parseStudioDocument = async file => request({
  url: '/v1/studio/documents/parse',
  method: 'post',
  data: { filename: file.name, content_base64: await readAsBase64(file) },
  timeout: 120000
})
