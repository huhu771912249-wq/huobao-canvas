/**
 * Takes over the request-timeout head of tests/sessionGuard.test.mjs.
 *
 * The session-probe half of that file — `createSessionProbe` / `resolveSessionRoute`
 * against a fake clock — was already a real test and stays put. What moved is the part
 * that read src/utils/request.js and five API modules as text:
 *
 *   grep                                          | behaviour asserted here
 *   ----------------------------------------------|------------------------------------
 *   `DEFAULT_REQUEST_TIMEOUT_MS = (\d+)` in range  | the axios instance the whole app
 *   `timeout: DEFAULT_REQUEST_TIMEOUT_MS`          |   shares really carries a bounded
 *   not `timeout: 30000000`                        |   default timeout
 *   materialInput / mediaComposition /             | each long-running call really goes
 *   videoTextOverlay / gifEditor `15 * 60 * 1000`  |   out with its own longer timeout,
 *   studioDocument `120000`                        |   and everything else really gets
 *                                                  |   the default
 *
 * Reading the constant out of the source could not tell whether it was ever handed to
 * `axios.create`, and reading `timeout: 15 * 60 * 1000` out of an API module could not
 * tell whether that config object is the one that reaches the wire. Both are measured
 * here on the outgoing request.
 *
 * Still grep'd in tests/sessionGuard.test.mjs (D 类接线, batch 5): src/router/index.js must
 * use the bounded probe. Asserting that for real means driving the real router.
 */
import { beforeEach, describe, expect, it } from 'vitest'

const { default: request, DEFAULT_REQUEST_TIMEOUT_MS } = await import('../../src/utils/request.js')
const { createMaterialInput } = await import('../../src/api/materialInput.js')
const { createMediaComposition } = await import('../../src/api/mediaComposition.js')
const { createVideoTextOverlay } = await import('../../src/api/videoTextOverlay.js')
const { uploadGifEditorMedia } = await import('../../src/api/gifEditor.js')
const { createStudioStoryboard } = await import('../../src/api/studioDocument.js')

const FIFTEEN_MINUTES = 15 * 60 * 1000

/** Drive the real axios instance and record what went out. */
const captureRequests = () => {
  const sent = []
  request.defaults.adapter = async (config) => {
    sent.push(config)
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  return sent
}

describe('request timeouts', () => {
  let sent

  beforeEach(() => {
    localStorage.clear()
    sent = captureRequests()
  })

  it('gives every ordinary call a bounded default timeout', async () => {
    await request({ url: '/v1/images/generations', method: 'post', data: {} })

    const { timeout } = sent[0]
    expect(timeout, '默认超时必须真的挂在共享的 axios 实例上').toBe(DEFAULT_REQUEST_TIMEOUT_MS)
    expect(timeout, `默认超时 ${timeout}ms 过短，会误伤正常请求`).toBeGreaterThanOrEqual(30000)
    expect(
      timeout,
      `默认超时 ${timeout}ms 过长，后端挂起时界面会长时间无响应`
    ).toBeLessThanOrEqual(300000)
  })

  it('keeps the per-request overrides on the calls that legitimately run long', async () => {
    await createMaterialInput({ name: 'a' })
    await createMediaComposition({ videoUrl: 'v', audioUrl: 'a', subtitleText: '', segments: [] })
    await createVideoTextOverlay({ video: 'v', ratio: '9:16', segments: [] })
    await uploadGifEditorMedia({ name: 'a' })
    await createStudioStoryboard('text', 'fast')

    expect(sent.map(config => [config.url, config.timeout])).toEqual([
      ['http://localhost:3000/v1/material-inputs', FIFTEEN_MINUTES],
      ['/v1/media/compositions', FIFTEEN_MINUTES],
      ['http://localhost:3000/v1/media/text-overlays', FIFTEEN_MINUTES],
      ['/v1/material-inputs', FIFTEEN_MINUTES],
      ['/v1/studio/storyboards', 120000]
    ])
  })

  it('does not leak a long override onto the next ordinary call', async () => {
    await createMaterialInput({ name: 'a' })
    await request({ url: '/v1/images/generations', method: 'post', data: {} })

    expect(
      sent[1].timeout,
      '长超时必须是逐请求的覆盖，泄漏到实例上会让后端挂起时整个界面冻结 15 分钟'
    ).toBe(DEFAULT_REQUEST_TIMEOUT_MS)
  })
})
