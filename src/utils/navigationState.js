export const AUTH_SESSION_CACHE_MS = 60 * 1000

export const hasFreshAuthenticatedSession = ({
  user,
  checkedAt = 0,
  now = Date.now(),
  ttl = AUTH_SESSION_CACHE_MS
} = {}) => Boolean(user) && checkedAt > 0 && now - checkedAt < ttl

export const createLatestRequestGate = () => {
  let generation = 0
  return {
    begin: () => ++generation,
    isCurrent: token => token === generation,
    invalidate: () => ++generation
  }
}

export const createLatestNavigationRunner = ({ setPending = () => {} } = {}) => {
  const requestGate = createLatestRequestGate()

  return async (intent, action) => {
    const requestToken = requestGate.begin()
    const isCurrent = () => requestGate.isCurrent(requestToken)
    const commit = callback => isCurrent() ? callback() : false
    setPending(true, intent)
    try {
      return await action({ isCurrent, commit })
    } finally {
      if (isCurrent()) setPending(false, intent)
    }
  }
}

const STUDIO_TABS = new Set(['quick', 'novel', 'assets'])

export const normalizeStudioTab = value => {
  const normalized = String(Array.isArray(value) ? value[0] : value || 'quick')
  return STUDIO_TABS.has(normalized) ? normalized : 'quick'
}
