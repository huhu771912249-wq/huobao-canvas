export const HOME_INTENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024
export const HOME_INTENT_MEDIA_MAX_BYTES = 90 * 1024 * 1024

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const EXTENSION_KINDS = Object.freeze({
  png: ['image', 'image/png'],
  jpg: ['image', 'image/jpeg'],
  jpeg: ['image', 'image/jpeg'],
  webp: ['image', 'image/webp'],
  gif: ['gif', 'image/gif'],
  mp4: ['video', 'video/mp4'],
  mov: ['video', 'video/quicktime'],
  webm: ['video', 'video/webm']
})
const WORKFLOW_ATTACHMENT_CONSUMERS = Object.freeze({
  gifEditor: Object.freeze({
    image: Object.freeze({ targetType: 'watermarkEditor' }),
    gif: Object.freeze({ targetType: 'watermarkEditor' }),
    video: Object.freeze({ targetType: 'watermarkEditor' })
  })
})

const workflowAttachmentConsumer = (flow, kind) => WORKFLOW_ATTACHMENT_CONSUMERS[flow]?.[kind] || null

const humanFileSize = bytes => {
  const value = Math.max(0, Number(bytes) || 0)
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
    : `${Math.max(1, Math.ceil(value / 1024))} KB`
}

const attachmentDescriptor = (file, kind, mime) => ({
  name: String(file?.name || '未命名素材').slice(0, 160),
  mime,
  size: Number(file?.size || 0),
  sizeLabel: humanFileSize(file?.size),
  kind,
  kindLabel: kind === 'image' ? '图片' : kind === 'gif' ? 'GIF' : '视频'
})

export const validateHomeIntentAttachment = file => {
  if (!file) return { ok: false, attachment: null, message: '请选择一个素材' }
  const name = String(file.name || '')
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  const declaredMime = String(file.type || '').toLowerCase()
  let kind = ''
  let mime = ''
  if (declaredMime === 'image/gif') {
    kind = 'gif'
    mime = declaredMime
  } else if (IMAGE_MIMES.has(declaredMime)) {
    kind = 'image'
    mime = declaredMime
  } else if (VIDEO_MIMES.has(declaredMime)) {
    kind = 'video'
    mime = declaredMime
  } else if (!declaredMime && EXTENSION_KINDS[extension]) {
    const fallback = EXTENSION_KINDS[extension]
    kind = fallback[0]
    mime = fallback[1]
  }
  if (!kind) {
    return { ok: false, attachment: null, message: '只支持 PNG、JPEG、WebP、GIF、MP4、MOV 或 WebM' }
  }
  const size = Number(file.size || 0)
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, attachment: null, message: '素材文件为空或大小无效' }
  }
  const limit = kind === 'image' ? HOME_INTENT_IMAGE_MAX_BYTES : HOME_INTENT_MEDIA_MAX_BYTES
  if (size > limit) {
    return {
      ok: false,
      attachment: null,
      message: `${kind === 'image' ? '图片' : '视频 / GIF'}不能超过 ${limit / 1024 / 1024}MB`
    }
  }
  return { ok: true, file, attachment: attachmentDescriptor(file, kind, mime), message: '' }
}

export const createHomeIntentAttachmentState = ({ onChange = () => {} } = {}) => {
  let selected = null
  const publish = (validation) => {
    selected = validation.ok ? { file: validation.file, attachment: validation.attachment } : null
    onChange({ attachment: selected, error: validation.message || '' })
    return validation
  }
  return {
    select: file => publish(validateHomeIntentAttachment(file)),
    clear: () => publish({ ok: false, attachment: null, message: '' }),
    current: () => selected
  }
}

const INTENT_RULES = Object.freeze([
  {
    id: 'gif-edit',
    label: 'GIF / 水印编辑',
    keywords: ['gif', '动图', '水印', '角标', 'logo'],
    attachmentKinds: ['gif'],
    quick: { label: '水印与 GIF 素材编辑', flow: 'gifEditor' },
    workflow: { label: '可编辑 GIF 工作流', flow: 'gifEditor' }
  },
  {
    id: 'resize',
    label: '视频尺寸适配',
    keywords: ['尺寸', '裁剪', '适配', '横版', '竖版', '抖音', '平台'],
    quick: { label: '视频尺寸工作台', route: '/video-resize' },
    workflow: { label: '批量广告尺寸画板', flow: 'batch' }
  },
  {
    id: 'background',
    label: '背景替换',
    keywords: ['背景', '换景', '换背景', '抠图'],
    quick: { label: '背景替换工具', flow: 'background' },
    workflow: { label: '可编辑背景替换工作流', flow: 'background' }
  },
  {
    id: 'variation',
    label: '素材裂变',
    keywords: ['裂变', '变体', '多版本', 'a/b', 'ab 测试'],
    quick: { label: '素材裂变工具', flow: 'variation' },
    workflow: { label: '可编辑素材裂变工作流', flow: 'variation' }
  },
  {
    id: 'dsp',
    label: 'DSP 优秀素材',
    keywords: ['dsp', '高点击', '优秀素材'],
    quick: { label: '54DSP 优秀素材', flow: 'dsp' },
    workflow: { label: '可编辑 DSP 工作流', flow: 'dsp' }
  },
  {
    id: 'video',
    label: '视频创作',
    keywords: ['视频', '运镜', '口播', '镜头'],
    attachmentKinds: ['video'],
    quick: { label: '视频创作中心', route: '/video-studio' },
    workflow: { label: '可编辑视频工作流', flow: 'video' }
  },
  {
    id: 'image',
    label: '广告画面创作',
    keywords: [],
    attachmentKinds: ['image'],
    quick: { label: 'AI 作图', flow: 'image' },
    workflow: { label: '可编辑图片工作流', flow: 'image' },
    defaultDestination: 'workflow'
  }
])

const safeAttachmentDescriptor = value => {
  if (!value) return null
  if (value.file) return safeAttachmentDescriptor(value.attachment)
  if (value.kind && value.name) {
    return {
      name: String(value.name).slice(0, 160),
      mime: String(value.mime || ''),
      size: Number(value.size || 0),
      sizeLabel: String(value.sizeLabel || humanFileSize(value.size)),
      kind: String(value.kind),
      kindLabel: String(value.kindLabel || value.kind)
    }
  }
  const validation = validateHomeIntentAttachment(value)
  return validation.ok ? validation.attachment : null
}

const matchIntentRule = (prompt, attachment) => {
  const normalizedPrompt = String(prompt || '').trim().toLowerCase()
  for (const rule of INTENT_RULES) {
    const keyword = rule.keywords.find(value => normalizedPrompt.includes(value))
    if (keyword) return { rule, reason: `文字中包含“${keyword}”` }
    if (attachment && rule.attachmentKinds?.includes(attachment.kind)) {
      return { rule, reason: `检测到${attachment.kindLabel}附件` }
    }
  }
  return { rule: INTENT_RULES.at(-1), reason: '未命中专项关键词，按通用广告画面处理' }
}

export const createHomeIntentPlan = ({ prompt = '', attachment = null } = {}) => {
  const cleanPrompt = String(prompt || '').trim()
  const descriptor = safeAttachmentDescriptor(attachment)
  const { rule, reason } = matchIntentRule(cleanPrompt, descriptor)
  const quickDisabled = Boolean(descriptor)
  const workflowConsumer = descriptor
    ? workflowAttachmentConsumer(rule.workflow.flow, descriptor.kind)
    : null
  const workflowDisabled = Boolean(descriptor) && !workflowConsumer
  const recommendation = workflowDisabled
    ? 'unavailable'
    : descriptor ? 'workflow' : (rule.defaultDestination || 'quick')
  const destinations = {
    quick: {
      id: 'quick',
      title: '快捷工具',
      ...rule.quick,
      disabled: quickDisabled,
      explanation: quickDisabled
        ? '现有快捷页无法安全接收首页已上传附件，请使用可编辑工作流。'
        : '直接打开现有工具，确认前不创建项目。'
    },
    workflow: {
      id: 'workflow',
      title: '可编辑工作流',
      ...rule.workflow,
      disabled: workflowDisabled,
      explanation: workflowDisabled
        ? `现有“${rule.workflow.label}”无法消费${descriptor.kindLabel}附件，请改用 GIF / 水印编辑需求或移除附件。`
        : descriptor
        ? '确认后上传素材，并把公开 URL 与元数据放入画板。'
        : '确认后创建可继续调整节点的画板。'
    },
    ...(workflowDisabled ? {
      unavailable: {
        id: 'unavailable',
        title: '暂无可用去向',
        label: '请更换需求或移除附件',
        disabled: true,
        explanation: '当前两个去向都无法安全消费该附件。'
      }
    } : {})
  }
  const steps = workflowDisabled
    ? [
        `已识别为“${rule.label}”`,
        `现有工作流没有可消费${descriptor.kindLabel}附件的目标节点`,
        '更换需求或移除附件后再确认'
      ]
    : [
        ...(descriptor ? [`上传 ${descriptor.name} 并只保留公开 URL / 元数据`] : []),
        `按“${rule.label}”准备目标`,
        recommendation === 'workflow' ? '创建可编辑画板并打开' : '打开推荐快捷工具',
        '等待你在目标页手动提交（本步不执行付费生成）'
      ]
  return {
    prompt: cleanPrompt,
    attachment: descriptor,
    intent: { id: rule.id, label: rule.label, reason },
    recommendation,
    selectedDestination: recommendation,
    destinations,
    steps
  }
}

export const chooseHomeIntentDestination = (plan, destination) => {
  const key = destination === 'quick' ? 'quick' : 'workflow'
  if (!plan?.destinations?.[key] || plan.destinations[key].disabled) return plan
  return { ...plan, selectedDestination: key }
}

const publicAssetUrl = payload => String(
  payload?.public_url || payload?.url || payload?.local_url || ''
).trim()

export const normalizeHomeIntentUploadedAsset = (payload, attachment = {}) => {
  const url = publicAssetUrl(payload)
  if (!url || /^(?:data|blob):/i.test(url)) throw new Error('素材上传后未返回可保存的公开地址')
  return {
    url,
    name: String(payload?.name || attachment?.name || '首页素材').slice(0, 160),
    assetName: String(payload?.asset_name || payload?.file_name || '').slice(0, 180),
    mime: String(payload?.mime || attachment?.mime || ''),
    kind: String(payload?.kind || attachment?.kind || (String(payload?.mime || '').startsWith('video/') ? 'video' : 'image')),
    bytes: Math.max(0, Number(payload?.bytes || attachment?.size || 0)),
    width: Math.max(0, Number(payload?.width || 0)),
    height: Math.max(0, Number(payload?.height || 0))
  }
}

const cloneCanvas = canvas => ({
  nodes: Array.isArray(canvas?.nodes) ? canvas.nodes.map(node => ({
    ...node,
    position: { ...(node.position || {}) },
    data: { ...(node.data || {}) }
  })) : [],
  edges: Array.isArray(canvas?.edges) ? canvas.edges.map(edge => ({ ...edge, data: edge.data ? { ...edge.data } : undefined })) : [],
  viewport: { x: 100, y: 80, zoom: 0.8, ...(canvas?.viewport || {}) }
})

export const buildHomeIntentCanvas = ({ canvas, plan, asset } = {}) => {
  const result = cloneCanvas(canvas)
  if (!asset) return result
  const safeAsset = normalizeHomeIntentUploadedAsset(asset, plan?.attachment)
  const workflowFlow = plan?.destinations?.workflow?.flow || ''
  const consumer = workflowAttachmentConsumer(workflowFlow, safeAsset.kind)
  if (!consumer) throw new Error('当前工作流无法消费该附件')
  const targetNode = result.nodes.find(node => node.type === consumer.targetType)
  if (!targetNode) throw new Error('当前工作流缺少可消费附件的目标节点')
  const occupied = new Set(result.nodes.map(node => node.id))
  let assetNodeId = 'home-intent-asset'
  let suffix = 2
  while (occupied.has(assetNodeId)) assetNodeId = `home-intent-asset-${suffix++}`
  const firstNode = result.nodes[0]
  const position = {
    x: Number(firstNode?.position?.x || 160) - 520,
    y: Number(firstNode?.position?.y || 100)
  }
  const commonData = {
    url: safeAsset.url,
    label: safeAsset.name,
    mime: safeAsset.mime,
    assetName: safeAsset.assetName,
    bytes: safeAsset.bytes,
    width: safeAsset.width,
    height: safeAsset.height,
    homeIntent: plan?.intent?.id || ''
  }
  const assetNode = safeAsset.kind === 'image'
    ? {
        id: assetNodeId,
        type: 'image',
        position,
        data: { ...commonData, publicProps: { name: safeAsset.name } }
      }
    : {
        id: assetNodeId,
        type: 'materialInput',
        position,
        data: {
          ...commonData,
          sourceMode: 'file',
          sourceUrl: '',
          selectedIndex: 0,
          assets: [{
            url: safeAsset.url,
            name: safeAsset.name,
            asset_name: safeAsset.assetName,
            mime: safeAsset.mime,
            bytes: safeAsset.bytes,
            width: safeAsset.width,
            height: safeAsset.height
          }]
        }
      }
  result.nodes = [assetNode, ...result.nodes]
  result.edges = [{
    id: `edge_${assetNodeId}_${targetNode.id}`,
    source: assetNodeId,
    target: targetNode.id,
    sourceHandle: 'right',
    targetHandle: 'left'
  }, ...result.edges]
  return result
}
