/**
 * Chat stream collection | 对话流收集
 *
 * Callers of `useChat().send` decide what to do with `if (result)`. Anything
 * that resolves to an empty or undefined value therefore shows the user
 * nothing at all — no text, no error, no clue. Every outcome below is
 * explicit so no failure can disappear silently.
 * 调用方用 `if (result)` 判断结果,任何返回空值的路径都会让用户"点了没反应",
 * 所以这里把每种结局都显式表达出来。
 */

/**
 * A stop initiated from the UI (or an unmounted component) is not a failure.
 * `fetch` aborts surface as `AbortError`; axios cancellations as `ERR_CANCELED`.
 * 用户主动停止不算失败,但要能和真正的错误区分开。
 */
export const isChatAbortError = error =>
  error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'

/** Raised when the model streamed nothing at all. | 模型一个字都没返回时抛出 */
export const EMPTY_CHAT_RESPONSE_MESSAGE = '模型没有返回任何内容，请重试'

/**
 * Drain a chat completion stream into one string.
 *
 * @param {AsyncIterable<string>} chunks
 * @param {Object} [options]
 * @param {(text: string) => void} [options.onProgress] - called with the text so far
 * @returns {Promise<{ aborted: boolean, text: string }>}
 * @throws when the stream fails, or completes without producing any text
 */
export const collectChatStream = async (chunks, { onProgress } = {}) => {
  let text = ''

  try {
    for await (const chunk of chunks) {
      text += chunk
      onProgress?.(text)
    }
  } catch (error) {
    if (isChatAbortError(error)) return { aborted: true, text }
    throw error
  }

  // An empty completion used to resolve to '' and read as "nothing happened".
  // 空结果过去会被当成 falsy 静默丢弃,必须显式报错。
  if (!text) throw new Error(EMPTY_CHAT_RESPONSE_MESSAGE)

  return { aborted: false, text }
}
