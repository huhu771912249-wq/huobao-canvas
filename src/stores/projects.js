/**
 * Projects store | 项目状态管理
 * Keeps project JSON on the backend and only lightweight UI state locally.
 */
import { ref, computed } from 'vue'
import {
  deleteCanvasProject,
  getCanvasProject,
  listCanvasProjects,
  publishProjectImage,
  putCanvasProject
} from '../api/projects.js'
import {
  LEGACY_PROJECTS_STORAGE_KEY,
  prepareProjectForServer,
  readLegacyProjects,
  readProjectClientState,
  writeProjectClientState
} from '../utils/projectPersistence.js'

// Generate unique ID | 生成唯一ID
const generateId = () => `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Projects list | 项目列表
export const projects = ref([])

// Current project ID | 当前项目ID
export const currentProjectId = ref(null)

// Current project | 当前项目
export const currentProject = computed(() => {
  return projects.value.find(p => p.id === currentProjectId.value) || null
})

let initializationPromise = null
const projectWriteQueues = new Map()
let lastPersistenceErrorAt = 0

const browserStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

const hydrateProject = project => ({
  ...project,
  createdAt: new Date(project.createdAt || Date.now()),
  updatedAt: new Date(project.updatedAt || Date.now())
})

const persistClientState = (lastServerSyncAt = '') => {
  const storage = browserStorage()
  if (!storage) return
  try {
    writeProjectClientState(storage, {
      currentProjectId: currentProjectId.value,
      lastServerSyncAt
    })
  } catch (error) {
    console.warn('Failed to save lightweight project state:', error)
  }
}

const reportPersistenceError = error => {
  console.error('Failed to persist project:', error)
  const now = Date.now()
  if (now - lastPersistenceErrorAt < 5000) return
  lastPersistenceErrorAt = now
  if (typeof window !== 'undefined') {
    window.$message?.error('项目暂时无法同步到服务器，当前页面内容仍保留，请稍后重试')
  }
}

const publishInlineImage = image => {
  return publishProjectImage(image, `canvas-project-${Date.now()}.png`)
}

const queueProjectOperation = (projectId, operation) => {
  const previous = projectWriteQueues.get(projectId) || Promise.resolve()
  const next = previous.catch(() => {}).then(operation)
  projectWriteQueues.set(projectId, next)
  next.finally(() => {
    if (projectWriteQueues.get(projectId) === next) projectWriteQueues.delete(projectId)
  }).catch(() => {})
  return next
}

const persistProject = projectId => queueProjectOperation(projectId, async () => {
  const project = projects.value.find(item => item.id === projectId)
  if (!project) return null
  const snapshotUpdatedAt = new Date(project.updatedAt || 0).getTime()
  const prepared = await prepareProjectForServer(project, {
    publishImage: publishInlineImage
  })
  const saved = await putCanvasProject(projectId, prepared)
  const current = projects.value.find(item => item.id === projectId)
  if (current && new Date(current.updatedAt || 0).getTime() === snapshotUpdatedAt) {
    const index = projects.value.findIndex(item => item.id === projectId)
    projects.value[index] = hydrateProject(saved)
  }
  persistClientState(new Date().toISOString())
  return saved
})

const scheduleProjectSave = projectId => {
  if (typeof window === 'undefined') return
  persistProject(projectId).catch(reportPersistenceError)
}

/**
 * Read legacy browser projects for one-time migration. New project JSON never
 * writes to localStorage.
 */
export const loadProjects = () => {
  const storage = browserStorage()
  if (!storage) return []
  const legacy = readLegacyProjects(storage)
  if (legacy.length && projects.value.length === 0) {
    projects.value = legacy.map(hydrateProject)
  }
  const clientState = readProjectClientState(storage)
  currentProjectId.value = clientState.currentProjectId || currentProjectId.value
  return legacy
}

export const saveProjects = () => {
  persistClientState()
  projects.value.forEach(project => scheduleProjectSave(project.id))
}

/**
 * Create a new project | 创建新项目
 * @param {string} name - Project name | 项目名称
 * @returns {string} - New project ID | 新项目ID
 */
export const createProject = (name = '未命名项目') => {
  const id = generateId()
  const now = new Date()
  
  const newProject = {
    id,
    name,
    thumbnail: '',
    createdAt: now,
    updatedAt: now,
    // Canvas data | 画布数据
    canvasData: {
      nodes: [],
      edges: [],
      viewport: { x: 100, y: 50, zoom: 0.8 }
    }
  }
  
  projects.value = [newProject, ...projects.value]
  currentProjectId.value = id
  persistClientState()
  scheduleProjectSave(id)
  
  return id
}

/**
 * Update project | 更新项目
 * @param {string} id - Project ID | 项目ID
 * @param {object} data - Update data | 更新数据
 */
export const updateProject = (id, data) => {
  const index = projects.value.findIndex(p => p.id === id)
  if (index === -1) return false
  
  projects.value[index] = {
    ...projects.value[index],
    ...data,
    updatedAt: new Date()
  }
  
  // Move to top of list | 移动到列表顶部
  const [updated] = projects.value.splice(index, 1)
  projects.value = [updated, ...projects.value]
  
  scheduleProjectSave(id)
  return true
}

/**
 * Update project canvas data | 更新项目画布数据
 * @param {string} id - Project ID | 项目ID
 * @param {object} canvasData - Canvas data (nodes, edges, viewport) | 画布数据
 */
export const updateProjectCanvas = (id, canvasData) => {
  const project = projects.value.find(p => p.id === id)
  if (!project) return false
  
  project.canvasData = {
    ...project.canvasData,
    ...canvasData
  }
  project.updatedAt = new Date()
  
  // Auto-update thumbnail from last edited image/video node | 自动从最后编辑的图片/视频节点更新缩略图
  if (canvasData.nodes) {
    const mediaNodes = canvasData.nodes
      .filter(node => (node.type === 'image' || node.type === 'video') && node.data?.url)
      .sort((a, b) => {
        // Sort by last updated time | 按最后更新时间排序
        const aTime = a.data?.updatedAt || a.data?.createdAt || 0
        const bTime = b.data?.updatedAt || b.data?.createdAt || 0
        return bTime - aTime
      })
    if (mediaNodes.length > 0) {
      const latestNode = mediaNodes[0]
      // Use thumbnail for video nodes, url for image nodes | 视频节点使用缩略图，图片节点使用 URL
      if (latestNode.type === 'video') {
        project.thumbnail = latestNode.data.thumbnail || latestNode.data.url
      } else {
        project.thumbnail = latestNode.data.url
      }
    }
  }
  
  scheduleProjectSave(id)
  return true
}

/**
 * Get project canvas data | 获取项目画布数据
 * @param {string} id - Project ID | 项目ID
 * @returns {object|null} - Canvas data or null | 画布数据或空
 */
export const getProjectCanvas = (id) => {
  const project = projects.value.find(p => p.id === id)
  return project?.canvasData || null
}

export const ensureProjectLoaded = async id => {
  const existing = projects.value.find(project => project.id === id)
  if (existing?.canvasData) {
    currentProjectId.value = id
    persistClientState()
    return existing
  }
  const loaded = hydrateProject(await getCanvasProject(id))
  const index = projects.value.findIndex(project => project.id === id)
  if (index === -1) projects.value = [loaded, ...projects.value]
  else projects.value[index] = loaded
  currentProjectId.value = id
  persistClientState(new Date().toISOString())
  return loaded
}

/**
 * Delete project | 删除项目
 * @param {string} id - Project ID | 项目ID
 */
export const deleteProject = (id) => {
  const removed = projects.value.find(project => project.id === id)
  projects.value = projects.value.filter(project => project.id !== id)
  if (currentProjectId.value === id) currentProjectId.value = null
  persistClientState()
  if (typeof window === 'undefined') return
  queueProjectOperation(id, async () => {
    try {
      await deleteCanvasProject(id)
    } catch (error) {
      if (error?.response?.status === 404) return
      if (removed && !projects.value.some(project => project.id === id)) {
        projects.value = [removed, ...projects.value]
      }
      reportPersistenceError(error)
    }
  })
}

/**
 * Duplicate project | 复制项目
 * @param {string} id - Source project ID | 源项目ID
 * @returns {string|null} - New project ID or null | 新项目ID或空
 */
export const duplicateProject = (id) => {
  const source = projects.value.find(p => p.id === id)
  if (!source) return null
  
  const newId = generateId()
  const now = new Date()
  
  const newProject = {
    ...JSON.parse(JSON.stringify(source)), // Deep clone | 深拷贝
    id: newId,
    name: `${source.name} (副本)`,
    createdAt: now,
    updatedAt: now
  }
  
  projects.value = [newProject, ...projects.value]
  currentProjectId.value = newId
  persistClientState()
  scheduleProjectSave(newId)
  
  return newId
}

/**
 * Rename project | 重命名项目
 * @param {string} id - Project ID | 项目ID
 * @param {string} name - New name | 新名称
 */
export const renameProject = (id, name) => {
  return updateProject(id, { name })
}

/**
 * Update project thumbnail | 更新项目缩略图
 * @param {string} id - Project ID | 项目ID
 * @param {string} thumbnail - Thumbnail URL (base64 or URL) | 缩略图URL
 */
export const updateProjectThumbnail = (id, thumbnail) => {
  return updateProject(id, { thumbnail })
}

/**
 * Get sorted projects | 获取排序后的项目列表
 * @param {string} sortBy - Sort field (updatedAt, createdAt, name) | 排序字段
 * @param {string} order - Sort order (asc, desc) | 排序顺序
 */
export const getSortedProjects = (sortBy = 'updatedAt', order = 'desc') => {
  return computed(() => {
    const sorted = [...projects.value]
    sorted.sort((a, b) => {
      let valueA = a[sortBy]
      let valueB = b[sortBy]
      
      if (valueA instanceof Date) {
        valueA = valueA.getTime()
        valueB = valueB.getTime()
      }
      
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase()
        valueB = valueB.toLowerCase()
      }
      
      if (order === 'asc') {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })
    return sorted
  })
}

const sampleCanvasData = () => ({
  nodes: [
    {
      id: 'node_0',
      type: 'text',
      position: { x: 150, y: 150 },
      data: {
        content: '一只金毛寻回犬在草地上奔跑，摇着尾巴，脸上带着快乐的表情。它的毛发在阳光下闪耀，眼神充满了对自由的渴望，全身散发着阳光、友善的气息。',
        label: '文本输入'
      }
    },
    {
      id: 'node_1',
      type: 'imageConfig',
      position: { x: 500, y: 150 },
      data: {
        prompt: '',
        model: 'doubao-seedream-4-5-251128',
        size: '512x512',
        label: '文生图'
      }
    }
  ],
  edges: [
    {
      id: 'edge_node_0_node_1',
      source: 'node_0',
      target: 'node_1',
      sourceHandle: 'right',
      targetHandle: 'left'
    }
  ],
  viewport: { x: 100, y: 50, zoom: 0.8 }
})

const mergeProjectSummaries = summaries => {
  const localById = new Map(projects.value.map(project => [project.id, project]))
  const merged = summaries.map(summary => {
    const local = localById.get(summary.id)
    localById.delete(summary.id)
    return hydrateProject({
      ...local,
      ...summary,
      ...(local?.canvasData ? { canvasData: local.canvasData } : {})
    })
  })
  projects.value = [...localById.values(), ...merged].sort(
    (left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
  )
}

/**
 * Load the server index and migrate the old all-projects localStorage record.
 * The legacy key is removed only after every project has reached the backend.
 */
export const initProjectsStore = () => {
  if (initializationPromise) return initializationPromise
  const legacy = loadProjects()

  initializationPromise = (async () => {
    try {
      let response = await listCanvasProjects()
      let summaries = Array.isArray(response?.projects) ? response.projects : []
      const remoteById = new Map(summaries.map(project => [project.id, project]))

      if (legacy.length) {
        for (const project of legacy) {
          const remote = remoteById.get(project.id)
          const localTime = new Date(project.updatedAt || 0).getTime()
          const remoteTime = new Date(remote?.updatedAt || 0).getTime()
          if (!remote || localTime > remoteTime) await persistProject(project.id)
        }
        const storage = browserStorage()
        storage?.removeItem?.(LEGACY_PROJECTS_STORAGE_KEY)
        response = await listCanvasProjects()
        summaries = Array.isArray(response?.projects) ? response.projects : []
      }

      mergeProjectSummaries(summaries)
      if (projects.value.length === 0) {
        const id = createProject('示例项目')
        const project = projects.value.find(item => item.id === id)
        if (project) {
          project.canvasData = sampleCanvasData()
          project.updatedAt = new Date()
          await persistProject(id)
        }
      }
      persistClientState(new Date().toISOString())
      return projects.value
    } catch (error) {
      reportPersistenceError(error)
      return projects.value
    }
  })()

  return initializationPromise
}

// Export for debugging | 导出用于调试
if (typeof window !== 'undefined') {
  window.__aiCanvasProjects = {
    projects,
    loadProjects,
    saveProjects,
    createProject,
    deleteProject
  }
}
