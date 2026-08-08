import assert from 'node:assert/strict'
import { getVideoInputCapabilities } from '../src/utils/videoInputCapabilities.js'

assert.deepEqual(getVideoInputCapabilities('minimax-h3'), { firstFrame: true, lastFrame: false, references: false })
assert.deepEqual(getVideoInputCapabilities('ltx-2.3'), { firstFrame: true, lastFrame: false, references: false })
assert.deepEqual(getVideoInputCapabilities('frw-video'), { firstFrame: true, lastFrame: true, references: true })
console.log('videoInputCapabilities.test.mjs passed')
