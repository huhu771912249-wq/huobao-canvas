import { ref } from 'vue'
import { session } from '@/api/auth'
import { hasFreshAuthenticatedSession } from '@/utils/navigationState'

export const currentUser = ref(null)
export const authReady = ref(false)
let lastSessionCheckedAt = 0
let sessionRequest = null

export const markSessionAuthenticated = user => {
  currentUser.value = user || null
  authReady.value = true
  lastSessionCheckedAt = currentUser.value ? Date.now() : 0
}

export const invalidateSessionCache = () => {
  lastSessionCheckedAt = 0
}

export const refreshSession = async ({ force = false } = {}) => {
  if (!force && hasFreshAuthenticatedSession({
    user: currentUser.value,
    checkedAt: lastSessionCheckedAt
  })) return true

  if (!sessionRequest) {
    sessionRequest = (async () => {
      try {
        const result = await session()
        currentUser.value = result.authenticated ? result.user : null
        lastSessionCheckedAt = Date.now()
      } catch {
        currentUser.value = null
        lastSessionCheckedAt = 0
      } finally {
        authReady.value = true
      }
      return Boolean(currentUser.value)
    })()
  }

  try {
    return await sessionRequest
  } finally {
    sessionRequest = null
  }
}
