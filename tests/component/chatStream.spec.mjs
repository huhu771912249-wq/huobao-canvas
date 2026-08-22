/**
 * Takes over the `useApi.js` grep tail of tests/chatStream.test.mjs.
 *
 * The pure half of that file — `collectChatStream` / `isChatAbortError` against fake async
 * generators — was already a real test and stays put. The tail sliced the text of
 * `const send = ...` out of src/hooks/useApi.js and pattern-matched it:
 *
 *   grep                                        | behaviour asserted here
 *   --------------------------------------------|--------------------------------------
 *   `collectChatStream(`                         | send() joins the streamed chunks and
 *                                                |   surfaces the empty-completion error
 *   no `if (err.name !== 'AbortError') {`         | an abort raised *outside* the stream
 *   `isChatAbortError(err)`                      |   still releases `loading` and returns
 *                                                |   an explicit null, and records no error
 *   no `\n      if (stream) {`                    | `stream = false` returns the full
 *                                                |   answer — never `undefined` with
 *                                                |   `loading` stuck on
 *   `stream ? { onProgress`                      | `stream = true` reports every prefix;
 *                                                |   `stream = false` reports none but
 *                                                |   still lands the same final text
 *   `if (outcome.aborted) {`                     | a stop mid-stream keeps the partial
 *   `reset()\n return null`                      |   text, returns null, clears loading
 *   `return outcome.text`                        | a normal answer is returned and pushed
 *                                                |   onto the transcript
 *
 * A regex over the source cannot tell whether `loading` is actually released on each of
 * those paths, nor whether the transcript survives a stop. Those are the failures this
 * file adds.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, watch } from 'vue'

const streamChatCompletions = vi.fn()
vi.mock('@/api', () => ({
  streamChatCompletions: (...args) => streamChatCompletions(...args),
  generateImage: vi.fn(),
  createVideoTask: vi.fn(),
  getVideoTaskStatus: vi.fn(),
  cancelVideoTask: vi.fn()
}))

const { useChat } = await import('../../src/hooks/useApi.js')
const { EMPTY_CHAT_RESPONSE_MESSAGE } = await import('../../src/utils/chatStream.js')

const abortError = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })

const streamOf = (chunks, tailError = null) => async function* stream () {
  for (const chunk of chunks) yield chunk
  if (tailError) throw tailError
}

/**
 * Record every value `currentResponse` takes while a send is in flight. `flush: 'sync'`
 * so a prefix that is immediately overwritten still shows up.
 */
const watchCurrentResponse = (chat, sink) => watch(
  chat.currentResponse,
  value => { if (value !== '') sink.push(value) },
  { flush: 'sync' }
)

/** `useChat` registers `onUnmounted`, so it has to run inside a component instance. */
const mountChat = () => {
  let chat = null
  const wrapper = mount(defineComponent({
    setup () {
      chat = useChat()
      return () => null
    }
  }), { attachTo: document.body })
  return { chat, wrapper }
}

describe('useChat().send', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    streamChatCompletions.mockReset()
  })

  it('streams the answer, reports every prefix and keeps the transcript', async () => {
    streamChatCompletions.mockImplementation(streamOf(['你好', '，', '世界']))
    const { chat, wrapper } = mountChat()

    const result = await chat.send('hi')

    expect(result).toBe('你好，世界')
    expect(chat.currentResponse.value).toBe('你好，世界')
    expect(chat.messages.value).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '你好，世界' }
    ])
    expect(chat.loading.value).toBe(false)
    expect(chat.status.value).toBe('success')
    expect(chat.error.value).toBeNull()
    wrapper.unmount()
  })

  it('reports incremental progress only in streaming mode, but lands the same answer either way', async () => {
    streamChatCompletions.mockImplementation(streamOf(['a', 'b', 'c']))
    const streamed = mountChat()
    const progress = []
    // currentResponse is the only progress channel useChat exposes.
    const stop = watchCurrentResponse(streamed.chat, progress)
    const streamedResult = await streamed.chat.send('hi', true)
    stop()

    expect(streamedResult).toBe('abc')
    expect(progress, 'streaming mode must paint the answer as it arrives').toEqual(['a', 'ab', 'abc'])
    streamed.wrapper.unmount()

    streamChatCompletions.mockImplementation(streamOf(['a', 'b', 'c']))
    const buffered = mountChat()
    const bufferedProgress = []
    const stopBuffered = watchCurrentResponse(buffered.chat, bufferedProgress)
    const bufferedResult = await buffered.chat.send('hi', false)
    stopBuffered()

    expect(
      bufferedResult,
      'stream = false only means "no incremental updates" — it must still return the answer'
    ).toBe('abc')
    expect(
      bufferedProgress,
      'non-streaming mode must land the answer in one go, with no intermediate prefixes'
    ).toEqual(['abc'])
    expect(buffered.chat.loading.value, 'loading must be released in both modes').toBe(false)
    expect(buffered.chat.status.value).toBe('success')
    buffered.wrapper.unmount()
  })

  it('turns a stop mid-stream into an explicit null and keeps what arrived', async () => {
    streamChatCompletions.mockImplementation(streamOf(['半句'], abortError()))
    const { chat, wrapper } = mountChat()

    const result = await chat.send('hi')

    expect(result, 'a stop must be distinguishable from an answer').toBeNull()
    expect(chat.currentResponse.value, '已经收到的部分文本不能丢').toBe('半句')
    expect(chat.loading.value, 'a stop must not leave the composer spinning forever').toBe(false)
    expect(chat.status.value).toBe('idle')
    expect(chat.error.value, 'a user-initiated stop is not an error').toBeNull()
    expect(chat.messages.value, 'an interrupted answer must not be pushed as if complete').toEqual([])
    wrapper.unmount()
  })

  it('treats an abort raised outside the stream the same way', async () => {
    streamChatCompletions.mockImplementation(() => { throw abortError() })
    const { chat, wrapper } = mountChat()

    const result = await chat.send('hi')

    expect(result).toBeNull()
    expect(chat.loading.value, 'an abort thrown before the first chunk must still clear loading').toBe(false)
    expect(chat.error.value).toBeNull()
    wrapper.unmount()
  })

  it('propagates a real failure and records it', async () => {
    streamChatCompletions.mockImplementation(streamOf([], new Error('Stream request failed')))
    const { chat, wrapper } = mountChat()

    await expect(chat.send('hi')).rejects.toThrow('Stream request failed')
    expect(chat.error.value?.message).toBe('Stream request failed')
    expect(chat.status.value).toBe('error')
    expect(chat.loading.value).toBe(false)
    wrapper.unmount()
  })

  it('raises when the model returned nothing at all', async () => {
    streamChatCompletions.mockImplementation(streamOf([]))
    const { chat, wrapper } = mountChat()

    await expect(
      chat.send('hi'),
      '一个空回答必须报错，不能 resolve 成空串被调用方的 if (result) 静默吞掉'
    ).rejects.toThrow(EMPTY_CHAT_RESPONSE_MESSAGE)
    expect(chat.loading.value).toBe(false)
    wrapper.unmount()
  })
})
