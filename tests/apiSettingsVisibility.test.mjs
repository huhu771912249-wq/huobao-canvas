import assert from 'node:assert/strict'
import { apiSettingsVisibility } from '../src/utils/apiSettingsVisibility.js'

assert.deepEqual(apiSettingsVisibility('local-material', false), { showAdvancedToggle: false, showTechnicalFields: false })
assert.deepEqual(apiSettingsVisibility('chatfire', false), { showAdvancedToggle: true, showTechnicalFields: false })
assert.deepEqual(apiSettingsVisibility('chatfire', true), { showAdvancedToggle: true, showTechnicalFields: true })
console.log('apiSettingsVisibility.test.mjs passed')
