export const apiSettingsVisibility = (provider, advancedOpen) => {
  const local = provider === 'local-material'
  return {
    showAdvancedToggle: !local,
    showTechnicalFields: !local && Boolean(advancedOpen)
  }
}
