import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateHealth, extractAssetPaths, redactUrl, run } from '../scripts/verify-release-health.mjs'

const FRONTEND_SHA = 'a'.repeat(40)
const BACKEND_SHA = 'b'.repeat(40)
const EXPECTED = {
  release_id: 'v1.2.3',
  frontend_commit_sha: FRONTEND_SHA,
  backend_commit_sha: BACKEND_SHA,
  build_time: '2026-08-07T00:00:00Z'
}
const healthBody = (overrides = {}) => ({ ok: true, ...EXPECTED, ...overrides })

// --- asset extraction: this is what proves *which build* is live | 证明线上是这次构建 ---

const INDEX_HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-D4f9Xk2a.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-9Bc1Ze7Q.css">
<link rel="icon" href="/favicon.ico">
<link rel="modulepreload" href="./assets/vendor-77aQ1p.js">
<script src="https://cdn.example.com/analytics.js"></script>
</head><body><div id="app"></div></body></html>`

const assets = extractAssetPaths(INDEX_HTML)
assert.deepEqual(assets.sort(), [
  '/assets/index-9Bc1Ze7Q.css',
  '/assets/index-D4f9Xk2a.js',
  './assets/vendor-77aQ1p.js'
].sort(), '引用按原样返回，由 URL 解析处理 base path')
assert.ok(!assets.some((path) => path.includes('cdn.example.com')), '外部脚本不算本次产物')
assert.ok(!assets.includes('/favicon.ico'), '非 js/css 不作为版本证据')
assert.deepEqual(extractAssetPaths('<html><body>nothing</body></html>'), [])

// The real build is served under a base path, so root-absolute references carry
// it and must not be re-prefixed by hand.
const BASE_PATH_HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/huobao-canvas/assets/index-DR2uuuYo.js"></script>
<link rel="stylesheet" crossorigin href="/huobao-canvas/assets/index-Dyv-281A.css">
<link rel="icon" type="image/svg+xml" href="/huobao-canvas/logo.png" />
</head><body></body></html>`
assert.deepEqual(extractAssetPaths(BASE_PATH_HTML).sort(), [
  '/huobao-canvas/assets/index-DR2uuuYo.js',
  '/huobao-canvas/assets/index-Dyv-281A.css'
])
assert.equal(
  new URL('/huobao-canvas/assets/index-DR2uuuYo.js', 'https://example.com/huobao-canvas/').pathname,
  '/huobao-canvas/assets/index-DR2uuuYo.js',
  'base path 不得被重复拼接'
)

// --- health evaluation | /health 判定 ---

assert.deepEqual(evaluateHealth(healthBody(), EXPECTED).problems, [])
assert.equal(evaluateHealth(healthBody(), EXPECTED).paired, true)
assert.equal(evaluateHealth(healthBody({ chat_workers: 3 }), EXPECTED).paired, true, '额外字段不影响判定')

const stale = evaluateHealth(healthBody({ frontend_commit_sha: 'c'.repeat(40) }), EXPECTED)
assert.equal(stale.paired, false)
assert.equal(stale.problems.length, 0, '前端 SHA 不匹配属于配对问题，不是服务问题')
assert.match(stale.pairProblems[0], /frontend_commit_sha/)

const down = evaluateHealth(healthBody({ ok: false }), EXPECTED)
assert.deepEqual(down.problems, ['/health reported ok=false, expected true'])

const unknown = evaluateHealth(
  { ok: true, release_id: 'unknown', frontend_commit_sha: 'unknown', backend_commit_sha: 'unknown', build_time: 'unknown' },
  EXPECTED
)
assert.equal(unknown.paired, false)
assert.equal(unknown.pairProblems.length, 4, '未注入版本信息的服务不能算发布成功')

assert.deepEqual(evaluateHealth(null, EXPECTED).problems, ['/health did not return a JSON object'])
assert.deepEqual(evaluateHealth([1, 2], EXPECTED).problems, ['/health did not return a JSON object'])

// --- log redaction: deploy targets are secrets | 真实域名不进日志 ---

assert.equal(redactUrl('https://real.example.com/health'), 'https://***/health')
assert.equal(redactUrl('http://user:pw@10.0.0.4:8080/health'), 'http://***/health')
assert.equal(redactUrl('not a url'), '***')

// --- end to end against a real socket | 真实 HTTP 往返 ---

const workDir = mkdtempSync(join(tmpdir(), 'release-health-'))
const indexPath = join(workDir, 'index.html')
writeFileSync(indexPath, INDEX_HTML)

function startServer({ servedAssets, health, basePathServed = '/' }) {
  const server = createServer((request, response) => {
    const path = request.url.split('?')[0]
    if (path === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(health))
      return
    }
    if (path === '/' || path === basePathServed || servedAssets.includes(path)) {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html></html>')
      return
    }
    response.writeHead(404)
    response.end('not found')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

async function runCheck({ servedAssets, health, extraArgs = [], basePath = '/', index = indexPath }) {
  const { server, port } = await startServer({ servedAssets, health, basePathServed: basePath })
  const base = `http://127.0.0.1:${port}${basePath}`
  const savedArgv = process.argv
  const lines = []
  process.argv = [
    'node', 'verify-release-health.mjs',
    '--site-url', base,
    '--health-url', `http://127.0.0.1:${port}/health`,
    '--index', index,
    '--release-id', EXPECTED.release_id,
    '--frontend-sha', FRONTEND_SHA,
    '--backend-sha', BACKEND_SHA,
    '--build-time', EXPECTED.build_time,
    '--attempts', '1',
    '--delay-ms', '0',
    ...extraArgs
  ]
  try {
    const code = await run({ log: (line) => lines.push(String(line)) })
    return { code, output: lines.join('\n') }
  } finally {
    process.argv = savedArgv
    server.close()
  }
}

/** Resolve build-time asset references the same way the checker does. */
const servedPathsFor = (html, siteUrl) =>
  extractAssetPaths(html).map((asset) => new URL(asset, siteUrl).pathname)

const allAssets = servedPathsFor(INDEX_HTML, 'http://127.0.0.1/')

// Happy path: every asset of this build is live and /health already reports the pair.
const ok = await runCheck({ servedAssets: allAssets, health: healthBody() })
assert.equal(ok.code, 0, ok.output)
assert.match(ok.output, /release confirmed by live readback/)

// The real deployment shape: the app lives under a base path. Concatenating the
// site URL with a root-absolute asset path would produce /huobao-canvas/huobao-canvas/...
// and 404 on a perfectly good release.
const basePathIndex = join(workDir, 'base-path-index.html')
writeFileSync(basePathIndex, BASE_PATH_HTML)
const withBasePath = await runCheck({
  servedAssets: servedPathsFor(BASE_PATH_HTML, 'http://127.0.0.1/huobao-canvas/'),
  health: healthBody(),
  basePath: '/huobao-canvas/',
  index: basePathIndex
})
assert.equal(withBasePath.code, 0, withBasePath.output)
assert.match(withBasePath.output, /release confirmed by live readback/)

// The failure this check exists for: the symlink did not actually switch, so the
// site still serves the previous build's hashed assets.
const staleAssets = await runCheck({ servedAssets: ['/assets/index-OLDBUILD.js'], health: healthBody() })
assert.equal(staleAssets.code, 1, '线上没有本次产物必须判失败')
assert.match(staleAssets.output, /RELEASE NOT CONFIRMED/)
assert.match(staleAssets.output, /index-D4f9Xk2a\.js/)

// Frontend deploys first, so an un-updated pair is reported but not fatal by default.
const beforeBackend = await runCheck({
  servedAssets: allAssets,
  health: healthBody({ frontend_commit_sha: 'f'.repeat(40) })
})
assert.equal(beforeBackend.code, 0, beforeBackend.output)
assert.match(beforeBackend.output, /does not report this release pair yet/)

// ...and fatal once the operator asserts the backend has already been deployed.
const afterBackend = await runCheck({
  servedAssets: allAssets,
  health: healthBody({ frontend_commit_sha: 'f'.repeat(40) }),
  extraArgs: ['--require-paired-health']
})
assert.equal(afterBackend.code, 1)
assert.match(afterBackend.output, /frontend_commit_sha/)

// A backend that is down fails the release even when the static files are fine.
const backendDown = await runCheck({ servedAssets: allAssets, health: healthBody({ ok: false }) })
assert.equal(backendDown.code, 1)
assert.match(backendDown.output, /ok=false/)

// Bad inputs must fail loudly rather than silently checking nothing.
await assert.rejects(async () => {
  const savedArgv = process.argv
  process.argv = ['node', 'verify-release-health.mjs', '--site-url', 'http://x', '--health-url', 'http://x/health',
    '--release-id', 'v1', '--frontend-sha', 'short', '--backend-sha', BACKEND_SHA, '--build-time', 't']
  try {
    await run({ log: () => {} })
  } finally {
    process.argv = savedArgv
  }
}, /40 hexadecimal/)

console.log('releaseHealthCheck.test.mjs passed')
