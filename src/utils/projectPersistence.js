export const LEGACY_PROJECTS_STORAGE_KEY = 'ai-canvas-projects'
export const PROJECT_CLIENT_STATE_KEY = 'ai-canvas-project-state'
export const PROJECT_SCHEMA_VERSION = 2

const DROP = Symbol('drop-project-value')

const isInlineImage = value => String(value || '').trim().toLowerCase().startsWith('data:image/')
const isTransientUrl = value => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized.startsWith('data:') || normalized.startsWith('blob:')
}

const resolvedAssetUrl = payload => String(
  payload?.public_url || payload?.url || payload?.local_url || ''
).trim()

export const prepareProjectForServer = async (project, { publishImage } = {}) => {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new Error('项目数据无效')
  }

  const inlineAssets = new Map()
  const ancestors = new Set()

  const publishInlineImage = async image => {
    if (typeof publishImage !== 'function') {
      throw new Error('项目包含未上传图片，暂时无法保存')
    }
    if (!inlineAssets.has(image)) {
      inlineAssets.set(image, Promise.resolve(publishImage(image)).then(result => {
        const url = resolvedAssetUrl(result)
        if (!url || isTransientUrl(url)) {
          throw new Error('图片已上传，但服务器没有返回可保存的素材地址')
        }
        return url
      }))
    }
    return inlineAssets.get(image)
  }

  const clean = async (value, depth = 0) => {
    if (depth > 32) throw new Error('项目数据嵌套过深')
    if (value === null || ['boolean', 'number'].includes(typeof value)) return value
    if (typeof value === 'string') {
      if (isInlineImage(value)) return publishInlineImage(value)
      return isTransientUrl(value) ? DROP : value
    }
    if (value instanceof Date) return value.toISOString()
    if (typeof value !== 'object') return DROP
    if (ancestors.has(value)) throw new Error('项目数据存在循环引用')

    ancestors.add(value)
    try {
      if (Array.isArray(value)) {
        const result = []
        for (const item of value) {
          const next = await clean(item, depth + 1)
          if (next !== DROP) result.push(next)
        }
        return result
      }

      const result = {}
      for (const [key, item] of Object.entries(value)) {
        const next = await clean(item, depth + 1)
        if (next !== DROP) result[key] = next
      }
      if (Object.keys(value).length > 0 && Object.keys(result).length === 0) return DROP
      return result
    } finally {
      ancestors.delete(value)
    }
  }

  return clean(project)
}

export const readLegacyProjects = storage => {
  try {
    const raw = storage?.getItem?.(LEGACY_PROJECTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(project => project && typeof project === 'object' && project.id)
  } catch {
    return []
  }
}

export const readProjectClientState = storage => {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PROJECT_CLIENT_STATE_KEY) || '{}')
    if (parsed?.schemaVersion !== PROJECT_SCHEMA_VERSION) return {}
    return parsed
  } catch {
    return {}
  }
}

export const writeProjectClientState = (storage, state = {}) => {
  const value = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    currentProjectId: String(state.currentProjectId || ''),
    lastServerSyncAt: String(state.lastServerSyncAt || '')
  }
  storage?.setItem?.(PROJECT_CLIENT_STATE_KEY, JSON.stringify(value))
  return value
}
