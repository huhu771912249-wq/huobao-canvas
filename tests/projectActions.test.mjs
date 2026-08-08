import assert from 'node:assert/strict'

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  }
}

const {
  createProject,
  deleteProject,
  duplicateProject,
  projects
} = await import('../src/stores/projects.js')

projects.value = []
const sourceId = createProject('项目操作回归')
assert.equal(projects.value.length, 1)
assert.equal(projects.value[0].id, sourceId)

const duplicateId = duplicateProject(sourceId)
assert.ok(duplicateId)
assert.notEqual(duplicateId, sourceId)
assert.equal(projects.value.length, 2)
assert.equal(projects.value[0].name, '项目操作回归 (副本)')

deleteProject(duplicateId)
assert.equal(projects.value.length, 1)
assert.equal(projects.value[0].id, sourceId)

deleteProject(sourceId)
assert.equal(projects.value.length, 0)
assert.deepEqual(JSON.parse(storage.get('ai-canvas-projects')), [])

console.log('projectActions.test.mjs passed')
