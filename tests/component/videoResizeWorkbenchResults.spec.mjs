/**
 * 视频尺寸工作台的成品卡片必须按**回执里真实存在的产物**渲染。
 *
 * `:39` 的 MP4 / GIF 是两个独立复选框，用户可以取消 MP4 只勾 GIF —— 那就是一个
 * GIF-only 任务，回执里没有 `mp4_url`。成品卡片过去无条件读 `item.mp4_url`：
 * `:key` 变 `undefined`（多尺寸时重复 key）、`<video>` 是个空黑框、「下载 MP4」是条死链。
 *
 * 以前这块能用，靠的是后端在 GIF-only 任务里也留了一个用户没要过的 H.264 中间件
 * （见 guanxi-canvas-backend `video_resize_pipeline.py`）—— 中间件一清掉就露馅。
 * 所以这里锁的是「按产物渲染」，不是「碰巧有个 mp4」。
 *
 * 三档回执各锁一次，MP4 那两档是防止顺手把老行为改掉的护栏。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { h } from 'vue'

const getVideoResizeJob = vi.fn()
const handoffVideoResizeJob = vi.fn()
vi.mock('../../src/api/videoResize.js', () => ({
  createVideoResizeJob: vi.fn(),
  getVideoResizeJob: (...args) => getVideoResizeJob(...args),
  cancelVideoResizeJob: vi.fn(),
  retryVideoResizeJob: vi.fn(),
  saveVideoResizeJob: vi.fn(),
  handoffVideoResizeJob: (...args) => handoffVideoResizeJob(...args)
}))

// See recentGenerationsHandoff.spec.mjs: the store writes the PUT response back over its
// own copy, so the double has to echo the project instead of returning `{}`.
vi.mock('../../src/api/projects.js', () => ({
  deleteCanvasProject: vi.fn(async () => ({})),
  getCanvasProject: vi.fn(async id => ({ id })),
  listCanvasProjects: vi.fn(async () => ({ projects: [] })),
  publishProjectImage: vi.fn(async () => ({})),
  putCanvasProject: vi.fn(async (id, payload) => ({ ...payload, id }))
}))

vi.mock('../../src/components/ComputeStatusIndicator.vue', () => ({
  default: { name: 'ComputeStatusIndicator', render: () => h('div') }
}))

const { default: VideoResizeWorkbench } = await import('../../src/views/VideoResizeWorkbench.vue')
const { getProjectCanvas, projects } = await import('../../src/stores/projects.js')

const MP4_RESULT = {
  requested_width: 720,
  requested_height: 1280,
  actual_width: 720,
  actual_height: 1280,
  upscale_method: 'ffmpeg_high_quality',
  mp4_url: 'http://127.0.0.1:8788/public-assets/resize-aaa-720x1280.mp4'
}

const GIF_RESULT = {
  requested_width: 720,
  requested_height: 1280,
  actual_width: 720,
  actual_height: 1280,
  upscale_method: 'ffmpeg_high_quality',
  gif_url: 'http://127.0.0.1:8788/public-assets/resize-bbb-720x1280.gif'
}

// 一个任务里的多个输出尺寸：`video_resize_jobs.py` 建 targets 时按 (w,h) 去重，
// 所以 requested_* 在同一份回执里是互不相同的。
const secondSize = (result, url) => ({
  ...result,
  requested_width: 1080,
  requested_height: 1080,
  actual_width: 1080,
  actual_height: 1080,
  ...(result.mp4_url ? { mp4_url: url } : { gif_url: url })
})

const completedJob = results => ({
  job_id: 'resize-test',
  status: 'completed',
  progress: 100,
  current_step: '完成',
  results
})

const mountWorkbench = async (results, { status = 'completed' } = {}) => {
  getVideoResizeJob.mockResolvedValue({ ...completedJob(results), status })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/video-resize', component: { render: () => h('div') } },
      { path: '/canvas/:id', component: { render: () => h('div') } },
      { path: '/:pathMatch(.*)*', component: { render: () => h('div') } }
    ]
  })
  await router.push('/video-resize?job=resize-test')
  await router.isReady()
  const pushed = []
  router.afterEach(to => { pushed.push(to) })
  const wrapper = mount(VideoResizeWorkbench, {
    attachTo: document.body,
    global: { plugins: [router] }
  })
  await flushPromises()
  return { wrapper, router, pushed }
}

const cards = wrapper => wrapper.findAll('[data-testid="resize-result-card"]')
const linkTexts = wrapper => cards(wrapper).flatMap(card => card.findAll('a').map(link => link.text()))

describe('视频尺寸工作台 · 成品卡片', () => {
  beforeEach(() => {
    localStorage.clear()
    projects.value = []
    getVideoResizeJob.mockReset()
    handoffVideoResizeJob.mockReset()
  })

  it('只勾 GIF 的任务不渲染 video，也不给一条指向 mp4 的死链', async () => {
    const { wrapper } = await mountWorkbench([GIF_RESULT])

    expect(cards(wrapper)).toHaveLength(1)
    expect(
      wrapper.findAll('video'),
      'GIF-only 任务的回执里没有 mp4_url，渲染 <video> 就是一个空黑框'
    ).toHaveLength(0)
    expect(linkTexts(wrapper), 'mp4 不存在时「下载 MP4」是死链').not.toContain('下载 MP4')
    expect(linkTexts(wrapper)).toContain('下载 GIF')
  })

  it('只勾 GIF 的任务用 GIF 自己做预览', async () => {
    const { wrapper } = await mountWorkbench([GIF_RESULT])

    const preview = cards(wrapper)[0].find('img')
    expect(preview.exists(), '成品页看不到成品，用户没法判断这次要不要重做').toBe(true)
    expect(preview.attributes('src')).toBe(GIF_RESULT.gif_url)
    expect(cards(wrapper)[0].find('a[download]').attributes('href')).toBe(GIF_RESULT.gif_url)
  })

  it('多个尺寸的 GIF-only 任务里，每张卡跟着自己的尺寸走', async () => {
    // GIF-only 时 `:key="item.mp4_url"` 一整列都是 undefined —— Vue 认不出谁是谁，
    // 只能按位置 patch，卡片和数据就脱钩了。这里不去数 Vue 的告警（同 key 同类型走的是
    // 前缀同步分支，根本不报），而是直接量那件事本身：认准一张卡的 DOM 节点，
    // 让轮询把两个尺寸换个顺序回来，看这个节点还是不是原来那个尺寸的卡。
    const sizes = [GIF_RESULT, secondSize(GIF_RESULT, 'http://127.0.0.1:8788/public-assets/resize-ccc-1080x1080.gif')]
    vi.useFakeTimers()
    try {
      // 非终态才会排下一次轮询（`poll` 只在 !terminal 时 setTimeout）。
      const { wrapper } = await mountWorkbench(sizes, { status: 'framing' })
      expect(cards(wrapper)).toHaveLength(2)

      const firstCardElement = cards(wrapper)[0].element
      expect(firstCardElement.textContent).toContain('720 × 1280')

      getVideoResizeJob.mockResolvedValue(completedJob([...sizes].reverse().map(item => ({ ...item }))))
      await vi.advanceTimersByTimeAsync(1600)
      await flushPromises()

      expect(cards(wrapper), '轮询之后两个尺寸都还在').toHaveLength(2)
      expect(
        firstCardElement.textContent,
        '同一个 DOM 节点被塞进别人的尺寸 = 卡片和它的下载链接不再是一对'
      ).toContain('720 × 1280')
    } finally {
      vi.useRealTimers()
    }
  })

  it('只勾 MP4 的任务表现不变：video 预览 + 下载 MP4，没有 GIF 入口', async () => {
    const { wrapper } = await mountWorkbench([MP4_RESULT])

    const video = cards(wrapper)[0].find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe(MP4_RESULT.mp4_url)
    expect(linkTexts(wrapper)).toContain('下载 MP4')
    expect(linkTexts(wrapper)).not.toContain('下载 GIF')
  })

  it('MP4 + GIF 的任务表现不变：video 预览 + 两个下载入口', async () => {
    const both = { ...MP4_RESULT, gif_url: GIF_RESULT.gif_url }
    const { wrapper } = await mountWorkbench([both])

    expect(cards(wrapper)[0].find('video').attributes('src')).toBe(both.mp4_url)
    expect(
      cards(wrapper)[0].findAll('img'),
      '两个产物都在时预览只有一个 —— video 之外再挂一张 GIF 是双份画面'
    ).toHaveLength(0)
    expect(linkTexts(wrapper)).toContain('下载 MP4')
    expect(linkTexts(wrapper)).toContain('下载 GIF')
  })

  it('尺寸和超分回执照旧显示', async () => {
    const { wrapper } = await mountWorkbench([{ ...MP4_RESULT, upscale_method: 'seedvr2' }])

    expect(cards(wrapper)[0].text()).toContain('720 × 1280')
    expect(cards(wrapper)[0].text()).toContain('SeedVR2 AI 超分')
  })

  describe('送入无限画布', () => {
    const handoff = async (wrapper, results) => {
      handoffVideoResizeJob.mockResolvedValue({
        canvas_payload: { kind: 'video-resize-results', title: '视频尺寸成品', results }
      })
      await wrapper.find('[data-testid="resize-handoff"]').trigger('click')
      await flushPromises()
    }

    it('GIF-only 任务送出的是能看见的 GIF 节点，不是一排空视频节点', async () => {
      const { wrapper, pushed } = await mountWorkbench([GIF_RESULT])
      await handoff(wrapper, [GIF_RESULT])

      const canvas = getProjectCanvas(String(pushed.at(-1).params.id))
      expect(canvas.nodes).toHaveLength(1)
      expect(canvas.nodes[0].data.url, '节点没有 url = 画布上一个空框').toBe(GIF_RESULT.gif_url)
      expect(canvas.nodes[0].type, 'GIF 用 video 节点放不出来').toBe('image')
    })

    it('MP4 任务送出的仍然是 video 节点', async () => {
      const { wrapper, pushed } = await mountWorkbench([MP4_RESULT])
      await handoff(wrapper, [MP4_RESULT])

      const canvas = getProjectCanvas(String(pushed.at(-1).params.id))
      expect(canvas.nodes[0].type).toBe('video')
      expect(canvas.nodes[0].data.url).toBe(MP4_RESULT.mp4_url)
      expect(canvas.nodes[0].data.label).toBe('720×1280')
    })

    it('没有任何可用地址的回执不会变成画布上的空节点', async () => {
      const { wrapper, pushed } = await mountWorkbench([MP4_RESULT])
      await handoff(wrapper, [{ actual_width: 720, actual_height: 1280 }, MP4_RESULT])

      const canvas = getProjectCanvas(String(pushed.at(-1).params.id))
      expect(canvas.nodes).toHaveLength(1)
      expect(canvas.nodes[0].data.url).toBe(MP4_RESULT.mp4_url)
    })
  })
})
