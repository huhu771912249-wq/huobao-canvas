import assert from 'node:assert/strict'
import {
  EMPTY_CHAT_RESPONSE_MESSAGE,
  collectChatStream,
  isChatAbortError
} from '../src/utils/chatStream.js'

const streamOf = async function* (chunks) {
  for (const chunk of chunks) yield chunk
}

const failingStream = async function* (chunks, error) {
  for (const chunk of chunks) yield chunk
  throw error
}

const abortError = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })

// 1. A normal completion is joined and reported. | 正常结果拼接后返回。
{
  const progress = []
  const outcome = await collectChatStream(streamOf(['你好', '，', '世界']), {
    onProgress: text => progress.push(text)
  })
  assert.deepEqual(outcome, { aborted: false, text: '你好，世界' })
  assert.deepEqual(progress, ['你好', '你好，', '你好，世界'])
}

// 2. A caller that wants no incremental updates still gets the full answer.
//    不需要增量更新的调用方同样要拿到完整结果。
{
  const outcome = await collectChatStream(streamOf(['a', 'b']))
  assert.deepEqual(outcome, { aborted: false, text: 'ab' })
}

// 3. An abort is a distinct, explicit outcome — never a silent undefined.
//    中止是一个显式结局，不能变成静默的 undefined。
assert.equal(isChatAbortError(abortError()), true)
assert.equal(isChatAbortError({ code: 'ERR_CANCELED' }), true)
assert.equal(isChatAbortError(new Error('network down')), false)
{
  const outcome = await collectChatStream(failingStream(['半句'], abortError()))
  assert.equal(outcome.aborted, true)
  assert.equal(outcome.text, '半句', '中止时应保留已收到的部分文本')
}

// 4. A completion that produced nothing must raise, not resolve to ''.
//    模型什么都没返回时必须报错，而不是 resolve 成空串被 `if (result)` 吞掉。
await assert.rejects(() => collectChatStream(streamOf([])), new RegExp(EMPTY_CHAT_RESPONSE_MESSAGE))

// 5. Real failures still propagate. | 真正的错误依旧上抛。
await assert.rejects(
  () => collectChatStream(failingStream([], new Error('Stream request failed'))),
  /Stream request failed/
)

// 6. useChat wires every branch: no silent swallow, no missing else.
//    useChat 必须接上每个分支：不静默吞错，也不留没有 else 的 if。
//
// Moved to tests/component/chatStream.spec.mjs: `send()` is driven for real against a
// stubbed `streamChatCompletions`, so "abort returns an explicit null and releases
// loading", "stream = false still returns the answer" and "a real error is recorded and
// rethrown" are asserted as outcomes instead of as source patterns.

console.log('chatStream.test.mjs passed')
