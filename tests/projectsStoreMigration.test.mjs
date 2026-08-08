import assert from 'node:assert/strict'

const legacyKey = 'ai-canvas-projects'
const clientStateKey = 'ai-canvas-project-state'
const inlineImage = 'data:image/png;base64,aGVsbG8='
const storage = new Map([
  [legacyKey, JSON.stringify([{
    id: 'project_legacy_1',
    name: '旧缓存项目',
    thumbnail: inlineImage,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    canvasData: {
      nodes: [{
        id: 'node_1',
        type: 'videoConfig',
        data: { confirmedMultiViewReference: { image: inlineImage } }
      }],
      edges: []
    }
  }])]
])

const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}
globalThis.window = {
  localStorage,
  location: { origin: 'https://canvas.test' },
  $message: { error: message => { throw new Error(message) } }
}

const serverProjects = new Map()
let imageUploads = 0
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url)
  if (parsed.pathname === '/v1/assets/images' && options.method === 'post') {
    imageUploads += 1
    return Response.json({ url: '/public-assets/migrated-reference.png' })
  }
  if (parsed.pathname === '/v1/projects' && !options.method) {
    const projects = [...serverProjects.values()].map(project => {
      const { canvasData, ...summary } = project
      return summary
    })
    return Response.json({ projects, total: projects.length })
  }
  if (parsed.pathname.startsWith('/v1/projects/') && options.method === 'put') {
    const payload = JSON.parse(options.body)
    const saved = {
      ...payload,
      schemaVersion: 2,
      revision: 1,
      updatedAt: '2026-08-08T00:00:01.000Z'
    }
    serverProjects.set(payload.id, saved)
    return Response.json(saved)
  }
  throw new Error(`unexpected request: ${options.method || 'get'} ${parsed.pathname}`)
}

const { initProjectsStore, projects } = await import('../src/stores/projects.js')
await initProjectsStore()

assert.equal(imageUploads, 1)
assert.equal(serverProjects.size, 1)
assert.equal(
  serverProjects.get('project_legacy_1').canvasData.nodes[0].data.confirmedMultiViewReference.image,
  '/public-assets/migrated-reference.png'
)
assert.doesNotMatch(JSON.stringify(serverProjects.get('project_legacy_1')), /data:image|blob:/)
assert.equal(storage.has(legacyKey), false, '服务端迁移成功后应释放旧的大缓存')
assert.equal(projects.value[0].id, 'project_legacy_1')

const clientState = storage.get(clientStateKey)
assert.ok(clientState)
assert.ok(clientState.length < 512)
assert.doesNotMatch(clientState, /canvasData|nodes|data:image/)

console.log('projectsStoreMigration.test.mjs passed')
