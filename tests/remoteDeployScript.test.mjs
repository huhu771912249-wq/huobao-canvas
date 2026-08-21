/**
 * Exercise the server-side deploy/rollback scripts against a throwaway APP_ROOT.
 *
 * A workflow file cannot prove that an immutable release is never overwritten,
 * that a corrupt artifact never becomes `current`, or that a rollback refuses an
 * unverifiable target. These do.
 *
 * The scripts target GNU coreutils on Linux (`mv -T`, `sha256sum`) as
 * DEPLOYMENT.md prescribes, so this file skips on hosts without them.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DEPLOY_SH = join(here, '..', 'scripts', 'remote_deploy.sh')
const ROLLBACK_SH = join(here, '..', 'scripts', 'remote_rollback.sh')

function gnuToolsAvailable() {
  const probe = mkdtempSync(join(tmpdir(), 'gnu-probe-'))
  try {
    writeFileSync(join(probe, 'src'), 'x')
    writeFileSync(join(probe, 'dst'), 'y')
    // Probe by doing the actual work, not by parsing --version output.
    if (spawnSync('sha256sum', [join(probe, 'dst')]).status !== 0) return false
    return spawnSync('mv', ['-Tf', join(probe, 'src'), join(probe, 'dst')]).status === 0
  } catch {
    return false
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
}

if (!gnuToolsAvailable()) {
  console.log('remoteDeployScript.test.mjs skipped (needs GNU coreutils: sha256sum, mv -T)')
  process.exit(0)
}

const RELEASE_FIELDS = {
  frontend_commit_sha: 'a'.repeat(40),
  backend_commit_sha: 'b'.repeat(40),
  build_time: '2026-08-07T00:00:00Z'
}

function listFiles(root, prefix = '') {
  const out = []
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(root, rel))
    else out.push(rel)
  }
  return out
}

function writeChecksums(dir) {
  const lines = listFiles(dir)
    .filter((rel) => rel !== 'SHA256SUMS')
    .sort()
    .map((rel) => `${createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex')}  ./${rel}`)
  writeFileSync(join(dir, 'SHA256SUMS'), `${lines.join('\n')}\n`)
}

/** Build a release tarball shaped exactly like the CD build job produces. */
function buildArtifact(workDir, releaseId, { corrupt = false, withManifest = true, withDist = true } = {}) {
  const staging = mkdtempSync(join(workDir, `staging-${releaseId}-`))
  if (withDist) {
    mkdirSync(join(staging, 'dist', 'assets'), { recursive: true })
    writeFileSync(join(staging, 'dist', 'index.html'), `<html>${releaseId}</html>`)
    writeFileSync(join(staging, 'dist', 'assets', `index-${releaseId}.js`), `// ${releaseId}`)
  } else {
    mkdirSync(join(staging, 'dist'), { recursive: true })
    writeFileSync(join(staging, 'dist', 'README'), 'no index here')
  }
  if (withManifest) {
    writeFileSync(
      join(staging, 'release-manifest.json'),
      `${JSON.stringify({ schema_version: 1, release_id: releaseId, ...RELEASE_FIELDS }, null, 2)}\n`
    )
  }
  writeChecksums(staging)
  if (corrupt) writeFileSync(join(staging, 'dist', 'index.html'), '<html>tampered</html>')
  const tarDir = mkdtempSync(join(workDir, 'tar-'))
  const tarball = join(tarDir, `${releaseId}.tar.gz`)
  execFileSync('tar', ['-czf', tarball, '-C', staging, '.'])
  return tarball
}

function makeAppRoot(workDir) {
  const appRoot = join(workDir, `app-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(appRoot, 'releases'), { recursive: true })
  return appRoot
}

function runScript(script, appRoot, releaseId, { dryRun, tarball, reloadMarker } = {}) {
  const env = {
    ...process.env,
    APP_ROOT: appRoot,
    RELEASE_ID: releaseId,
    DRY_RUN: dryRun ? '1' : '0'
  }
  if (tarball) env.TARBALL = tarball
  if (reloadMarker) env.RELOAD_COMMAND = `touch ${reloadMarker}`
  const result = spawnSync('bash', [script], { env, encoding: 'utf8' })
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' }
}

const exists = (path) => {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}
const currentTarget = (appRoot) => {
  try {
    return basename(realpathSync(join(appRoot, 'current')))
  } catch {
    return ''
  }
}

const workDir = mkdtempSync(join(tmpdir(), 'fe-remote-deploy-'))

// --- dry run must be inert | 演练不得改动任何东西 ---

{
  const appRoot = makeAppRoot(workDir)
  const result = runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: true })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /DRY RUN/)
  assert.equal(exists(join(appRoot, 'releases', 'v1')), false)
  assert.equal(exists(join(appRoot, 'current')), false)
  assert.ok(!result.stdout.includes(appRoot), 'APP_ROOT 是机密，不进日志')
}

{
  const bare = join(workDir, 'bare')
  mkdirSync(bare, { recursive: true })
  const result = runScript(DEPLOY_SH, bare, 'v1', { dryRun: true })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /releases\/ does not exist/)
}

// --- a real deploy | 真实发布 ---

{
  const appRoot = makeAppRoot(workDir)
  const reloadMarker = join(workDir, `reloaded-${Date.now()}`)
  const result = runScript(DEPLOY_SH, appRoot, 'v1', {
    dryRun: false,
    tarball: buildArtifact(workDir, 'v1'),
    reloadMarker
  })
  assert.equal(result.code, 0, result.stderr)
  assert.equal(currentTarget(appRoot), 'v1')
  assert.ok(exists(join(appRoot, 'current', 'dist', 'index.html')))
  assert.ok(exists(join(appRoot, 'releases', 'v1', 'release-manifest.json')))
  assert.equal(exists(join(appRoot, 'releases', 'v1', '.git')), false, 'release 目录不得带 .git')
  assert.ok(exists(reloadMarker), 'reload 命令必须执行')
}

// --- immutability | 不可变 release ---

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  const before = readFileSync(join(appRoot, 'releases', 'v1', 'dist', 'index.html'), 'utf8')
  const result = runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /immutable releases are never overwritten/)
  assert.equal(readFileSync(join(appRoot, 'releases', 'v1', 'dist', 'index.html'), 'utf8'), before)
}

// --- a corrupt artifact must never go live | 校验值不对就不上线 ---

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  const result = runScript(DEPLOY_SH, appRoot, 'v2', {
    dryRun: false,
    tarball: buildArtifact(workDir, 'v2', { corrupt: true })
  })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /checksum verification failed/)
  assert.equal(currentTarget(appRoot), 'v1', 'current 不得移动')
}

{
  const appRoot = makeAppRoot(workDir)
  const result = runScript(DEPLOY_SH, appRoot, 'v1', {
    dryRun: false,
    tarball: buildArtifact(workDir, 'v1', { withDist: false })
  })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /no dist\/index\.html/)
  assert.equal(currentTarget(appRoot), '')
}

{
  const appRoot = makeAppRoot(workDir)
  const result = runScript(DEPLOY_SH, appRoot, 'v1', {
    dryRun: false,
    tarball: buildArtifact(workDir, 'v1', { withManifest: false })
  })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /no release-manifest\.json/)
}

// --- release id must not escape the releases directory | 目录穿越 ---

for (const bad of ['../evil', '..', 'a/b', 'v1;rm -rf /']) {
  const appRoot = makeAppRoot(workDir)
  const result = runScript(DEPLOY_SH, appRoot, bad, { dryRun: true })
  assert.notEqual(result.code, 0, `${bad} 必须被拒绝`)
  assert.match(result.stderr, /invalid RELEASE_ID/)
}

// --- rollback | 回滚 ---

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  runScript(DEPLOY_SH, appRoot, 'v2', { dryRun: false, tarball: buildArtifact(workDir, 'v2') })
  assert.equal(currentTarget(appRoot), 'v2')

  const dry = runScript(ROLLBACK_SH, appRoot, 'v1', { dryRun: true })
  assert.equal(dry.code, 0, dry.stderr)
  assert.equal(currentTarget(appRoot), 'v2', '演练不切换')

  const rolled = runScript(ROLLBACK_SH, appRoot, 'v1', { dryRun: false })
  assert.equal(rolled.code, 0, rolled.stderr)
  assert.equal(currentTarget(appRoot), 'v1')
  assert.ok(exists(join(appRoot, 'releases', 'v2')), '失败的 release 保留作取证')
  assert.equal(basename(realpathSync(join(appRoot, 'previous'))), 'v2')
}

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  const result = runScript(ROLLBACK_SH, appRoot, 'v9', { dryRun: false })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /does not exist/)
  assert.equal(currentTarget(appRoot), 'v1')
}

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  runScript(DEPLOY_SH, appRoot, 'v2', { dryRun: false, tarball: buildArtifact(workDir, 'v2') })
  rmSync(join(appRoot, 'releases', 'v1', 'release-manifest.json'))
  const result = runScript(ROLLBACK_SH, appRoot, 'v1', { dryRun: false })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /no manifest/)
  assert.equal(currentTarget(appRoot), 'v2')
}

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  runScript(DEPLOY_SH, appRoot, 'v2', { dryRun: false, tarball: buildArtifact(workDir, 'v2') })
  writeFileSync(join(appRoot, 'releases', 'v1', 'dist', 'index.html'), '<html>rotted on disk</html>')
  const result = runScript(ROLLBACK_SH, appRoot, 'v1', { dryRun: false })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /not a safe rollback target/)
  assert.equal(currentTarget(appRoot), 'v2')
}

// --- a release directory that lies about its own id | manifest 与目录名不一致 ---

{
  const appRoot = makeAppRoot(workDir)
  runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: false, tarball: buildArtifact(workDir, 'v1') })
  runScript(DEPLOY_SH, appRoot, 'v2', { dryRun: false, tarball: buildArtifact(workDir, 'v2') })
  const releaseDir = join(appRoot, 'releases', 'v1')
  const manifest = JSON.parse(readFileSync(join(releaseDir, 'release-manifest.json'), 'utf8'))
  manifest.release_id = 'somebody-elses-release'
  writeFileSync(join(releaseDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeChecksums(releaseDir)
  const result = runScript(ROLLBACK_SH, appRoot, 'v1', { dryRun: false })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /but the directory is/)
  assert.equal(currentTarget(appRoot), 'v2')
}

// --- current must be a symlink, never a real directory | current 必须是软链 ---

{
  const appRoot = makeAppRoot(workDir)
  mkdirSync(join(appRoot, 'current'))
  const result = runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: true })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /not a symlink/)
}

// A dangling current (target deleted by hand) must not be silently ignored.
{
  const appRoot = makeAppRoot(workDir)
  symlinkSync(join(appRoot, 'releases', 'gone'), join(appRoot, 'current'))
  const result = runScript(DEPLOY_SH, appRoot, 'v1', { dryRun: true })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /current release/)
}

rmSync(workDir, { recursive: true, force: true })
console.log('remoteDeployScript.test.mjs passed')
