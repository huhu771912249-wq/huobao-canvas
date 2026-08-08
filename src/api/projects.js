import { buildMaterialApiUrl } from '../utils/apiBase.js'

const root = '/v1/projects'

const projectRequest = async (path, options = {}) => {
  const response = await fetch(buildMaterialApiUrl(path), {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `项目请求失败（HTTP ${response.status}）`)
    error.response = { status: response.status, data: payload }
    throw error
  }
  return payload
}

export const listCanvasProjects = () => projectRequest(root)

export const getCanvasProject = projectId => projectRequest(
  `${root}/${encodeURIComponent(projectId)}`
)

export const putCanvasProject = (projectId, project) => projectRequest(
  `${root}/${encodeURIComponent(projectId)}`,
  {
    method: 'put',
    body: JSON.stringify(project)
  }
)

export const deleteCanvasProject = projectId => projectRequest(
  `${root}/${encodeURIComponent(projectId)}`,
  {
    method: 'delete',
    body: '{}'
  }
)

export const publishProjectImage = (image, name) => projectRequest(
  '/v1/assets/images',
  {
    method: 'post',
    body: JSON.stringify({ image, name })
  }
)
