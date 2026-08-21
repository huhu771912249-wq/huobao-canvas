#!/usr/bin/env node
/**
 * Single entry point for the whole test suite.
 *
 * Two lanes coexist while the legacy suite is migrated:
 *
 *   lane A — legacy `tests/**\/*.test.mjs`: plain node scripts that assert at module
 *            scope and print `<name> passed`. Each one runs in its own process because
 *            many of them install globals (window, localStorage, fetch) that would leak
 *            between files inside a shared worker.
 *   lane B — component `tests/component/**\/*.spec.mjs`: vitest + jsdom + @vue/test-utils.
 *
 * Both lanes are discovered by globbing the filesystem. Nothing is hand-registered, so a
 * new test file is executed the moment it is written — the failure mode that let three
 * files sit unexecuted for a year (fixed by #44) cannot come back.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readdir } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Under vitest this module is served over http, so `import.meta.url` is not a file URL.
const moduleParent = new URL('..', import.meta.url)
const repoRoot = moduleParent.protocol === 'file:' ? fileURLToPath(moduleParent) : process.cwd()
const testsRoot = path.join(repoRoot, 'tests')

/** Directories under tests/ that belong to lane B and must not be run as bare node scripts. */
export const COMPONENT_DIRS = ['component']

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(absolute))
      continue
    }
    files.push(absolute)
  }
  return files
}

/** Lane A discovery: every `*.test.mjs` under tests/ that is not inside a component dir. */
export const discoverLegacyTests = async () => {
  const all = await walk(testsRoot)
  return all
    .filter(file => file.endsWith('.test.mjs'))
    .filter(file => {
      const relative = path.relative(testsRoot, file)
      return !COMPONENT_DIRS.includes(relative.split(path.sep)[0])
    })
    .map(file => path.relative(repoRoot, file))
}

/** Lane B discovery: every `*.spec.mjs` under tests/component/. */
export const discoverComponentTests = async () => {
  const all = await walk(testsRoot)
  return all
    .filter(file => file.endsWith('.spec.mjs'))
    .map(file => path.relative(repoRoot, file))
}

const runNode = (file) => new Promise((resolve) => {
  const child = spawn(process.execPath, [file], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  child.on('close', code => resolve({ file, code, stdout, stderr }))
})

const runLegacyLane = async () => {
  const files = await discoverLegacyTests()
  const concurrency = Math.max(1, Math.min(availableParallelism(), 8))
  const results = []
  let cursor = 0
  const worker = async () => {
    while (cursor < files.length) {
      const file = files[cursor++]
      const result = await runNode(file)
      results.push(result)
      process.stdout.write(result.code === 0 ? '.' : 'F')
    }
  }
  const startedAt = Date.now()
  await Promise.all(Array.from({ length: concurrency }, worker))
  process.stdout.write('\n')

  const failures = results.filter(result => result.code !== 0)
  for (const failure of failures) {
    process.stdout.write(`\n--- FAIL ${failure.file} (exit ${failure.code}) ---\n`)
    process.stdout.write(failure.stdout)
    process.stdout.write(failure.stderr)
  }
  const duration = ((Date.now() - startedAt) / 1000).toFixed(2)
  process.stdout.write(
    `legacy suite: ${results.length - failures.length}/${files.length} files passed in ${duration}s\n`
  )
  return failures.length === 0
}

const runComponentLane = async () => {
  const files = await discoverComponentTests()
  if (files.length === 0) {
    process.stdout.write('component suite: no *.spec.mjs files found\n')
    return true
  }
  // `vitest.mjs` is the published CLI entry but is not listed in the package `exports`,
  // so resolve the package root and join it manually.
  const require = createRequire(import.meta.url)
  const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [vitestBin, 'run', ...process.argv.slice(2)], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, CI: process.env.CI ?? 'true' }
    })
    child.on('close', resolve)
  })
  return code === 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const legacyOk = await runLegacyLane()
  const componentOk = await runComponentLane()
  process.stdout.write(
    `\ndiscovered by glob: ${(await discoverLegacyTests()).length} legacy test files`
      + ` + ${(await discoverComponentTests()).length} component spec files\n`
  )
  if (!legacyOk || !componentOk) process.exit(1)
}
