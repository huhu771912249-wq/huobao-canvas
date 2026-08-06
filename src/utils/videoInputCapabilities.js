const SINGLE_FRAME_MODELS = new Set(['minimax-h3', 'ltx-2.3', 'scail2-action-transfer'])

export const getVideoInputCapabilities = (model = '') => SINGLE_FRAME_MODELS.has(String(model))
  ? { firstFrame: true, lastFrame: false, references: false }
  : { firstFrame: true, lastFrame: true, references: true }
