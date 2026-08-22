/**
 * Takes over the store + API half of the grep tail of tests/materialVariation.test.mjs.
 *
 * That file's pure half — every `buildMaterialVariationPayload` / `normalize*` /
 * `getPrimaryCreativeAssets` assertion — was already a real test and stays put. The tail
 * read src/stores/canvas.js and src/api/*.js as text:
 *
 *   grep                                          | behaviour asserted here
 *   ----------------------------------------------|------------------------------------
 *   store `case 'materialVariation'`               | adding the node produces a node whose
 *   store `count: DEFAULT_MATERIAL_VARIATION_COUNT`|   data carries the shipped defaults
 *   store `sizes: [...DEFAULT_MATERIAL_VARIATION_SIZES]` | … and each node gets its OWN
 *                                                  |   sizes array (the spread), so editing
 *                                                  |   one node cannot rewrite the module
 *                                                  |   default or a sibling node
 *   api/index.js `export * from './materialVariation'` | the barrel really re-exports the
 *                                                  |   callable functions
 *   api `/v1/material/variations`                  | create / read / retry / second-wave
 *                                                  |   hit the four contract URLs with the
 *                                                  |   right verbs
 *   api `MATERIAL_VARIATION_POLL_INTERVAL`         | polling really waits that long between
 *                                                  |   requests
 *
 * The array-aliasing failure is the one no grep could reach: `sizes: DEFAULT_...` (no
 * spread) still contains the constant's name, and the old test read the literal text
 * `[...DEFAULT_MATERIAL_VARIATION_SIZES]`, which any equivalent rewrite would break while
 * a genuinely shared array would slip through elsewhere.
 *
 * Still grep'd in tests/materialVariation.test.mjs: the copy and interaction contract of
 * MaterialVariationNode.vue (batch 4) and the Canvas.vue node-type registry (batch 5).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  DEFAULT_MATERIAL_VARIATION_COUNT,
  DEFAULT_MATERIAL_VARIATION_SIZES,
  MATERIAL_VARIATION_API_BASE,
  MATERIAL_VARIATION_POLL_INTERVAL
} = await import('../../src/utils/materialVariation.js')
const canvasStore = await import('../../src/stores/canvas.js')
const materialVariationApi = await import('../../src/api/materialVariation.js')
const apiBarrel = await import('../../src/api/index.js')
const { default: request } = await import('../../src/utils/request.js')

/** Drive the real axios instance and record what went out. */
const captureRequests = (respond = () => ({})) => {
  const sent = []
  request.defaults.adapter = async (config) => {
    sent.push(config)
    return { data: respond(config) ?? {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  return sent
}

const addNode = (type) => {
  const id = canvasStore.addNode(type)
  return canvasStore.nodes.value.find(node => node.id === id)
}

describe('material variation node defaults', () => {
  beforeEach(() => {
    canvasStore.clearCanvas()
  })

  it('ships the documented defaults', () => {
    const node = addNode('materialVariation')

    expect(node.data.label).toBe('素材裂变')
    expect(node.data.count).toBe(DEFAULT_MATERIAL_VARIATION_COUNT)
    expect(node.data.sizes).toEqual(DEFAULT_MATERIAL_VARIATION_SIZES)
    expect(node.data.qualityMode).toBe('high_quality')
    expect(node.data.strength).toBe('moderate')
  })

  it('gives every node its own sizes array', () => {
    const first = addNode('materialVariation')
    const second = addNode('materialVariation')

    first.data.sizes.push('999x999')

    expect(
      second.data.sizes,
      '两个裂变节点共用一个数组时，改一个的尺寸会连带改掉另一个'
    ).toEqual(DEFAULT_MATERIAL_VARIATION_SIZES)
    expect(
      DEFAULT_MATERIAL_VARIATION_SIZES,
      '更不能把模块级的默认值改掉 —— 那会污染此后创建的每一个节点'
    ).not.toContain('999x999')
  })
})

describe('material variation API', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('is reachable through the api barrel', () => {
    for (const name of [
      'createMaterialVariation',
      'getMaterialVariation',
      'retryMaterialVariation',
      'startMaterialVariationSecondWave',
      'pollMaterialVariation'
    ]) {
      expect(typeof apiBarrel[name], `src/api/index.js 必须把 ${name} 转出来`).toBe('function')
    }
  })

  it('uses the four fixed local contract endpoints', async () => {
    const sent = captureRequests()

    await materialVariationApi.createMaterialVariation({ count: 10 })
    await materialVariationApi.getMaterialVariation('job 1')
    await materialVariationApi.retryMaterialVariation('job/1')
    await materialVariationApi.startMaterialVariationSecondWave('job:1', { ctr: 2 })

    // The host is resolved per environment by buildMaterialApiUrl (the absolute form is
    // pinned in tests/materialVariation.test.mjs); what is asserted here is the path,
    // the verb, and that the job id is percent-encoded into it.
    expect(MATERIAL_VARIATION_API_BASE).toMatch(/\/v1\/material\/variations$/)
    expect(sent.map(config => [config.method, config.url])).toEqual([
      ['post', MATERIAL_VARIATION_API_BASE],
      ['get', `${MATERIAL_VARIATION_API_BASE}/job%201`],
      ['post', `${MATERIAL_VARIATION_API_BASE}/job%2F1/retry`],
      ['post', `${MATERIAL_VARIATION_API_BASE}/job%3A1/second-wave`]
    ])
    expect(JSON.parse(sent[0].data), '创建请求要把 payload 原样带上').toEqual({ count: 10 })
  })

  it('waits the shared polling interval between two status reads', async () => {
    vi.useFakeTimers()
    const sent = captureRequests(() => ({ status: 'running' }))

    const controller = new AbortController()
    const settled = materialVariationApi.pollMaterialVariation('job-1', { signal: controller.signal })
      .then(value => ({ value }), error => ({ error }))
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(MATERIAL_VARIATION_POLL_INTERVAL - 1)
    expect(sent, '不到间隔就重新查会把后端打爆').toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(sent, '到了间隔必须继续查').toHaveLength(2)

    controller.abort()
    await vi.advanceTimersByTimeAsync(MATERIAL_VARIATION_POLL_INTERVAL)
    expect((await settled).error?.name).toBe('AbortError')
    vi.useRealTimers()
  })
})
