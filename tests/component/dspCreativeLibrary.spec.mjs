/**
 * Takes over the canvas-store slice of the grep tail of tests/dspCreativeLibrary.test.mjs.
 *
 * That file is ~1700 lines of real unit tests over src/utils/dspCreativeLibrary.js plus a
 * ~250-line grep tail. Only the store slice moves here; the rest is D 类 and stays (see the
 * note left in the legacy file).
 *
 *   grep                                            | behaviour asserted here
 *   ------------------------------------------------|----------------------------------
 *   store `case 'dspCreativeLibrary'`                | adding the node yields the shipped
 *   store `minImpressions: DEFAULT_DSP_THRESHOLDS…`  |   defaults …
 *   store `mediaTypes: [...DEFAULT_DSP_MEDIA_TYPES]` | … each node owning its own filter
 *                                                    |   arrays
 *   store `case 'dspCreativeTaskCenter'`             | the task-centre node starts with an
 *   store `jobIds: []` / `uiPrefs:`                  |   empty job list and blank ui prefs
 *   libraryStoreBlock has no `candidates:`           | neither the freshly created node nor
 *   libraryStoreBlock has no `job:`                  |   the persisted project carries the
 *   store `sanitizeDspCreativeCanvasNodeData`        |   fetched candidate payload — that is
 *   store `canvasData.nodes …sanitize`               |   megabytes of API response and it
 *   store `updateProjectCanvas …sanitize`            |   must never reach the project file
 *
 * The last group is the one greps handled worst: `sanitizeDspCreativeCanvasNodeData`
 * appearing three times in the store says nothing about whether the payload actually gets
 * stripped on the way out. Here the project is saved for real and read back.
 */
import { beforeEach, describe, expect, it } from 'vitest'

const {
  DEFAULT_DSP_DIMENSIONS,
  DEFAULT_DSP_MEDIA_TYPES,
  DEFAULT_DSP_THRESHOLDS
} = await import('../../src/utils/dspCreativeLibrary.js')
const canvasStore = await import('../../src/stores/canvas.js')
const projectsStore = await import('../../src/stores/projects.js')

const addNode = (type, data) => {
  const id = canvasStore.addNode(type, { x: 0, y: 0 }, data)
  return canvasStore.nodes.value.find(node => node.id === id)
}

describe('DSP creative node defaults', () => {
  beforeEach(() => {
    localStorage.clear()
    canvasStore.clearCanvas()
    canvasStore.currentProjectId.value = null
  })

  it('starts the library node on the shipped filters and thresholds', () => {
    const node = addNode('dspCreativeLibrary')

    expect(node.data.label).toBe('54DSP 优秀素材')
    expect(node.data.mediaTypes).toEqual(DEFAULT_DSP_MEDIA_TYPES)
    expect(node.data.dimensions).toEqual(DEFAULT_DSP_DIMENSIONS)
    expect(node.data.minImpressions).toBe(DEFAULT_DSP_THRESHOLDS.minImpressions)
    expect(node.data.minClicks).toBe(DEFAULT_DSP_THRESHOLDS.minClicks)
    expect(node.data.topN).toBe(DEFAULT_DSP_THRESHOLDS.topN)
    expect(node.data.selectedIds).toEqual([])
    expect(node.data.jobId).toBe('')
  })

  it('gives every library node its own filter arrays', () => {
    const first = addNode('dspCreativeLibrary')
    const second = addNode('dspCreativeLibrary')

    first.data.mediaTypes.push('AUDIO')
    first.data.dimensions.push('1x1')

    expect(second.data.mediaTypes, '两个节点共用一个数组时，改一个的筛选条件会连带改另一个').toEqual(DEFAULT_DSP_MEDIA_TYPES)
    expect(second.data.dimensions).toEqual(DEFAULT_DSP_DIMENSIONS)
    expect(DEFAULT_DSP_MEDIA_TYPES).not.toContain('AUDIO')
    expect(DEFAULT_DSP_DIMENSIONS).not.toContain('1x1')
  })

  it('never seeds the library node with a candidate payload', () => {
    const node = addNode('dspCreativeLibrary')

    expect(
      Object.keys(node.data),
      '候选素材是一次几 MB 的接口响应，默认值里带上它等于每建一个节点就往项目文件里塞一份'
    ).not.toContain('candidates')
    expect(Object.keys(node.data)).not.toContain('job')
  })

  it('starts the task centre node with an empty job list and blank ui prefs', () => {
    const node = addNode('dspCreativeTaskCenter')

    expect(node.data.label).toBe('素材任务中心')
    expect(node.data.jobIds).toEqual([])
    expect(node.data.uiPrefs).toEqual({ status: '', mediaType: '', query: '' })
  })

  it('strips the fetched payload out of the node before the project is persisted', () => {
    const projectId = projectsStore.createProject('dsp-persistence-fixture')
    canvasStore.currentProjectId.value = projectId

    addNode('dspCreativeLibrary', {
      candidates: [{ candidate_key: 'a', preview_url: 'x'.repeat(5000) }],
      job: { id: 'job-1', results: new Array(50).fill('x'.repeat(500)) },
      selectedIds: ['a']
    })
    canvasStore.saveProject()

    const persisted = projectsStore.getProjectCanvas(projectId)
    const [node] = persisted.nodes
    expect(node.type).toBe('dspCreativeLibrary')
    expect(
      Object.keys(node.data),
      '候选素材必须在写盘前被剥掉，否则项目文件会被一次预览撑爆'
    ).not.toContain('candidates')
    expect(Object.keys(node.data)).not.toContain('job')
    expect(node.data.selectedIds, '用户真正选了什么要留下来').toEqual(['a'])
  })
})
