const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '')

export const getMaterialApiBase = () => {
  const configured = trimTrailingSlash(import.meta.env?.VITE_MATERIAL_API_BASE_URL)
  if (configured) return configured

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return 'http://127.0.0.1:8788'
}

export const buildMaterialApiUrl = (path) => {
  const normalizedPath = String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`
  return `${getMaterialApiBase()}${normalizedPath}`
}

export const isMaterialApiUrl = (value) => {
  const url = String(value || '')
  return url.startsWith(getMaterialApiBase())
    || url.startsWith('http://127.0.0.1:8788')
    || url.startsWith('https://127.0.0.1:8788')
    || url.startsWith('http://localhost:8788')
    || url.startsWith('https://localhost:8788')
}
