import { ref } from 'vue'
import { session } from '@/api/auth'

export const currentUser = ref(null)
export const authReady = ref(false)

export const refreshSession = async () => {
  try {
    const result = await session()
    currentUser.value = result.authenticated ? result.user : null
  } catch {
    currentUser.value = null
  } finally {
    authReady.value = true
  }
  return Boolean(currentUser.value)
}
