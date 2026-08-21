/**
 * Provider API key vault | 渠道 API Key 保管处
 *
 * Third-party provider keys (chatfire / openai) belong to the user, not to us. They used to
 * be written to `localStorage` in clear text by two independent implementations
 * (`src/hooks/useApiConfig.js` under `apiKey`, and `src/stores/pinia/models.js` under
 * `api-keys-by-provider`), which meant a key entered once stayed readable on the device
 * forever — by any other script on the origin, by a browser extension, by anyone who later
 * sits down at the machine, and by anything that syncs the browser profile.
 *
 * This module is now the single place a provider key lives, and it lives **in memory only**.
 * Nothing here writes to `localStorage`, `sessionStorage` or `document.cookie`, so no key is
 * left at rest once the tab closes. `SECURITY.md` and `ARCHITECTURE.md` already state the
 * rule this restores: provider credentials belong to the backend, never to the browser.
 *
 * RESIDUAL RISK — read this before "improving" the file:
 *   Memory-only storage does NOT stop XSS. Any script running on this origin can import this
 *   module (or read the Pinia store that mirrors it) and exfiltrate the key, exactly as it
 *   could read `localStorage`. A single-page app that attaches `Authorization: Bearer <key>`
 *   from JavaScript cannot fix that on the client — the key has to be in the page in order
 *   to be sent. What memory-only storage does fix is the *at-rest* half of the problem: the
 *   exposure window shrinks from "forever on this device" to "this tab's lifetime".
 *   The complete fix is for guanxi-canvas-backend to hold per-user provider credentials and
 *   inject the upstream `Authorization` header server-side, so the browser never receives
 *   the key at all. Until that lands, do not re-add client-side persistence: an
 *   "encrypted in localStorage" variant would not help either, because the decryption key
 *   would have to sit next to the ciphertext in the same JavaScript context.
 *
 * KNOWN COST: a provider key does not survive a page reload. `local-material` (the default
 * provider) needs no key at all, so the default product path is unaffected; users who point
 * the app at chatfire/openai re-enter the key after a reload.
 */

/** provider key -> API key. Module scope on purpose: never serialized, never persisted. */
const vault = new Map()

/**
 * Storage entries written by the pre-fix code. They are deleted the first time this module
 * loads, so an existing install stops carrying a clear-text key on disk.
 * 修复前写下的存储项：模块加载时清掉，让老用户设备上的明文密钥立刻消失。
 */
export const LEGACY_API_KEY_STORAGE_KEYS = Object.freeze({
  /** `src/stores/pinia/models.js` — JSON object of { provider: apiKey }; the live path. */
  BY_PROVIDER: 'api-keys-by-provider',
  /**
   * `src/hooks/useApiConfig.js` — a bare key string. That hook was never wired into the
   * request path (nothing but the hook itself ever read this entry), so the value is not
   * lifted into the vault, only deleted.
   */
  SINGLE: 'apiKey'
})

const resolveStorage = (storage) => {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage || null
  } catch {
    // Private mode / disabled storage: nothing to migrate away from.
    return null
  }
}

/**
 * Read the API key of a provider. Returns '' when unset — callers treat that as
 * "unconfigured" rather than sending an empty bearer token.
 */
export const getApiKey = (provider) => vault.get(provider) || ''

/** Store (or, for a falsy value, drop) the API key of one provider. */
export const setApiKey = (provider, apiKey) => {
  if (!provider) return
  if (apiKey) vault.set(provider, apiKey)
  else vault.delete(provider)
}

/** Drop the API key of one provider. */
export const clearApiKey = (provider) => {
  vault.delete(provider)
}

/** Drop every API key. */
export const clearAllApiKeys = () => {
  vault.clear()
}

/**
 * Plain-object view for the settings UI, which needs "is this provider configured" per row.
 * The result is a copy; mutating it does not touch the vault.
 */
export const snapshotApiKeys = () => Object.fromEntries(vault)

/** Replace the whole vault from a { provider: apiKey } map. */
export const replaceApiKeys = (apiKeys = {}) => {
  vault.clear()
  for (const [provider, apiKey] of Object.entries(apiKeys || {})) {
    if (apiKey) vault.set(provider, apiKey)
  }
}

/**
 * One-way migration: lift the clear-text keys left by the old code into memory, then delete
 * the stored copies. Idempotent, and a no-op when storage is unavailable.
 *
 * The lift keeps the current session working for an existing user; the delete is the point
 * of the exercise — after this runs the key is no longer at rest on the device.
 *
 * @param {Storage|null} [storage] - defaults to `globalThis.localStorage`.
 * @returns {string[]} the storage keys that were removed.
 */
export const purgeLegacyApiKeyStorage = (storage) => {
  const target = resolveStorage(storage)
  if (!target) return []

  const removed = []
  try {
    const raw = target.getItem(LEGACY_API_KEY_STORAGE_KEYS.BY_PROVIDER)
    if (raw !== null && raw !== undefined) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          for (const [provider, apiKey] of Object.entries(parsed)) {
            if (apiKey && !vault.has(provider)) vault.set(provider, apiKey)
          }
        }
      } catch {
        // Corrupt JSON: nothing to rescue, but it still has to go.
      }
      target.removeItem(LEGACY_API_KEY_STORAGE_KEYS.BY_PROVIDER)
      removed.push(LEGACY_API_KEY_STORAGE_KEYS.BY_PROVIDER)
    }

    if (target.getItem(LEGACY_API_KEY_STORAGE_KEYS.SINGLE) !== null) {
      target.removeItem(LEGACY_API_KEY_STORAGE_KEYS.SINGLE)
      removed.push(LEGACY_API_KEY_STORAGE_KEYS.SINGLE)
    }
  } catch {
    // A storage that throws on access cannot be holding a key we could leak.
  }

  return removed
}

// Run the scrub as soon as anything key-aware is loaded, rather than waiting for the Pinia
// store to be instantiated: `src/utils/request.js` imports this module, and that import
// happens during app boot, before any request can carry a key.
purgeLegacyApiKeyStorage()
