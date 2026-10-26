#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const repository = 'Leos-byte/MemoryGraph';
export const releaseVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;

export function releaseChannel(version) {
  if (!releaseVersion.test(version ?? '')) throw new Error('Expected MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.N.');
  return version.includes('-') ? 'beta' : 'stable';
}

export function validateRelease({ cwd = process.cwd(), env = process.env } = {}) {
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') throw new Error('Release requires workflow_dispatch.');
  if (env.GITHUB_REPOSITORY !== repository) throw new Error(`Release is limited to ${repository}.`);
  if (env.GITHUB_REF !== 'refs/heads/main') throw new Error('Dispatch the release workflow on main, not a tag or feature branch.');
  const tag = env.RELEASE_TAG ?? '';
  const version = tag.slice(1);
  if (!tag.startsWith('v') || !releaseVersion.test(version)) throw new Error('Expected an existing vMAJOR.MINOR.PATCH[-beta.N] tag.');
  const channel = releaseChannel(version);
  const sha = env.RELEASE_SHA || env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('A full validated Git SHA is required.');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git('rev-parse', 'HEAD') !== sha) throw new Error('Checkout is not the requested release SHA.');
  if (git('rev-parse', 'refs/remotes/origin/main^{commit}') !== sha) throw new Error('Release SHA is not the fetched main HEAD.');
  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== sha) throw new Error('Existing tag does not point to main HEAD.');
  const pkg = JSON.parse(readFileSync(resolve(cwd, 'Source/package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(cwd, 'Source/package-lock.json'), 'utf8'));
  if (pkg.version !== version || lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('Tag, Source/package.json, and root package-lock versions must agree.');
  }
  for (const name of ['build', 'typecheck', 'test', 'test:e2e', 'verify', 'package', 'package:dir', 'release:sign']) {
    if (!pkg.scripts?.[name]) throw new Error(`Missing release script: ${name}`);
  }
  return { sha, version, tag, channel };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const metadata = validateRelease();
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required in Actions.');
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(metadata).map(([key, value]) => `${key}=${value}\n`).join(''));
    console.log(`Validated ${metadata.tag} at ${metadata.sha}.`);
  } catch (error) {
    console.error(`Release validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
