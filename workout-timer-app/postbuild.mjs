import { readdir, rm, cp, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const root = resolve(__dirname, '..')
const dist = resolve(__dirname, 'dist')

// Clear previous build artifacts from root
const rootEntries = await readdir(root)
for (const entry of rootEntries) {
  const entryPath = join(root, entry)
  const isDir = (await stat(entryPath)).isDirectory()
  if (isDir && entry !== 'workout-timer-app' && entry !== '.git' && entry !== '.vs' && entry !== 'backups') {
    await rm(entryPath, { recursive: true, force: true })
  } else if (!isDir && ['index.html', 'favicon.svg', 'icons.svg'].includes(entry)) {
    await rm(entryPath, { force: true })
  }
}

// Copy dist contents to root
await cp(dist, root, { recursive: true, force: true })

// Remove dist folder
await rm(dist, { recursive: true, force: true })

console.log('Build artifacts deployed to root. dist/ cleaned.')
