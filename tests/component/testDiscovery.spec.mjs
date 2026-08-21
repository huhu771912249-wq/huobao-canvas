/**
 * The suite used to be registered by hand: `pretest` and `test` were two long `&&` chains
 * naming all 74 files. Three of them were simply never added, and sat unexecuted for a
 * year until #44 noticed. `scripts/run-tests.mjs` globs the filesystem instead; this spec
 * makes sure nobody quietly re-introduces a hand-maintained list.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverComponentTests, discoverLegacyTests } from '../../scripts/run-tests.mjs'

const repoRoot = process.cwd()
const readPackageJson = async () => JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))

describe('test discovery', () => {
  it('registers no test file by hand in package.json', async () => {
    const { scripts } = await readPackageJson()
    expect(scripts.pretest, '`pretest` was half of the hand-maintained list; it must stay gone').toBeUndefined()
    for (const [name, command] of Object.entries(scripts)) {
      expect(
        command.match(/tests\/[\w./-]+\.m?js/g) ?? [],
        `${name} names test files by hand — new files will silently never run`
      ).toEqual([])
    }
  })

  it('discovers every legacy node test on disk', async () => {
    const onDisk = (await readdir(path.join(repoRoot, 'tests'), { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
      .map(entry => path.join('tests', entry.name))
      .sort()

    expect(onDisk.length).toBeGreaterThan(0)
    expect(await discoverLegacyTests()).toEqual(onDisk)
  })

  it('discovers every component spec on disk', async () => {
    const onDisk = (await readdir(path.join(repoRoot, 'tests/component'), { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.spec.mjs'))
      .map(entry => path.join('tests/component', entry.name))
      .sort()

    expect(onDisk.length).toBeGreaterThan(0)
    expect((await discoverComponentTests()).sort()).toEqual(onDisk)
  })

  it('keeps the two lanes from stealing each other files', async () => {
    const legacy = await discoverLegacyTests()
    const component = await discoverComponentTests()
    expect(legacy.filter(file => component.includes(file))).toEqual([])
    expect(
      legacy.filter(file => file.startsWith('tests/component/')),
      'component tests must not be launched as bare node scripts'
    ).toEqual([])
  })
})
