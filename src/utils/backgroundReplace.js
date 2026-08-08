export const DEFAULT_BACKGROUND_INSTRUCTION =
  '保留原人物的身份、五官、发型、姿势、服装和前景，只把背景替换成参考图中的环境。'

const normalizeImage = (value) => String(value || '').trim()

export const getBackgroundReplaceReadiness = ({
  subjectImage,
  backgroundReferenceImage
} = {}) => {
  const missing = []
  if (!normalizeImage(subjectImage)) missing.push('主体图')
  if (!normalizeImage(backgroundReferenceImage)) missing.push('背景参考图')

  return {
    ready: missing.length === 0,
    missing,
    message: missing.length > 0 ? `请先添加${missing.join('和')}` : ''
  }
}

export const buildBackgroundReplacePayload = ({
  model,
  size,
  quality,
  subjectImage,
  backgroundReferenceImage,
  instruction
} = {}) => {
  const readiness = getBackgroundReplaceReadiness({
    subjectImage,
    backgroundReferenceImage
  })
  if (!readiness.ready) {
    throw new Error(readiness.message)
  }

  const normalizedInstruction =
    String(instruction || '').trim() || DEFAULT_BACKGROUND_INSTRUCTION

  return {
    model,
    prompt: normalizedInstruction,
    size,
    quality,
    n: 1,
    edit_mode: 'background_replace',
    subject_image: normalizeImage(subjectImage),
    background_reference_image: normalizeImage(backgroundReferenceImage),
    background_instruction: normalizedInstruction
  }
}
