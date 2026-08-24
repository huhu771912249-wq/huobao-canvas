/**
 * 「最近生成」的成品必须能回到它自己的编辑器。
 *
 * 之前 `RecentGenerations.vue` 只给 `media_type === 'image'` 渲染「去处理」，所以导出
 * 一个 GIF 之后只剩「下载」和「查看原文件」—— 想改一个字就得重新上传原素材从头再来。
 *
 * 这里断言的是**行为**，不是模板里出现了哪个 `v-if`：
 *
 *   - GIF 卡片上有可点的交接按钮，视频 / 音频卡片上没有（放宽入口时最容易顺手放开的一格）；
 *   - 点 GIF 的按钮真的落到 `/gif-editor`，并且带着 `project` + `node`；
 *   - 那个 project/node 在项目库里真实存在，且节点数据能被 GIF 编辑器读成一段可编辑的
 *     clip —— 光断言「跳转了」证明不了用户到了编辑器还能看见自己的素材。
 *
 * 最后一条用的是 `src/utils/watermarkEditorProject.js` 的真函数，也就是
 * `GifAdEditor.vue` onMounted 自己调的那两个。协议入口是 `node.data.sourceUrl`：
 * 换掉它就要同时换这里。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { h } from 'vue'

const listRecentGenerations = vi.fn()
vi.mock('../../src/api/recentGenerations.js', () => ({
  listRecentGenerations: (...args) => listRecentGenerations(...args)
}))

vi.mock('../../src/api/health.js', () => ({
  fetchServiceHealth: vi.fn(async () => ({ status: 'ok' }))
}))

// The projects store bootstraps itself off the backend on first use; keep it offline so the
// spec measures the handoff and not the network. `putCanvasProject` echoes the stored project
// back the way the real endpoint does — the store writes that response back over its own copy,
// so a double that returns `{}` would erase the project it just saved.
vi.mock('../../src/api/projects.js', () => ({
  deleteCanvasProject: vi.fn(async () => ({})),
  getCanvasProject: vi.fn(async id => ({ id })),
  listCanvasProjects: vi.fn(async () => ({ projects: [] })),
  publishProjectImage: vi.fn(async () => ({})),
  putCanvasProject: vi.fn(async (id, payload) => ({ ...payload, id }))
}))

// WorkspaceShell drags in the whole app chrome (account menu, health badge, nav). The page
// body is what this spec is about, so render just the slot it hands out.
vi.mock('../../src/components/workspace/WorkspaceShell.vue', () => ({
  default: {
    name: 'WorkspaceShell',
    setup: (props, { slots }) => () => h('div', { class: 'workspace-shell-stub' }, slots.main?.())
  }
}))

const { default: RecentGenerations } = await import('../../src/views/RecentGenerations.vue')
const { getProjectCanvas, projects } = await import('../../src/stores/projects.js')
const {
  createWatermarkEditorProjectForSource,
  restoreWatermarkEditorProject,
  sanitizeWatermarkEditorProject
} = await import('../../src/utils/watermarkEditorProject.js')

const asset = (overrides = {}) => ({
  id: 'sample',
  name: 'sample',
  media_type: 'image',
  url: 'http://127.0.0.1:8788/public-assets/sample.png',
  download_url: 'http://127.0.0.1:8788/public-assets/sample.png',
  created_at: '2026-08-24T09:00:00.000Z',
  size_bytes: 2048,
  ...overrides
})

const GIF = asset({
  id: 'resize-abc123-320x180.gif',
  name: 'resize-abc123-320x180.gif',
  media_type: 'gif',
  url: 'http://127.0.0.1:8788/public-assets/resize-abc123-320x180.gif',
  download_url: 'http://127.0.0.1:8788/public-assets/resize-abc123-320x180.gif'
})

const Blank = { render: () => h('div') }

const mountRecentGenerations = async (assets) => {
  listRecentGenerations.mockResolvedValue(assets)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/gif-editor', component: Blank },
      { path: '/canvas/:id', component: Blank },
      { path: '/:pathMatch(.*)*', component: Blank }
    ]
  })
  await router.push('/')
  await router.isReady()
  const pushed = []
  router.afterEach(to => { pushed.push(to) })
  const wrapper = mount(RecentGenerations, {
    attachTo: document.body,
    global: { plugins: [router] }
  })
  await flushPromises()
  return { wrapper, router, pushed }
}

/** The card for one asset, found the way a user finds it: by the name printed on it. */
const cardFor = (wrapper, name) => wrapper
  .findAll('article.asset-card')
  .find(card => card.find('h2').text() === name)

const handoffButtonFor = (wrapper, name) => {
  const card = cardFor(wrapper, name)
  expect(card, `列表里没有 ${name} 这张卡`).toBeTruthy()
  return card.find('[data-testid="recent-asset-handoff"]')
}

/**
 * Replay what `/gif-editor` does on arrival (src/views/GifAdEditor.vue onMounted): read the
 * node out of the project store and rebuild the editable clip from `node.data`.
 */
const readAsGifEditorWould = ({ project, node }) => {
  const canvas = getProjectCanvas(String(project))
  const target = (canvas?.nodes || []).find(item => item.id === String(node))
  expect(target, 'GIF 编辑器按 project+node 找不到节点就等于打开一个空草稿').toBeTruthy()
  const sourceProject = createWatermarkEditorProjectForSource({
    title: target.data?.label,
    url: target.data?.sourceUrl || (target.data?.compositionReady ? '' : target.data?.gifUrl || target.data?.url),
    mime: target.data?.sourceMime || target.data?.mime,
    label: target.data?.sourceLabel || '画板上游素材',
    duration: Number(target.data?.duration || 0),
    width: target.data?.width,
    height: target.data?.height
  })
  return restoreWatermarkEditorProject({
    savedProject: sanitizeWatermarkEditorProject(target.data?.editorProject),
    sourceProject,
    nodeData: target.data
  })
}

describe('最近生成 · 成品回编辑器', () => {
  beforeEach(() => {
    localStorage.clear()
    projects.value = []
    listRecentGenerations.mockReset()
  })

  it('给 GIF 成品渲染交接按钮', async () => {
    const { wrapper } = await mountRecentGenerations([GIF])

    const button = handoffButtonFor(wrapper, GIF.name)
    expect(button.exists(), 'GIF 没有交接按钮就只能下载，改一个字要重新上传原素材').toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('图片仍然走画布，视频和音频仍然没有交接入口', async () => {
    const image = asset({ id: 'poster.png', name: 'poster.png', media_type: 'image' })
    const video = asset({ id: 'clip.mp4', name: 'clip.mp4', media_type: 'video' })
    const audio = asset({ id: 'voice.mp3', name: 'voice.mp3', media_type: 'audio' })
    const { wrapper, pushed } = await mountRecentGenerations([image, video, audio])

    expect(handoffButtonFor(wrapper, video.name).exists(), '视频没有对应的编辑器，放开入口只会给用户一个死按钮').toBe(false)
    expect(handoffButtonFor(wrapper, audio.name).exists()).toBe(false)

    await handoffButtonFor(wrapper, image.name).trigger('click')
    await flushPromises()

    expect(pushed.at(-1).path).toMatch(/^\/canvas\//)
  })

  it('点 GIF 的交接按钮会打开 /gif-editor 并带上 project 和 node', async () => {
    const { wrapper, pushed } = await mountRecentGenerations([GIF])

    await handoffButtonFor(wrapper, GIF.name).trigger('click')
    await flushPromises()

    const target = pushed.at(-1)
    expect(target.path).toBe('/gif-editor')
    expect(target.query.project, 'GIF 编辑器只认 project+node 这一对参数').toBeTruthy()
    expect(target.query.node).toBeTruthy()
  })

  it('交接出去的那个节点能被 GIF 编辑器读成这条 GIF 的可编辑 clip', async () => {
    const { wrapper, pushed } = await mountRecentGenerations([GIF])

    await handoffButtonFor(wrapper, GIF.name).trigger('click')
    await flushPromises()

    const { project } = readAsGifEditorWould(pushed.at(-1).query)

    expect(project.clips.length, '编辑器里没有 clip = 用户看到的还是一张白纸').toBe(1)
    expect(project.clips[0].url).toBe(GIF.url)
    expect(project.clips[0].kind, 'kind 认错就会按视频去解码这条 GIF').toBe('gif')
    expect(project.clips[0].name).toBe(GIF.name)
  })

  it('每次交接都建自己的工程，不会覆盖上一次的编辑结果', async () => {
    const { wrapper, pushed } = await mountRecentGenerations([GIF])

    await handoffButtonFor(wrapper, GIF.name).trigger('click')
    await flushPromises()
    const first = pushed.at(-1).query

    await handoffButtonFor(wrapper, GIF.name).trigger('click')
    await flushPromises()
    const second = pushed.at(-1).query

    expect(second.project).not.toBe(first.project)
    expect(getProjectCanvas(String(first.project))).toBeTruthy()
    expect(getProjectCanvas(String(second.project))).toBeTruthy()
  })
})
