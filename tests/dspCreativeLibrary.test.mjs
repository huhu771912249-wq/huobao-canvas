import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_DSP_MEDIA_TYPES,
  DEFAULT_DSP_THRESHOLDS,
  DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL,
  DSP_GIF_VARIANTS,
  MAX_DSP_SELECTED_IDS,
  MAX_DSP_IDENTIFIER_LENGTH,
  buildDspCreativeCancelUrl,
  buildDspCreativeCleanupUrl,
  buildDspCreativeConfirmUrl,
  buildDspCreativeCopyUrl,
  buildDspCreativeDeleteUrl,
  buildDspCreativeAutoRefreshUrl,
  buildDspCreativeImportUrl,
  buildDspH3UpgradeUrl,
  buildDspH3UpgradeActionUrl,
  buildDspCreativeExperimentBindingsUrl,
  buildDspCreativeExperimentRefreshUrl,
  buildDspCreativeJobUrl,
  buildDspCreativeJobsUrl,
  buildDspCreativeLibraryPersistence,
  buildDspCreativePreviewPayload,
  buildDspGifPreviewCatalog,
  buildDspPreviewFilterSignature,
  buildDspCreativePreviewUrl,
  buildFrwCostSummary,
  buildSelectableDspCandidateRows,
  canCancelDspCreativeJob,
  canCleanupDspCreativeJob,
  canConfirmDspCreativeJob,
  canImportDspPreview,
  canRetryDspCreativeJob,
  clearDspCreativePreviewState,
  getDefaultShanghaiDateRange,
  getDspCreativeCandidates,
  getDspCreativeCandidateId,
  formatDspCandidateCtrPercent,
  getDspCreativeDownloadUrl,
  getDspCreativeExpectedGifCount,
  getDspCreativeGifDownloads,
  getDspCreativeGenerationResults,
  getDspCreativeJobMediaTypes,
  getDspCreativeJobSearchText,
  getDspCreativeStepLabel,
  getDspCreativeJobs,
  getDspCreativeJobId,
  getDspCreativeProgress,
  getDspH3Eligibility,
  getDspH3ViewState,
  getSampleRiskWarning,
  formatDspAutoRefreshShanghaiTime,
  isDspCreativeJobActive,
  isDspCreativeQualityBlocked,
  isDspCreativeJobTerminal,
  isDspPreviewResponseCurrent,
  matchesDspJobStatusFilter,
  normalizeDspDimensions,
  normalizeDspMediaTypes,
  resolveDspDimensionSelection,
  resolveDspFrwCostSummary,
  resolveTaskCenterPreferences,
  sanitizeDspCreativeAutoRefreshStatus,
  sanitizeDspCreativeCanvasNodeData,
  sanitizeTaskCenterPersistence,
  sortSelectableDspCandidateRows,
  shouldPauseDspAutoRefreshStatus,
  shouldPollDspCreativeJob
} from '../src/utils/dspCreativeLibrary.js'
import {
  cancelDspCreativeJob,
  cleanupDspCreativePublicFiles,
  confirmDspCreativeJob,
  deleteDspCreativeJob,
  getDspCreativeAutoRefreshStatus,
  getDspCreativeJob,
  importDspCreatives,
  listDspCreativeJobs,
  previewDspCreatives,
  updateDspCreativeCopy
} from '../src/api/dspCreativeLibrary.js'

assert.deepEqual(DEFAULT_DSP_MEDIA_TYPES, ['BANNER', 'NATIVE', 'VIDEO'])
assert.deepEqual(DSP_GIF_VARIANTS, ['A', 'B', 'C', 'D', 'E'])
assert.equal(DEFAULT_DSP_MEDIA_TYPES.includes('POP'), false)
assert.equal(MAX_DSP_SELECTED_IDS, 50)
assert.equal(MAX_DSP_IDENTIFIER_LENGTH, 512)
assert.equal(DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL, 60_000)
assert.deepEqual(normalizeDspMediaTypes(undefined), ['BANNER', 'NATIVE', 'VIDEO'])
assert.deepEqual(normalizeDspMediaTypes([]), [])
assert.deepEqual(DEFAULT_DSP_THRESHOLDS, {
  minImpressions: 1000,
  minClicks: 20,
  topN: 10
})
assert.equal(isDspCreativeQualityBlocked({
  quality_gate: {
    passed: false,
    reason: 'source_text_redraw_risk'
  }
}), true)
assert.equal(isDspCreativeQualityBlocked({
  frw_status: 'blocked'
}), true)
assert.equal(isDspCreativeQualityBlocked({
  quality_gate: {
    passed: true,
    reason: ''
  },
  frw_status: 'not_confirmed'
}), false)
assert.equal(getDspCreativeStepLabel({ status: 'completed' }), '任务已完成')
assert.equal(getDspCreativeStepLabel({ status: 'failed' }), '任务失败')
assert.equal(
  getDspCreativeStepLabel({ status: 'completed', current_step: '素材裂变完成' }),
  '素材裂变完成'
)
const sortableCandidates = buildSelectableDspCandidateRows([
  {
    candidate_key: 'candidate-b',
    creative_id: 'creative-b',
    media_type: 'BANNER',
    width: 300,
    height: 100,
    impressions: 100,
    clicks: 8,
    ctr: 0.08,
    spend: 12,
    wilson_ctr: 0.05
  },
  {
    candidate_key: 'candidate-a',
    creative_id: 'creative-a',
    media_type: 'NATIVE',
    width: 200,
    height: 200,
    impressions: 200,
    clicks: 10,
    ctr: 0.05,
    spend: 9,
    wilson_ctr: 0.03
  }
])
assert.deepEqual(
  sortSelectableDspCandidateRows(
    sortableCandidates,
    'impressions',
    'desc'
  ).map((row) => row.id),
  ['candidate-a', 'candidate-b']
)
assert.deepEqual(
  sortSelectableDspCandidateRows(
    sortableCandidates,
    'creative',
    'asc'
  ).map((row) => row.id),
  ['candidate-a', 'candidate-b']
)
assert.deepEqual(
  sortableCandidates.map((row) => row.id),
  ['candidate-b', 'candidate-a'],
  '排序不得原地修改候选列表'
)
assert.equal(
  formatDspCandidateCtrPercent({
    impressions: 201286,
    clicks: 1909,
    ctr: 0.9484
  }),
  '0.95%'
)
assert.equal(
  formatDspCandidateCtrPercent({ impressions: 0, clicks: 0, ctr: 0.52 }),
  '0.52%'
)
const normalizedDimensionSet = normalizeDspDimensions([
  'bad',
  '300x100',
  '300x100',
  ...Array.from({ length: 60 }, (_, index) => `${400 + index}x200`)
])
assert.equal(normalizedDimensionSet.length, 50)
assert.equal(normalizedDimensionSet.includes('bad'), false)
assert.equal(new Set(normalizedDimensionSet).size, normalizedDimensionSet.length)
assert.deepEqual(
  resolveDspDimensionSelection([]),
  ['300x100', '300x250', '720x240', '200x200'],
  '旧项目保存空尺寸时必须恢复默认投放尺寸'
)
assert.deepEqual(
  resolveDspDimensionSelection(['300x250', 'bad']),
  ['300x250'],
  '有效的自定义尺寸必须保留'
)

assert.deepEqual(
  getDefaultShanghaiDateRange(new Date('2026-07-24T03:30:00.000Z')),
  {
    startDate: '2026-07-17',
    endDate: '2026-07-24',
    timezone: 'Asia/Shanghai'
  }
)

assert.deepEqual(
  buildDspCreativePreviewPayload({
    now: new Date('2026-07-24T03:30:00.000Z'),
    mediaTypes: ['POP', 'VIDEO', 'BANNER', 'VIDEO'],
    dimensions: ['300x250', ' 720x240 ', 'bad'],
    account: '  acct-01  ',
    minImpressions: 99,
    minClicks: 2,
    topN: 99
  }),
  {
    start: '2026-07-17',
    end: '2026-07-24',
    media_types: ['BANNER', 'VIDEO'],
    dimensions: ['300x250', '720x240'],
    account_id: 'acct-01',
    min_impressions: 99,
    min_clicks: 2,
    top_per_group: 50
  }
)
assert.deepEqual(
  buildDspCreativePreviewPayload({
    now: new Date('2026-07-24T03:30:00.000Z'),
    mediaTypes: ['BANNER'],
    dimensions: []
  }),
  {
    start: '2026-07-17',
    end: '2026-07-24',
    media_types: ['BANNER'],
    account_id: '',
    min_impressions: 1000,
    min_clicks: 20,
    top_per_group: 10
  }
)

assert.equal(
  getSampleRiskWarning({ minImpressions: 999, minClicks: 20 }),
  '当前门槛低于默认值，存在小样本风险'
)
assert.equal(getSampleRiskWarning({ minImpressions: 1000, minClicks: 20 }), '')
assert.equal(
  buildDspCreativeAutoRefreshUrl(),
  'http://127.0.0.1:8788/v1/dsp-creatives/auto-refresh'
)
assert.deepEqual(
  sanitizeDspCreativeAutoRefreshStatus({
    enabled: true,
    status: 'running',
    timezone: 'Asia/Shanghai',
    last_started: '2026-07-25T09:59:00+08:00',
    last_finished: '2026-07-25T10:01:00+08:00',
    last_success: '2026-07-25T10:01:00+08:00',
    next_run: '2026-07-28T10:00:00+08:00',
    retry_count: 2,
    catalog_size: 123,
    candidate_count: 40,
    added_count: 5,
    updated_count: 6,
    unchanged_count: 29,
    analysis_reused_count: 30,
    analysis_generated_count: 10,
    failed_count: 1,
    error: '上次有 1 条素材处理失败',
    state_path: '/Users/private/state.json',
    api_key: 'sk-must-not-survive',
    source_url: 'https://upstream.example/?token=secret'
  }),
  {
    enabled: true,
    status: 'running',
    timezone: 'Asia/Shanghai',
    lastStarted: '2026-07-25T09:59:00+08:00',
    lastFinished: '2026-07-25T10:01:00+08:00',
    lastSuccess: '2026-07-25T10:01:00+08:00',
    nextRun: '2026-07-28T10:00:00+08:00',
    retryCount: 2,
    catalogSize: 123,
    candidateCount: 40,
    addedCount: 5,
    updatedCount: 6,
    unchangedCount: 29,
    analysisReusedCount: 30,
    analysisGeneratedCount: 10,
    failedCount: 1,
    error: '上次有 1 条素材处理失败'
  }
)
const unsafeAutoRefreshStatus = sanitizeDspCreativeAutoRefreshStatus({
  enabled: 'true',
  status: 'unknown',
  timezone: '/etc/localtime',
  last_success: '2026-07-25T10:00:00',
  next_run: 'file:///Users/private/next-run',
  retry_count: -1,
  catalog_size: 9_999_999,
  candidate_count: true,
  added_count: 1.5,
  updated_count: 2,
  unchanged_count: 3,
  analysis_reused_count: 4,
  analysis_generated_count: 5,
  failed_count: 6,
  error: '读取 /Users/private/state.json；Authorization：Bearer secret'
})
assert.deepEqual(unsafeAutoRefreshStatus, {
  enabled: false,
  status: 'error',
  timezone: 'Asia/Shanghai',
  lastStarted: '',
  lastFinished: '',
  lastSuccess: '',
  nextRun: '',
  retryCount: 0,
  catalogSize: 1_000_000,
  candidateCount: 0,
  addedCount: 0,
  updatedCount: 2,
  unchangedCount: 3,
  analysisReusedCount: 4,
  analysisGeneratedCount: 5,
  failedCount: 6,
  error: '自动更新状态异常（敏感详情已隐藏）'
})
for (const error of [
  '读取/Users/private/state.json失败',
  'open state/catalog.json failed',
  'refreshToken=abc',
  'clientSecret=abc',
  'Bearer abc',
  'password=abc',
  'access_key=abc',
  'credential=abc',
  './state/catalog',
  '../state/catalog',
  '127.0.0.1:8788/refresh',
  'api.example.com/v1'
]) {
  assert.equal(
    sanitizeDspCreativeAutoRefreshStatus({
      enabled: true,
      status: 'error',
      error
    }).error,
    '自动更新状态异常（敏感详情已隐藏）'
  )
}
assert.equal(
  sanitizeDspCreativeAutoRefreshStatus({
    enabled: true,
    status: 'error',
    error: '体育/赛事素材更新失败'
  }).error,
  '体育/赛事素材更新失败'
)
assert.equal(shouldPauseDspAutoRefreshStatus({
  mounted: true,
  requestInFlight: false,
  actionBusy: '',
  jobStatus: 'idle'
}), false)
for (const jobStatus of [
  'queued',
  'downloading',
  'reversing',
  'confirmed',
  'generating',
  'packaging',
  'running'
]) {
  assert.equal(
    shouldPauseDspAutoRefreshStatus({
      mounted: true,
      requestInFlight: false,
      actionBusy: '',
      jobStatus
    }),
    true,
    `${jobStatus} 期间不得并发读取自动更新状态`
  )
}
for (const state of [
  { mounted: false },
  { requestInFlight: true },
  { previewing: true },
  { importing: true },
  { confirming: true },
  { actionBusy: 'preview' }
]) {
  assert.equal(
    shouldPauseDspAutoRefreshStatus({
      mounted: true,
      requestInFlight: false,
      actionBusy: '',
      jobStatus: 'idle',
      ...state
    }),
    true
  )
}
assert.equal(
  sanitizeDspCreativeAutoRefreshStatus({
    enabled: true,
    status: 'error',
    error: '体育/赛事素材更新失败'
  }).error,
  '体育/赛事素材更新失败'
)
assert.equal(
  formatDspAutoRefreshShanghaiTime('2026-07-25T02:00:00Z'),
  '2026年07月25日 10:00'
)
assert.equal(formatDspAutoRefreshShanghaiTime('2026-07-25T10:00:00'), '未记录')
assert.equal(formatDspAutoRefreshShanghaiTime('file:///tmp/run'), '未记录')
assert.equal(getDspCreativeProgress({ progress: 0.437 }), 44)
assert.equal(getDspCreativeProgress({ completed_count: 3, total_count: 4 }), 75)
assert.equal(getDspCreativeProgress({ status: 'completed', progress: 0 }), 100)
assert.equal(
  getDspCreativeProgress({
    status: 'generating',
    progress_percent: 45,
    progress: 100
  }),
  45,
  'canonical backend progress must override stale legacy 100%'
)
assert.equal(
  getDspCreativeProgress({
    status: 'generating',
    source_count: 2,
    generations: [
      { call_key: 'a', status: 'completed' },
      { call_key: 'b', status: 'submitted' }
    ]
  }),
  45,
  'legacy jobs must infer FRW progress from terminal calls'
)
assert.equal(
  getDspCreativeProgress({ status: 'completed_with_errors', progress: 0 }),
  100,
  'all terminal base jobs must report terminal progress'
)
assert.equal(
  buildDspH3UpgradeUrl('job/a'),
  `${buildDspCreativeJobUrl('job/a')}/h3-upgrades`
)
assert.equal(
  buildDspH3UpgradeActionUrl('job/a', 'h3up/1', 'retry'),
  `${buildDspCreativeJobUrl('job/a')}/h3-upgrades/h3up%2F1/retry`
)
assert.deepEqual(
  getDspH3Eligibility({
    experiment_metrics: {
      status: 'ready',
      min_impressions: 1000,
      groups: [{
        candidate_key: 'candidate-1',
        status: 'ready',
        winner: { variant: 'C', impressions: 2000 }
      }]
    }
  }, 'candidate-1'),
  { eligible: true, reason: '', winner: { variant: 'C', impressions: 2000 } }
)
assert.equal(
  getDspH3Eligibility({ experiment_metrics: { status: 'insufficient_exposure' } }, 'candidate-1').eligible,
  false
)
assert.deepEqual(
  getDspH3ViewState({ status: 'upscaling', progress_percent: 72 }),
  { label: 'SeedVR2 AI 超分中', progress: 72, terminal: false }
)
assert.equal(
  shouldPollDspCreativeJob({
    status: 'completed',
    h3_upgrades: [{ status: 'cloud_generate' }]
  }),
  true,
  'a terminal GIF job must keep polling while its H3 upgrade is active'
)
assert.equal(
  getDspCreativeProgress({ progress: { completed_creatives: 3, total_creatives: 4 } }),
  75
)
assert.deepEqual(
  getDspCreativeCandidates({
    id: 'preview-1',
    result: { creatives: [{ id: 'creative-1', wilson_ctr: 0.0142 }] }
  }),
  [{ id: 'creative-1', wilson_ctr: 0.0142 }]
)
assert.equal(
  getDspCreativeCandidateId({ candidate_key: 'BANNER:300x250:creative-1', creative_id: 'creative-1' }),
  'BANNER:300x250:creative-1'
)
assert.equal(getDspCreativeCandidateId({ creative_id: 'legacy-unique' }), 'legacy-unique')
assert.deepEqual(
  buildSelectableDspCandidateRows([
    { candidate_key: 'BANNER:300x250:creative-1', creative_id: 'creative-1' },
    { creative_id: 'legacy-unique' },
    { creative_id: 'legacy-duplicate' },
    { creative_id: 'legacy-duplicate' }
  ]).map((row) => row.id),
  ['BANNER:300x250:creative-1', 'legacy-unique']
)
assert.deepEqual(
  buildSelectableDspCandidateRows([
    { candidate_key: 'duplicate-key', creative_id: 'creative-1' },
    { candidate_key: 'duplicate-key', creative_id: 'creative-2' },
    { candidate_key: 'shared-id', creative_id: 'creative-3' },
    { creative_id: 'shared-id' }
  ]),
  []
)
const fiftyUniqueCandidates = Array.from(
  { length: 50 },
  (_, index) => ({ candidate_key: `candidate-${index + 1}` })
)
assert.equal(
  buildSelectableDspCandidateRows([
    ...fiftyUniqueCandidates,
    { creative_id: 'legacy-duplicate' },
    { creative_id: 'legacy-duplicate' }
  ]).length,
  50
)
assert.equal(
  buildSelectableDspCandidateRows([
    ...fiftyUniqueCandidates,
    { candidate_key: 'candidate-51' }
  ]).length,
  51
)
assert.equal(getDspCreativeJobId({ id: 'preview-1', result: { creatives: [] } }), 'preview-1')
assert.equal(
  getDspCreativeJobId({ id: 'j'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 100) }),
  ''
)
assert.equal(isDspCreativeJobTerminal('completed_with_errors'), true)
assert.equal(isDspCreativeJobActive('awaiting_confirmation'), true)
assert.equal(shouldPollDspCreativeJob('awaiting_confirmation'), false)
for (const status of ['queued', 'downloading', 'reversing', 'confirmed', 'generating', 'packaging', 'running']) {
  assert.equal(shouldPollDspCreativeJob(status), true, `${status} 应继续轮询`)
}
for (const status of ['completed', 'completed_with_errors', 'failed', 'cancelled']) {
  assert.equal(shouldPollDspCreativeJob(status), false, `${status} 不应继续轮询`)
}

assert.deepEqual(
  buildFrwCostSummary({
    selectedCreatives: 2,
    sizes: ['300x100', '300x250', '720x240', '200x200']
  }),
  {
    sourceCount: 2,
    sizeCount: 4,
    ratioGroupCount: 3,
    ratios: ['3:1', '6:5', '1:1'],
    experimentGroupCount: 5,
    groups: ['A', 'B', 'C', 'D', 'E'],
    callsPerSource: 15,
    totalCalls: 30
  }
)
assert.deepEqual(
  resolveDspFrwCostSummary(
    {
      cost_estimate: {
        source_count: 1,
        size_count: 4,
        ratio_group_count: 3,
        sizes: ['200x200', '300x100', '300x250', '720x240'],
        ratios: ['1:1', '3:1', '6:5'],
        experiment_groups: 5,
        frw_video_calls: 15,
        pipeline_version: 'gif-only-v1',
        output_format: 'gif',
        generation_kind: 'img2video',
        requires_confirmation: true
      }
    },
    {
      selectedCreatives: 9,
      sizes: ['300x100', '300x250', '720x240', '200x200']
    }
  ),
  {
    sourceCount: 1,
    sourceSetCount: 1,
    sourceStrategy: '',
    sizeCount: 4,
    ratioGroupCount: 3,
    ratios: ['1:1', '3:1', '6:5'],
    experimentGroupCount: 5,
    groups: ['A', 'B', 'C', 'D', 'E'],
    sizes: ['200x200', '300x100', '300x250', '720x240'],
    callsPerSource: 15,
    totalCalls: 15,
    localTextSafe: false,
    frwCalls: 15,
    fromPersistedEstimate: true,
    invalidPersistedEstimate: false
  }
)
assert.deepEqual(
  resolveDspFrwCostSummary(
    {
      cost_estimate: {
        source_count: 5,
        source_set_count: 1,
        source_strategy: 'multi_source_ae',
        size_count: 1,
        ratio_group_count: 1,
        sizes: ['300x250'],
        ratios: ['6:5'],
        experiment_groups: 5,
        frw_video_calls: 5,
        pipeline_version: 'gif-only-v1',
        output_format: 'gif',
        generation_kind: 'img2video',
        requires_confirmation: true
      }
    },
    {
      selectedCreatives: 5,
      sizes: ['300x250']
    }
  ),
  {
    sourceCount: 5,
    sourceSetCount: 1,
    sourceStrategy: 'multi_source_ae',
    sizeCount: 1,
    ratioGroupCount: 1,
    ratios: ['6:5'],
    experimentGroupCount: 5,
    groups: ['A', 'B', 'C', 'D', 'E'],
    sizes: ['300x250'],
    callsPerSource: 5,
    totalCalls: 5,
    localTextSafe: false,
    frwCalls: 5,
    fromPersistedEstimate: true,
    invalidPersistedEstimate: false
  }
)
const localTextSafeCost = resolveDspFrwCostSummary({
  generation_mode: 'local_text_safe',
  cost_estimate: {
    source_count: 1,
    size_count: 1,
    ratio_group_count: 1,
    sizes: ['300x100'],
    ratios: ['3:1'],
    experiment_groups: 5,
    frw_video_calls: 0,
    local_gif_jobs: 5,
    pipeline_version: 'gif-only-v1',
    output_format: 'gif',
    generation_kind: 'img2video',
    requires_confirmation: true
  }
}, {
  selectedCreatives: 1,
  sizes: ['300x100']
})
assert.equal(localTextSafeCost.totalCalls, 5)
assert.equal(localTextSafeCost.localTextSafe, true)
assert.equal(localTextSafeCost.frwCalls, 0)
assert.equal(localTextSafeCost.invalidPersistedEstimate, false)
const rejectedLegacyCost = resolveDspFrwCostSummary({
    cost_estimate: {
      source_count: 1,
      size_count: 1,
      ratio_group_count: 1,
      sizes: ['300x100'],
      ratios: ['3:1'],
      experiment_groups: 2,
      frw_image_calls: 2
    }
  }, {
    selectedCreatives: 2,
    sizes: ['300x100']
  })
assert.equal(rejectedLegacyCost.totalCalls, 0)
assert.equal(rejectedLegacyCost.fromPersistedEstimate, false)
assert.equal(rejectedLegacyCost.invalidPersistedEstimate, true)

const rejectedTamperedCost = resolveDspFrwCostSummary({
    cost_estimate: {
      source_count: 99,
      size_count: 1,
      ratio_group_count: 1,
      sizes: ['300x100'],
      ratios: ['3:1'],
      experiment_groups: 5,
      frw_video_calls: 6
    }
  }, {
    selectedCreatives: 2,
    sizes: ['300x100']
  })
assert.equal(rejectedTamperedCost.totalCalls, 0)
assert.equal(rejectedTamperedCost.invalidPersistedEstimate, true)

const rejectedDimensionCost = resolveDspFrwCostSummary({
    cost_estimate: {
      source_count: 1,
      size_count: 1,
      ratio_group_count: 1,
      sizes: ['300x100'],
      ratios: ['3:1'],
      experiment_groups: 5,
      frw_video_calls: 5
    }
  }, {
    selectedCreatives: 2,
    sizes: ['300x250']
  })
assert.equal(rejectedDimensionCost.totalCalls, 0)
assert.equal(rejectedDimensionCost.invalidPersistedEstimate, true)

for (const requiresConfirmation of [false, undefined]) {
  const estimate = {
    source_count: 1,
    size_count: 1,
    ratio_group_count: 1,
    sizes: ['300x100'],
    ratios: ['3:1'],
    experiment_groups: 5,
    frw_video_calls: 5,
    pipeline_version: 'gif-only-v1',
    output_format: 'gif',
    generation_kind: 'img2video'
  }
  if (requiresConfirmation !== undefined) {
    estimate.requires_confirmation = requiresConfirmation
  }
  const rejectedConfirmationCost = resolveDspFrwCostSummary({
    cost_estimate: estimate
  }, {
    selectedCreatives: 1,
    sizes: ['300x100']
  })
  assert.equal(rejectedConfirmationCost.totalCalls, 0)
  assert.equal(rejectedConfirmationCost.fromPersistedEstimate, false)
  assert.equal(rejectedConfirmationCost.invalidPersistedEstimate, true)
}

const localOnlyCost = resolveDspFrwCostSummary({}, {
  selectedCreatives: 2,
  sizes: ['300x100']
})
assert.equal(localOnlyCost.totalCalls, 10)
assert.equal(localOnlyCost.fromPersistedEstimate, false)
assert.equal(localOnlyCost.invalidPersistedEstimate, false)

assert.equal(buildDspCreativePreviewUrl(), 'http://127.0.0.1:8788/v1/dsp-creatives/preview')
assert.equal(buildDspCreativeImportUrl(), 'http://127.0.0.1:8788/v1/dsp-creatives/import')
assert.equal(
  buildDspCreativeJobsUrl({ status: 'running', mediaType: 'VIDEO' }),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs?status=running&media_type=VIDEO'
)
assert.equal(
  buildDspCreativeJobsUrl({ status: 'failed' }),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs?status=failed'
)
assert.equal(
  buildDspCreativeJobsUrl({ status: 'completed_with_errors' }),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs?status=completed_with_errors'
)
assert.equal(
  buildDspCreativeJobUrl('job/1'),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs/job%2F1'
)
assert.throws(
  () => buildDspCreativeJobUrl('j'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1)),
  /任务标识不能超过 512 个字符/
)
assert.equal(
  buildDspCreativeConfirmUrl('job 1'),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs/job%201/confirm'
)
assert.equal(
  buildDspCreativeCancelUrl('job:1'),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs/job%3A1/cancel'
)
assert.equal(
  buildDspCreativeExperimentBindingsUrl('job:1'),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs/job%3A1/experiment-bindings'
)
assert.equal(
  buildDspCreativeExperimentRefreshUrl('job:1'),
  'http://127.0.0.1:8788/v1/dsp-creatives/jobs/job%3A1/experiment-refresh'
)
assert.equal(
  buildDspCreativeCleanupUrl(),
  'http://127.0.0.1:8788/v1/dsp-creatives/public-assets/cleanup'
)
assert.equal(buildDspCreativeDeleteUrl('job-1'), buildDspCreativeJobUrl('job-1'))
assert.equal(
  getDspCreativeDownloadUrl({
    zip_url: 'http://127.0.0.1:8788/public-assets/job-1.zip'
  }),
  'http://127.0.0.1:8788/public-assets/job-1.zip'
)
globalThis.window = {
  location: {
    origin: 'https://canvas.example.com'
  }
}
assert.equal(
  getDspCreativeDownloadUrl({
    zip_url: 'http://127.0.0.1:8788/public-assets/job-1.zip'
  }),
  'https://canvas.example.com/public-assets/job-1.zip'
)
delete globalThis.window
assert.equal(
  getDspCreativeDownloadUrl({ zip_url: 'http://127.0.0.1:8788/files/job-1.zip' }),
  ''
)
assert.equal(
  getDspCreativeDownloadUrl({
    zip_url: 'https://safe-material.trycloudflare.com/public-assets/job-1.zip'
  }),
  ''
)
assert.equal(
  getDspCreativeDownloadUrl({
    zip_url: 'https://safe-material.trycloudflare.com/public-assets/job-1.zip?token=secret'
  }),
  ''
)
for (const unsafeUrl of [
  'javascript:alert(1)',
  'data:text/html;base64,QQ==',
  'file:///tmp/job.zip',
  'https://evil.example/job.zip',
  'https://evil.trycloudflare.com/public-assets/job-1.zip',
  'http://127.0.0.1:8788/public-assets/job.zip?key=secret',
  'http://127.0.0.1:8788/public-assets/job.zip#secret',
  'http://user:pass@127.0.0.1:8788/public-assets/job.zip',
  'http://127.0.0.1:8788/public-assets/job.mp4',
  'http://127.0.0.1:8788/public-assets/%2e%2e/job.zip',
  'http://127.0.0.1:8788/public-assets/safe%2Fjob.zip',
  'http://127.0.0.1:8788/public-assets/safe%5cjob.zip'
]) {
  assert.equal(getDspCreativeDownloadUrl({ zip_url: unsafeUrl }), '')
}
assert.deepEqual(
  getDspCreativeGenerationResults({
    generation_results: [
      {
        variant: 'A',
        category: '电商促销',
        headline: '限时上新',
        body: '抓住优惠',
        cta: '立即查看',
        motion_prompt: '人物向镜头展示商品',
        gif_url: 'http://127.0.0.1:8788/public-assets/a.gif',
        files: [
          {
            size: '300x100',
            bytes: 123,
            sha256: 'a'.repeat(64),
            gif_url: 'http://127.0.0.1:8788/public-assets/a-300x100.gif'
          },
          {
            size: '720x240',
            bytes: 456,
            sha256: 'b'.repeat(64),
            gif_url: 'https://evil.example/a.gif'
          }
        ]
      }
    ]
  }),
  [
    {
      candidateKey: '',
      creativeId: '',
      variant: 'A',
      category: '电商促销',
      headline: '限时上新',
      body: '抓住优惠',
      cta: '立即查看',
      motionPrompt: '人物向镜头展示商品',
      gifUrl: 'http://127.0.0.1:8788/public-assets/a.gif',
      files: [
        {
          size: '300x100',
          width: 0,
          height: 0,
          bytes: 123,
          sha256: 'a'.repeat(64),
          qualityPassed: false,
          gifUrl: 'http://127.0.0.1:8788/public-assets/a-300x100.gif'
        },
        {
          size: '720x240',
          width: 0,
          height: 0,
          bytes: 456,
          sha256: 'b'.repeat(64),
          qualityPassed: false,
          gifUrl: ''
        }
      ]
    }
  ]
)
assert.deepEqual(
  getDspCreativeGenerationResults({
    generation_results: [
      {
        candidate_key: 'candidate-1',
        creative_id: 'creative-1',
        variant: 'A',
        headline: '同一方案',
        gif_url: 'http://127.0.0.1:8788/public-assets/a-200x200.gif',
        files: [
          {
            width: 200,
            height: 200,
            url: 'http://127.0.0.1:8788/public-assets/a-200x200.gif'
          }
        ]
      },
      {
        candidate_key: 'candidate-1',
        creative_id: 'creative-1',
        variant: 'A',
        headline: '同一方案',
        gif_url: 'http://127.0.0.1:8788/public-assets/a-300x100.gif',
        files: [
          {
            width: 300,
            height: 100,
            url: 'http://127.0.0.1:8788/public-assets/a-300x100.gif'
          },
          {
            width: 720,
            height: 240,
            url: 'http://127.0.0.1:8788/public-assets/a-720x240.gif'
          }
        ]
      }
    ]
  }),
  [
    {
      candidateKey: 'candidate-1',
      creativeId: 'creative-1',
      variant: 'A',
      category: '',
      headline: '同一方案',
      body: '',
      cta: '',
      motionPrompt: '',
      gifUrl: 'http://127.0.0.1:8788/public-assets/a-200x200.gif',
      files: [
        {
          size: '200x200',
          width: 200,
          height: 200,
          bytes: 0,
          sha256: '',
          qualityPassed: false,
          gifUrl: 'http://127.0.0.1:8788/public-assets/a-200x200.gif'
        },
        {
          size: '300x100',
          width: 300,
          height: 100,
          bytes: 0,
          sha256: '',
          qualityPassed: false,
          gifUrl: 'http://127.0.0.1:8788/public-assets/a-300x100.gif'
        },
        {
          size: '720x240',
          width: 720,
          height: 240,
          bytes: 0,
          sha256: '',
          qualityPassed: false,
          gifUrl: 'http://127.0.0.1:8788/public-assets/a-720x240.gif'
        }
      ]
    }
  ]
)
const unsafeTypedGenerationResults = getDspCreativeGenerationResults({
  generation_results: [
    {
      variant: 'A',
      gif_url: 'http://127.0.0.1:8788/public-assets/fake-gif.mp4',
      files: [
        {
          size: '300x100',
          gif_url: 'http://127.0.0.1:8788/public-assets/fake-file.mp4'
        },
        {
          size: '720x240',
          gif_url: 'http://127.0.0.1:8788/public-assets/%2e%2e/fake.gif'
        },
        {
          size: '200x200',
          gif_url: 'https://evil.trycloudflare.com/public-assets/fake.gif'
        }
      ]
    }
  ]
})
assert.equal(unsafeTypedGenerationResults[0].gifUrl, '')
assert.deepEqual(
  unsafeTypedGenerationResults[0].files.map((file) => file.gifUrl),
  ['', '', '']
)
assert.deepEqual(
  getDspCreativeGifDownloads({
    gifUrl: 'http://127.0.0.1:8788/public-assets/a.gif',
    files: [
      {
        size: '300x100',
        gifUrl: 'http://127.0.0.1:8788/public-assets/a.gif',
        qualityPassed: true
      },
      {
        size: '720x240',
        gifUrl: 'http://127.0.0.1:8788/public-assets/a-720x240.gif',
        qualityPassed: true
      },
      {
        size: '200x200',
        gifUrl: 'https://evil.example/a.gif',
        qualityPassed: true
      }
    ]
  }),
  [
    {
      gifUrl: 'http://127.0.0.1:8788/public-assets/a.gif',
      label: '下载该 GIF'
    },
    {
      gifUrl: 'http://127.0.0.1:8788/public-assets/a-720x240.gif',
      label: '下载 720x240 GIF'
    }
  ]
)
const trustedGif300x100 = 'http://127.0.0.1:8788/public-assets/preview-300x100.gif'
const trustedGif200x200 = 'http://127.0.0.1:8788/public-assets/preview-200x200.gif'
const previewCatalog = buildDspGifPreviewCatalog({
  generation_results: [{
    candidate_key: 'candidate-1',
    creative_id: 'creative-1',
    category: '游戏',
    variant: 'A',
    copy: {
      headline: '标题',
      body: '正文',
      cta: '立即体验'
    },
    files: [
      {
        width: 200,
        height: 200,
        url: trustedGif200x200,
        quality: { passed: true, reasons: [] }
      },
      {
        width: 300,
        height: 100,
        url: trustedGif300x100,
        quality: { passed: true, reasons: [] }
      }
    ]
  }]
})
assert.deepEqual(
  previewCatalog.map((item) => item.size),
  ['300x100', '200x200']
)
assert.equal(previewCatalog[0].variant, 'A')
assert.equal(previewCatalog[0].gifUrl, trustedGif300x100)
assert.equal(previewCatalog[0].headline, '标题')
const auditedPreviewCatalog = buildDspGifPreviewCatalog({
  generation_results: [{
    candidate_key: 'candidate-audit',
    creative_id: 'creative-audit',
    category: '游戏',
    variant: 'B',
    experiment_axis: 'CLOSEUP',
    experiment_label: '人脸近景',
    source_metrics: {
      impressions: 2400,
      clicks: 84,
      ctr: 3.5,
      spend: 18.6,
      wilson_ctr: 2.86
    },
    visual_audit: {
      passed: false,
      reason: 'visual_too_similar_to_control'
    },
    files: [{
      width: 300,
      height: 100,
      url: trustedGif300x100,
      quality: { passed: true, reasons: [] }
    }]
  }]
})
assert.equal(auditedPreviewCatalog.length, 0)
assert.deepEqual(
  getDspCreativeGifDownloads({
    visualAuditPassed: false,
    files: [{
      size: '300x100',
      gifUrl: trustedGif300x100,
      qualityPassed: true
    }]
  }),
  []
)
assert.deepEqual(
  getDspCreativeGifDownloads({
    visualAuditPassed: true,
    files: [{
      size: '300x100',
      gifUrl: trustedGif300x100,
      qualityPassed: false
    }]
  }),
  []
)
assert.equal(getDspCreativeExpectedGifCount({
  cost_estimate: {
    source_count: 2,
    source_set_count: 2,
    ratio_group_count: 3,
    experiment_groups: 5
  }
}), 30)
assert.equal(getDspCreativeExpectedGifCount({
  cost_estimate: {
    source_count: 5,
    source_set_count: 1,
    ratio_group_count: 1,
    experiment_groups: 5,
    frw_video_calls: 5
  }
}), 5)
assert.equal(getDspCreativeExpectedGifCount({}), 0)
assert.equal(buildDspGifPreviewCatalog({
  generation_results: [{
    candidate_key: 'legacy-candidate',
    creative_id: 'legacy-creative',
    variant: 'A',
    files: [{
      width: 300,
      height: 100,
      url: trustedGif300x100
    }]
  }]
}).length, 0)
assert.equal(buildDspGifPreviewCatalog({
  generation_results: [{
    candidate_key: 'candidate-1',
    creative_id: 'creative-1',
    variant: 'A',
    files: [{
      width: 300,
      height: 100,
      url: 'javascript:alert(1)'
    }]
  }]
}).length, 0)
assert.deepEqual(getDspCreativeCandidates({ data: null }), [])
assert.deepEqual(getDspCreativeCandidates({ result: { creatives: { bad: true } } }), [])
assert.deepEqual(
  getDspCreativeCandidates({ creatives: [null, 'bad', 7, { candidate_key: 'ok' }] }),
  [{ candidate_key: 'ok' }]
)
assert.deepEqual(getDspCreativeJobs({ result: { jobs: [{ id: 'job-1' }] } }), [{ id: 'job-1' }])
assert.deepEqual(getDspCreativeJobs({ data: null }), [])
assert.deepEqual(
  getDspCreativeJobs({ jobs: [null, 'bad', 7, { id: 'job-1' }] }),
  [{ id: 'job-1' }]
)
const selectedCreativeJob = {
  id: 'job-selected',
  selected_creatives: [
    { candidate_key: 'BANNER:300x250:creative-1', creative_id: 'creative-1', media_type: 'BANNER' },
    { candidate_key: 'VIDEO:720x240:creative-2', creative_id: 'creative-2', media_type: 'VIDEO' }
  ]
}
assert.deepEqual(getDspCreativeJobMediaTypes(selectedCreativeJob), ['BANNER', 'VIDEO'])
assert.match(getDspCreativeJobSearchText(selectedCreativeJob), /creative-1/)
assert.match(getDspCreativeJobSearchText(selectedCreativeJob), /VIDEO:720x240:creative-2/)

assert.equal(canConfirmDspCreativeJob('awaiting_confirmation', false), true)
assert.equal(canConfirmDspCreativeJob('completed', false), false)
assert.equal(canConfirmDspCreativeJob('awaiting_confirmation', true), false)
assert.equal(canCancelDspCreativeJob('awaiting_confirmation', false), true)
assert.equal(canCancelDspCreativeJob('awaiting_confirmation', true), false)
assert.equal(canRetryDspCreativeJob('completed_with_errors', false), true)
assert.equal(canRetryDspCreativeJob('running', false), false)
assert.equal(
  canCleanupDspCreativeJob({
    status: 'completed',
    zip_url: 'https://canvas.example/public-assets/job.zip'
  }, false),
  true
)
assert.equal(canCleanupDspCreativeJob({ status: 'completed' }, false), false)
assert.equal(canCleanupDspCreativeJob({ status: 'failed' }, false), false)
assert.equal(canCleanupDspCreativeJob({ status: 'completed_with_errors' }, false), false)
assert.equal(
  canCleanupDspCreativeJob({
    status: 'completed',
    zip_url: 'https://canvas.example/public-assets/job.zip'
  }, true),
  false
)
for (const activeStatus of [
  'queued',
  'downloading',
  'reversing',
  'awaiting_confirmation',
  'confirmed',
  'generating',
  'packaging',
  'running'
]) {
  assert.equal(matchesDspJobStatusFilter('running', activeStatus), true)
}
assert.equal(matchesDspJobStatusFilter('running', 'completed'), false)
assert.equal(matchesDspJobStatusFilter('failed', 'failed'), true)

assert.deepEqual(
  sanitizeTaskCenterPersistence({
    jobIds: ['job-1', 'job-1', '', 'job-2'],
    filters: { status: 'failed', mediaType: 'POP', query: 'abc', secret: 'drop-me' },
    jobs: [{ id: 'must-not-persist' }],
    apiKey: 'must-not-persist'
  }),
  {
    jobIds: ['job-1', 'job-2'],
    filters: { status: 'failed', mediaType: '', query: 'abc' }
  }
)
assert.deepEqual(
  resolveTaskCenterPreferences(
    { status: '', mediaType: '', query: '' },
    { status: 'failed', mediaType: 'VIDEO', query: 'job-7' }
  ),
  { status: 'failed', mediaType: 'VIDEO', query: 'job-7' }
)
assert.deepEqual(
  resolveTaskCenterPreferences(
    { status: 'completed', mediaType: '', query: '' },
    { status: 'failed', mediaType: 'VIDEO', query: 'job-7' }
  ),
  { status: 'completed', mediaType: '', query: '' }
)
assert.deepEqual(
  buildDspCreativeLibraryPersistence({
    startDate: '2026-07-17',
    endDate: '2026-07-24',
    mediaTypes: ['BANNER', 'POP'],
    dimensions: ['300x100', '720x240'],
    account: 'acct-01',
    minImpressions: 1000,
    minClicks: 20,
    topN: 10,
    selectedIds: ['creative-1', 'creative-1'],
    previewRef: 'preview-1',
    previewSignature: '{"dimensions":["300x100","720x240"]}',
    jobId: 'job-1',
    candidates: [{ id: 'must-not-persist' }],
    job: { id: 'must-not-persist' },
    result: { raw: 'must-not-persist' }
    ,
    autoRefreshStatus: {
      status: 'error',
      error: '/Users/private/must-not-persist'
    },
    autoRefreshError: 'sk-must-not-persist'
  }),
  {
    startDate: '2026-07-17',
    endDate: '2026-07-24',
    mediaTypes: ['BANNER'],
    dimensions: ['300x100', '720x240'],
    account: 'acct-01',
    minImpressions: 1000,
    minClicks: 20,
    topN: 10,
    selectedIds: ['creative-1'],
    previewRef: 'preview-1',
    previewSignature: '{"dimensions":["300x100","720x240"]}',
    jobId: 'job-1'
  }
)
const fiftySelectedIds = Array.from({ length: 50 }, (_, index) => `candidate-${index + 1}`)
assert.deepEqual(
  buildDspCreativeLibraryPersistence({ selectedIds: fiftySelectedIds }).selectedIds,
  fiftySelectedIds
)
assert.throws(
  () => buildDspCreativeLibraryPersistence({
    selectedIds: [...fiftySelectedIds, 'candidate-51']
  }),
  /最多选择 50 条候选素材/
)
assert.throws(
  () => buildDspCreativeLibraryPersistence({
    selectedIds: ['x'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1)]
  }),
  /候选标识不能超过 512 个字符/
)
const boundedPersistence = buildDspCreativeLibraryPersistence({
  account: 'a'.repeat(1000),
  startDate: { invalid: true },
  endDate: '2026-07-24-extra'
})
assert.equal(boundedPersistence.account.length, 256)
assert.equal(boundedPersistence.startDate, '')
assert.equal(boundedPersistence.endDate, '')
assert.throws(
  () => buildDspCreativeLibraryPersistence({ previewRef: 'p'.repeat(1000) }),
  /预览标识不能超过 512 个字符/
)
assert.throws(
  () => buildDspCreativeLibraryPersistence({ jobId: 'j'.repeat(1000) }),
  /任务标识不能超过 512 个字符/
)
assert.throws(
  () => sanitizeTaskCenterPersistence({
    jobIds: ['j'.repeat(1000)],
    filters: { query: 'q'.repeat(1000) }
  }),
  /任务标识不能超过 512 个字符/
)
const boundedTaskCenter = sanitizeTaskCenterPersistence({
  jobIds: ['job-1'],
  filters: { query: 'q'.repeat(1000) }
})
assert.equal(boundedTaskCenter.filters.query.length, 100)
const boundedMetadata = sanitizeDspCreativeCanvasNodeData('dspCreativeLibrary', {
  label: 'L'.repeat(500),
  createdAt: 123,
  updatedAt: '2026-07-24T12:00:00.000Z'
})
assert.equal(boundedMetadata.label.length, 100)
assert.equal(boundedMetadata.createdAt, 123)
assert.equal(boundedMetadata.updatedAt, '2026-07-24T12:00:00.000Z')
const invalidMetadata = sanitizeDspCreativeCanvasNodeData('dspCreativeLibrary', {
  label: { invalid: true },
  createdAt: { invalid: true },
  updatedAt: 'x'.repeat(100)
})
assert.equal('label' in invalidMetadata, false)
assert.equal('createdAt' in invalidMetadata, false)
assert.equal('updatedAt' in invalidMetadata, false)
const rejectedLibraryIds = sanitizeDspCreativeCanvasNodeData('dspCreativeLibrary', {
  selectedIds: ['candidate-ok', 'x'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1)],
  previewRef: 'p'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1),
  jobId: 'j'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1)
})
assert.deepEqual(rejectedLibraryIds.selectedIds, [])
assert.equal(rejectedLibraryIds.previewRef, '')
assert.equal(rejectedLibraryIds.jobId, '')
const rejectedTaskCenterIds = sanitizeDspCreativeCanvasNodeData('dspCreativeTaskCenter', {
  jobIds: ['job-ok', 'j'.repeat(MAX_DSP_IDENTIFIER_LENGTH + 1)],
  uiPrefs: { query: 'safe' }
})
assert.deepEqual(rejectedTaskCenterIds.jobIds, [])
assert.equal(rejectedTaskCenterIds.uiPrefs.query, 'safe')

const previewFilterBase = {
  startDate: '2026-07-17',
  endDate: '2026-07-24',
  mediaTypes: ['BANNER', 'NATIVE', 'VIDEO'],
  dimensions: ['300x100', '300x250'],
  account: 'acct-01',
  minImpressions: 1000,
  minClicks: 20,
  topN: 10
}
const previewFilterVariants = [
  { startDate: '2026-07-16' },
  { endDate: '2026-07-23' },
  { mediaTypes: ['BANNER'] },
  { dimensions: ['200x200'] },
  { account: 'acct-02' },
  { minImpressions: 2000 },
  { minClicks: 30 },
  { topN: 20 }
]
for (const variant of previewFilterVariants) {
  assert.notEqual(
    buildDspPreviewFilterSignature(previewFilterBase),
    buildDspPreviewFilterSignature({ ...previewFilterBase, ...variant })
  )
}
assert.deepEqual(
  clearDspCreativePreviewState({
    previewRef: 'preview-old',
    previewSignature: 'signature-old',
    candidates: [{ candidate_key: 'candidate-old' }],
    selectedIds: ['candidate-old']
  }),
  { previewRef: '', previewSignature: '', candidates: [], selectedIds: [] }
)
assert.equal(
  isDspPreviewResponseCurrent({
    requestSequence: 7,
    latestSequence: 7,
    requestSignature: 'signature-current',
    currentSignature: 'signature-current'
  }),
  true
)
assert.equal(
  isDspPreviewResponseCurrent({
    requestSequence: 7,
    latestSequence: 8,
    requestSignature: 'signature-current',
    currentSignature: 'signature-current'
  }),
  false
)
assert.equal(
  isDspPreviewResponseCurrent({
    requestSequence: 7,
    latestSequence: 7,
    requestSignature: 'signature-old',
    currentSignature: 'signature-current'
  }),
  false
)
assert.equal(
  canImportDspPreview({
    previewRef: 'preview-1',
    previewSignature: 'signature-current',
    currentSignature: 'signature-current'
  }),
  true
)
assert.equal(
  canImportDspPreview({
    previewRef: 'preview-1',
    previewSignature: 'signature-old',
    currentSignature: 'signature-current'
  }),
  false
)
assert.deepEqual(
  sanitizeDspCreativeCanvasNodeData('dspCreativeLibrary', {
    label: '54DSP 优秀素材',
    createdAt: 123,
    selectedIds: ['creative-1'],
    previewRef: 'preview-1',
    previewSignature: 'signature-current',
    jobId: 'job-1',
    candidates: [{ id: 'must-not-persist' }],
    job: { id: 'must-not-persist' },
    result: { raw: 'must-not-persist' }
  }),
  {
    label: '54DSP 优秀素材',
    createdAt: 123,
    startDate: '',
    endDate: '',
    mediaTypes: ['BANNER', 'NATIVE', 'VIDEO'],
    dimensions: [],
    account: '',
    minImpressions: 1000,
    minClicks: 20,
    topN: 10,
    selectedIds: ['creative-1'],
    previewRef: 'preview-1',
    previewSignature: 'signature-current',
    jobId: 'job-1'
  }
)

const originalFetch = globalThis.fetch
const calls = []
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  if (String(url) === buildDspCreativeAutoRefreshUrl()) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        enabled: true,
        status: 'standby',
        timezone: 'Asia/Shanghai',
        last_success: '2026-07-25T10:00:00+08:00',
        next_run: '2026-07-28T10:00:00+08:00',
        catalog_size: 12,
        error: 'file:///Users/private/leak',
        api_key: 'sk-leak'
      })
    }
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, data: { job_id: 'job-1' } })
  }
}

try {
  const status = await getDspCreativeAutoRefreshStatus()
  assert.equal(status.status, 'standby')
  assert.equal(status.catalogSize, 12)
  assert.equal(status.error, '自动更新状态异常（敏感详情已隐藏）')
  assert.equal(JSON.stringify(status).includes('/Users/private'), false)
  assert.equal(JSON.stringify(status).includes('sk-leak'), false)
  await previewDspCreatives({ media_types: ['BANNER'] })
  await importDspCreatives({ creative_ids: ['creative-1'] })
  await listDspCreativeJobs({ status: 'running' })
  await getDspCreativeJob('job-1')
  await confirmDspCreativeJob('job-1', { idempotency_key: 'confirm-1' })
  await updateDspCreativeCopy('job-1', {
    candidate_key: 'candidate-1',
    variants: []
  })
  await cancelDspCreativeJob('job-1')
  await cleanupDspCreativePublicFiles('job-1')
  await deleteDspCreativeJob('job-1')
} finally {
  globalThis.fetch = originalFetch
}

assert.deepEqual(calls.map((call) => call.options.method), [
  'GET',
  'POST',
  'POST',
  'GET',
  'GET',
  'POST',
  'POST',
  'POST',
  'POST',
  'DELETE'
])
assert.equal(calls[0].url, buildDspCreativeAutoRefreshUrl())
assert.equal(calls[1].url, buildDspCreativePreviewUrl())
assert.equal(calls[2].url, buildDspCreativeImportUrl())
assert.equal(calls[3].url, buildDspCreativeJobsUrl({ status: 'running' }))
assert.equal(calls[4].url, buildDspCreativeJobUrl('job-1'))
assert.equal(calls[5].url, buildDspCreativeConfirmUrl('job-1'))
assert.equal(calls[6].url, buildDspCreativeCopyUrl('job-1'))
assert.equal(calls[7].url, buildDspCreativeCancelUrl('job-1'))
assert.equal(calls[8].url, buildDspCreativeCleanupUrl())
assert.deepEqual(JSON.parse(calls[8].options.body), { job_id: 'job-1' })
assert.equal(calls[9].url, buildDspCreativeDeleteUrl('job-1'))
assert.equal(calls[9].options.headers['Content-Type'], 'application/json')
assert.deepEqual(JSON.parse(calls[9].options.body), {})
for (const call of calls) {
  assert.equal(Object.keys(call.options.headers || {}).some((key) => /authorization|api[-_]?key/i.test(key)), false)
}

globalThis.fetch = async () => ({
  ok: false,
  status: 500,
  headers: { get: () => 'application/json' },
  json: async () => ({
    error: '读取 /Users/private/refresh.json 失败，token=must-not-leak'
  })
})
try {
  const failedStatus = await getDspCreativeAutoRefreshStatus()
  assert.equal(failedStatus.status, 'error')
  assert.equal(failedStatus.error, '自动更新状态异常（敏感详情已隐藏）')
  assert.equal(JSON.stringify(failedStatus).includes('/Users/private'), false)
  assert.equal(JSON.stringify(failedStatus).includes('must-not-leak'), false)
} finally {
  globalThis.fetch = originalFetch
}

let retryablePreviewCalls = 0
globalThis.fetch = async () => {
  retryablePreviewCalls += 1
  return {
    ok: false,
    status: 502,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'upstream service unavailable' })
  }
}
try {
  await assert.rejects(
    () => previewDspCreatives({}, { retryDelayMs: 0 }),
    (error) => error.message === 'upstream service unavailable' && error.status === 502
  )
  assert.equal(retryablePreviewCalls, 2)
} finally {
  globalThis.fetch = originalFetch
}

let recoveredPreviewCalls = 0
globalThis.fetch = async () => {
  recoveredPreviewCalls += 1
  if (recoveredPreviewCalls === 1) {
    return {
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'DSP API 网络错误: SSL UNEXPECTED_EOF_WHILE_READING'
      })
    }
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ id: 'preview-recovered', status: 'completed' })
  }
}
try {
  assert.deepEqual(
    await previewDspCreatives({}, { retryDelayMs: 0 }),
    { id: 'preview-recovered', status: 'completed' }
  )
  assert.equal(recoveredPreviewCalls, 2)
} finally {
  globalThis.fetch = originalFetch
}

for (const [detail, expected] of [
  ['validation failed', 'validation failed'],
  [['first error', { msg: 'second error' }], 'first error；second error'],
  [{ field: 'media_types', reason: 'required' }, '{"field":"media_types","reason":"required"}']
]) {
  let validationPreviewCalls = 0
  globalThis.fetch = async () => {
    validationPreviewCalls += 1
    return {
      ok: false,
      status: 422,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail })
    }
  }
  try {
    await assert.rejects(
      () => previewDspCreatives({}, { retryDelayMs: 0 }),
      (error) => error.message === expected && error.status === 422
    )
    assert.equal(validationPreviewCalls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
}

for (const response of [
  {
    ok: true,
    status: 204,
    headers: { get: () => '' },
    text: async () => ''
  },
  {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    }
  }
]) {
  globalThis.fetch = async () => response
  try {
    assert.deepEqual(await previewDspCreatives({}), {})
  } finally {
    globalThis.fetch = originalFetch
  }
}

// ---------------------------------------------------------------------------
// 下面这一段是 grep 尾巴。批次 6 只搬走了 src/stores/canvas.js 那一小片
// （见 tests/component/dspCreativeLibrary.spec.mjs：默认筛选条件、每个节点自己的数组、
// 以及「候选素材写盘前必须被剥掉」——那条现在是真的存了一次项目再读回来验的）。
//
// 剩下的两大块都是 D 类，按 docs/testing-migration.md 的分批留到后面：
//   · DspCreativeLibraryNode.vue / DspCreativeTaskCenterNode.vue 的文案与内部接线
//     （batch 4：要挂节点组件 + 打桩 API 才谈得上真断言，这个节点有预览/导入/确认/
//     自动刷新四条异步路径，转换成本远超本批）
//   · Canvas.vue 的节点类型注册表（batch 5：要挂 Canvas.vue）
// 在那之前删掉任何一条都是净损失，所以原样留着。
// ---------------------------------------------------------------------------
const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8')
const libraryNodeSource = read('src/components/nodes/DspCreativeLibraryNode.vue')
const taskCenterSource = read('src/components/nodes/DspCreativeTaskCenterNode.vue')
const canvasSource = read('src/views/Canvas.vue')

for (const label of [
  '54DSP 优秀素材',
  '近 7 个完整自然日',
  '高点击不等于高转化',
  '确认后才消耗 FRW',
  'GMI 反向',
  'FRW GIF 五套裂变',
  'GIF-only',
  '广告类别',
  '动作提示',
  '查看成本并生成 5 套 GIF',
  '确认并生成 5 套 GIF',
  '下载 GIF ZIP',
  '每个来源',
  '每3天自动更新',
  '自动更新只抓取候选素材并生成 GMI 草稿',
  '不调用、不消耗 FRW',
  '上次成功',
  '下次运行',
  '素材库',
  '分析复用',
  '新生成分析',
  '重试'
]) {
  assert.match(libraryNodeSource, new RegExp(label), `优秀素材节点缺少“${label}”`)
}
assert.doesNotMatch(libraryNodeSource, /FRW A\/B|图生图|PNG/)
assert.doesNotMatch(taskCenterSource, /FRW A\/B|图生图|PNG/)
assert.doesNotMatch(
  libraryNodeSource,
  /FRW A-E 五套视频|查看成本并生成 A-E 五套视频|确认并提交 A-E 五套视频|下载总 ZIP/
)
assert.match(taskCenterSource, /FRW GIF 五套裂变/)
assert.match(taskCenterSource, /下载 GIF ZIP/)
assert.match(libraryNodeSource, /sortSelectableDspCandidateRows/)
assert.match(libraryNodeSource, /候选排序/)
assert.match(libraryNodeSource, /编辑文案/)
assert.match(libraryNodeSource, /保存文案/)
assert.match(libraryNodeSource, /updateDspCreativeCopy/)

for (const label of ['任务中心', '失败原因', '取消', '重试', '下载', '删除', '清理临时公开文件']) {
  assert.match(taskCenterSource, new RegExp(label), `任务中心节点缺少“${label}”`)
}

assert.doesNotMatch(libraryNodeSource, /API Key|apiKey|api_key/)
assert.doesNotMatch(taskCenterSource, /API Key|apiKey|api_key/)
assert.match(taskCenterSource, /sanitizeTaskCenterPersistence/)
assert.match(libraryNodeSource, /buildDspCreativeLibraryPersistence/)
assert.match(libraryNodeSource, /buildSelectableDspCandidateRows/)
assert.match(libraryNodeSource, /candidate_key/)
assert.match(libraryNodeSource, /const normalizedDimensions = computed/)
assert.doesNotMatch(libraryNodeSource, /const dimensions = computed/)
assert.match(libraryNodeSource, /dimensions:\s*normalizedDimensions\.value/)
assert.match(libraryNodeSource, /sizes:\s*normalizedDimensions\.value/g)
assert.match(libraryNodeSource, /costSummary\.value\.sizes\.length > 0/)
assert.match(libraryNodeSource, /buildDspPreviewFilterSignature/)
assert.match(libraryNodeSource, /clearDspCreativePreviewState/)
assert.match(libraryNodeSource, /isDspPreviewResponseCurrent/)
assert.match(libraryNodeSource, /canImportDspPreview/)
assert.match(libraryNodeSource, /previewRevision/)
assert.match(libraryNodeSource, /filters\.mediaTypes\.length === 0/)
assert.match(libraryNodeSource, /请至少选择一种媒体类型/)
assert.match(libraryNodeSource, /v-if="canConfirmFrw"/)
assert.match(libraryNodeSource, /:disabled="confirming \|\| !canConfirmFrw"/)
assert.match(libraryNodeSource, /jobStatus\.value === 'awaiting_confirmation'/)
assert.match(libraryNodeSource, /if \(\s*!previewRef\.value/)
const handlePreviewBlock = (
  libraryNodeSource.match(/const handlePreview = async \(\) => \{[\s\S]*?\n\}\n\nconst handleImport/)?.[0]
  || ''
)
assert.ok(
  handlePreviewBlock.indexOf('clearDspCreativePreviewState') >= 0
    && handlePreviewBlock.indexOf('clearDspCreativePreviewState') <
      handlePreviewBlock.indexOf('previewDspCreatives(payload'),
  '点击预览必须先清空旧 preview，再请求新 preview'
)
assert.match(handlePreviewBlock, /const requestSignature = filterSignature\.value/)
assert.match(handlePreviewBlock, /previewSignature\.value = requestSignature/)
assert.doesNotMatch(libraryNodeSource, /rawDimensions/)
assert.doesNotMatch(libraryNodeSource, /props\.data\?\.sizes/)
assert.doesNotMatch(libraryNodeSource, /reverseAnalysis:\s*job/)
assert.match(libraryNodeSource, /二次裂变/)
assert.match(libraryNodeSource, /addNode\('materialVariation'/)
assert.match(libraryNodeSource, /sourceJobId:\s*currentJobId\.value/)
const variationHandoffBlock = (
  libraryNodeSource.match(/const addToVariation = \(\) => \{[\s\S]*?\n\}/)?.[0]
  || ''
)
assert.doesNotMatch(variationHandoffBlock, /\bjob_id\s*:/)
assert.doesNotMatch(libraryNodeSource, /taskSnapshot\s*:/)
assert.doesNotMatch(libraryNodeSource, /zipUrl\s*:/)
assert.match(libraryNodeSource, /AbortController/)
assert.match(libraryNodeSource, /mounted/)
assert.match(libraryNodeSource, /requestSequence/)
assert.match(libraryNodeSource, /getDspCreativeAutoRefreshStatus/)
assert.match(libraryNodeSource, /DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL/)
assert.match(libraryNodeSource, /autoRefreshRequestSequence/)
assert.match(libraryNodeSource, /autoRefreshRequestInFlight/)
assert.match(libraryNodeSource, /autoRefreshRequestController/)
assert.match(libraryNodeSource, /startAutoRefreshStatusPolling/)
assert.match(libraryNodeSource, /stopAutoRefreshStatusPolling/)
assert.match(libraryNodeSource, /window\.setInterval/)
assert.match(libraryNodeSource, /autoRefreshRequestController\?\.abort\(\)/)
assert.match(libraryNodeSource, /sanitizeDspCreativeAutoRefreshStatus/)
assert.match(libraryNodeSource, /formatDspAutoRefreshShanghaiTime/)
const autoRefreshBlock = (
  libraryNodeSource.match(
    /const refreshAutoRefreshStatus = async \(\) => \{[\s\S]*?\n\}\n\nconst startAutoRefreshStatusPolling/
  )?.[0]
  || ''
)
assert.match(autoRefreshBlock, /!mounted/)
assert.match(autoRefreshBlock, /autoRefreshRequestInFlight/)
assert.match(autoRefreshBlock, /previewing\.value/)
assert.match(autoRefreshBlock, /importing\.value/)
assert.match(autoRefreshBlock, /confirming\.value/)
assert.match(autoRefreshBlock, /actionBusy\.value/)
assert.match(autoRefreshBlock, /AbortController/)
assert.match(autoRefreshBlock, /autoRefreshRequestSequence/)
assert.match(autoRefreshBlock, /status:\s*'error'/)
assert.doesNotMatch(autoRefreshBlock, /errorMessage\.value/)
assert.doesNotMatch(autoRefreshBlock, /confirmDspCreativeJob/)
assert.doesNotMatch(autoRefreshBlock, /previewDspCreatives/)
assert.doesNotMatch(autoRefreshBlock, /importDspCreatives/)
const autoRefreshStartBlock = (
  libraryNodeSource.match(
    /const startAutoRefreshStatusPolling = \(\) => \{[\s\S]*?\n\}\n\n/
  )?.[0]
  || ''
)
assert.ok(
  autoRefreshStartBlock.indexOf('refreshAutoRefreshStatus()') >= 0
    && autoRefreshStartBlock.indexOf('refreshAutoRefreshStatus()')
      < autoRefreshStartBlock.indexOf('window.setInterval'),
  '自动更新状态轮询必须 mount 后立即读取，再按 60 秒轮询'
)
assert.match(autoRefreshStartBlock, /DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL/)
const mountedBlock = (
  libraryNodeSource.match(/onMounted\(\(\) => \{[\s\S]*?\n\}\)/)?.[0]
  || ''
)
const unmountedBlock = (
  libraryNodeSource.match(/onUnmounted\(\(\) => \{[\s\S]*?\n\}\)/)?.[0]
  || ''
)
assert.match(mountedBlock, /startAutoRefreshStatusPolling\(\)/)
assert.match(unmountedBlock, /stopAutoRefreshStatusPolling\(\)/)
const saveNodeStateBlock = (
  libraryNodeSource.match(
    /const saveNodeState = \(\) => \{[\s\S]*?\n\}\n\nconst abortAutoRefreshStatusRequest/
  )?.[0]
  || ''
)
assert.doesNotMatch(saveNodeStateBlock, /autoRefreshStatus|autoRefreshError/)
assert.doesNotMatch(libraryNodeSource, /自动生成\s*FRW|立即自动生成|autoGenerateFrw/)
assert.doesNotMatch(libraryNodeSource, /props\.data\?\.candidates/)
assert.doesNotMatch(libraryNodeSource, /props\.data\?\.job\b/)
assert.match(libraryNodeSource, /selected_ids:\s*\[\.\.\.selectedIds\.value\]/)
const handleImportBlock = (
  libraryNodeSource.match(/const handleImport = async \(\) => \{[\s\S]*?\n\}\n\nconst stopPolling/)?.[0]
  || ''
)
assert.match(handleImportBlock, /sizes:\s*normalizedDimensions\.value/)
assert.match(handleImportBlock, /normalizedDimensions\.value\.length === 0/)
assert.match(handleImportBlock, /canImportDspPreview/)
assert.match(handleImportBlock, /筛选条件已变化，请重新预览/)
assert.match(libraryNodeSource, /!normalizedDimensions\.length/)
assert.match(libraryNodeSource, /resolveDspFrwCostSummary/)
assert.match(libraryNodeSource, /costSummary\.value\.fromPersistedEstimate === true/)
assert.match(libraryNodeSource, /!costSummary\.value\.invalidPersistedEstimate/)
assert.match(libraryNodeSource, /成本估算无效，请重新导入并完成 GMI 反向/)
assert.doesNotMatch(libraryNodeSource, /sizes:\s*costSummary\.value\.sizes/)
assert.match(libraryNodeSource, /getDspCreativeGifDownloads\(result\)/)
assert.match(libraryNodeSource, /下载该 GIF/)
assert.match(libraryNodeSource, /DspGifResultPreview/)
assert.match(libraryNodeSource, /buildDspGifPreviewCatalog/)
assert.match(libraryNodeSource, /activePreviewKey/)
assert.match(libraryNodeSource, /const qualityBlocked = computed/)
assert.match(libraryNodeSource, /quality_gate/)
assert.match(libraryNodeSource, /重新选择素材/)
assert.match(libraryNodeSource, /v-if="!qualityBlocked && variantGroups\.length"/)
assert.match(
  libraryNodeSource,
  /v-if="!qualityBlocked && \(data\.selected \|\| previewItems\.length\)"/
)
assert.match(
  libraryNodeSource,
  /v-if="qualityBlocked"[\s\S]*?改用本地保字动效[\s\S]*?@click="handleRetry"/
)
assert.match(libraryNodeSource, /本地保字模式：0 次 FRW/)
const handleConfirmBlock = (
  libraryNodeSource.match(/const handleConfirmFrw = async \(\) => \{[\s\S]*?\n\}\n\nconst handleCancel/)?.[0]
  || ''
)
assert.match(handleConfirmBlock, /experiment_groups:\s*\[\.\.\.DSP_GIF_VARIANTS\]/)
assert.match(handleConfirmBlock, /sizes:\s*normalizedDimensions\.value/)
assert.match(handleConfirmBlock, /expected_calls:\s*costSummary\.value\.totalCalls/)
assert.match(libraryNodeSource, /actionBusy\.value = 'preview'/)
assert.match(libraryNodeSource, /actionBusy\.value = 'import'/)
assert.match(libraryNodeSource, /wilson_ctr/)
assert.match(libraryNodeSource, /A-E CTR 实验登记/)
assert.doesNotMatch(libraryNodeSource, /A-E 进入率实验绑定/)
assert.match(libraryNodeSource, /进入率如指落地页到达率/)
assert.match(libraryNodeSource, /实验结论/)
assert.match(libraryNodeSource, /样本门槛/)
assert.match(libraryNodeSource, /登记范围/)
assert.match(libraryNodeSource, /数据窗口/)
assert.match(libraryNodeSource, /shouldPollDspCreativeJob/)
assert.match(libraryNodeSource, /刷新当前任务/)
assert.match(libraryNodeSource, /window\.addEventListener\('focus', handleWindowFocus\)/)
assert.match(libraryNodeSource, /window\.removeEventListener\('focus', handleWindowFocus\)/)
assert.match(taskCenterSource, /v-if="canDelete\(item\)"/)
assert.match(taskCenterSource, /v-if="canCleanup\(item\)"/)
assert.match(taskCenterSource, /isDspCreativeQualityBlocked/)
assert.match(taskCenterSource, /!qualityBlocked\(item\)[\s\S]*?canRetryDspCreativeJob/)
assert.match(taskCenterSource, /qualityBlocked\(item\)\s*\?\s*'已拦截'/)
assert.match(taskCenterSource, /const filteredJobs = computed\(\(\) => jobs\.value\)/)
assert.doesNotMatch(taskCenterSource, /getDspCreativeJobMediaTypes/)
assert.doesNotMatch(taskCenterSource, /getDspCreativeJobSearchText/)
assert.doesNotMatch(taskCenterSource, /matchesDspJobStatusFilter/)
assert.doesNotMatch(taskCenterSource, /jobs\.value\.some/)
assert.match(taskCenterSource, /if \(mounted\) loadJobs\(\)/)
assert.match(taskCenterSource, /value="completed_with_errors"/)
assert.match(taskCenterSource, /listRequestInFlight/)
assert.match(taskCenterSource, /if \(listRequestInFlight && !abortExisting\) return/)
assert.match(taskCenterSource, /loadJobs\(\{ abortExisting: true \}\)/)
assert.match(taskCenterSource, /AbortController/)
assert.match(taskCenterSource, /mounted/)
assert.match(taskCenterSource, /requestSequence/)
assert.match(taskCenterSource, /progressClass[\s\S]{0,400}completed_with_errors/)
assert.match(canvasSource, /DspCreativeLibraryNode/)
assert.match(canvasSource, /DspCreativeTaskCenterNode/)
assert.match(canvasSource, /dspCreativeLibrary:\s*markRaw\(DspCreativeLibraryNode\)/)
assert.match(canvasSource, /dspCreativeTaskCenter:\s*markRaw\(DspCreativeTaskCenterNode\)/)
assert.match(canvasSource, /type:\s*'dspCreativeLibrary',\s*name:\s*'54DSP 优秀素材'/)
assert.match(canvasSource, /type:\s*'dspCreativeTaskCenter',\s*name:\s*'素材任务中心'/)
// src/stores/canvas.js 的默认值、每节点独立数组、以及「候选素材 / job 不得进默认值、
// 更不得写进项目文件」都搬去 tests/component/dspCreativeLibrary.spec.mjs 真跑了。

console.log('dspCreativeLibrary.test.mjs passed')
