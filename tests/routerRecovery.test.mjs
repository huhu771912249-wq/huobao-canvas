import assert from 'node:assert/strict'
import { isDynamicImportFailure } from '../src/router/recovery.js'

assert.equal(isDynamicImportFailure(new Error('Failed to fetch dynamically imported module: /assets/Old.js')), true)
assert.equal(isDynamicImportFailure(new Error('Importing a module script failed.')), true)
assert.equal(isDynamicImportFailure(new Error('普通接口请求失败')), false)
