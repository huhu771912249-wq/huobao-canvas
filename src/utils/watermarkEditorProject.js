const safeAssetUrl = value => {
  const url = String(value || '').trim()
  return /^(?:https?:\/\/|\/public-assets\/)/i.test(url) ? url : ''
}

const cloneList = value => Array.isArray(value) ? value.map(item => ({ ...item })) : []
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, finiteNumber(value, fallback)))
const finiteTrackTime = (value, fallback) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const clampTrackTime = (value, min, max, fallback) => Math.min(max, Math.max(min, finiteTrackTime(value, fallback)))
const roundTrackTime = value => Number(value.toFixed(3))

export const formatGifEditorTrackTime = value => {
  const time = finiteTrackTime(value, Number.NaN)
  return Number.isFinite(time) ? time.toFixed(1) : '—'
}

export const normalizeGifEditorTrackRange = (track = {}, sourceDuration, updates = {}) => {
  const duration = clampTrackTime(sourceDuration, 0.1, 3600, 3)
  const hasStartUpdate = Object.hasOwn(updates, 'start')
  const hasEndUpdate = Object.hasOwn(updates, 'end')
  const currentStart = clampTrackTime(track.start, 0, duration, 0)
  const currentEnd = clampTrackTime(track.end, 0, duration, duration)
  let start = clampTrackTime(hasStartUpdate ? updates.start : track.start, 0, duration, currentStart)
  let end = clampTrackTime(hasEndUpdate ? updates.end : track.end, 0, duration, currentEnd)
  const minimumGap = Math.min(0.1, duration)

  if (end - start < minimumGap) {
    if (hasStartUpdate && !hasEndUpdate) {
      start = Math.max(0, end - minimumGap)
    } else {
      end = Math.min(duration, start + minimumGap)
      if (end - start < minimumGap) {
        end = duration
        start = Math.max(0, end - minimumGap)
      }
    }
  }

  return { start: roundTrackTime(start), end: roundTrackTime(end) }
}

export const isGifEditorTrackActive = (track, playhead, sourceDuration) => {
  const currentTime = finiteTrackTime(playhead, -1)
  const range = normalizeGifEditorTrackRange(track, sourceDuration)
  return currentTime >= range.start && currentTime <= range.end
}

export const createGifEditorTrackTimeDraftStore = ({ onChange = () => {} } = {}) => {
  const drafts = new Map()
  const runtimeIdentities = new WeakMap()
  let runtimeSequence = 0

  const trackIdentity = (type, track) => {
    const trackType = String(type || 'track')
    const trackId = String(track?.id || '').trim()
    if (trackId) return `${trackType}:${trackId}`
    if (track && typeof track === 'object') {
      if (!runtimeIdentities.has(track)) runtimeIdentities.set(track, `runtime-${++runtimeSequence}`)
      return `${trackType}:${runtimeIdentities.get(track)}`
    }
    return `${trackType}:missing`
  }
  const draftKey = (type, track, field) => `${trackIdentity(type, track)}:${field}`
  const notify = () => onChange()

  return {
    get: (type, track, field) => {
      const key = draftKey(type, track, field)
      return drafts.has(key) ? drafts.get(key) : track?.[field] ?? ''
    },
    set: (type, track, field, value) => {
      drafts.set(draftKey(type, track, field), value)
      notify()
    },
    clearField: (type, track, field) => {
      if (drafts.delete(draftKey(type, track, field))) notify()
    },
    clearTrack: (type, track) => {
      const prefix = `${trackIdentity(type, track)}:`
      let changed = false
      for (const key of drafts.keys()) {
        if (key.startsWith(prefix)) changed = drafts.delete(key) || changed
      }
      if (changed) notify()
    },
    clearAll: () => {
      if (!drafts.size) return
      drafts.clear()
      notify()
    }
  }
}

const withStableTrackIds = (value, type) => {
  const tracks = cloneList(value)
  const reservedIds = new Set(tracks.map(track => String(track.id || '').trim()).filter(Boolean))
  const assignedIds = new Set()
  return tracks.map((track, index) => {
    const explicitId = String(track.id || '').trim()
    if (explicitId && !assignedIds.has(explicitId)) {
      assignedIds.add(explicitId)
      return { ...track, id: explicitId }
    }
    const baseId = explicitId || `legacy-${type}-${index + 1}`
    let id = baseId
    let suffix = 2
    while (reservedIds.has(id) || assignedIds.has(id)) id = `${baseId}-${suffix++}`
    assignedIds.add(id)
    return { ...track, id }
  })
}

const sourceKind = (url, mime) => (
  String(mime || '').toLowerCase() === 'image/gif' || /\.gif(?:$|\?)/i.test(url) ? 'gif' : 'video'
)

export const GIF_TEXT_STYLE_PRESETS = Object.freeze({
  '爆款白字': Object.freeze({
    color: '#ffffff', strokeColor: '#111111', strokeWidth: 4,
    background: false, backgroundColor: '#000000', backgroundOpacity: 0
  }),
  '高亮黄字': Object.freeze({
    color: '#fde047', strokeColor: '#111111', strokeWidth: 3,
    background: false, backgroundColor: '#000000', backgroundOpacity: 0
  }),
  '字幕黑底': Object.freeze({
    color: '#ffffff', strokeColor: '#111111', strokeWidth: 0,
    background: true, backgroundColor: '#000000', backgroundOpacity: 0.72
  })
})

const DEFAULT_TEXT_STYLE = '爆款白字'

/* --- gif editor preview/backend contract --- */
/*
 * 预览必须和后端 ffmpeg 走同一套换算，否则「调参数 → 看预览 → 导出」这条工作流就退化成
 * 「导出 → 下载 → 看 → 改 → 再导出」。下面这一段是**唯一**的换算实现：
 * GifAdEditor.vue 的行内样式和 buildGifEditorJobPayload 的 payload 都从这里取值，
 * tests/gifPreviewBackendParity.test.mjs 逐格和后端公式对拍。
 *
 * 后端事实源（guanxi-canvas-backend，另一个仓库，所以只能镜像 + 注明出处）：
 *
 *   video_resize_pipeline.py `_text_track_filter`
 *     fontsize={font_size:.2f}                      ← 输出分辨率下的**绝对像素**，不是百分比
 *     x=max(0,min(w-text_w, w*{x/100}-text_w/2))    ← 文字是**中心锚**
 *     y=max(0,min(h-text_h, h*{y/100}-text_h/2))
 *     borderw={stroke_width} / bordercolor / fontcolor 全部来自 track 自身字段
 *     选项列表里**没有** shadowcolor/shadowx/shadowy —— 文字轨道永远没有投影
 *     文案原样写进 textfile，drawtext 只按文件里的 \n 断行，不会自动折行
 *
 *   video_resize_pipeline.py `_watermark_position`（position 不在预设表里时走 custom 分支）
 *     x=(W-w)*{x/100}  y=(H-h)*{y/100}              ← 图片水印是**左上锚 + 按比例内缩**
 *   video_resize_pipeline.py `run_target`
 *     watermark_width = round(W * width/100)，高度 scale=w:-1 按原图比例
 *
 *   video_resize_pipeline.py `_filter`
 *     blur / contain → force_original_aspect_ratio=decrease（整帧保留，不裁切）
 *     其余（center） → force_original_aspect_ratio=increase,crop（裁切）
 *     blur 额外叠一层 boxblur=20 的铺满背景
 *
 *   video_resize_jobs.py `_required_color` / `_validated_text_tracks`
 *     color / stroke_color 必须是 #rrggbb（小写），stroke_width 0–32
 */

/** 后端 `_required_color` 的镜像：合法就归一成小写 #rrggbb，否则回退。 */
export const normalizeGifTextColor = (value, fallback = '#ffffff') => {
  const raw = String(value ?? '').trim().toLowerCase()
  const shorthand = /^#([0-9a-f]{3})$/.exec(raw)
  const color = shorthand ? `#${[...shorthand[1]].map(part => part + part).join('')}` : raw
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback
}

/**
 * 一条文字轨道最终生效的外观。item 自带的值优先，缺失/非法才回落到预设。
 * 预览和导出 payload 共用它 —— 只要它们都从这里取值，两边就不可能各画各的。
 */
export const resolveGifTextTrackStyle = track => {
  const preset = GIF_TEXT_STYLE_PRESETS[track?.style] || GIF_TEXT_STYLE_PRESETS[DEFAULT_TEXT_STYLE]
  return {
    color: normalizeGifTextColor(track?.color, preset.color),
    strokeColor: normalizeGifTextColor(track?.strokeColor, preset.strokeColor),
    strokeWidth: clamp(track?.strokeWidth, 0, 32, preset.strokeWidth),
    background: typeof track?.background === 'boolean' ? track.background : preset.background,
    backgroundColor: normalizeGifTextColor(track?.backgroundColor, preset.backgroundColor),
    backgroundOpacity: clamp(track?.backgroundOpacity, 0, 1, preset.backgroundOpacity)
  }
}

/** 后端 fontsize 是输出高度下的绝对像素；舞台是输出画面的等比缩放，于是 1cqh = 输出高度的 1%。 */
export const gifPreviewFontSizeCqh = (fontSize, outputHeight) => {
  const height = Number(outputHeight)
  if (!Number.isFinite(height) || height <= 0) return 0
  return clamp(fontSize, 0, 512, 32) / height * 100
}

/**
 * 文字叠加层的预览样式。`left/top` 百分比按舞台宽/高解析，`translate(-50%,-50%)`
 * 按元素自身宽高解析，合起来正好是后端的 `w*x-text_w/2` / `h*y-text_h/2`。
 */
export const gifPreviewTextOverlayStyle = (track, { outputHeight, fontFamily } = {}) => {
  const style = resolveGifTextTrackStyle(track)
  return {
    left: `${clamp(track?.x, 0, 100, 50)}%`,
    top: `${clamp(track?.y, 0, 100, 50)}%`,
    transform: 'translate(-50%, -50%)',
    color: style.color,
    fontSize: `${gifPreviewFontSizeCqh(track?.fontSize, outputHeight)}cqh`,
    ...(fontFamily ? { fontFamily } : {}),
    WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
    backgroundColor: style.background
      ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, '0')}`
      : 'transparent',
    // drawtext 的 boxborderw ≈ font_size*0.2，四边等宽 —— 等宽才不会把居中锚点推歪。
    padding: style.background ? '0.2em' : '0',
    // drawtext 只认文案里的 \n，不会自动折行，也从不加投影 —— 预览必须一样。
    whiteSpace: 'pre',
    textShadow: 'none'
  }
}

/**
 * 图片水印的预览样式。后端 custom 分支是 `(W-w)*x/100`，也就是左上锚按比例内缩；
 * `translate(-x%, -y%)`（百分比按元素自身宽高解析）把 `left:x%` 精确拉回同一个位置。
 * x=y=50 时退化成居中，和后端 `center` 预设的 `(W-w)/2` 也对得上。
 */
export const gifPreviewImageOverlayStyle = track => {
  const x = clamp(track?.x, 0, 100, 82)
  const y = clamp(track?.y, 0, 100, 12)
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: `${clamp(track?.size, 1, 100, 22)}%`,
    transform: `translate(${-x}%, ${-y}%)`,
    opacity: clamp(track?.opacity, 0, 100, 100) / 100
  }
}

/**
 * 图片水印的导出 payload。x/y/size 的夹取和 gifPreviewImageOverlayStyle 走同一套，
 * 预览摆在哪儿，后端就得摆在哪儿。position 固定 'custom'，正是为了走
 * `_watermark_position` 那个按比例内缩的分支（预设分支是固定 3% 边距，和百分比无关）。
 */
export const buildGifEditorWatermarkPayload = (track, { imageUrl, range, sourceDuration } = {}) => {
  const url = String(imageUrl ?? track?.url ?? '')
  if (!url) return null
  const duration = clampTrackTime(sourceDuration, 0.1, 3600, 3)
  const span = range || normalizeGifEditorTrackRange(track, duration)
  return {
    image_url: url,
    position: 'custom',
    x: clamp(track?.x, 0, 100, 82),
    y: clamp(track?.y, 0, 100, 12),
    width: clamp(track?.size, 1, 100, 22),
    opacity: clamp(track?.opacity, 0, 100, 100) / 100,
    start: span.start,
    ...(span.end < duration - 0.05 ? { end: span.end } : {})
  }
}

/** `_filter`：blur/contain 保留整帧（object-fit:contain），其余裁切（cover）。 */
export const gifPreviewMediaFit = fitMode => (
  ['blur', 'contain'].includes(String(fitMode || '')) ? 'contain' : 'cover'
)

/** blur 档位后端会额外铺一层 boxblur 背景，预览也得有。 */
export const gifPreviewUsesBlurBackdrop = fitMode => String(fitMode || '') === 'blur'

/** contain 的留边后端写死 `color=black`，预览的舞台底色必须同色。 */
export const gifPreviewStageBackground = fitMode => (
  gifPreviewUsesBlurBackdrop(fitMode) ? 'transparent' : '#000000'
)

/**
 * 后端 `_validated_watermark` 只收**一个** watermark 对象，payload 也是单对象。
 * UI 能加任意多张、侧栏/时间轴/预览全渲染，但导出只挑一张 —— 这里把它变成显式报错。
 */
export const MAX_GIF_EDITOR_IMAGE_WATERMARKS = 1

export const findGifEditorWatermarkOverflow = imageTracks => {
  const usable = (Array.isArray(imageTracks) ? imageTracks : []).filter(item => safeAssetUrl(item?.url))
  if (usable.length <= MAX_GIF_EDITOR_IMAGE_WATERMARKS) return ''
  return `后端一次只能合成 ${MAX_GIF_EDITOR_IMAGE_WATERMARKS} 张图片水印，当前有 ${usable.length} 张。`
    + '请先删除多余的图片轨道再导出，否则只有一张会被真正合成。'
}
/* --- end gif editor preview/backend contract --- */

const sanitizeTextTracks = (value, sourceDuration) => withStableTrackIds(cloneList(value).slice(0, 8), 'text').map(item => {
  const track = { ...item }
  const range = normalizeGifEditorTrackRange(item, sourceDuration)
  const style = Object.hasOwn(GIF_TEXT_STYLE_PRESETS, item.style) ? item.style : DEFAULT_TEXT_STYLE
  const appearance = resolveGifTextTrackStyle({ ...item, style })
  delete track.effect
  return {
    ...track,
    text: String(item.text || '').slice(0, 80),
    ...range,
    x: clamp(item.x, 0, 100, 50),
    y: clamp(item.y, 0, 100, 50),
    fontSize: clamp(item.fontSize, 8, 200, 32),
    style,
    ...appearance
  }
})

export const buildGifEditorTextTracks = (value, sourceDuration) => {
  const tracks = cloneList(value)
  if (tracks.length > 8) throw new TypeError('文字轨道最多 8 条')
  const duration = Number(sourceDuration)
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('源素材时长无效')

  return tracks.map((item, index) => {
    const text = String(item.text || '').trim()
    if (!text) throw new TypeError(`第 ${index + 1} 条文字文案不能为空`)
    const start = Number(item.start)
    const end = Number(item.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 0.001) {
      throw new TypeError(`第 ${index + 1} 条文字时间范围无效`)
    }
    // 后端 video_resize_jobs.py:157 本来就收任意 #rrggbb 和 0–32 描边宽度，
    // 所以 item 上的自定义值优先，只有缺失/非法才回落到预设。
    const style = resolveGifTextTrackStyle(item)
    return {
      text,
      start,
      end,
      x: clamp(item.x, 0, 100, 50),
      y: clamp(item.y, 0, 100, 50),
      font_size: clamp(item.fontSize, 8, 200, 32),
      color: style.color,
      stroke_color: style.strokeColor,
      stroke_width: style.strokeWidth,
      background: style.background,
      background_color: style.backgroundColor,
      background_opacity: style.backgroundOpacity,
      align: 'center'
    }
  })
}

/** 后端 `_validated_request` 只认这三档（外加前端不暴露的 smart）。 */
export const GIF_EDITOR_FIT_MODES = Object.freeze(['contain', 'blur', 'center'])

const clampFitMode = (value, fallback = 'contain') => (
  GIF_EDITOR_FIT_MODES.includes(String(value || '')) ? String(value) : fallback
)

export const createDefaultWatermarkEditorProject = ({ title = 'GIF 水印工程' } = {}) => ({
  version: 2,
  title,
  clips: [],
  textTracks: [],
  imageTracks: [],
  watermarkLibrary: [],
  output: { presetKey: 'vertical', cornerRadius: 0, fps: 12, colors: 128, loop: 'forever', fitMode: 'contain' },
  quickSettings: { watermarkId: '', position: 'top-right', size: 22, opacity: 92 },
  result: { jobId: '', status: '', progress: 0, outputUrl: '', error: '', metadata: {} }
})

export const createWatermarkEditorProjectForSource = ({
  title,
  url,
  mime,
  label,
  duration,
  width,
  height
} = {}) => {
  const project = createDefaultWatermarkEditorProject({ title })
  const sourceUrl = safeAssetUrl(url)
  if (!sourceUrl) return project
  project.clips = [{
    id: 'source-clip',
    name: String(label || sourceUrl.split('/').pop() || '上游素材').slice(0, 120),
    kind: sourceKind(sourceUrl, mime),
    duration: clamp(duration, 0.1, 3600, 3),
    url: sourceUrl,
    mime: String(mime || ''),
    width: Math.max(0, Math.round(finiteNumber(width, 0))),
    height: Math.max(0, Math.round(finiteNumber(height, 0)))
  }]
  return project
}

export const sanitizeWatermarkEditorProject = value => {
  const fallback = createDefaultWatermarkEditorProject({ title: value?.title })
  const clips = cloneList(value?.clips)
    .map(clip => ({
      ...clip,
      url: safeAssetUrl(clip.url),
      kind: sourceKind(clip.url, clip.mime),
      duration: clamp(clip.duration, 0.1, 3600, 3)
    }))
    .filter(clip => clip.url)
    .slice(0, 1)
  const sourceDuration = clips.reduce((total, clip) => total + clip.duration, 0) || 3
  const imageTracks = withStableTrackIds(value?.imageTracks, 'image').map(item => {
    const range = normalizeGifEditorTrackRange(item, sourceDuration)
    return {
      ...item,
      url: safeAssetUrl(item.url),
      ...range,
      size: clamp(item.size, 1, 100, 22),
      opacity: clamp(item.opacity, 0, 100, 100),
      x: clamp(item.x, 0, 100, 82),
      y: clamp(item.y, 0, 100, 12)
    }
  }).filter(item => item.url)
  const textTracks = sanitizeTextTracks(value?.textTracks, sourceDuration)
  const watermarkLibrary = imageTracks
    .filter(item => item.saved)
    .map(item => ({ id: item.id, name: item.name, kind: 'image', url: item.url }))
  const result = value?.result || {}

  return {
    version: 2,
    title: String(value?.title || fallback.title).slice(0, 80),
    clips,
    textTracks,
    imageTracks,
    watermarkLibrary,
    output: {
      ...fallback.output,
      ...(value?.output || {}),
      cornerRadius: clamp(value?.output?.cornerRadius, 0, 50, fallback.output.cornerRadius),
      fps: clamp(value?.output?.fps, 1, 60, fallback.output.fps),
      colors: clamp(value?.output?.colors, 2, 256, fallback.output.colors),
      fitMode: clampFitMode(value?.output?.fitMode, fallback.output.fitMode)
    },
    quickSettings: { ...fallback.quickSettings, ...(value?.quickSettings || {}) },
    result: {
      jobId: String(result.jobId || ''),
      status: String(result.status || ''),
      progress: clamp(result.progress, 0, 100, 0),
      outputUrl: safeAssetUrl(result.outputUrl),
      error: String(result.error || '').slice(0, 500),
      metadata: result.metadata && typeof result.metadata === 'object' ? { ...result.metadata } : {}
    }
  }
}

const emptyEditorResult = () => ({
  jobId: '', status: '', progress: 0, outputUrl: '', error: '', metadata: {}
})

const quickSettingPositions = {
  'top-left': [18, 12],
  'top-right': [82, 12],
  'bottom-left': [18, 88],
  'bottom-right': [82, 88],
  center: [50, 50]
}

/**
 * 画布节点上的 4 个快捷控件指向哪一条图片轨道。
 *
 * 历史 bug：节点默认 `watermarkId: 'image-1'`，而编辑器生成的 id 从 `image-11` 起
 * （GifAdEditor.vue 的 sequence 从 10 开始），于是这个引用永远悬空 —— 节点上的
 * 大小/透明度/位置滑块「改了等于没改」，但拨一下就会触发 shouldInvalidate 把已合成的
 * 成品清空，成了「能毁不能改」。默认值已改成空串；这里再补一层：引用匹配不到任何轨道时
 * 回退到第一条图片轨道，让快捷控件至少作用在用户看得见的那张水印上。
 */
const resolveQuickSettingsTargetId = (project, watermarkId) => {
  const id = String(watermarkId || '')
  if (id && project.imageTracks.some(item => item.id === id)) return id
  return project.imageTracks[0]?.id || ''
}

const mergeNodeQuickSettings = (project, nodeQuickSettings) => {
  const incoming = nodeQuickSettings && typeof nodeQuickSettings === 'object' ? nodeQuickSettings : {}
  const quickSettings = { ...project.quickSettings, ...incoming }
  const changedKeys = new Set(['watermarkId', 'position', 'size', 'opacity'].filter(key => (
    Object.prototype.hasOwnProperty.call(incoming, key)
    && incoming[key] !== project.quickSettings[key]
  )))
  if (!changedKeys.size) return { ...project, quickSettings }

  const coordinates = quickSettingPositions[quickSettings.position]
  const targetId = resolveQuickSettingsTargetId(project, quickSettings.watermarkId)
  return {
    ...project,
    quickSettings,
    imageTracks: project.imageTracks.map(item => item.id === targetId
      ? {
          ...item,
          ...(coordinates && (changedKeys.has('position') || changedKeys.has('watermarkId'))
            ? { x: coordinates[0], y: coordinates[1] }
            : {}),
          ...(changedKeys.has('size') || changedKeys.has('watermarkId')
            ? { size: Number(quickSettings.size || item.size || 22) }
            : {}),
          ...(changedKeys.has('opacity') || changedKeys.has('watermarkId')
            ? { opacity: Number(quickSettings.opacity ?? item.opacity ?? 92) }
            : {})
        }
      : item)
  }
}

export const restoreWatermarkEditorProject = ({ savedProject, sourceProject, nodeData = {} } = {}) => {
  const saved = sanitizeWatermarkEditorProject(savedProject)
  const currentSource = sanitizeWatermarkEditorProject(sourceProject)
  const savedSourceUrl = String(saved.clips[0]?.url || '')
  const currentSourceUrl = String(currentSource.clips[0]?.url || '')
  const sourceChanged = Boolean(savedSourceUrl && currentSourceUrl && savedSourceUrl !== currentSourceUrl)
  const sourceAligned = mergeNodeQuickSettings({
    ...saved,
    clips: sourceChanged || !saved.clips.length ? currentSource.clips : saved.clips,
    result: sourceChanged ? emptyEditorResult() : saved.result
  }, nodeData.quickSettings)
  const canRestoreResult = !sourceChanged && nodeData.editorStatus !== 'draft'
  const storedResult = canRestoreResult ? sourceAligned.result : emptyEditorResult()
  const result = {
    ...storedResult,
    jobId: canRestoreResult ? String(nodeData.outputJobId || storedResult.jobId || '') : '',
    status: canRestoreResult ? String(nodeData.editorStatus || storedResult.status || '') : '',
    outputUrl: canRestoreResult && nodeData.compositionReady
      ? String(nodeData.outputUrl || storedResult.outputUrl || '')
      : '',
    metadata: canRestoreResult && nodeData.compositionReady
      ? { ...(nodeData.outputMetadata || storedResult.metadata || {}) }
      : {}
  }
  const project = sanitizeWatermarkEditorProject({ ...sourceAligned, result })
  return {
    project,
    sourceChanged,
    compositionReady: Boolean(
      project.result.status === 'completed'
      && project.result.jobId
      && project.result.outputUrl
    )
  }
}

export const getWatermarkEditorSource = project => sanitizeWatermarkEditorProject(project).clips[0] || null

export const isWatermarkEditorJobTerminal = status => ['completed', 'failed', 'cancelled'].includes(String(status || '').toLowerCase())
