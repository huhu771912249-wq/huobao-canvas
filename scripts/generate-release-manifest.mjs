import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const SHA_RE = /^[0-9a-f]{40}$/i

export function buildManifest({ releaseId, frontendSha, backendSha, buildTime }) {
  for (const [name, value] of Object.entries({ frontendSha, backendSha })) {
    if (!SHA_RE.test(value || '')) {
      throw new Error(`${name} must be 40 hexadecimal characters`)
    }
  }
  if (!releaseId || !buildTime) throw new Error('releaseId and buildTime are required')
  return {
    schemaVersion: 1,
    releaseId,
    frontendSha: frontendSha.toLowerCase(),
    backendSha: backendSha.toLowerCase(),
    buildTime
  }
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main() {
  const output = option('--output')
  if (!output) throw new Error('--output is required')
  const manifest = buildManifest({
    releaseId: option('--release-id') || process.env.RELEASE_ID,
    frontendSha: option('--frontend-sha') || process.env.FRONTEND_COMMIT_SHA,
    backendSha: option('--backend-sha') || process.env.BACKEND_COMMIT_SHA,
    buildTime: option('--build-time') || process.env.BUILD_TIME
  })
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
