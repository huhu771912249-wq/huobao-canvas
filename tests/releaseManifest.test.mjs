import assert from 'node:assert/strict'
import { buildManifest } from '../scripts/generate-release-manifest.mjs'

const input = {
  releaseId: 'v1.2.3',
  frontendSha: 'a'.repeat(40),
  backendSha: 'b'.repeat(40),
  buildTime: '2026-08-07T00:00:00Z'
}

assert.deepEqual(buildManifest(input), buildManifest(input))
assert.deepEqual(buildManifest(input), {
  schema_version: 1,
  release_id: 'v1.2.3',
  frontend_commit_sha: 'a'.repeat(40),
  backend_commit_sha: 'b'.repeat(40),
  build_time: '2026-08-07T00:00:00Z'
})
assert.throws(
  () => buildManifest({ ...input, backendSha: 'short' }),
  /40 hexadecimal/
)

console.log('releaseManifest.test.mjs passed')
