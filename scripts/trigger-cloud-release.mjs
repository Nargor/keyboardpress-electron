// Triggers the GitHub Actions workflow (.github/workflows/release.yml) to build
// Windows, Linux, or Both, and publish them to GitHub Releases of this repo.
// Token: GH_TOKEN or GITHUB_TOKEN from process.env or local .env file.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const rawTarget = (process.argv[2] || 'all').toLowerCase()

// Same repo as the code — the app is released into keyboardpress-electron itself.
const OWNER = 'Nargor'
const REPO = 'keyboardpress-electron'
const REF = 'main'

let target = 'all'
if (rawTarget === 'win' || rawTarget === 'windows') {
  target = 'win'
} else if (rawTarget === 'linux') {
  target = 'linux'
} else if (rawTarget === 'win:linux' || rawTarget === 'win-linux' || rawTarget === 'windows-linux') {
  target = 'win-linux'
} else if (rawTarget === 'all') {
  target = 'all'
} else {
  console.error(`✖ Unknown target "${rawTarget}" (expected: win, linux, win:linux, all)`)
  process.exit(1)
}

let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token && existsSync(join(ROOT, '.env'))) {
  const env = readFileSync(join(ROOT, '.env'), 'utf8')
  token = env
    .match(/^\s*(?:GH_TOKEN|GITHUB_TOKEN)\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '')
}

if (!token) {
  console.error('✖ No GH_TOKEN found (checked environment and .env file).')
  process.exit(1)
}

const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'release-trigger-script'
}

console.log(`🚀 Triggering GitHub Actions workflow for target [${target}]...`)

try {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/release.yml/dispatches`,
    {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: REF,
        inputs: { target }
      })
    }
  )

  if (res.status === 204) {
    console.log(`✔ Successfully triggered release workflow on GitHub Actions for target: ${target}!`)
    console.log(`  Track progress: https://github.com/${OWNER}/${REPO}/actions`)
  } else {
    console.error(`✖ Failed to trigger workflow: ${res.status} ${(await res.text()).slice(0, 300)}`)
    process.exitCode = 1
  }
} catch (e) {
  console.error('✖ Unexpected error:', e)
  process.exitCode = 1
}
