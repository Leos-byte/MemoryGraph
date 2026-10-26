#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { repository, validateRelease } from './release-metadata.mjs';
import { checkSignedRelease } from './verify-signed-release.mjs';

function gh(args, { allowMissing = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw new Error(`Cannot run GitHub CLI: ${result.error.message}`);
  if (result.status !== 0) {
    if (allowMissing && /release not found|HTTP 404/.test(result.stderr)) return null;
    throw new Error(`GitHub CLI failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

export function validateDraft(release, { tag, sha, channel }) {
  if (!release.isDraft || release.isPrerelease !== (channel === 'beta') || release.tagName !== tag || release.targetCommitish !== sha) {
    throw new Error('Refusing to replace assets on a published, wrong-channel, or differently targeted release.');
  }
}

export function validateRemoteRefs({ main, tag }, sha) {
  if (main !== sha || tag !== sha) throw new Error('Remote main or tag moved since validation; aborting publication.');
}

export async function publish({ cwd = process.cwd(), env = process.env } = {}) {
  if (!env.GH_TOKEN) throw new Error('GH_TOKEN is required.');
  if (env.GH_REPO !== repository) throw new Error('Unexpected GitHub repository.');
  const metadata = validateRelease({ cwd, env });
  const source = resolve(cwd, env.RELEASE_DIR || 'signed-release');
  const assets = await checkSignedRelease({ source, version: metadata.version });
  const remoteRefs = () => validateRemoteRefs({
    main: gh(['api', `repos/${repository}/commits/main`, '--jq', '.sha']),
    tag: gh(['api', `repos/${repository}/commits/${metadata.tag}`, '--jq', '.sha']),
  }, metadata.sha);
  remoteRefs();
  if (gh(['api', `repos/${repository}`, '--jq', '.visibility']) !== 'public') throw new Error('Make the repository public before publishing.');
  const current = gh(['release', 'view', metadata.tag, '--json', 'isDraft,isPrerelease,tagName,targetCommitish'], { allowMissing: true });
  if (current !== null) {
    validateDraft(JSON.parse(current), metadata);
  } else {
    gh(['release', 'create', metadata.tag, '--verify-tag', '--target', metadata.sha, '--draft', ...(metadata.channel === 'beta' ? ['--prerelease'] : []),
      '--title', `MemGraph ${metadata.version}`,
      '--notes', `${metadata.channel === 'beta' ? 'Beta' : 'Stable'} release ${metadata.tag}\n\nCommit: ${metadata.sha}\n\nWindows x64: NSIS installer or zip. Linux x64: AppImage or tar.gz.\n\nPackages and updater metadata are covered by the Ed25519-signed release-manifest.json. This signature is not Windows Authenticode signing.\n\nMaintainer: complete docs/acceptance.md and review this draft before publishing.`]);
  }
  remoteRefs();
  validateDraft(JSON.parse(gh(['release', 'view', metadata.tag, '--json', 'isDraft,isPrerelease,tagName,targetCommitish'])), metadata);
  gh(['release', 'upload', metadata.tag, ...assets.map(name => resolve(source, name)), '--clobber']);
  console.log(`Uploaded ${assets.length} verified assets to draft ${metadata.channel} release ${metadata.tag}. No public release was made.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await publish();
  } catch (error) {
    console.error(`Publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}
