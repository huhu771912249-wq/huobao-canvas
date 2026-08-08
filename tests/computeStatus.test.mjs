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

const component = readFileSync(new URL('../src/components/ComputeStatusIndicator.vue', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/views/Canvas.vue', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/workspace/WorkspaceShell.vue', import.meta.url), 'utf8')
const login = readFileSync(new URL('../src/views/Login.vue', import.meta.url), 'utf8')
assert.match(component, /fetchComputeStatus/)
assert.match(component, /GPU利用率/)
assert.match(component, /当前任务/)
assert.match(component, /window\.setInterval\(refresh, 5000\)/)
assert.match(component, /huobao-compute-monitor-position-v1/)
assert.match(component, /@pointerdown="startDrag"/)
assert.match(component, /compute-task-drawer/)
assert.match(component, /查看详细状态/)
assert.match(canvas, /<ComputeStatusIndicator/)
assert.match(workspace, /<ComputeStatusIndicator/)
assert.doesNotMatch(login, /GPU 5090 ONLINE/)

console.log('computeStatus.test.mjs passed')
