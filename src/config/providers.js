import { getMaterialApiBase } from '../utils/apiBase.js'
import { normalizeVideoImageAlignmentRequest, normalizeVideoQualityRequestProfile } from './studioProjectFlow.js'
import { IMAGE_UNSUPPORTED_BY_PROVIDER, pickImageRequestFields } from '../utils/imageRequestContract.js'

// 图片适配器全部由 `utils/imageRequestContract` 的字段表推导，不再手抄。
// 以前每个渠道各写一串 `if (params.x) adapted.x = params.x`，于是出现了两种烂账：
//   1. useApi 根本没发的字段，适配器里却有个「准备接」的死分支（quality / style / n），
//      看起来像支持，实际上永远走不到 —— 本次 bug 报告就是被这个死分支误导的；
//   2. useApi 发了、适配器忘了抄，字段被静默丢掉（#43 的 video 白名单）。
const adaptImageRequest = (providerKey, params = {}) =>
  pickImageRequestFields(params, { drop: IMAGE_UNSUPPORTED_BY_PROVIDER[providerKey] })

const withVideoQualityContract = (params, adapted) => {
  const qualityProfile = normalizeVideoQualityRequestProfile(params?.quality_profile)
  const imageAlignment = normalizeVideoImageAlignmentRequest(params?.image_alignment)
  if (qualityProfile) adapted.quality_profile = qualityProfile
  if (imageAlignment) adapted.image_alignment = imageAlignment
  return adapted
}

const adaptLocalVideoRequest = (params = {}) => {
  const adapted = { model: params.model, prompt: params.prompt || '' }
  for (const key of ['first_frame_image', 'last_frame_image', 'images', 'driving_video', 'driving_video_name', 'size', 'seconds', 'sizes', 'output_formats', 'output_width', 'output_height', 'sampling_mode', 'director_plan']) {
    if (params[key] !== undefined) adapted[key] = params[key]
  }
  return withVideoQualityContract(params, adapted)
}

/**
 * API Provider Adapters | API 渠道适配器
 * 适配不同 API 提供商的请求参数和响应格式
 */

// 渠道适配配置
export const PROVIDERS = {
  'local-material': {
    label: '冠希本地 API',
    defaultBaseUrl: getMaterialApiBase(),
    defaultApiKey: '',
    endpoints: {
      chat: '/v1/chat/completions',
      image: '/v1/images/generations',
      video: '/v1/video/generations',
      videoQuery: '/v1/video/task/{taskId}'
    },
    requestAdapter: {
      chat: (params) => {
        const adapted = {
          model: params.model,
          messages: params.messages
        }
        if (params.temperature !== undefined) adapted.temperature = params.temperature
        if (params.max_tokens !== undefined) adapted.max_tokens = params.max_tokens
        if (params.stream !== undefined) adapted.stream = params.stream
        return adapted
      },
      image: (params) => adaptImageRequest('local-material', {
        ...params,
        model: params.model || 'frw-qianwen'
      }),
      video: adaptLocalVideoRequest
    },
    responseAdapter: {
      chat: (response) => {
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message?.content || ''
        }
        return ''
      },
      image: (response) => {
        const data = response.data || response
        return (Array.isArray(data) ? data : [data]).map(item => ({
          url: item.url || item.b64_json || '',
          public_url: item.public_url || '',
          asset_role: item.asset_role || '',
          file_name: item.file_name || '',
          revisedPrompt: item.revised_prompt || ''
        }))
      },
      video: (response) => response
    }
  },
  chatfire: {
    label: '冠希 (Chatfire)',
    defaultBaseUrl: 'https://api.chatfire.site',
    // 端点路径
    endpoints: {
      chat: '/v1/chat/completions',
      image: '/v1/images/generations',
      video: '/v1/video/generations',
      videoQuery: '/v1/video/task/{taskId}'
    },
    // 冠希渠道请求适配
    requestAdapter: {
      chat: (params) => {
        const adapted = {
          model: params.model,
          messages: params.messages
        }
        if (params.temperature !== undefined) adapted.temperature = params.temperature
        if (params.max_tokens !== undefined) adapted.max_tokens = params.max_tokens
        if (params.stream !== undefined) adapted.stream = params.stream
        return adapted
      },
      image: (params) => adaptImageRequest('chatfire', params),
      video: (params) => {
        const model = params.model || ''

        // Seedance 模型 - 使用 content 数组格式
        if (model.includes('seedance')) {
          const content = []

          // 构建完整参数文本
          // 格式: prompt --resolution 720p --ratio 16:9 --dur 5 --fps 24 --wm true --seed 11 --cf false
          let textPrompt = params.prompt || ''

          // 添加 resolution 参数
          if (params.resolution) {
            textPrompt += ` --resolution ${params.resolution}`
          }

          // 添加 ratio 参数 (图生视频用 16:9)
          if (params.size) {
            textPrompt += ` --ratio ${params.size}`
          }

          // 添加 duration 参数
          if (params.seconds) {
            textPrompt += ` --dur ${params.seconds}`
          }

          // 添加 fps (固定 24)
          textPrompt += ` --fps 24`

          // 添加水印参数 (默认 true)
          textPrompt += ` --wm ${params.wm !== false ? 'true' : 'false'}`

          // 添加 seed 参数 (可选)
          if (params.seed !== undefined) {
            textPrompt += ` --seed ${params.seed}`
          }

          // 添加 cf 参数 (默认 false)
          textPrompt += ` --cf ${params.cf === true ? 'true' : 'false'}`

          content.push({
            type: 'text',
            text: textPrompt
          })

          // 添加参考图（如果有）
          if (params.first_frame_image) {
            content.push({
              type: 'image_url',
              image_url: {
                url: params.first_frame_image
              }
            })
          }

          const adapted = {
            model: model,
            content: content,
            generate_audio: params.generateAudio !== false
          }

          return withVideoQualityContract(params, adapted)
        }

        // Kling 模型 - 使用 kling 特定格式
        if (model.includes('kling')) {
          // 将 ratio 转换为 aspect_ratio 格式
          const ratioMap = {
            '16:9': '16:9',
            '9:16': '9:16',
            '1:1': '1:1',
            '4:3': '4:3',
            '3:4': '3:4'
          }

          const adapted = {
            model_name: model,
            mode: 'std',
            prompt: params.prompt || '',
            aspect_ratio: ratioMap[params.size] || '16:9',
            duration: params.seconds || 5,
            negative_prompt: '',
            cfg_scale: 0.5
          }

          // 添加参考图（如果有）
          if (params.first_frame_image) {
            adapted.image = params.first_frame_image
          }

          return withVideoQualityContract(params, adapted)
        }

        // 默认格式（veo 等）
        const adapted = {
          model: params.model,
          prompt: params.prompt || ''
        }
        if (params.first_frame_image) adapted.first_frame_image = params.first_frame_image
        if (params.last_frame_image) adapted.last_frame_image = params.last_frame_image
        if (params.size) adapted.size = params.size
        if (params.seconds) adapted.seconds = params.seconds

        return withVideoQualityContract(params, adapted)
      }
    },
    // 冠希渠道响应格式
    responseAdapter: {
      chat: (response) => {
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message?.content || ''
        }
        return ''
      },
      image: (response) => {
        const data = response.data || response
        return (Array.isArray(data) ? data : [data]).map(item => ({
          url: item.url || item.b64_json || '',
          revisedPrompt: item.revised_prompt || ''
        }))
      },
      video: (response) => {
        return {
          url: response.data?.url || response.url || response.data?.[0]?.url || '',
          ...response
        }
      }
    }
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.chatfire.cn',
    // 端点路径
    endpoints: {
      chat: '/v1/chat/completions',
      image: '/v1/images/generations',
      video: '/v1/videos',
      videoQuery: '/v1/videos/{taskId}'
    },
    // 请求参数适配
    requestAdapter: {
      chat: (params) => {
        const adapted = {
          model: params.model,
          messages: params.messages
        }
        // 添加可选参数
        if (params.temperature !== undefined) adapted.temperature = params.temperature
        if (params.max_tokens !== undefined) adapted.max_tokens = params.max_tokens
        if (params.stream !== undefined) adapted.stream = params.stream
        return adapted
      },
      image: (params) => adaptImageRequest('openai', params),
      video: (params) => {
        const adapted = {
          model: params.model,
          prompt: params.prompt || ''
        }
        if (params.first_frame_image) adapted.first_frame_image = params.first_frame_image
        if (params.last_frame_image) adapted.last_frame_image = params.last_frame_image
        if (params.size) adapted.size = params.size
        if (params.seconds) adapted.seconds = params.seconds
        return withVideoQualityContract(params, adapted)
      }
    },
    // 响应数据适配
    responseAdapter: {
      chat: (response) => {
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message?.content || ''
        }
        return ''
      },
      image: (response) => {
        const data = response.data || response
        return (Array.isArray(data) ? data : [data]).map(item => ({
          url: item.url || item.b64_json || '',
          revisedPrompt: item.revised_prompt || ''
        }))
      },
      video: (response) => {
        return {
          url: response.data?.url || response.url || response.data?.[0]?.url || '',
          ...response
        }
      }
    }
  },

  

  // 默认使用 OpenAI 格式
  default: 'local-material'
}

// 获取渠道列表
export const getProviderList = () => {
  return Object.entries(PROVIDERS)
    .filter(([key]) => key !== 'default')
    .map(([key, value]) => ({
      key,
      label: value.label
    }))
}

// 获取默认渠道
export const getDefaultProvider = () => {
  return PROVIDERS.default || 'chatfire'
}

// 归一化渠道 Key，避免 localStorage 残留旧值时“显示默认渠道、过滤旧渠道模型”
export const normalizeProviderKey = (providerKey) => {
  return PROVIDERS[providerKey] ? providerKey : getDefaultProvider()
}

// 获取渠道的默认 Base URL
export const getDefaultBaseUrl = (providerKey) => {
  const config = getProviderConfig(providerKey)
  return config.defaultBaseUrl || ''
}

// 获取渠道配置
export const getProviderConfig = (providerKey) => {
  return PROVIDERS[normalizeProviderKey(providerKey)]
}
