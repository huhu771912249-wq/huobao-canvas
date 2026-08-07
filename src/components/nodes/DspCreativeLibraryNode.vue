<template>
  <div class="dsp-library-node relative" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <section
      class="dsp-library-node__shell w-[920px] overflow-hidden rounded-2xl border bg-[var(--bg-secondary)] shadow-2xl"
      :class="data.selected ? 'border-cyan-400' : 'border-[var(--border-color)]'"
    >
      <header class="dsp-library-node__header flex items-start justify-between border-b border-[var(--border-color)] px-5 py-4">
        <div>
          <h3 class="text-base font-semibold text-[var(--text-primary)]">54DSP 优秀素材</h3>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">
            近 7 个完整自然日 · Asia/Shanghai · 高点击不等于高转化
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button class="node-icon-button" title="复制节点" @click="duplicateNode(id)">
            <n-icon :size="15"><CopyOutline /></n-icon>
          </button>
          <button class="node-icon-button" title="删除节点" @click="removeNode(id)">
            <n-icon :size="15"><TrashOutline /></n-icon>
          </button>
        </div>
      </header>

      <div class="nodrag space-y-4 p-5">
        <div class="dsp-status-overview rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-[var(--text-primary)]">每3天自动更新</div>
              <div class="mt-1 text-[11px] text-[var(--text-secondary)]">
                自动更新只抓取候选素材并生成 GMI 草稿，不调用、不消耗 FRW；FRW 仍需手动确认。
              </div>
            </div>
            <span class="status-pill">
              {{ autoRefreshStatus.enabled ? '已启用' : '未启用' }} · {{ autoRefreshStatusLabel }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-4 gap-2 text-xs">
            <div class="rounded-lg bg-black/10 p-2">
              <div class="text-[var(--text-secondary)]">上次成功</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ autoRefreshLastSuccess }}</div>
            </div>
            <div class="rounded-lg bg-black/10 p-2">
              <div class="text-[var(--text-secondary)]">下次运行</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ autoRefreshNextRun }}</div>
            </div>
            <div class="rounded-lg bg-black/10 p-2">
              <div class="text-[var(--text-secondary)]">素材库</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ autoRefreshStatus.catalogSize }} 条</div>
            </div>
            <div class="rounded-lg bg-black/10 p-2">
              <div class="text-[var(--text-secondary)]">重试</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ autoRefreshStatus.retryCount }} 次</div>
            </div>
          </div>
          <div class="mt-2 grid grid-cols-4 gap-2 text-[11px] text-[var(--text-secondary)]">
            <span>候选 {{ autoRefreshStatus.candidateCount }}</span>
            <span>新增 {{ autoRefreshStatus.addedCount }}</span>
            <span>更新 {{ autoRefreshStatus.updatedCount }}</span>
            <span>未变化 {{ autoRefreshStatus.unchangedCount }}</span>
            <span>分析复用 {{ autoRefreshStatus.analysisReusedCount }}</span>
            <span>新生成分析 {{ autoRefreshStatus.analysisGeneratedCount }}</span>
            <span>失败 {{ autoRefreshStatus.failedCount }}</span>
          </div>
          <div v-if="autoRefreshIncident" class="service-incident mt-3">
            <strong>{{ autoRefreshIncident.title }}</strong>
            <span>{{ autoRefreshIncident.summary }}</span>
            <small>{{ autoRefreshIncident.detail }}</small>
          </div>
        </div>

        <div class="dsp-filter-panel grid grid-cols-4 gap-3">
          <label class="field">
            <span>开始日期</span>
            <input v-model="filters.startDate" type="date" />
          </label>
          <label class="field">
            <span>结束日期（不含）</span>
            <input v-model="filters.endDate" type="date" />
          </label>
          <label class="field col-span-2">
            <span>账户（可选）</span>
            <input v-model="filters.account" placeholder="全部账户" />
          </label>
        </div>

        <div class="dsp-filter-panel grid grid-cols-[1fr_1.2fr] gap-3">
          <fieldset class="rounded-xl border border-[var(--border-color)] p-3">
            <legend class="px-1 text-xs text-[var(--text-secondary)]">素材类型</legend>
            <div class="flex gap-4">
              <label v-for="type in mediaOptions" :key="type" class="check-label">
                <input
                  type="checkbox"
                  :checked="filters.mediaTypes.includes(type)"
                  @change="toggleMedia(type)"
                />
                {{ type }}
              </label>
            </div>
            <p class="mt-2 text-[11px] text-amber-400">仅 BANNER / NATIVE / VIDEO，POP 已排除</p>
          </fieldset>
          <label class="field">
            <span>尺寸（逗号分隔）</span>
            <input v-model="dimensionText" placeholder="300x100, 300x250, 720x240, 200x200" />
          </label>
        </div>

        <div class="dsp-filter-panel grid grid-cols-4 gap-3">
          <label class="field">
            <span>最低曝光</span>
            <input v-model.number="filters.minImpressions" type="number" min="0" />
          </label>
          <label class="field">
            <span>最低点击</span>
            <input v-model.number="filters.minClicks" type="number" min="0" />
          </label>
          <label class="field">
            <span>每组 Top N</span>
            <input v-model.number="filters.topN" type="number" min="1" max="50" />
          </label>
          <div class="flex items-end">
            <button
              class="primary-button w-full"
              :disabled="previewing || Boolean(actionBusy) || filters.mediaTypes.length === 0"
              @click="handlePreview"
            >
              <n-spin v-if="previewing" :size="14" />
              <span v-if="previewing">正在读取 {{ previewElapsedSeconds }} 秒</span>
              <span v-else>先预览候选</span>
            </button>
          </div>
        </div>

        <div v-if="previewing" class="notice notice-info">
          正在从 54DSP 拉取近 7 天素材，通常需要 1–2 分钟；完成后会自动展示，请勿重复点击。
        </div>
        <div v-if="sampleWarning" class="notice notice-warning">{{ sampleWarning }}</div>
        <div v-if="mediaTypeError" class="notice notice-error">请至少选择一种媒体类型</div>
        <div v-if="candidateIdentityWarning" class="notice notice-warning">
          {{ candidateIdentityWarning }}
        </div>
        <div class="notice notice-info">
          排名按同类型、同尺寸的 Wilson CTR 下界比较；曝光、点击和花费用于复核，不代表转化结果。
        </div>
        <div v-if="serviceIncident" class="service-incident">
          <strong>{{ serviceIncident.title }}</strong>
          <span>{{ serviceIncident.summary }}</span>
          <small>{{ serviceIncident.detail }}</small>
        </div>

        <div v-if="candidates.length" class="dsp-candidate-gallery overflow-hidden rounded-xl border border-[var(--border-color)]">
          <div class="flex items-center justify-between bg-[var(--bg-tertiary)] px-3 py-2">
            <div class="text-xs text-[var(--text-secondary)]">
              可选 {{ candidateRows.length }} 条，已选 {{ selectedIds.length }} 条
            </div>
            <button class="text-xs text-cyan-400 hover:text-cyan-300" @click="toggleAll">
              {{ allSelected ? '取消全选' : '全选当前候选' }}
            </button>
          </div>
          <div class="max-h-72 overflow-auto">
            <table class="w-full table-fixed text-left text-xs">
              <thead class="sticky top-0 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                <tr>
                  <th class="w-9 px-2 py-2"></th>
                  <th class="w-28 px-2 py-2">
                    <button
                      class="sort-header"
                      title="候选排序：Creative"
                      @click="setCandidateSort('creative')"
                    >
                      Creative <span>{{ candidateSortArrow('creative') }}</span>
                    </button>
                  </th>
                  <th class="w-24 px-2 py-2">
                    <button
                      class="sort-header"
                      title="候选排序：类型和尺寸"
                      @click="setCandidateSort('type')"
                    >
                      类型 / 尺寸 <span>{{ candidateSortArrow('type') }}</span>
                    </button>
                  </th>
                  <th
                    v-for="column in [
                      ['impressions', '曝光'],
                      ['clicks', '点击'],
                      ['ctr', 'CTR'],
                      ['spend', '花费'],
                      ['wilson', 'Wilson']
                    ]"
                    :key="column[0]"
                    class="px-2 py-2 text-right"
                  >
                    <button
                      class="sort-header ml-auto justify-end"
                      :title="`候选排序：${column[1]}`"
                      @click="setCandidateSort(column[0])"
                    >
                      {{ column[1] }} <span>{{ candidateSortArrow(column[0]) }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sortedCandidateRows"
                  :key="row.id"
                  class="border-t border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
                >
                  <td class="px-2 py-2">
                    <input
                      type="checkbox"
                      :checked="selectedIds.includes(row.id)"
                      @change="toggleCandidate(row.id)"
                    />
                  </td>
                  <td class="truncate px-2 py-2 font-mono" :title="row.id">
                    {{ row.id }}
                  </td>
                  <td class="px-2 py-2">
                    <div>{{ candidateMedia(row.candidate) }}</div>
                    <div class="text-[var(--text-secondary)]">
                      {{ candidateDimension(row.candidate) || '未知尺寸' }}
                    </div>
                  </td>
                  <td class="px-2 py-2 text-right">{{ formatInteger(candidateImpressions(row.candidate)) }}</td>
                  <td class="px-2 py-2 text-right">{{ formatInteger(candidateClicks(row.candidate)) }}</td>
                  <td class="px-2 py-2 text-right">{{ formatDspCandidateCtrPercent(row.candidate) }}</td>
                  <td class="px-2 py-2 text-right">{{ formatMoney(candidateSpend(row.candidate)) }}</td>
                  <td class="px-2 py-2 text-right font-mono text-cyan-400">
                    {{ formatScore(candidateWilson(row.candidate)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="dsp-import-action grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[var(--border-color)] p-3">
          <div>
            <div class="text-sm font-medium text-[var(--text-primary)]">导入并执行 GMI 反向</div>
            <div class="mt-1 text-xs text-[var(--text-secondary)]">
              只下载已勾选原素材并创建后台 job；不在此步骤调用 FRW。
            </div>
          </div>
          <button
            class="secondary-button"
            :disabled="!hasPreview || !selectedIds.length || !normalizedDimensions.length || importing || Boolean(actionBusy)"
            @click="handleImport"
          >
            <n-spin v-if="importing" :size="14" />
            <span v-else-if="!hasPreview">先预览并选择素材</span>
            <span v-else-if="!selectedIds.length">请选择至少 1 条素材</span>
            <span v-else-if="!normalizedDimensions.length">请先选择输出尺寸</span>
            <span v-else>明确导入 {{ selectedIds.length }} 条</span>
          </button>
        </div>

        <div v-if="currentJobId" class="dsp-job-panel rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-xs text-[var(--text-secondary)]">Job {{ currentJobId }}</div>
              <div class="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {{ jobStep }} · {{ progress }}%
              </div>
            </div>
            <span class="status-pill">{{ jobStatusLabel }}</span>
          </div>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
            <div class="h-full rounded-full bg-cyan-400 transition-all" :style="{ width: `${progress}%` }"></div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg bg-black/10 p-3">
              <div class="text-[var(--text-secondary)]">GMI 反向</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ reverseState }}</div>
            </div>
            <div class="rounded-lg bg-black/10 p-3">
              <div class="text-[var(--text-secondary)]">FRW GIF 五套裂变</div>
              <div class="mt-1 text-[var(--text-primary)]">{{ frwState }}</div>
            </div>
          </div>

          <div
            v-if="qualityBlocked"
            class="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4"
          >
            <div class="text-sm font-semibold text-amber-300">已停止生成</div>
            <div class="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {{ qualityBlockMessage }}。可改用本地保字动效，保留原图文字和人物且不调用 FRW。
            </div>
            <div class="mt-3 flex gap-2">
              <button class="secondary-button" @click="handleRetry">改用保字动效</button>
              <button class="ghost-button" @click="handleChooseNewMaterial">重新选择素材</button>
            </div>
          </div>
          <div v-if="jobError && !qualityBlocked" class="notice notice-error mt-3">
            <strong>失败原因：</strong>{{ jobError }}
          </div>
          <div v-if="costEstimateRequiresReimport && !qualityBlocked" class="notice notice-error mt-3">
            成本估算无效，请重新导入并完成 GMI 反向
          </div>

          <div v-if="!qualityBlocked" class="mt-3 flex flex-wrap gap-2">
            <button
              class="ghost-button"
              :disabled="Boolean(actionBusy)"
              @click="handleRefreshJob"
            >
              刷新当前任务
            </button>
            <button v-if="canConfirmFrw" class="secondary-button" @click="openCostPreview">
              {{ isLocalTextSafe ? '生成本地保字 5 套 GIF' : '查看成本并生成 5 套 GIF' }}
            </button>
            <button v-if="canCancel" class="ghost-button" @click="handleCancel">取消</button>
            <button v-if="canRetry" class="ghost-button" @click="handleRetry">重试</button>
            <a v-if="downloadUrl" :href="downloadUrl" download class="ghost-button">下载 GIF ZIP</a>
            <button
              v-if="currentJobId"
              class="ghost-button"
              :disabled="Boolean(actionBusy)"
              @click="addToVariation"
            >
              加入二次裂变
            </button>
          </div>
          <p v-if="!qualityBlocked" class="mt-3 text-[11px] text-amber-400">
            {{ isLocalTextSafe ? '本地保字模式：0 次 FRW，不重绘原文字和人物' : '确认后才消耗 FRW GIF 五套裂变调用' }}
          </p>

          <div
            v-if="!qualityBlocked && ['completed', 'completed_with_errors'].includes(jobStatus)"
            class="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-semibold text-[var(--text-primary)]">
                  A-E CTR 实验登记
                </div>
                <div class="mt-1 text-[11px] text-[var(--text-secondary)]">
                  素材上传 DSP 后填入对应 Creative ID；只读曝光/点击，按 1000 曝光门槛和 Wilson CTR 选胜出方案。进入率如指落地页到达率，需要另接落地页埋点。
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="ghost-button"
                  :disabled="Boolean(actionBusy)"
                  @click="handleSaveExperimentBindings"
                >
                  保存 A-E ID
                </button>
                <button
                  class="secondary-button"
                  :disabled="Boolean(actionBusy) || !job?.experiment_bindings?.length"
                  @click="handleRefreshExperimentMetrics"
                >
                  刷新实验数据
                </button>
              </div>
            </div>
            <section
              v-for="source in experimentSources"
              :key="source.candidate_key"
              class="mt-3 rounded-lg border border-[var(--border-color)] p-3"
            >
              <div
                class="truncate text-[11px] text-[var(--text-secondary)]"
                :title="source.candidate_key"
              >
                来源 {{ source.creative_id }} · Campaign {{ source.campaign_id }}
              </div>
              <div class="mt-2 grid grid-cols-5 gap-2">
                <label
                  v-for="variant in DSP_GIF_VARIANTS"
                  :key="variant"
                  class="field"
                >
                  <span>{{ variant }} · Creative ID</span>
                  <input
                    v-model="bindingDrafts[experimentBindingKey(source.candidate_key, variant)]"
                    :placeholder="`上传后 ${variant} 的 ID`"
                  />
                </label>
              </div>
            </section>
            <div
              v-if="experimentMetrics"
              class="mt-3 space-y-2"
            >
              <div class="grid gap-2 rounded-lg border border-cyan-300/20 bg-black/10 p-3 text-[11px] text-[var(--text-secondary)] md:grid-cols-4">
                <div>
                  <span class="block text-[var(--text-primary)]">实验结论</span>
                  {{ experimentReadout.statusText }}
                </div>
                <div>
                  <span class="block text-[var(--text-primary)]">样本门槛</span>
                  {{ formatInteger(experimentReadout.minImpressions) }} 曝光/方案
                </div>
                <div>
                  <span class="block text-[var(--text-primary)]">登记范围</span>
                  {{ experimentReadout.sourceCount }} 个母素材 · {{ experimentReadout.variantCount }} 个方案
                </div>
                <div>
                  <span class="block text-[var(--text-primary)]">数据窗口</span>
                  {{ experimentReadout.windowText }}
                </div>
              </div>
              <div
                class="notice"
                :class="experimentMetrics.status === 'ready'
                  ? 'notice-info'
                  : 'notice-warning'"
              >
                {{
                  experimentMetrics.status === 'ready'
                    ? 'A-E 均达到样本门槛，已可比较'
                    : '数据不足：所有方案达到 1000 曝光前不判定赢家'
                }}
              </div>
              <div
                v-for="metricGroup in experimentMetricGroups"
                :key="metricGroup.candidate_key"
                class="overflow-hidden rounded-lg border border-[var(--border-color)]"
              >
                <div class="bg-black/10 px-3 py-2 text-xs">
                  胜出方案：
                  <strong class="text-cyan-300">
                    {{ metricGroup.winner?.variant || '待样本充足' }}
                    {{ metricGroup.winner?.experiment_label || '' }}
                  </strong>
                </div>
              <div class="grid grid-cols-5 divide-x divide-[var(--border-color)]">
                  <div
                    v-for="metric in metricGroup.variants"
                    :key="metric.variant"
                    class="p-2 text-center text-[10px]"
                  >
                    <strong>{{ metric.variant }} {{ metric.experiment_label }}</strong>
                    <span class="mt-1 block">{{ formatInteger(metric.impressions) }} 曝光</span>
                    <span class="block">{{ formatInteger(metric.clicks) }} 点击</span>
                    <span class="block">CTR {{ formatPercent(metric.ctr) }}</span>
                    <span class="block">Wilson {{ formatScore(metric.wilson_ctr) }}</span>
                  </div>
                </div>
                <DspH3UpgradeCard
                  v-if="metricGroup.winner?.variant"
                  :winner="metricGroup.winner"
                  :upgrade="h3UpgradeFor(metricGroup.candidate_key)"
                  :busy="Boolean(actionBusy)"
                  @create="handleCreateH3(metricGroup, $event)"
                  @retry="handleRetryH3(h3UpgradeFor(metricGroup.candidate_key))"
                  @cancel="handleCancelH3(h3UpgradeFor(metricGroup.candidate_key))"
                />
              </div>
            </div>
          </div>

          <div v-if="!qualityBlocked && variantGroups.length" class="mt-4 space-y-3">
            <div class="text-xs font-semibold text-[var(--text-primary)]">
              A-E 五套 GIF 文案与结果
            </div>
            <section
              v-for="group in variantGroups"
              :key="group.key"
              class="space-y-2 rounded-xl border border-[var(--border-color)] p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <div>
                  <div class="text-xs font-medium text-[var(--text-primary)]">
                    素材 {{ group.creativeId || '未返回' }}
                  </div>
                  <div class="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    广告类别：{{ group.category || '未返回' }}
                  </div>
                </div>
                <div
                  v-if="jobStatus === 'awaiting_confirmation' && group.candidateKey"
                  class="flex items-center gap-2"
                >
                  <template v-if="editingCandidateKey === group.candidateKey">
                    <button
                      class="ghost-button"
                      :disabled="copySaving"
                      @click="cancelCopyEdit"
                    >
                      取消
                    </button>
                    <button
                      class="secondary-button"
                      :disabled="copySaving"
                      @click="saveCopyEdit"
                    >
                      <n-spin v-if="copySaving" :size="12" />
                      <span v-else>保存文案</span>
                    </button>
                  </template>
                  <button
                    v-else
                    class="ghost-button"
                    :disabled="Boolean(actionBusy)"
                    @click="startCopyEdit(group)"
                  >
                    编辑文案
                  </button>
                </div>
              </div>
              <article
                v-for="result in group.results"
                :key="`${group.key}-${result.variant}`"
                class="rounded-xl bg-black/10 p-3 text-xs"
              >
                <strong class="text-cyan-300">
                  方案 {{ result.variant }} · {{ result.experimentLabel || '未标实验轴' }}
                </strong>
                <dl class="mt-2 grid grid-cols-[64px_1fr] gap-x-2 gap-y-2">
                  <dt class="text-[var(--text-secondary)]">中文标题</dt>
                  <dd v-if="editingCandidateKey === group.candidateKey">
                    <input
                      v-model="copyDrafts[result.variant].headline"
                      class="copy-input"
                      maxlength="120"
                    />
                  </dd>
                  <dd v-else>{{ result.headline || '未返回' }}</dd>
                  <dt class="text-[var(--text-secondary)]">正文</dt>
                  <dd v-if="editingCandidateKey === group.candidateKey">
                    <textarea
                      v-model="copyDrafts[result.variant].body"
                      class="copy-input min-h-16 resize-y"
                      maxlength="500"
                    ></textarea>
                  </dd>
                  <dd v-else>{{ result.body || '未返回' }}</dd>
                  <dt class="text-[var(--text-secondary)]">CTA</dt>
                  <dd v-if="editingCandidateKey === group.candidateKey">
                    <input
                      v-model="copyDrafts[result.variant].cta"
                      class="copy-input"
                      maxlength="80"
                    />
                  </dd>
                  <dd v-else>{{ result.cta || '未返回' }}</dd>
                  <dt class="text-[var(--text-secondary)]">动作提示</dt>
                  <dd>{{ result.motionPrompt || '未返回' }}</dd>
                </dl>
                <div
                  v-if="getDspCreativeGifDownloads(result).length"
                  class="mt-2 flex flex-wrap gap-2"
                >
                  <a
                    v-for="download in getDspCreativeGifDownloads(result)"
                    :key="download.gifUrl"
                    :href="download.gifUrl"
                    download
                    class="ghost-button"
                  >
                    {{ download.label || '下载该 GIF' }}
                  </a>
                </div>
              </article>
            </section>
          </div>
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" class="!bg-cyan-400" />
      <NodeHandleMenu
        :nodeId="id"
        nodeType="dspCreativeLibrary"
        :visible="showHandleMenu"
        :operations="[]"
      />
    </section>

    <Teleport to="body">
      <DspGifResultPreview
        v-if="!qualityBlocked && (data.selected || previewItems.length)"
        class="fixed right-6 top-24 z-50 max-h-[calc(100vh-120px)] w-[420px] overflow-auto"
        :items="previewItems"
        :active-key="activePreviewKey"
        :expected-count="expectedGifCount"
        :zip-url="downloadUrl"
        :opening-folder="openingDownloadFolder"
        @select="activePreviewKey = $event"
        @previous="selectAdjacentPreview(-1)"
        @next="selectAdjacentPreview(1)"
        @open-folder="handleOpenDownloadFolder"
      />
    </Teleport>

    <n-modal v-model:show="showCostPreview">
      <n-card class="w-[520px]" title="FRW GIF 五套裂变调用确认" :bordered="false" role="dialog">
        <div class="space-y-3 text-sm text-[var(--text-primary)]">
          <p>来源素材：{{ costSummary.sourceCount }} 个</p>
          <p>目标尺寸：{{ costSummary.sizeCount }} 个</p>
          <p>
            比例组：{{ costSummary.ratios.join(' / ') }}（{{ costSummary.ratioGroupCount }} 组）
          </p>
          <p>
            实验组：{{ costSummary.groups.join(' / ') }}（{{ costSummary.experimentGroupCount }} 组）
          </p>
          <div class="grid grid-cols-5 gap-2 text-center text-xs">
            <span class="rounded-lg bg-black/10 p-2">A<br />原版对照</span>
            <span class="rounded-lg bg-black/10 p-2">B<br />人脸近景</span>
            <span class="rounded-lg bg-black/10 p-2">C<br />动作冲击</span>
            <span class="rounded-lg bg-black/10 p-2">D<br />场景重构</span>
            <span class="rounded-lg bg-black/10 p-2">E<br />强色反差</span>
          </div>
          <p>
            每个来源：{{ costSummary.callsPerSource }} 次（{{ costSummary.ratioGroupCount }} 个比例 × 5 套）
          </p>
          <p class="rounded-xl bg-amber-500/10 p-3 font-semibold text-amber-400">
            {{ isLocalTextSafe
              ? `本地生成 ${costSummary.totalCalls} 组保字 GIF，FRW 调用 0 次`
              : `预计调用 FRW 生成 ${costSummary.totalCalls} 次，对应输出 GIF` }}
          </p>
          <p class="text-xs text-[var(--text-secondary)]">
            {{ isLocalTextSafe
              ? 'A-E 使用原图像素制作缩放、平移、扫光、色彩和边框动效，不让模型重画文字。'
              : 'A-E 均使用对应动作提示执行图生视频，最终只发布 GIF（GIF-only）；点击确认后才会产生付费调用。' }}
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <button class="ghost-button" @click="showCostPreview = false">返回</button>
            <button
              class="primary-button"
              :disabled="confirming || !canConfirmFrw"
              @click="handleConfirmFrw"
            >
              <n-spin v-if="confirming" :size="14" />
              <span v-else>{{ isLocalTextSafe ? '确认本地生成' : '确认并生成 5 套 GIF' }}</span>
            </button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NCard, NIcon, NModal, NSpin } from 'naive-ui'
import { CopyOutline, TrashOutline } from '@vicons/ionicons5'
import {
  bindDspCreativeExperiment,
  cancelDspCreativeJob,
  cancelDspH3Upgrade,
  confirmDspCreativeJob,
  createDspH3Upgrade,
  getDspCreativeAutoRefreshStatus,
  getDspCreativeJob,
  importDspCreatives,
  openDspCreativeDownloadFolder,
  previewDspCreatives,
  refreshDspCreativeExperiment,
  retryDspH3Upgrade,
  retryDspCreativeJob,
  updateDspCreativeCopy
} from '../../api/dspCreativeLibrary.js'
import {
  DEFAULT_DSP_MEDIA_TYPES,
  DEFAULT_DSP_THRESHOLDS,
  DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL,
  DSP_GIF_VARIANTS,
  DSP_CREATIVE_POLL_INTERVAL,
  MAX_DSP_SELECTED_IDS,
  buildDspPreviewFilterSignature,
  buildSelectableDspCandidateRows,
  buildDspCreativeLibraryPersistence,
  buildDspCreativePreviewPayload,
  buildDspGifPreviewCatalog,
  canCancelDspCreativeJob,
  canConfirmDspCreativeJob,
  canImportDspPreview,
  canRetryDspCreativeJob,
  clearDspCreativePreviewState,
  formatDspAutoRefreshShanghaiTime,
  formatDspCandidateCtrPercent,
  getDefaultShanghaiDateRange,
  getDspCreativeCandidates,
  getDspCreativeDownloadUrl,
  getDspCreativeExpectedGifCount,
  getDspCreativeGifDownloads,
  getDspCreativeGenerationResults,
  getDspCreativeJobId,
  getDspCreativeProgress,
  getSampleRiskWarning,
  isDspCreativeQualityBlocked,
  isDspPreviewResponseCurrent,
  normalizeDspDimensions,
  resolveDspDimensionSelection,
  resolveDspFrwCostSummary,
  sanitizeDspCreativeAutoRefreshStatus,
  sortSelectableDspCandidateRows,
  shouldPauseDspAutoRefreshStatus,
  shouldPollDspCreativeJob,
  unwrapDspCreativePayload,
  validateDspCreativeIdentifier
} from '../../utils/dspCreativeLibrary.js'
import { addNode, duplicateNode, nodes, removeNode, updateNode } from '../../stores/canvas.js'
import { normalizeServiceIncident } from '../../utils/workspaceUi.js'
import {
  createVisibilityPollingController,
  isDocumentVisible
} from '../../utils/visibilityPolling.js'
import DspGifResultPreview from '../dsp/DspGifResultPreview.vue'
import DspH3UpgradeCard from '../dsp/DspH3UpgradeCard.vue'
import NodeHandleMenu from './NodeHandleMenu.vue'

const props = defineProps({
  id: String,
  data: Object
})

const defaultRange = getDefaultShanghaiDateRange()
const mediaOptions = DEFAULT_DSP_MEDIA_TYPES
const filters = reactive({
  startDate: props.data?.startDate || defaultRange.startDate,
  endDate: props.data?.endDate || defaultRange.endDate,
  mediaTypes: Array.isArray(props.data?.mediaTypes)
    ? [...props.data.mediaTypes]
    : [...DEFAULT_DSP_MEDIA_TYPES],
  account: props.data?.account || '',
  minImpressions: props.data?.minImpressions ?? DEFAULT_DSP_THRESHOLDS.minImpressions,
  minClicks: props.data?.minClicks ?? DEFAULT_DSP_THRESHOLDS.minClicks,
  topN: props.data?.topN ?? DEFAULT_DSP_THRESHOLDS.topN
})
const dimensionText = ref(resolveDspDimensionSelection(props.data?.dimensions).join(', '))
const previewing = ref(false)
const previewElapsedSeconds = ref(0)
const importing = ref(false)
const confirming = ref(false)
const showCostPreview = ref(false)
const showHandleMenu = ref(false)
const errorMessage = ref('')
const candidates = ref([])
const selectedIds = ref(Array.isArray(props.data?.selectedIds) ? props.data.selectedIds : [])
const previewRef = ref(props.data?.previewRef || '')
const previewSignature = ref(props.data?.previewSignature || '')
const job = ref(null)
const currentJobId = ref(props.data?.jobId || '')
const autoRefreshStatus = ref(sanitizeDspCreativeAutoRefreshStatus({
  enabled: false,
  status: 'disabled'
}))
let pollTimer = null
let mounted = false
let pollGeneration = 0
let requestSequence = 0
let jobRequestInFlight = false
let jobRequestController = null
let autoRefreshTimer = null
let autoRefreshRequestController = null
let autoRefreshRequestSequence = 0
let autoRefreshRequestInFlight = false
let previewRequestController = null
let previewRequestSequence = 0
let previewElapsedTimer = null
const previewRevision = ref(0)
const actionBusy = ref('')
const activePreviewKey = ref('')
const openingDownloadFolder = ref(false)
const bindingDrafts = reactive({})
const candidateSort = reactive({
  key: 'wilson',
  direction: 'desc'
})
const editingCandidateKey = ref('')
const copySaving = ref(false)
const copyDrafts = reactive(Object.fromEntries(
  DSP_GIF_VARIANTS.map((variant) => [
    variant,
    {
      variant,
      headline: '',
      body: '',
      cta: ''
    }
  ])
))

const normalizedDimensions = computed(() => normalizeDspDimensions(
  dimensionText.value.split(',')
))
const filterSignature = computed(() => buildDspPreviewFilterSignature({
  ...filters,
  dimensions: normalizedDimensions.value
}))
const sampleWarning = computed(() => getSampleRiskWarning(filters))
const mediaTypeError = computed(() => filters.mediaTypes.length === 0)
const candidateRows = computed(() => buildSelectableDspCandidateRows(candidates.value))
const sortedCandidateRows = computed(() => sortSelectableDspCandidateRows(
  candidateRows.value,
  candidateSort.key,
  candidateSort.direction
))
const candidateIdentityWarning = computed(() => {
  const excluded = candidates.value.length - candidateRows.value.length
  return excluded > 0
    ? `${excluded} 条候选缺少唯一 candidate_key，已禁止勾选`
    : ''
})
const serviceIncident = computed(() => (
  errorMessage.value ? normalizeServiceIncident(errorMessage.value) : null
))
const autoRefreshIncident = computed(() => (
  autoRefreshStatus.value.error
    ? normalizeServiceIncident(autoRefreshStatus.value.error)
    : null
))
const hasPreview = computed(() => canImportDspPreview({
  previewRef: previewRef.value,
  previewSignature: previewSignature.value,
  currentSignature: filterSignature.value
}))
const allSelected = computed(() => (
  candidateRows.value.length > 0 && selectedIds.value.length === candidateRows.value.length
))
const progress = computed(() => getDspCreativeProgress(job.value || {}))
const jobStatus = computed(() => String(job.value?.status || '等待').toLowerCase())
const qualityBlocked = computed(() => (
  isDspCreativeQualityBlocked(job.value || {})
))
const isLocalTextSafe = computed(() => (
  String(job.value?.generation_mode || '') === 'local_text_safe'
))
const qualityBlockMessage = computed(() => (
  String(job.value?.quality_gate?.message || job.value?.error || '').trim()
  || '原素材文字区域过多，重绘容易产生乱码'
))
const jobStatusLabel = computed(() => (
  qualityBlocked.value
    ? '已拦截'
    : ({
        awaiting_confirmation: (
          isLocalTextSafe.value ? '待本地生成确认' : '待 FRW 确认'
        ),
        completed_with_errors: '部分完成（有错误）',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
      }[jobStatus.value] || jobStatus.value)
))
const autoRefreshStatusLabel = computed(() => ({
  disabled: '已关闭',
  stopping: '停止中',
  error: '状态失败',
  idle: '空闲',
  running: '更新中',
  standby: '待命'
}[autoRefreshStatus.value.status] || '状态失败'))
const autoRefreshLastSuccess = computed(() => (
  formatDspAutoRefreshShanghaiTime(autoRefreshStatus.value.lastSuccess)
))
const autoRefreshNextRun = computed(() => (
  formatDspAutoRefreshShanghaiTime(autoRefreshStatus.value.nextRun, '未安排')
))
const jobStep = computed(() => (
  job.value?.current_step
  || job.value?.currentStep
  || job.value?.result?.current_step
  || job.value?.result?.currentStep
  || '等待后端状态'
))
const jobError = computed(() => (
  job.value?.error?.message
  || job.value?.error
  || job.value?.failure_reason
  || (
    jobStatus.value === 'completed_with_errors'
      ? '部分素材处理失败，请到任务中心查看失败原因'
      : ''
  )
))
const reverseState = computed(() => (
  job.value?.reverse_status
  || job.value?.reverseStatus
  || job.value?.result?.reverse_status
  || (job.value?.reverse_analysis || job.value?.reverseAnalysis ? '已完成' : '等待/处理中')
))
const frwState = computed(() => (
  job.value?.frw_status || job.value?.frwStatus || job.value?.result?.frw_status || '未确认'
))
const downloadUrl = computed(() => getDspCreativeDownloadUrl(job.value || {}))
const variantResults = computed(() => getDspCreativeGenerationResults(job.value || {}))
const previewItems = computed(() => buildDspGifPreviewCatalog(job.value || {}))
const expectedGifCount = computed(() => getDspCreativeExpectedGifCount(job.value || {}))
const experimentMetrics = computed(() => (
  job.value?.experiment_metrics
  && typeof job.value.experiment_metrics === 'object'
    ? job.value.experiment_metrics
    : null
))
const experimentMetricGroups = computed(() => (
  Array.isArray(experimentMetrics.value?.groups)
    ? experimentMetrics.value.groups
    : []
))
const h3Upgrades = computed(() => (
  Array.isArray(job.value?.h3_upgrades) ? job.value.h3_upgrades : []
))
const h3UpgradeFor = (candidateKey) => {
  const matches = h3Upgrades.value.filter((upgrade) => (
    String(upgrade?.candidate_key || '') === String(candidateKey || '')
  ))
  return matches.at(-1) || null
}
const experimentReadout = computed(() => {
  const groups = experimentMetricGroups.value
  const sourceCount = groups.length || experimentSources.value.length
  const variantCount = groups.reduce(
    (total, group) => total + (
      Array.isArray(group?.variants) ? group.variants.length : 0
    ),
    0
  ) || sourceCount * DSP_GIF_VARIANTS.length
  const winnerCount = groups.filter((group) => group?.winner?.variant).length
  const ready = experimentMetrics.value?.status === 'ready'
  const window = experimentMetrics.value?.window || {}
  const start = String(window.start || '').slice(0, 10)
  const end = String(window.end || '').slice(0, 10)
  return {
    sourceCount,
    variantCount,
    minImpressions: Number(
      experimentMetrics.value?.min_impressions
      ?? experimentMetrics.value?.minImpressions
      ?? DEFAULT_DSP_THRESHOLDS.minImpressions
    ) || DEFAULT_DSP_THRESHOLDS.minImpressions,
    statusText: ready
      ? `可进入二轮：${winnerCount}/${sourceCount} 个母素材已有胜出方案`
      : `继续观察：${winnerCount}/${sourceCount} 个母素材达到判定条件`,
    windowText: start && end ? `${start} 至 ${end}` : '未记录'
  }
})
const experimentSources = computed(() => (
  Array.isArray(job.value?.selected_creatives)
    ? job.value.selected_creatives.filter((candidate) => candidate?.candidate_key)
    : []
))
const variantGroups = computed(() => {
  const groups = new Map()
  for (const result of variantResults.value) {
    const candidateKey = String(result.candidateKey || '')
    const creativeId = String(result.creativeId || '')
    const groupKey = candidateKey || creativeId || 'unknown'
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        candidateKey,
        creativeId,
        category: result.category || '',
        results: []
      })
    }
    groups.get(groupKey).results.push(result)
  }
  return [...groups.values()]
})
const canCancel = computed(() => canCancelDspCreativeJob(jobStatus.value, Boolean(actionBusy.value)))
const canRetry = computed(() => (
  canRetryDspCreativeJob(jobStatus.value, Boolean(actionBusy.value))
))
const canConfirmFrw = computed(() => (
  Boolean(currentJobId.value)
  && costSummary.value.sizes.length > 0
  && costSummary.value.totalCalls > 0
  && costSummary.value.fromPersistedEstimate === true
  && !costSummary.value.invalidPersistedEstimate
  && jobStatus.value === 'awaiting_confirmation'
  && canConfirmDspCreativeJob(jobStatus.value, Boolean(actionBusy.value))
))
const costSummary = computed(() => resolveDspFrwCostSummary(
  job.value || {},
  {
    selectedCreatives: selectedIds.value.length,
    sizes: normalizedDimensions.value,
    groups: DSP_GIF_VARIANTS
  }
))
const costEstimateRequiresReimport = computed(() => (
  jobStatus.value === 'awaiting_confirmation'
  && (
    costSummary.value.invalidPersistedEstimate
    || costSummary.value.fromPersistedEstimate !== true
  )
))

watch(previewItems, (items) => {
  if (!items.some((item) => item.key === activePreviewKey.value)) {
    activePreviewKey.value = items[0]?.key || ''
  }
}, { immediate: true })

const selectAdjacentPreview = (offset) => {
  const items = previewItems.value
  if (items.length < 2) return
  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.key === activePreviewKey.value)
  )
  const nextIndex = (currentIndex + offset + items.length) % items.length
  activePreviewKey.value = items[nextIndex].key
}

const handleOpenDownloadFolder = async () => {
  if (!currentJobId.value || openingDownloadFolder.value) return
  openingDownloadFolder.value = true
  errorMessage.value = ''
  try {
    await openDspCreativeDownloadFolder(currentJobId.value)
  } catch (error) {
    errorMessage.value = error?.message || '打开下载文件夹失败'
  } finally {
    openingDownloadFolder.value = false
  }
}

const candidateMedia = (candidate) => String(
  candidate?.media_type || candidate?.mediaType || candidate?.type || ''
).toUpperCase()
const candidateDimension = (candidate) => String(
  candidate?.dimension
  || candidate?.dimensions
  || candidate?.size
  || (candidate?.width && candidate?.height ? `${candidate.width}x${candidate.height}` : '')
)
const candidateImpressions = (candidate) => Number(candidate?.impressions ?? candidate?.imps ?? 0)
const candidateClicks = (candidate) => Number(candidate?.clicks ?? 0)
const candidateSpend = (candidate) => Number(candidate?.spend ?? 0)
const candidateWilson = (candidate) => Number(
  candidate?.wilson_ctr
  ?? candidate?.wilson_lower_bound
  ?? candidate?.wilsonScore
  ?? candidate?.wilson
  ?? 0
)
const formatInteger = (value) => Math.max(0, Number(value || 0)).toLocaleString('zh-CN')
const formatPercent = (value) => {
  const number = Number(value || 0)
  return `${(number <= 1 ? number * 100 : number).toFixed(2)}%`
}
const formatMoney = (value) => Number(value || 0).toFixed(2)
const formatScore = (value) => Number(value || 0).toFixed(5)

const setCandidateSort = (key) => {
  if (candidateSort.key === key) {
    candidateSort.direction = (
      candidateSort.direction === 'asc' ? 'desc' : 'asc'
    )
    return
  }
  candidateSort.key = key
  candidateSort.direction = ['creative', 'type'].includes(key)
    ? 'asc'
    : 'desc'
}

const candidateSortArrow = (key) => {
  if (candidateSort.key !== key) return '↕'
  return candidateSort.direction === 'asc' ? '↑' : '↓'
}

const startCopyEdit = (group) => {
  if (
    jobStatus.value !== 'awaiting_confirmation'
    || !group?.candidateKey
    || actionBusy.value
  ) return
  const byVariant = new Map(
    group.results.map((result) => [result.variant, result])
  )
  for (const variant of DSP_GIF_VARIANTS) {
    const source = byVariant.get(variant) || {}
    copyDrafts[variant] = {
      variant,
      headline: String(source.headline || ''),
      body: String(source.body || ''),
      cta: String(source.cta || '')
    }
  }
  editingCandidateKey.value = group.candidateKey
  errorMessage.value = ''
}

const cancelCopyEdit = () => {
  if (copySaving.value) return
  editingCandidateKey.value = ''
}

const saveCopyEdit = async () => {
  if (
    !currentJobId.value
    || !editingCandidateKey.value
    || copySaving.value
    || actionBusy.value
  ) return
  const variants = DSP_GIF_VARIANTS.map((variant) => ({
    variant,
    headline: String(copyDrafts[variant]?.headline || '').trim(),
    body: String(copyDrafts[variant]?.body || '').trim(),
    cta: String(copyDrafts[variant]?.cta || '').trim()
  }))
  if (variants.some((variant) => (
    !variant.headline || !variant.body || !variant.cta
  ))) {
    errorMessage.value = 'A-E 的标题、正文和 CTA 都不能为空'
    return
  }
  copySaving.value = true
  actionBusy.value = 'copy'
  errorMessage.value = ''
  try {
    const result = await updateDspCreativeCopy(currentJobId.value, {
      candidate_key: editingCandidateKey.value,
      variants
    })
    if (mounted) {
      applyJob(result)
      editingCandidateKey.value = ''
    }
  } catch (error) {
    if (mounted) {
      errorMessage.value = error?.message || '保存文案失败'
    }
  } finally {
    if (mounted) {
      copySaving.value = false
      if (actionBusy.value === 'copy') actionBusy.value = ''
    }
  }
}

const saveNodeState = () => {
  try {
    updateNode(props.id, buildDspCreativeLibraryPersistence({
      startDate: filters.startDate,
      endDate: filters.endDate,
      mediaTypes: [...filters.mediaTypes],
      dimensions: normalizedDimensions.value,
      account: filters.account,
      minImpressions: filters.minImpressions,
      minClicks: filters.minClicks,
      topN: filters.topN,
      selectedIds: selectedIds.value,
      previewRef: previewRef.value,
      previewSignature: previewSignature.value,
      jobId: currentJobId.value
    }))
    return true
  } catch (error) {
    errorMessage.value = error?.message || '节点状态超出安全保存范围'
    return false
  }
}

const abortAutoRefreshStatusRequest = () => {
  autoRefreshRequestSequence += 1
  autoRefreshRequestController?.abort()
  autoRefreshRequestController = null
  autoRefreshRequestInFlight = false
}

const stopAutoRefreshStatusPolling = () => {
  if (autoRefreshTimer) window.clearInterval(autoRefreshTimer)
  autoRefreshTimer = null
  abortAutoRefreshStatusRequest()
}

const refreshAutoRefreshStatus = async () => {
  if (shouldPauseDspAutoRefreshStatus({
    mounted,
    requestInFlight: autoRefreshRequestInFlight,
    previewing: previewing.value,
    importing: importing.value,
    confirming: confirming.value,
    actionBusy: actionBusy.value,
    jobStatus: jobStatus.value
  })) return
  const sequence = ++autoRefreshRequestSequence
  const controller = new AbortController()
  autoRefreshRequestController = controller
  autoRefreshRequestInFlight = true
  try {
    const result = await getDspCreativeAutoRefreshStatus({
      signal: controller.signal
    })
    if (!mounted || sequence !== autoRefreshRequestSequence) return
    autoRefreshStatus.value = result
  } catch (error) {
    if (
      error?.name !== 'AbortError'
      && mounted
      && sequence === autoRefreshRequestSequence
    ) {
      autoRefreshStatus.value = sanitizeDspCreativeAutoRefreshStatus({
        enabled: false,
        status: 'error',
        error: '自动更新状态读取失败'
      })
    }
  } finally {
    if (sequence === autoRefreshRequestSequence) {
      autoRefreshRequestController = null
      autoRefreshRequestInFlight = false
    }
  }
}

const startAutoRefreshStatusPolling = () => {
  if (autoRefreshTimer) window.clearInterval(autoRefreshTimer)
  if (!isDocumentVisible(document)) return
  refreshAutoRefreshStatus()
  autoRefreshTimer = window.setInterval(
    refreshAutoRefreshStatus,
    DSP_CREATIVE_AUTO_REFRESH_POLL_INTERVAL
  )
}

const toggleMedia = (type) => {
  const next = new Set(filters.mediaTypes)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  filters.mediaTypes = DEFAULT_DSP_MEDIA_TYPES.filter((item) => next.has(item))
}

const toggleCandidate = (creativeId) => {
  const next = new Set(selectedIds.value)
  if (next.has(creativeId)) next.delete(creativeId)
  else {
    if (next.size >= MAX_DSP_SELECTED_IDS) {
      errorMessage.value = `最多选择 ${MAX_DSP_SELECTED_IDS} 条候选素材`
      return
    }
    next.add(creativeId)
  }
  selectedIds.value = [...next]
  saveNodeState()
}

const toggleAll = () => {
  if (!allSelected.value && candidateRows.value.length > MAX_DSP_SELECTED_IDS) {
    errorMessage.value = `最多选择 ${MAX_DSP_SELECTED_IDS} 条候选素材，请缩小筛选范围`
    return
  }
  selectedIds.value = allSelected.value ? [] : candidateRows.value.map((row) => row.id)
  saveNodeState()
}

const applyJob = (result) => {
  if (!mounted) return
  const payload = unwrapDspCreativePayload(result)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errorMessage.value = '后端返回的任务结构无效'
    return
  }
  const nextJob = payload.job || payload
  if (!nextJob || typeof nextJob !== 'object' || Array.isArray(nextJob)) {
    errorMessage.value = '后端返回的任务结构无效'
    return
  }
  job.value = nextJob
  hydrateExperimentBindings(nextJob)
  currentJobId.value = getDspCreativeJobId(nextJob) || currentJobId.value
  saveNodeState()
}

const experimentBindingKey = (candidateKey, variant) => (
  `${candidateKey}\u0000${variant}`
)

const hydrateExperimentBindings = (nextJob) => {
  const persisted = new Map(
    (Array.isArray(nextJob?.experiment_bindings)
      ? nextJob.experiment_bindings
      : []
    ).map((binding) => [
      experimentBindingKey(binding.candidate_key, binding.variant),
      binding
    ])
  )
  for (const candidate of (
    Array.isArray(nextJob?.selected_creatives)
      ? nextJob.selected_creatives
      : []
  )) {
    const candidateKey = String(candidate?.candidate_key || '')
    if (!candidateKey) continue
    for (const variant of DSP_GIF_VARIANTS) {
      const key = experimentBindingKey(candidateKey, variant)
      const existing = persisted.get(key)
      if (!(key in bindingDrafts) || existing) {
        bindingDrafts[key] = String(existing?.creative_id || '')
      }
    }
  }
}

const handleSaveExperimentBindings = async () => {
  if (!currentJobId.value || actionBusy.value) return
  const bindings = experimentSources.value.flatMap((candidate) => (
    DSP_GIF_VARIANTS.map((variant) => ({
      candidate_key: candidate.candidate_key,
      variant,
      account_id: candidate.account_id,
      campaign_id: candidate.campaign_id,
      creative_id: String(
        bindingDrafts[
          experimentBindingKey(candidate.candidate_key, variant)
        ] || ''
      ).trim()
    }))
  ))
  if (
    !bindings.length
    || bindings.some((binding) => (
      !binding.account_id
      || !binding.campaign_id
      || !binding.creative_id
    ))
  ) {
    errorMessage.value = '请为每个来源完整填写 A-E 五个上传后的 Creative ID'
    return
  }
  actionBusy.value = 'experiment-bindings'
  errorMessage.value = ''
  try {
    applyJob(await bindDspCreativeExperiment(currentJobId.value, {
      bindings
    }))
  } catch (error) {
    errorMessage.value = error?.message || '保存实验 Creative ID 失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const handleRefreshExperimentMetrics = async () => {
  if (!currentJobId.value || actionBusy.value) return
  actionBusy.value = 'experiment-refresh'
  errorMessage.value = ''
  try {
    applyJob(await refreshDspCreativeExperiment(currentJobId.value, {
      start: filters.startDate,
      end: filters.endDate,
      min_impressions: 1000
    }))
  } catch (error) {
    errorMessage.value = error?.message || '刷新 A-E 实验数据失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const newH3IdempotencyKey = (prefix) => (
  `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`
)

const handleCreateH3 = async (metricGroup, outputSize = {}) => {
  if (!currentJobId.value || actionBusy.value || !metricGroup?.candidate_key) return
  actionBusy.value = 'h3-create'
  errorMessage.value = ''
  try {
    applyJob(await createDspH3Upgrade(currentJobId.value, {
      candidate_key: metricGroup.candidate_key,
      output_width: Number(outputSize.output_width || 1920),
      output_height: Number(outputSize.output_height || 1080),
      idempotency_key: newH3IdempotencyKey('h3-create')
    }))
    startPolling()
  } catch (error) {
    errorMessage.value = error?.message || 'H3 获胜视频提交失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const handleRetryH3 = async (upgrade) => {
  if (!currentJobId.value || actionBusy.value || !upgrade?.upgrade_id) return
  actionBusy.value = 'h3-retry'
  errorMessage.value = ''
  try {
    applyJob(await retryDspH3Upgrade(currentJobId.value, upgrade.upgrade_id, {
      idempotency_key: newH3IdempotencyKey('h3-retry')
    }))
    startPolling()
  } catch (error) {
    errorMessage.value = error?.message || 'H3 获胜视频重试失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const handleCancelH3 = async (upgrade) => {
  if (!currentJobId.value || actionBusy.value || !upgrade?.upgrade_id) return
  actionBusy.value = 'h3-cancel'
  errorMessage.value = ''
  try {
    applyJob(await cancelDspH3Upgrade(currentJobId.value, upgrade.upgrade_id))
  } catch (error) {
    errorMessage.value = error?.message || '取消 H3 获胜视频失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const invalidatePreview = () => {
  previewRevision.value += 1
  previewRequestController?.abort()
  previewRequestController = null
  previewing.value = false
  if (previewElapsedTimer) window.clearInterval(previewElapsedTimer)
  previewElapsedTimer = null
  previewElapsedSeconds.value = 0
  const cleared = clearDspCreativePreviewState()
  previewRef.value = cleared.previewRef
  previewSignature.value = cleared.previewSignature
  candidates.value = cleared.candidates
  selectedIds.value = cleared.selectedIds
  saveNodeState()
}

const handlePreview = async () => {
  if (filters.mediaTypes.length === 0 || previewing.value || actionBusy.value) {
    if (filters.mediaTypes.length === 0) {
      errorMessage.value = '请至少选择一种媒体类型'
    }
    return
  }
  abortAutoRefreshStatusRequest()
  previewRevision.value += 1
  const revision = previewRevision.value
  const sequence = ++previewRequestSequence
  const requestSignature = filterSignature.value
  previewRequestController?.abort()
  const cleared = clearDspCreativePreviewState()
  previewRef.value = cleared.previewRef
  previewSignature.value = cleared.previewSignature
  candidates.value = cleared.candidates
  selectedIds.value = cleared.selectedIds
  saveNodeState()
  const controller = new AbortController()
  previewRequestController = controller
  previewing.value = true
  previewElapsedSeconds.value = 0
  if (previewElapsedTimer) window.clearInterval(previewElapsedTimer)
  previewElapsedTimer = window.setInterval(() => {
    previewElapsedSeconds.value += 1
  }, 1000)
  actionBusy.value = 'preview'
  errorMessage.value = ''
  try {
    const payload = buildDspCreativePreviewPayload({
      ...filters,
      dimensions: normalizedDimensions.value
    })
    const result = await previewDspCreatives(payload, { signal: controller.signal })
    if (
      !mounted
      || revision !== previewRevision.value
      || !isDspPreviewResponseCurrent({
        requestSequence: sequence,
        latestSequence: previewRequestSequence,
        requestSignature,
        currentSignature: filterSignature.value
      })
    ) return
    const body = unwrapDspCreativePayload(result)
    candidates.value = getDspCreativeCandidates(result).filter(
      (candidate) => DEFAULT_DSP_MEDIA_TYPES.includes(candidateMedia(candidate))
    )
    if (candidateRows.value.length > MAX_DSP_SELECTED_IDS) {
      selectedIds.value = []
      previewRef.value = ''
      previewSignature.value = ''
      errorMessage.value = `候选超过 ${MAX_DSP_SELECTED_IDS} 条，请缩小筛选范围后重试`
    } else {
      selectedIds.value = candidateRows.value.map((row) => row.id)
      previewRef.value = validateDspCreativeIdentifier(
        body.id || body.preview_id || body.previewRef || body.snapshot_id || '',
        '预览标识'
      )
      if (previewRef.value) {
        previewSignature.value = requestSignature
      } else {
        previewSignature.value = ''
      }
    }
    saveNodeState()
  } catch (error) {
    if (error?.name !== 'AbortError' && mounted && sequence === previewRequestSequence) {
      errorMessage.value = error?.message || '候选预览失败'
    }
  } finally {
    if (sequence === previewRequestSequence) {
      previewRequestController = null
      previewing.value = false
      if (previewElapsedTimer) window.clearInterval(previewElapsedTimer)
      previewElapsedTimer = null
      if (actionBusy.value === 'preview') actionBusy.value = ''
    }
  }
}

const handleImport = async () => {
  if (
    previewRef.value
    && !canImportDspPreview({
      previewRef: previewRef.value,
      previewSignature: previewSignature.value,
      currentSignature: filterSignature.value
    })
  ) {
    invalidatePreview()
    errorMessage.value = '筛选条件已变化，请重新预览'
    return
  }
  if (
    !previewRef.value
    || !selectedIds.value.length
    || normalizedDimensions.value.length === 0
    || importing.value
    || actionBusy.value
  ) return
  abortAutoRefreshStatusRequest()
  importing.value = true
  actionBusy.value = 'import'
  errorMessage.value = ''
  try {
    const result = await importDspCreatives({
      preview_id: previewRef.value || undefined,
      selected_ids: [...selectedIds.value],
      sizes: normalizedDimensions.value,
      reverse_with_gmi: true
    })
    if (mounted) {
      applyJob(result)
      startPolling()
    }
  } catch (error) {
    if (mounted) errorMessage.value = error?.message || '素材导入失败'
  } finally {
    if (mounted) {
      importing.value = false
      if (actionBusy.value === 'import') actionBusy.value = ''
    }
  }
}

const stopPolling = () => {
  pollGeneration += 1
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  jobRequestController?.abort()
  jobRequestController = null
  jobRequestInFlight = false
}

const refreshJob = async (generation = pollGeneration) => {
  if (!mounted || !currentJobId.value || jobRequestInFlight) return
  const sequence = ++requestSequence
  const controller = new AbortController()
  jobRequestController = controller
  jobRequestInFlight = true
  try {
    const result = await getDspCreativeJob(currentJobId.value, { signal: controller.signal })
    if (!mounted || sequence !== requestSequence || generation !== pollGeneration) return
    applyJob(result)
    if (!shouldPollDspCreativeJob(job.value)) stopPolling()
  } catch (error) {
    if (error?.name !== 'AbortError' && mounted && sequence === requestSequence) {
      errorMessage.value = error?.message || '读取任务状态失败'
    }
  } finally {
    if (sequence === requestSequence) {
      jobRequestController = null
      jobRequestInFlight = false
    }
  }
}

const startPolling = async () => {
  stopPolling()
  if (!mounted || !currentJobId.value || !isDocumentVisible(document)) return
  const generation = pollGeneration
  await refreshJob(generation)
  if (mounted && generation === pollGeneration && shouldPollDspCreativeJob(job.value)) {
    pollTimer = window.setInterval(
      () => refreshJob(generation),
      DSP_CREATIVE_POLL_INTERVAL
    )
  }
}

const handleRefreshJob = async () => {
  if (!currentJobId.value || actionBusy.value) return
  actionBusy.value = 'refresh'
  errorMessage.value = ''
  try {
    await refreshJob(pollGeneration)
  } finally {
    if (mounted && actionBusy.value === 'refresh') {
      actionBusy.value = ''
    }
  }
}

const handleChooseNewMaterial = () => {
  stopPolling()
  job.value = null
  currentJobId.value = ''
  selectedIds.value = []
  activePreviewKey.value = ''
  errorMessage.value = ''
  saveNodeState()
}

const handleWindowFocus = () => {
  if (mounted && currentJobId.value && isDocumentVisible(document)) {
    refreshJob(pollGeneration)
  }
}

const visibilityPolling = createVisibilityPollingController({
  documentRef: document,
  onHidden: () => {
    stopAutoRefreshStatusPolling()
    stopPolling()
  },
  onVisible: () => {
    if (!mounted) return
    startAutoRefreshStatusPolling()
    if (currentJobId.value) startPolling()
  }
})

const openCostPreview = () => {
  if (!canConfirmFrw.value) return
  showCostPreview.value = true
}

const handleConfirmFrw = async () => {
  if (!currentJobId.value || !canConfirmFrw.value || confirming.value || actionBusy.value) return
  abortAutoRefreshStatusRequest()
  confirming.value = true
  actionBusy.value = 'confirm'
  errorMessage.value = ''
  try {
    const result = await confirmDspCreativeJob(currentJobId.value, {
      idempotency_key: `${currentJobId.value}-frw-gif-ae`,
      experiment_groups: [...DSP_GIF_VARIANTS],
      sizes: normalizedDimensions.value,
      expected_calls: costSummary.value.totalCalls
    })
    if (mounted) {
      applyJob(result)
      showCostPreview.value = false
      startPolling()
    }
  } catch (error) {
    errorMessage.value = error?.message || 'FRW 确认提交失败'
  } finally {
    if (mounted) {
      confirming.value = false
      actionBusy.value = ''
    }
  }
}

const handleCancel = async () => {
  if (!currentJobId.value || !canCancel.value || actionBusy.value) return
  actionBusy.value = 'cancel'
  try {
    const result = await cancelDspCreativeJob(currentJobId.value)
    if (mounted) {
      applyJob(result)
      if (!shouldPollDspCreativeJob(job.value)) stopPolling()
    }
  } catch (error) {
    errorMessage.value = error?.message || '取消失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const handleRetry = async () => {
  if (!currentJobId.value || !canRetry.value || actionBusy.value) return
  actionBusy.value = 'retry'
  try {
    const result = await retryDspCreativeJob(currentJobId.value)
    if (mounted) {
      applyJob(result)
      startPolling()
    }
  } catch (error) {
    errorMessage.value = error?.message || '重试失败'
  } finally {
    if (mounted) actionBusy.value = ''
  }
}

const addToVariation = () => {
  if (!currentJobId.value || actionBusy.value) return
  const currentNode = nodes.value.find((node) => node.id === props.id)
  addNode('materialVariation', {
    x: (currentNode?.position?.x || 0) + 820,
    y: currentNode?.position?.y || 0
  }, {
    label: '二次裂变',
    sourceJobId: currentJobId.value
  })
}

watch(filterSignature, (next, previous) => {
  if (next !== previous) invalidatePreview()
})

watch(
  () => props.data?.jobId,
  (next) => {
    if (next && next !== currentJobId.value) {
      currentJobId.value = next
      startPolling()
    }
  }
)

onMounted(() => {
  mounted = true
  window.addEventListener('focus', handleWindowFocus)
  visibilityPolling.start()
  startAutoRefreshStatusPolling()
  if (selectedIds.value.length > MAX_DSP_SELECTED_IDS) {
    errorMessage.value = `最多选择 ${MAX_DSP_SELECTED_IDS} 条候选素材`
    selectedIds.value = []
  }
  if (currentJobId.value) startPolling()
})
onUnmounted(() => {
  mounted = false
  window.removeEventListener('focus', handleWindowFocus)
  visibilityPolling.stop()
  stopAutoRefreshStatusPolling()
  previewRequestController?.abort()
  previewRequestController = null
  if (previewElapsedTimer) window.clearInterval(previewElapsedTimer)
  previewElapsedTimer = null
  stopPolling()
})
</script>

<style scoped>
.dsp-library-node__shell {
  border-color: rgba(159, 181, 215, 0.15);
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(23, 33, 49, 0.97), rgba(13, 19, 30, 0.98));
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.38);
}
.dsp-library-node__header {
  padding: 22px 24px;
  background:
    radial-gradient(circle at 15% 0%, rgba(56, 189, 248, 0.09), transparent 42%),
    rgba(14, 20, 31, 0.82);
}
.dsp-library-node__header h3 {
  font-size: 19px;
  letter-spacing: -0.02em;
}
.dsp-status-overview,
.dsp-filter-panel,
.dsp-candidate-gallery,
.dsp-import-action,
.dsp-job-panel {
  border-color: rgba(159, 181, 215, 0.14) !important;
  background: rgba(255, 255, 255, 0.025) !important;
}
.dsp-status-overview {
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(35, 178, 226, 0.09), rgba(101, 230, 189, 0.035)) !important;
}
.dsp-filter-panel {
  padding: 14px;
  border: 1px solid rgba(159, 181, 215, 0.12);
  border-radius: 18px;
}
.dsp-candidate-gallery {
  border-radius: 18px !important;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.025);
}
.dsp-candidate-gallery tbody tr {
  transition: background 160ms ease;
}
.dsp-candidate-gallery tbody tr:hover {
  background: rgba(101, 230, 189, 0.055) !important;
}
.dsp-import-action {
  padding: 16px !important;
  border-radius: 18px !important;
}
.dsp-job-panel {
  padding: 18px !important;
  border-radius: 20px !important;
}
.service-incident {
  display: grid;
  gap: 4px;
  padding: 13px 14px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 14px;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.18);
}
.service-incident span {
  color: #fca5a5;
  font-size: 12px;
}
.service-incident small {
  color: var(--text-secondary);
  line-height: 1.5;
}
.field {
  @apply flex flex-col gap-1 text-xs text-[var(--text-secondary)];
}
.field input {
  @apply min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors;
}
.field input:focus {
  @apply border-cyan-400;
}
.sort-header {
  @apply inline-flex w-full items-center gap-1 whitespace-nowrap text-[var(--text-secondary)] transition-colors hover:text-cyan-300;
}
.copy-input {
  @apply w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-cyan-400;
}
.check-label {
  @apply flex items-center gap-1.5 text-xs text-[var(--text-primary)];
}
.primary-button {
  @apply inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40;
}
.secondary-button {
  @apply inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40;
}
.ghost-button {
  @apply inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:border-cyan-400 hover:text-cyan-300;
}
.node-icon-button {
  @apply rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)];
}
.notice {
  @apply rounded-xl border px-3 py-2 text-xs;
}
.notice-warning {
  @apply border-amber-500/30 bg-amber-500/10 text-amber-400;
}
.notice-info {
  @apply border-sky-500/20 bg-sky-500/10 text-sky-300;
}
.notice-error {
  @apply border-red-500/30 bg-red-500/10 text-red-400;
}
.status-pill {
  @apply rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300;
}
</style>
