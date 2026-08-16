// Uploads already-built installers to THIS repo (keyboardpress-electron) as ONE
// real GitHub release. Works for a local Windows-only build or a CI run that has
// collected Windows + Linux artifacts into release/.
//
// Why this exists instead of `electron-builder --publish always`: that path
// uploads assets in parallel, and each upload independently checks "does this
// release exist yet?" before creating it. With nothing published yet both
// checks miss, both create a release, and the installer + blockmap end up
// split across two separate drafts. Here the release is created ONCE up
// front, then assets upload sequentially into it. CI therefore builds every
// platform first and publishes from a single job.
//
// package.json's `build.publish` block is the source of truth for where to
// publish (it also bakes app-update.yml into the app so electron-updater
// knows where to look, if auto-update is added later).
//
// Token: GH_TOKEN from the environment, or from a local .env file (gitignored).
// Needs write access to this repo.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'

const ROOT = process.cwd()
const DIST = join(ROOT, 'release') // electron-builder directories.output

class Fail extends Error {}
function fail(msg) {
  throw new Fail(msg)
}

try {
  await main()
} catch (e) {
  if (e instanceof Fail) {
    console.error(`\n✖ ${e.message}`)
  } else {
    console.error(`\n✖ Unexpected error: ${e?.stack || e}`)
  }
  process.exitCode = 1
}

async function main() {
  // ── Config: package.json build.publish is the single source of truth ──
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const publish = pkg?.build?.publish
  if (publish?.provider !== 'github' || !publish.owner || !publish.repo) {
    fail('package.json has no github publish config (build.publish provider/owner/repo).')
  }
  const { owner, repo } = publish
  const version = pkg.version
  const tag = publish.vPrefixedTagName === false ? version : `v${version}`

  // ── Token ──
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token && existsSync(join(ROOT, '.env'))) {
    const env = readFileSync(join(ROOT, '.env'), 'utf8')
    token = env
      .match(/^\s*(?:GH_TOKEN|GITHUB_TOKEN)\s*=\s*(.*)$/m)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, '')
  }
  if (!token) fail('No GH_TOKEN found (checked environment and .env).')

  const H = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': `${repo}-release-script`
  }

  if (!existsSync(DIST)) fail(`No release/ directory. Run a build first (npm run build:win).`)

  // ── Collect assets ──
  // release/ accumulates artifacts from previous versions on a dev machine,
  // so installers are matched by version. The latest*.yml updater feeds don't
  // carry the version in their filename — they're validated against it below.
  const INSTALLER_EXTS = ['.exe', '.blockmap', '.AppImage', '.deb', '.snap', '.dmg', '.zip', '.rpm']
  const FEEDS = ['latest.yml', 'latest-linux.yml', 'latest-mac.yml']

  const entries = readdirSync(DIST).filter((f) => statSync(join(DIST, f)).isFile())

  const installers = entries.filter(
    (f) =>
      INSTALLER_EXTS.some((ext) => f.endsWith(ext)) &&
      (f.includes(`-${version}`) || f.includes(`_${version}_`)) &&
      !f.includes('__uninstaller')
  )
  const feeds = entries.filter((f) => FEEDS.includes(f))

  if (installers.length === 0) {
    fail(`No installer artifacts for ${version} found in release/.\nRun the build first (npm run build:win).`)
  }

  for (const feedName of feeds) {
    const feed = parseYaml(readFileSync(join(DIST, feedName), 'utf8'))
    if (feed.version !== version) {
      fail(`release/${feedName} is for ${feed.version}, but package.json says ${version}. Rebuild.`)
    }
    const referenced = [feed.path, ...(feed.files ?? []).map((f) => f.url)].filter(Boolean)
    const missing = referenced.filter((name) => !installers.includes(name))
    if (missing.length > 0) {
      fail(`release/${feedName} points at ${missing.join(', ')}, which is not among the built artifacts.`)
    }
  }
  if (feeds.length === 0) {
    console.warn('⚠ No latest*.yml in release/ — auto-update will not see this release.')
  }

  const assets = [...installers, ...feeds]

  const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers: H })
  if (!listRes.ok) fail(`Failed to list releases: ${listRes.status} ${(await listRes.text()).slice(0, 400)}`)

  let release = (await listRes.json()).find((r) => r.tag_name === tag || r.name === version)

  if (release) {
    console.log(`Using existing release for ${tag} (id=${release.id})`)
  } else {
    // ── Release notes: this version's section of CHANGELOG.md ──
    const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')
    const escaped = version.replace(/\./g, '\\.')
    const section = changelog.match(
      new RegExp(`(?:^|\\n)## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`)
    )
    const notes = section?.[1]?.trim()
    if (!notes) fail(`No "## [${version}]" section found in CHANGELOG.md.`)

    console.log(`Creating release ${owner}/${repo} ${tag}`)
    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: version,
        body: notes,
        draft: false,
        prerelease: false
      })
    })
    if (!createRes.ok) {
      const refetchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers: H })
      if (refetchRes.ok) {
        release = (await refetchRes.json()).find((r) => r.tag_name === tag || r.name === version)
      }
      if (!release) {
        fail(`Create release failed: ${createRes.status} ${(await createRes.text()).slice(0, 400)}`)
      } else {
        console.log(`  found existing release created concurrently (id=${release.id})`)
      }
    } else {
      release = await createRes.json()
      console.log(`  release created (id=${release.id})`)
    }
  }

  console.log(`Uploading assets to release ${tag}...`)
  console.log(`  assets to upload: ${assets.join(', ')}`)

  for (const name of assets) {
    const path = join(DIST, name)
    const size = statSync(path).size

    const existingAsset = (release.assets || []).find((a) => a.name === name)
    if (existingAsset) {
      console.log(`  deleting previous asset ${name} (id=${existingAsset.id})...`)
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`,
        { method: 'DELETE', headers: H }
      )
    }

    console.log(`  uploading ${name} (${(size / 1024 / 1024).toFixed(1)} MB)...`)
    const upRes = await fetch(
      `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          ...H,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(size)
        },
        body: readFileSync(path)
      }
    )
    if (!upRes.ok)
      fail(`Upload of ${name} failed: ${upRes.status} ${(await upRes.text()).slice(0, 300)}`)
  }

  const final = await (
    await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
      headers: H
    })
  ).json()
  if (final.draft) fail('Release ended up as a draft — publish it manually.')
  console.log(`\n✔ Published ${final.tag_name}: ${final.html_url}`)
  console.log(`  assets: ${final.assets.map((a) => a.name).join(', ')}`)
}
