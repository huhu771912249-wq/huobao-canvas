export const isDocumentVisible = (documentRef) => (
  !documentRef || documentRef.visibilityState !== 'hidden'
)

export const createVisibilityPollingController = ({
  documentRef = globalThis.document,
  onHidden,
  onVisible
} = {}) => {
  let started = false

  const handleVisibilityChange = () => {
    if (isDocumentVisible(documentRef)) onVisible?.()
    else onHidden?.()
  }

  return {
    start() {
      if (started || !documentRef?.addEventListener) return
      started = true
      documentRef.addEventListener('visibilitychange', handleVisibilityChange)
    },
    stop() {
      if (!started || !documentRef?.removeEventListener) return
      documentRef.removeEventListener('visibilitychange', handleVisibilityChange)
      started = false
    },
    handleVisibilityChange
  }
}
