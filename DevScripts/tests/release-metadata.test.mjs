import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateRelease } from '../release-metadata.mjs';

function fixture(t, version = '0.2.0-beta.1') {
  const cwd = mkdtempSync(resolve(tmpdir(), 'memgraph-release-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'release-test@example.invalid');
  git('config', 'user.name', 'Release Test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  const scripts = Object.fromEntries(['build', 'typecheck', 'test', 'test:e2e', 'verify', 'package', 'package:dir', 'release:sign'].map(name => [name, 'test']));
  mkdirSync(resolve(cwd, 'Source'));
  writeFileSync(resolve(cwd, 'Source/package.json'), JSON.stringify({ version, scripts }));
  writeFileSync(resolve(cwd, 'Source/package-lock.json'), JSON.stringify({ version, packages: { '': { version } } }));
  git('add', '.');
  git('commit', '-m', 'fixture');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', sha);
  git('tag', '-a', `v${version}`, '-m', 'beta');
  const env = { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'Leos-byte/MemoryGraph', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha, RELEASE_TAG: `v${version}` };
  return { cwd, git, env, version, sha };
}

test('accepts an existing annotated tag at main with matching package and lock versions', t => {
  const fixtureData = fixture(t);
  assert.deepEqual(validateRelease(fixtureData), { sha: fixtureData.sha, version: fixtureData.version, tag: fixtureData.env.RELEASE_TAG, channel: 'beta' });
});

test('accepts a stable version and infers stable channel from the matching tag/package', t => {
  const data = fixture(t, '0.2.0');
  assert.deepEqual(validateRelease(data), { sha: data.sha, version: data.version, tag: data.env.RELEASE_TAG, channel: 'stable' });
});

for (const [name, override] of [
  ['PR event', { GITHUB_EVENT_NAME: 'pull_request' }],
  ['fork repository', { GITHUB_REPOSITORY: 'someone/MemoryGraph' }],
  ['feature branch', { GITHUB_REF: 'refs/heads/feature' }],
  ['tag dispatch', { GITHUB_REF: 'refs/tags/v0.2.0-beta.1' }],
  ['unsupported prerelease', { RELEASE_TAG: 'v0.2.0-rc.1' }],
  ['shell text in tag', { RELEASE_TAG: 'v0.2.0-beta.1;echo unsafe' }],
  ['leading zero', { RELEASE_TAG: 'v0.2.0-beta.01' }],
  ['short SHA', { GITHUB_SHA: '1234567' }],
]) {
  test(`rejects ${name}`, t => {
    const data = fixture(t);
    assert.throws(() => validateRelease({ ...data, env: { ...data.env, ...override } }));
  });
}

test('rejects mismatched package and lock versions', t => {
  const data = fixture(t);
  writeFileSync(resolve(data.cwd, 'Source/package-lock.json'), JSON.stringify({ version: '0.1.0' }));
  assert.throws(() => validateRelease(data), /versions must agree/);
});

test('rejects missing tags', t => {
  const data = fixture(t);
  assert.throws(() => validateRelease({ ...data, env: { ...data.env, RELEASE_TAG: 'v0.2.0-beta.2' } }));
});

test('rejects a tag pointing to an older main commit', t => {
  const data = fixture(t);
  data.git('commit', '--allow-empty', '-m', 'new head');
  data.env.GITHUB_SHA = data.git('rev-parse', 'HEAD');
  data.git('update-ref', 'refs/remotes/origin/main', data.env.GITHUB_SHA);
  assert.throws(() => validateRelease(data), /tag does not point/);
});

test('rejects release commit that is no longer main HEAD', t => {
  const data = fixture(t);
  data.git('commit', '--allow-empty', '-m', 'new main');
  data.git('update-ref', 'refs/remotes/origin/main', data.git('rev-parse', 'HEAD'));
  data.git('checkout', '--detach', data.sha);
  assert.throws(() => validateRelease(data), /not the fetched main HEAD/);
});
