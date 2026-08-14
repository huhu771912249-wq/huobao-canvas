import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createWatermarkEditorProjectForSource,
  createDefaultWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} from '../src/utils/watermarkEditorProject.js'

const project = createDefaultWatermarkEditorProject({ title: '品牌角标工程' })
assert.equal(project.title, '品牌角标工程')
assert.equal(project.clips.length, 0, '独立页不得伪造三段示例素材')
assert.equal(project.textTracks.length, 0)
assert.equal(project.watermarkLibrary.length, 0)

const linkedProject = createWatermarkEditorProjectForSource({
  title: '真实上游',
  url: '/public-assets/source.gif',
  mime: 'image/gif',
  label: '上游 GIF',
  duration: 6.4
})
assert.equal(linkedProject.clips.length, 1)
assert.equal(linkedProject.clips[0].url, '/public-assets/source.gif')
assert.equal(linkedProject.clips[0].kind, 'gif')
assert.equal(linkedProject.clips[0].duration, 6.4)

const sanitized = sanitizeWatermarkEditorProject({
  ...project,
  imageTracks: [
    { id: 'saved', name: 'logo.png', url: '/public-assets/logo.png', saved: true },
    { id: 'temporary', name: 'draft.png', url: 'blob:http://localhost/draft', saved: true }
  ]
})
assert.equal(sanitized.imageTracks[0].url, '/public-assets/logo.png')
assert.equal(sanitized.imageTracks.length, 1, '不得持久化 blob 临时水印')
assert.equal(sanitizeWatermarkEditorProject({ clips: [{ name: '假素材.mp4' }] }).clips.length, 0)

const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const node = readFileSync(new URL('../src/components/nodes/WatermarkEditorNode.vue', import.meta.url), 'utf8')
const exportNode = readFileSync(new URL('../src/components/nodes/MaterialExportNode.vue', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../src/views/GifAdEditor.vue', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8')
const entries = readFileSync(new URL('../src/config/studioEntries.js', import.meta.url), 'utf8')

assert.match(canvas, /watermarkEditor:\s*markRaw\(WatermarkEditorNode\)/)
assert.match(node, /水印与素材编辑/)
assert.match(node, /进入详情编辑/)
assert.match(node, /compositionReady/)
assert.match(node, /outputUrl/)
assert.match(node, /Position\.Left/)
assert.match(node, /Position\.Right/)
assert.match(editor, /保存到水印库/)
assert.match(editor, /保存并返回画板/)
assert.match(editor, /watermarkLibrary/)
assert.match(editor, /createGifEditorJob/)
assert.match(editor, /getGifEditorJob/)
assert.match(editor, /暂无可编辑素材/)
assert.doesNotMatch(editor, /当前为交互原型/)
assert.doesNotMatch(editor, /下一阶段再接真实/)
assert.match(editor, /const compositionReady = Boolean/)
assert.match(editor, /outputJobId/)
assert.match(editor, /outputUrl/)
assert.match(editor, /outputMetadata/)
assert.match(editor, /uploadGifEditorAsset/)
assert.match(editor, /实时进度/)
assert.match(exportNode, /compositionReady/)
assert.match(exportNode, /outputJobId/)
assert.match(exportNode, /outputUrl/)
assert.match(home, /gifEditor/)
assert.match(entries, /flow:\s*'gifEditor'/)

const apiSource = readFileSync(new URL('../src/api/gifEditor.js', import.meta.url), 'utf8')
  .replace(/^import request from ['"][^'"]+['"]\s*/m, 'const request = globalThis.__gifEditorRequestSpy\n')
const apiCalls = []
globalThis.__gifEditorRequestSpy = config => {
  apiCalls.push(config)
  return Promise.resolve(config)
}
const gifEditorApi = await import(`data:text/javascript,${encodeURIComponent(apiSource)}#${Date.now()}`)
await gifEditorApi.uploadGifEditorAsset('data:image/png;base64,AAAA')
await gifEditorApi.uploadGifEditorMedia({ source_name: 'source.gif', source_base64: 'AAAA' })
await gifEditorApi.createGifEditorJob({ source_url: '/public-assets/source.gif' })
await gifEditorApi.getGifEditorJob('job /1')
assert.deepEqual(apiCalls, [
  { url: '/v1/assets/images', method: 'post', data: { image: 'data:image/png;base64,AAAA' } },
  { url: '/v1/material-inputs', method: 'post', data: { source_name: 'source.gif', source_base64: 'AAAA' }, timeout: 15 * 60 * 1000 },
  { url: '/v1/media/gif-watermarks', method: 'post', data: { source_url: '/public-assets/source.gif' } },
  { url: '/v1/video-resize/jobs/job%20%2F1', method: 'get' }
])
assert.throws(() => gifEditorApi.getGifEditorJob(''), /jobId is required/)
delete globalThis.__gifEditorRequestSpy

console.log('watermarkEditorWorkflow.test.mjs passed')
