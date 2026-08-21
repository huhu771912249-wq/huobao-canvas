/**
 * Read the deployed site back and prove this release is the one being served.
 *
 * OPERATIONS.md is explicit that a local build and an HTTP 200 are not evidence
 * of a release. So this does two independent readbacks:
 *
 *   1. the live site serves the *hashed asset filenames* this build produced,
 *      which no stale `dist/` can fake;
 *   2. the backend `/health` is up, and its paired SHAs are reported.
 *
 * The frontend deploys before the backend, so by default a SHA pair that still
 * shows the previous release is reported but not fatal - the backend workflow
 * is the gate that makes /health truthful. Pass --require-paired-health once the
 * backend has been deployed to turn that into a hard check.
 *
 * Node standard library only: no dependency install on the deploy path.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const SHA_RE = /^[0-9a-f]{40}$/i

/** Keep real hosts out of CI logs; they are repository secrets. */
export function redactUrl(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//***${parsed.pathname}`
  } catch {
    return '***'
  }
}

/**
 * Pull the built asset references out of an index.html.
 * Vite emits hashed filenames, so these are unique to this exact build.
 *
 * References are returned exactly as written. The app is served under a base
 * path, so they must be resolved against the site URL with the URL API rather
 * than concatenated - a root-absolute "/base/assets/x.js" and a relative
 * "./assets/x.js" resolve differently and both occur in real builds.
 */
export function extractAssetPaths(html) {
  const paths = new Set()
  const patterns = [/<script[^>]+src="([^"]+)"/g, /<link[^>]+href="([^"]+)"/g]
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1]
      if (!value || /^(https?:)?\/\//.test(value) || value.startsWith('data:')) continue
      if (!/\.(js|css)$/.test(value)) continue
      paths.add(value)
    }
  }
  return [...paths]
}

/** Compare a /health body against the release we believe we shipped. */
export function evaluateHealth(payload, expected) {
  const problems = []
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { problems: ['/health did not return a JSON object'], paired: false }
  }
  if (payload.ok !== true) {
    problems.push(`/health reported ok=${JSON.stringify(payload.ok)}, expected true`)
  }
  const pairProblems = []
  for (const key of ['release_id', 'frontend_commit_sha', 'backend_commit_sha', 'build_time']) {
    const got = payload[key]
    if (got === undefined) pairProblems.push(`/health is missing ${key}`)
    else if (String(got) !== expected[key]) {
      pairProblems.push(`${key}: /health reported ${JSON.stringify(got)}, expected ${JSON.stringify(expected[key])}`)
    }
  }
  return { problems, pairProblems, paired: pairProblems.length === 0 }
}

/** Every response body must be consumed or cancelled, or the socket leaks and
 *  Node's HTTP client can abort the process on connection close. */
async function discard(response) {
  try {
    await response.body?.cancel()
  } catch {
    // Already consumed or never had a body: nothing to release.
  }
}

/**
 * GET with retries. Returns `{ status, json }`; `json` is only populated when
 * asked for, and the body is always released either way.
 */
async function getWithRetry(url, { attempts, delayMs, timeoutMs, log, json = false }) {
  let last = 'never attempted'
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
      if (response.ok) {
        if (!json) {
          await discard(response)
          return { status: response.status }
        }
        return { status: response.status, json: await response.json() }
      }
      last = `HTTP ${response.status}`
      await discard(response)
    } catch (error) {
      last = `request failed: ${error?.name ?? 'Error'}`
    }
    log(`  attempt ${attempt}/${attempts}: ${last}`)
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(`${redactUrl(url)} not OK after ${attempts} attempts (${last})`)
}

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function flag(name) {
  return process.argv.includes(name)
}

export async function run({ log = console.log } = {}) {
  const siteUrl = option('--site-url')
  const healthUrl = option('--health-url')
  const indexPath = option('--index', 'dist/index.html')
  const attempts = Number(option('--attempts', '10'))
  const delayMs = Number(option('--delay-ms', '6000'))
  const timeoutMs = Number(option('--timeout-ms', '10000'))
  const requirePaired = flag('--require-paired-health')
  const expected = {
    release_id: option('--release-id'),
    frontend_commit_sha: option('--frontend-sha'),
    backend_commit_sha: option('--backend-sha'),
    build_time: option('--build-time')
  }

  if (!siteUrl || !healthUrl) throw new Error('--site-url and --health-url are required')
  for (const key of ['frontend_commit_sha', 'backend_commit_sha']) {
    if (!SHA_RE.test(expected[key] || '')) throw new Error(`${key} must be 40 hexadecimal characters`)
  }
  if (!expected.release_id || !expected.build_time) {
    throw new Error('--release-id and --build-time are required')
  }
  expected.frontend_commit_sha = expected.frontend_commit_sha.toLowerCase()
  expected.backend_commit_sha = expected.backend_commit_sha.toLowerCase()

  const failures = []

  // 1. the site answers at all
  log(`checking ${redactUrl(siteUrl)} ...`)
  const indexResponse = await getWithRetry(siteUrl, { attempts, delayMs, timeoutMs, log })
  log(`  index OK (HTTP ${indexResponse.status})`)

  // 2. the site serves *this build's* hashed assets - the real readback.
  // A stale `dist/` or a symlink that never switched cannot fake these.
  const assets = extractAssetPaths(readFileSync(indexPath, 'utf8'))
  if (assets.length === 0) {
    failures.push(`no hashed assets found in ${indexPath}; cannot prove which build is live`)
  }
  for (const asset of assets) {
    const assetUrl = new URL(asset, siteUrl).toString()
    try {
      await getWithRetry(assetUrl, { attempts: 3, delayMs: 2000, timeoutMs, log })
      log(`  asset OK ${asset}`)
    } catch (error) {
      failures.push(`this build's asset is not being served: ${asset} (${error.message})`)
    }
  }

  // 3. the backend is up, and we report whether the pair is truthful yet
  log(`checking ${redactUrl(healthUrl)} ...`)
  let health
  try {
    const response = await getWithRetry(healthUrl, { attempts, delayMs, timeoutMs, log, json: true })
    health = response.json
  } catch (error) {
    failures.push(`backend health unreachable: ${error.message}`)
  }

  if (health !== undefined) {
    const { problems, pairProblems, paired } = evaluateHealth(health, expected)
    failures.push(...problems)
    if (paired) {
      log('  /health already reports this exact release pair')
    } else if (requirePaired) {
      failures.push(...pairProblems)
    } else {
      log('  /health does not report this release pair yet (expected: the backend deploys after the frontend):')
      for (const problem of pairProblems) log(`    - ${problem}`)
      log('  deploy the backend with this release id to make /health truthful.')
    }
  }

  if (failures.length > 0) {
    log('')
    log('RELEASE NOT CONFIRMED:')
    for (const failure of failures) log(`  - ${failure}`)
    return 1
  }
  log('')
  log('release confirmed by live readback')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
}
