export const isDynamicImportFailure = (error) => (
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i
    .test(String(error?.message || error || ''))
)

export const recoverFromDynamicImportFailure = (error) => {
  if (!isDynamicImportFailure(error) || typeof window === 'undefined') return false
  const key = 'huobao-dynamic-import-reload'
  if (window.sessionStorage.getItem(key) === '1') return false
  window.sessionStorage.setItem(key, '1')
  window.location.reload()
  return true
}

export const clearDynamicImportRecovery = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('huobao-dynamic-import-reload')
  }
}
