import assert from 'node:assert/strict'
import {
  buildRecentImageCanvas,
  formatRecentAssetSize
} from '../src/utils/recentGenerations.js'

const canvas = buildRecentImageCanvas({
  id: 'poster.png',
  name: 'poster.png',
  url: '/public-assets/poster.png'
}, {
  nodeId: 'recent-image-test',
  now: 123
})

assert.deepEqual(canvas.edges, [])
assert.equal(canvas.nodes.length, 1)
assert.equal(canvas.nodes[0].type, 'image')
assert.equal(canvas.nodes[0].data.url, '/public-assets/poster.png')
assert.equal(canvas.nodes[0].data.sourceAssetId, 'poster.png')
assert.equal(canvas.nodes[0].data.createdAt, 123)
assert.equal(formatRecentAssetSize(1536), '1.5 KB')

console.log('recentGenerations.test.mjs passed')
