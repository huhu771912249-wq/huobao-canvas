import assert from 'node:assert/strict'

import {
  LEGACY_PROJECTS_STORAGE_KEY,
  PROJECT_CLIENT_STATE_KEY,
  prepareProjectForServer,
  writeProjectClientState
} from '../src/utils/projectPersistence.js'

const inlineImage = 'data:image/png;base64,aGVsbG8='
const published = []
const project = {
  id: 'project_cache_contract',
  name: '缓存契约',
  thumbnail: inlineImage,
  canvasData: {
    nodes: [
      {
        id: 'node_1',
        type: 'videoConfig',
        data: {
          confirmedMultiViewReference: { image: inlineImage },
          nested: [{ preview: inlineImage }, { preview: 'blob:https://canvas.test/transient' }],
          base64: inlineImage,
          taskId: 'video-task-1'
        }
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

const prepared = await prepareProjectForServer(project, {
  publishImage: async image => {
    published.push(image)
    return { url: '/public-assets/reference.png' }
  }
})

assert.equal(published.length, 1, '同一内嵌图片只应上传一次')
assert.equal(prepared.thumbnail, '/public-assets/reference.png')
assert.equal(
  prepared.canvasData.nodes[0].data.confirmedMultiViewReference.image,
  '/public-assets/reference.png'
)
assert.equal(prepared.canvasData.nodes[0].data.nested.length, 1)
assert.equal(prepared.canvasData.nodes[0].data.base64, '/public-assets/reference.png')
assert.equal(prepared.canvasData.nodes[0].data.taskId, 'video-task-1')
assert.doesNotMatch(JSON.stringify(prepared), /data:image|blob:/)

const storage = new Map([[LEGACY_PROJECTS_STORAGE_KEY, JSON.stringify([project])]])
const localStorageLike = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}

writeProjectClientState(localStorageLike, {
  currentProjectId: project.id,
  lastServerSyncAt: '2026-08-08T00:00:00.000Z'
})

const clientState = JSON.parse(storage.get(PROJECT_CLIENT_STATE_KEY))
assert.deepEqual(clientState, {
  schemaVersion: 2,
  currentProjectId: project.id,
  lastServerSyncAt: '2026-08-08T00:00:00.000Z'
})
assert.ok(storage.get(LEGACY_PROJECTS_STORAGE_KEY), '迁移成功前不能提前删除旧项目')
assert.ok(JSON.stringify(clientState).length < 512, 'localStorage 只能保留轻量客户端状态')

console.log('projectPersistence.test.mjs passed')
