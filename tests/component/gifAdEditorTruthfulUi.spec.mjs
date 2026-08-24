/**
 * GIF 编辑器「UI 不许撒谎」的行为契约。
 *
 * 这些事实只存在于渲染树里，源码 grep 抓不到（一个 `disabled` 属性写没写、
 * 一个按钮在哪个分支下才出现、点下去有没有真的发请求），所以放泳道 B。
 *
 *   审计结论                                    | 这里断言的行为
 *   --------------------------------------------|--------------------------------------
 *   导出弹窗只有「下载」，成品 24h 后就没了      | 成品态多一个「保存到素材库」，点了真的
 *                                               |   调 POST /v1/video-resize/jobs/<id>/save
 *   「片段时长」是纯装饰（payload 里被丢弃）     | 输入框 disabled，且旁边写清楚为什么
 *   多张图片水印导出时被静默挑一张               | 侧栏/弹窗都报错，导出按钮 disabled，
 *                                               |   且 createGifEditorJob 一次都不会被调用
 *   9 个死控件（撤销/重做/适应/50%/参考线/音量/  | 渲染树里一个都找不到
 *     时间轴缩放/转场）                          |
 *   画面适配三档预览纹丝不动                     | 换档位真的换 object-fit / 模糊背景层
 *
 * 换算本身的正确性（字号、锚点、断行、颜色）由 tests/gifPreviewBackendParity.test.mjs
 * 和后端公式逐格对拍，这里只管「UI 有没有把它接上」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const createGifEditorJob = vi.fn()
const getGifEditorJob = vi.fn()
const saveVideoResizeJob = vi.fn()
const updateProjectCanvas = vi.fn()
let canvas = null

vi.mock('../../src/api/gifEditor.js', async () => {
  const actual = await vi.importActual('../../src/utils/watermarkEditorProject.js')
  return {
    buildGifEditorJobPayload: ({ source_url, watermark, text_tracks, duration, output }) => ({
      source_url,
      ...(watermark ? { watermark } : {}),
      ...(text_tracks?.length ? { text_tracks: actual.buildGifEditorTextTracks(text_tracks, duration) } : {}),
      output
    }),
    createGifEditorJob,
    getGifEditorJob,
    getGifEditorJobDuration: job => Number(job?.results?.[0]?.duration || 0),
    probeGifEditorMediaDuration: vi.fn(async () => 3),
    uploadGifEditorAsset: vi.fn(),
    uploadGifEditorMedia: vi.fn()
  }
})
vi.mock('../../src/api/videoResize.js', () => ({ saveVideoResizeJob }))
vi.mock('../../src/utils/assetDownload.js', () => ({
  startAssetDownload: vi.fn(async () => ({ filename: 'out.gif' }))
}))
vi.mock('../../src/stores/projects.js', () => ({
  initProjectsStore: vi.fn(async () => {}),
  ensureProjectLoaded: vi.fn(async () => {}),
  getProjectCanvas: () => canvas,
  updateProjectCanvas
}))

const GifAdEditor = (await import('../../src/views/GifAdEditor.vue')).default

const editorProject = watermarkCount => ({
  version: 2,
  title: '对拍工程',
  clips: [{ id: 'source-clip', name: '上游 GIF', url: '/public-assets/source.gif', mime: 'image/gif', duration: 3 }],
  textTracks: [{ id: 'text-11', text: '限时五折', start: 0, end: 3, x: 50, y: 50, fontSize: 32, style: '爆款白字' }],
  imageTracks: Array.from({ length: watermarkCount }, (_, index) => ({
    id: `image-${11 + index}`,
    name: `logo-${index}.png`,
    url: `/public-assets/logo-${index}.png`,
    start: 0,
    end: 3,
    x: 82,
    y: 12,
    size: 22,
    opacity: 92
  })),
  watermarkLibrary: [],
  output: { presetKey: 'vertical', cornerRadius: 6, fps: 12, colors: 128, loop: 'forever', fitMode: 'contain' },
  quickSettings: { watermarkId: '', position: 'top-right', size: 22, opacity: 92 },
  result: { jobId: '', status: '', progress: 0, outputUrl: '', error: '', metadata: {} }
})

const mountEditor = async ({ watermarkCount = 1 } = {}) => {
  canvas = {
    nodes: [{
      id: 'watermark-node',
      type: 'watermarkEditor',
      data: {
        label: '水印与素材编辑',
        sourceUrl: '/public-assets/source.gif',
        sourceMime: 'image/gif',
        duration: 3,
        editorStatus: 'draft',
        editorProject: editorProject(watermarkCount)
      }
    }],
    edges: []
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/gif-editor', component: GifAdEditor }, { path: '/:rest(.*)', component: { template: '<div />' } }]
  })
  await router.push('/gif-editor?project=p1&node=watermark-node')
  await router.isReady()
  const wrapper = mount(GifAdEditor, { global: { plugins: [router] }, attachTo: document.body })
  await vi.waitUntil(() => wrapper.text().includes('已保存到节点'), { timeout: 2000 })
  return wrapper
}

const buttonWithText = (wrapper, text) => wrapper.findAll('button').find(button => button.text().trim() === text)
const labelledInput = (wrapper, label) => wrapper.findAll('label')
  .find(item => item.text().includes(label))
  ?.find('input')

beforeEach(() => {
  createGifEditorJob.mockReset()
  getGifEditorJob.mockReset()
  saveVideoResizeJob.mockReset()
  updateProjectCanvas.mockReset()
})

describe('GIF 编辑器不许显示自己做不到的事', () => {
  it('片段时长是只读的，因为它在 payload 里会被丢弃、导出后还会被后端结果覆写', async () => {
    const wrapper = await mountEditor()
    await wrapper.findAll('.asset-item').find(item => item.text().includes('上游 GIF')).trigger('click')

    const duration = labelledInput(wrapper, '片段时长（秒）')
    expect(duration.exists()).toBe(true)
    expect(duration.element.disabled).toBe(true)
    expect(duration.element.value).toBe('3.0')
    expect(wrapper.text()).toContain('ffprobe')
  })

  it('9 个死控件在渲染树里一个都没有', async () => {
    const wrapper = await mountEditor()
    const labels = wrapper.findAll('button').map(button => button.text().trim())

    for (const dead of ['↶', '↷', '适应', '50%', '参考线', '•••', '🔊', '◇']) {
      expect(labels, `死控件「${dead}」又回来了`).not.toContain(dead)
    }
    expect(wrapper.find('input[aria-label="时间轴缩放"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('转场')
  })

  it('画面适配换档，预览真的跟着换', async () => {
    const wrapper = await mountEditor()
    const fit = wrapper.findAll('select').find(select => select.element.innerHTML.includes('模糊背景'))

    await fit.setValue('contain')
    expect(wrapper.find('.stage-backdrop').exists()).toBe(false)
    expect(wrapper.find('.stage-media').attributes('style')).toContain('object-fit: contain')

    await fit.setValue('blur')
    expect(wrapper.find('.stage-backdrop').exists()).toBe(true)
    expect(wrapper.find('.stage-media').attributes('style')).toContain('object-fit: contain')

    await fit.setValue('center')
    expect(wrapper.find('.stage-backdrop').exists()).toBe(false)
    expect(wrapper.find('.stage-media').attributes('style')).toContain('object-fit: cover')
  })
})

describe('画布上新建的水印节点', () => {
  it('不带任何悬空的 watermarkId —— 那会让节点滑块「能毁不能改」', async () => {
    const canvasStore = await import('../../src/stores/canvas.js')
    canvasStore.clearCanvas()
    const id = canvasStore.addNode('watermarkEditor', { x: 0, y: 0 })
    const node = canvasStore.nodes.value.find(item => item.id === id)

    // 空串 = 还没选水印。任何非空默认值都指不到编辑器生成的 id（image-11 起步），
    // 于是节点上的 4 个滑块改了等于没改，却照样把已合成的成品清空。
    expect(node.data.quickSettings.watermarkId).toBe('')
    expect(node.data.editorProject).toBe(null)
  })
})

describe('多张图片水印', () => {
  it('挡住导出并说明原因，而不是静默只合成一张', async () => {
    const wrapper = await mountEditor({ watermarkCount: 3 })
    expect(wrapper.text()).toContain('只能合成 1 张图片水印')
    expect(wrapper.text()).toContain('当前有 3 张')

    await buttonWithText(wrapper, '导出 GIF').trigger('click')
    const start = buttonWithText(wrapper, '开始真实导出')
    expect(start.element.disabled).toBe(true)
    expect(wrapper.find('.export-modal').text()).toContain('只能合成 1 张图片水印')
    expect(createGifEditorJob).not.toHaveBeenCalled()
  })

  it('只有一张时照常导出', async () => {
    const wrapper = await mountEditor({ watermarkCount: 1 })
    expect(wrapper.text()).not.toContain('只能合成 1 张图片水印')

    await buttonWithText(wrapper, '导出 GIF').trigger('click')
    expect(buttonWithText(wrapper, '开始真实导出').element.disabled).toBe(false)
  })
})

describe('导出成品', () => {
  const completedJob = {
    job_id: 'resize-abc',
    status: 'completed',
    progress: 100,
    results: [{ gif_url: '/public-assets/out.gif', watermark_applied: true, text_tracks_applied: 1, duration: 3 }]
  }

  const exportOnce = async wrapper => {
    createGifEditorJob.mockResolvedValue({ job_id: 'resize-abc', status: 'queued', progress: 0 })
    getGifEditorJob.mockResolvedValue(completedJob)
    await buttonWithText(wrapper, '导出 GIF').trigger('click')
    await buttonWithText(wrapper, '开始真实导出').trigger('click')
    await vi.waitUntil(() => wrapper.text().includes('下载编辑 GIF'), { timeout: 2000 })
  }

  it('成品态给出「保存到素材库」，点了真的调后端的 /save', async () => {
    const wrapper = await mountEditor()
    await exportOnce(wrapper)

    const save = buttonWithText(wrapper, '保存到素材库')
    expect(save, '导出成功后必须能把成品转存到素材库').toBeTruthy()
    expect(wrapper.find('.export-modal').text()).toContain('24 小时')

    saveVideoResizeJob.mockResolvedValue({ job_id: 'resize-abc', saved: true, saved_count: 2 })
    await save.trigger('click')
    await vi.waitUntil(() => wrapper.text().includes('已保存到服务器素材库'), { timeout: 2000 })

    expect(saveVideoResizeJob).toHaveBeenCalledWith('resize-abc')
    expect(wrapper.text()).toContain('2 个文件')
  })

  it('保存失败要说出来，不许假装成功', async () => {
    const wrapper = await mountEditor()
    await exportOnce(wrapper)

    saveVideoResizeJob.mockRejectedValue({ response: { data: { error: { message: '素材库磁盘已满' } } } })
    await buttonWithText(wrapper, '保存到素材库').trigger('click')
    await vi.waitUntil(() => wrapper.text().includes('素材库磁盘已满'), { timeout: 2000 })

    expect(wrapper.find('.export-error').text()).toContain('素材库磁盘已满')
  })
})
