import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createDefaultWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'

const project = createDefaultWatermarkEditorProject({ title: '品牌角标工程' })
assert.equal(project.title, '品牌角标工程')
assert.equal(project.watermarkLibrary.length, 1)

const sanitized = sanitizeWatermarkEditorProject({
  ...project,
  imageTracks: [
    { id: 'saved', name: 'logo.png', url: '/public-assets/logo.png', saved: true },
    { id: 'temporary', name: 'draft.png', url: 'blob:http://localhost/draft', saved: true }
  ]
})
assert.equal(sanitized.imageTracks[0].url, '/public-assets/logo.png')
assert.equal(sanitized.imageTracks[1].url, '')

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const node = readFileSync(new URL('../src/components/nodes/WatermarkEditorNode.vue', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../src/views/GifAdEditor.vue', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')

assert.match(canvas, /watermarkEditor:\s*markRaw\(WatermarkEditorNode\)/)
assert.match(node, /水印与素材编辑/)
assert.match(node, /进入详情编辑/)
assert.match(node, /Position\.Left/)
assert.match(node, /Position\.Right/)
assert.match(editor, /保存到水印库/)
assert.match(editor, /保存并返回画板/)
assert.match(editor, /watermarkLibrary/)
assert.match(home, /gifEditor/)
assert.match(entries, /flow:\s*'gifEditor'/)

console.log('watermarkEditorWorkflow.test.mjs passed')
