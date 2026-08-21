import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchComputeStatus } from '../src/api/computeStatus.js'
import {
  computeTaskStageLabel,
  formatElapsedSeconds,
  formatGpuMemory,
  shortGpuName,
  summarizeComputeStatus
} from '../src/utils/computeStatus.js'

assert.equal(formatGpuMemory(16384, 32768), '16.0 / 32.0 GB')
assert.equal(shortGpuName('NVIDIA GeForce RTX 5090'), 'RTX 5090')
assert.equal(computeTaskStageLabel({ stage: 'upscale' }), 'SeedVR2 超分')
assert.equal(formatElapsedSeconds(65), '已运行 1分5秒')

const payload = {
  status: 'online',
  updated_at: '2026-08-08T10:30:00Z',
  gpus: [{
    name: 'NVIDIA GeForce RTX 5090',
    utilization_percent: 76,
    memory_used_mb: 24576,
    memory_total_mb: 32768,
    memory_utilization_percent: 75,
    temperature_c: 68,
    power_draw_w: 410,
    power_limit_w: 575
  }],
  comfyui: { online: true },
  queues: { total_waiting: 3, comfyui_running: 1 },
  current_tasks: [{ task_id: 'videoq-test', stage: 'generate', status: 'running' }]
}
const summary = summarizeComputeStatus(payload)
assert.equal(summary.gpuName, 'RTX 5090')
assert.equal(summary.memoryLabel, '24.0 / 32.0 GB')
assert.equal(summary.waiting, 3)
assert.equal(summary.running, 1)
assert.equal(summary.tasks.length, 1)

const result = await fetchComputeStatus({
  fetchImpl: async (_url, options) => {
    assert.equal(options.credentials, 'include')
    assert.equal(options.method, 'GET')
    return { ok: true, json: async () => ({ code: 200, data: payload }) }
  }
})
assert.deepEqual(result, payload)

// ComputeStatusIndicator.vue 自身的行为契约（折叠起步、停靠位置、Teleport、5 秒轮询、
// 拖拽不落盘、抽屉与详情开关）已经全部搬进 tests/component/computeStatusIndicator.spec.mjs，
// 用真组件断言，不再扫源码。下面只剩「两个外壳确实挂了这个组件」的接线守卫，
// 转换它需要挂载整个 Canvas / WorkspaceShell，属于后续批次。
const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/workspace/WorkspaceShell.vue', import.meta.url), 'utf8')
const login = readFileSync(new URL('../src/views/Login.vue', import.meta.url), 'utf8')
assert.match(canvas, /<ComputeStatusIndicator/)
assert.match(workspace, /<ComputeStatusIndicator/)
assert.doesNotMatch(login, /GPU 5090 ONLINE/)

console.log('computeStatus.test.mjs passed')
