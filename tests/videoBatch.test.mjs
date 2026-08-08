import assert from 'node:assert/strict'
import {
  DEFAULT_VIDEO_BATCH_FORMATS,
  VIDEO_BATCH_SIZES,
  buildVideoBatchRetryUrl,
  normalizeVideoBatchFormats,
  normalizeVideoBatchSizes,
  supportsVideoBatch
} from '../src/utils/videoBatch.js'

assert.deepEqual(VIDEO_BATCH_SIZES, ['300x100', '300x250', '720x240', '200x200'])
assert.deepEqual(DEFAULT_VIDEO_BATCH_FORMATS, ['mp4', 'gif'])

assert.deepEqual(
  normalizeVideoBatchSizes(['720x240', 'invalid', '300x100', '720x240']),
  ['300x100', '720x240']
)
assert.deepEqual(normalizeVideoBatchSizes([]), VIDEO_BATCH_SIZES)

assert.deepEqual(normalizeVideoBatchFormats(['gif']), ['mp4', 'gif'])
assert.deepEqual(normalizeVideoBatchFormats([]), DEFAULT_VIDEO_BATCH_FORMATS)

assert.equal(supportsVideoBatch('scail2-action-transfer'), true)
assert.equal(supportsVideoBatch('frw-video'), true)
assert.equal(supportsVideoBatch('seedance-1.5-pro'), false)

assert.equal(
  buildVideoBatchRetryUrl('http://127.0.0.1:8788/v1/video/generations', 'videobatch:task 1'),
  'http://127.0.0.1:8788/v1/video/batch/videobatch%3Atask%201/retry'
)
