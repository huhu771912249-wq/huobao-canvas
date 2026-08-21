/**
 * Regression guard: a third-party provider API key must never be written to browser storage.
 *
 * WHAT WENT WRONG (CodeQL js/clear-text-storage-of-sensitive-data, high):
 *   `src/hooks/useApiConfig.js` wrote the key to `localStorage['apiKey']`, and — the part
 *   CodeQL did *not* flag, because the value went through `JSON.stringify` of a
 *   `{ provider: key }` object — `src/stores/pinia/models.js` wrote every provider key to
 *   `localStorage['api-keys-by-provider']`. That second one was the live path: it is what
 *   `src/utils/request.js` and `src/api/chat.js` read back to build the `Authorization`
 *   header. Deleting only the flagged hook would have turned the alert green and left the
 *   real clear-text store in place.
 *
 * WHAT THIS SPEC LOCKS:
 *   1. Storing a key through the real store never puts it in localStorage / sessionStorage —
 *      asserted by scanning *every* entry for the secret, not just the two keys we know
 *      about, so a future "let me persist it under a different name" reintroduction is red.
 *   2. The key still reaches the wire. A "fix" that simply stopped storing the key and broke
 *      authentication would pass assertion 1; the axios instance is driven end to end here
 *      so that shortcut is red too.
 *   3. An install that already has a clear-text key on disk gets it scrubbed on boot, and
 *      the rescued value keeps that session working.
 *   4. Sign-out drops the keys, so a second account on the same tab cannot inherit them.
 *
 * NOT covered, by construction: XSS. An injected script can read the in-memory vault just as
 * easily as it could read localStorage. See the residual-risk note in
 * `src/utils/apiKeyVault.js` — only backend-held credentials fix that.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// Deliberately not shaped like a real credential: gitleaks flags an `sk-` prefix
// followed by a hex run as a generic-api-key, and a test fixture must not trip
// the secret scanner. Any distinctive string works — the assertions only ever
// substring-search storage for this value.
const SECRET = 'guanxi-regression-fixture-not-a-real-credential'

/** Every value currently readable out of a Storage, for substring scanning. */
const dumpStorage = (storage) => {
  const entries = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    entries[key] = storage.getItem(key)
  }
  return entries
}

const expectNoSecretAtRest = (secret) => {
  for (const [name, storage] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) {
    const entries = dumpStorage(storage)
    for (const [key, value] of Object.entries(entries)) {
      expect(
        String(value ?? ''),
        `${name}['${key}'] contains the provider API key in clear text`
      ).not.toContain(secret)
    }
  }
  expect(document.cookie, 'document.cookie contains the provider API key').not.toContain(secret)
}

/**
 * Fresh module registry per test: the vault is module state and scrubs legacy storage on
 * import, so each case has to start from a clean import graph.
 */
const loadModules = async () => {
  vi.resetModules()
  const [{ useModelStore }, request, vault] = await Promise.all([
    import('@/stores/pinia'),
    import('@/utils/request.js').then(module => module.default),
    import('@/utils/apiKeyVault.js')
  ])
  return { useModelStore, request, vault }
}

/** Run one request through the real interceptor chain and hand back the outgoing config. */
const captureOutgoingRequest = async (request, url) => {
  let captured = null
  request.defaults.adapter = async (config) => {
    captured = config
    return { data: { code: 200 }, status: 200, statusText: 'OK', headers: {}, config }
  }
  await request({ url, method: 'post', data: {} })
  const header = captured.headers?.get?.('Authorization') ?? captured.headers?.Authorization
  return { captured, authorization: header ? String(header) : '' }
}

describe('provider API key storage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('never writes the key into browser storage, and still authenticates the request', async () => {
    localStorage.setItem('api-provider', 'chatfire')
    const { useModelStore, request } = await loadModules()
    const store = useModelStore()

    store.setApiKeyByProvider('chatfire', SECRET)
    await nextTick()

    expectNoSecretAtRest(SECRET)
    expect(store.currentApiKey, 'the UI must still see the configured key').toBe(SECRET)
    expect(store.isCurrentProviderConfigured).toBe(true)

    const { authorization } = await captureOutgoingRequest(request, '/v1/images/generations')
    expect(authorization, 'the key must still reach the wire').toBe(`Bearer ${SECRET}`)
  })

  it('keeps the streaming path — which bypasses the interceptor — on the same source', async () => {
    localStorage.setItem('api-provider', 'chatfire')
    const { useModelStore } = await loadModules()
    useModelStore().setApiKeyByProvider('chatfire', SECRET)
    await nextTick()

    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({ message: 'stop here' }) }))
    vi.stubGlobal('fetch', fetchMock)

    const { streamChatCompletions } = await import('@/api/chat.js')
    await expect(streamChatCompletions({ model: 'x', messages: [] }).next()).rejects.toThrow('stop here')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`)
    expectNoSecretAtRest(SECRET)
  })

  it('scrubs a clear-text key left by the previous release and keeps that session working', async () => {
    localStorage.setItem('api-provider', 'chatfire')
    // Exactly what the pre-fix code left behind on an existing install.
    localStorage.setItem('api-keys-by-provider', JSON.stringify({ chatfire: SECRET }))
    localStorage.setItem('apiKey', SECRET)

    const { useModelStore, request } = await loadModules()

    expect(localStorage.getItem('api-keys-by-provider'), 'legacy clear-text entry must be deleted').toBeNull()
    expect(localStorage.getItem('apiKey'), 'legacy clear-text entry must be deleted').toBeNull()
    expectNoSecretAtRest(SECRET)

    // Rescued into memory, so the user is not logged out of their provider mid-session.
    expect(useModelStore().currentApiKey).toBe(SECRET)
    const { authorization } = await captureOutgoingRequest(request, '/v1/images/generations')
    expect(authorization).toBe(`Bearer ${SECRET}`)
  })

  it('does not resurrect the key when unrelated settings are persisted afterwards', async () => {
    localStorage.setItem('api-provider', 'chatfire')
    const { useModelStore } = await loadModules()
    const store = useModelStore()

    store.setApiKeyByProvider('chatfire', SECRET)
    store.setBaseUrlByProvider('chatfire', 'https://api.chatfire.site/v1')
    store.addCustomChatModel('gpt-test')
    store.setProvider('openai')
    store.setProvider('chatfire')
    await nextTick()

    expectNoSecretAtRest(SECRET)
    expect(localStorage.getItem('base-urls-by-provider'), 'non-secret settings must still persist')
      .toContain('api.chatfire.site')
  })

  it('drops every key on sign-out', async () => {
    localStorage.setItem('api-provider', 'chatfire')
    const { useModelStore, vault } = await loadModules()
    const store = useModelStore()

    store.setApiKeyByProvider('chatfire', SECRET)
    await nextTick()
    expect(vault.getApiKey('chatfire')).toBe(SECRET)

    store.clearAllApiKeys()
    await nextTick()

    expect(vault.getApiKey('chatfire')).toBe('')
    expect(store.currentApiKey).toBe('')
    expect(vault.snapshotApiKeys()).toEqual({})
  })
})
