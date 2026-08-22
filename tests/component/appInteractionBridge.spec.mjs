/**
 * Takes over two small, fully convertible slices of the grep tail of
 * tests/appInteractionBridge.test.mjs.
 *
 *   grep                                          | behaviour asserted here
 *   ----------------------------------------------|------------------------------------
 *   vite.config.js `target: 'http://127.0.0.1:8788'` | the dev server really proxies the
 *   vite.config.js `'/public-assets': {`           |   three backend prefixes to the local
 *                                                  |   backend (asserted on the imported
 *                                                  |   config object, not on its text — a
 *                                                  |   proxy entry moved to the wrong key
 *                                                  |   used to pass)
 *   GlobalMessageBridge `useMessage()`             | mounting the bridge really installs a
 *   GlobalMessageBridge `window.$message = message`|   working `window.$message`, and
 *                                                  |   unmounting takes it away again —
 *                                                  |   every `window.$message?.error(...)`
 *                                                  |   in src/ depends on this one line
 *
 * The rest of that file's tail (Home.vue, Canvas.vue, CreationLauncher.vue,
 * WorkflowShelf.vue, RecentGenerationStrip.vue, WorkspaceShell.vue, TaskRail.vue,
 * DownloadModal.vue, ImageNode.vue, VideoNode.vue, the two DSP nodes) is D 类 view-level
 * wiring and stays where it is until batch 5 — see the note left in the legacy file.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NMessageProvider } from 'naive-ui'
import { defineComponent, h } from 'vue'

const { default: viteConfig } = await import('../../vite.config.js')
const { default: GlobalMessageBridge } = await import('../../src/components/GlobalMessageBridge.vue')

const LOCAL_BACKEND = 'http://127.0.0.1:8788'

describe('dev server proxy', () => {
  it('routes every backend prefix to the local material backend', () => {
    const proxy = viteConfig.server?.proxy || {}

    for (const prefix of ['/auth', '/v1', '/public-assets']) {
      expect(proxy[prefix], `${prefix} 必须被代理，否则开发机上这条路径会打到 vite 自己`).toBeTruthy()
      expect(proxy[prefix].target).toBe(LOCAL_BACKEND)
      expect(proxy[prefix].changeOrigin).toBe(true)
    }
  })
})

describe('GlobalMessageBridge', () => {
  const mountBridge = () => mount(defineComponent({
    render: () => h(NMessageProvider, null, { default: () => h(GlobalMessageBridge) })
  }), { attachTo: document.body })

  it('installs a usable window.$message and removes it on teardown', () => {
    expect(window.$message).toBeUndefined()

    const wrapper = mountBridge()

    expect(
      window.$message,
      'src/ 里到处是 window.$message?.error(...)，没有这座桥它们全都静默失败'
    ).toBeTruthy()
    for (const level of ['success', 'warning', 'error', 'info']) {
      expect(typeof window.$message[level], `window.$message.${level} 必须可调用`).toBe('function')
    }
    expect(() => window.$message.error('boom')).not.toThrow()

    wrapper.unmount()
    expect(
      window.$message,
      '卸载后必须收回，否则指向已销毁 provider 的句柄会在下一次报错时抛异常'
    ).toBeUndefined()
  })
})
