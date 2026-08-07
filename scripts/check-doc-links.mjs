import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const docs = fs.readdirSync(root).filter((name) => name.endsWith('.md'))
const localLink = /\[[^\]]+\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g
const failures = []

for (const name of docs) {
  const source = fs.readFileSync(path.join(root, name), 'utf8')
  for (const match of source.matchAll(localLink)) {
    const target = decodeURIComponent(match[1].split('#', 1)[0])
    if (!target) continue
    const resolved = path.resolve(root, path.dirname(name), target)
    if (!fs.existsSync(resolved)) failures.push(`${name}: missing ${target}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`checked ${docs.length} markdown files`)
