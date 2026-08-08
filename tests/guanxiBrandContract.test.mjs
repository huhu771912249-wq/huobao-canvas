import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = ['src/views/Login.vue', 'src/views/Home.vue', 'src/views/VideoStudio.vue', 'src/components/nodes/VideoConfigNode.vue', 'src/config/providers.js']
const visibleSource = files.map(file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n')

assert.match(visibleSource, /冠希 CANVAS/)
assert.match(visibleSource, /冠希 VIDEO/)
assert.match(visibleSource, /进入冠希画布/)
assert.doesNotMatch(visibleSource, /HUOBAO|火宝/)
console.log('guanxiBrandContract.test.mjs passed')
