import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(new URL('../../Source/package.json', import.meta.url));
const { parse } = require('yaml');
const steps = parse(readFileSync(resolve(root, '.github/workflows/sync-r2.yml'), 'utf8')).jobs.mirror.steps;
const linuxOnly = { skip: process.platform !== 'linux' };

function fixture(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'memgraph-r2-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = resolve(directory, 'bin'); mkdirSync(bin);
  const env = {
    PATH: bin + delimiter + process.env.PATH,
    HOME: directory, RUNNER_TEMP: directory,
    GITHUB_OUTPUT: resolve(directory, 'output'), GITHUB_STEP_SUMMARY: resolve(directory, 'summary'),
    GH_REPO: 'Leos-byte/MemoryGraph', R2_BUCKET: 'memorygraph-releases', DOWNLOAD_HOST: 'download.leoone.uk',
    COMMANDS: resolve(directory, 'commands'),
  };
  const mock = (name, script) => writeFileSync(resolve(bin, name), `#!/bin/bash\nset -euo pipefail\n${script}\n`, { mode: 0o755 });
  const run = (step, changes = {}) => spawnSync('bash', ['-c', step.run], { cwd: root, env: { ...env, ...changes }, encoding: 'utf8', timeout: 15000 });
  return { directory, env, mock, run };
}

test('every mirror shell step parses without executing any commands', linuxOnly, () => {
  for (const step of steps.filter(step => step.run)) {
    const result = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
    assert.ifError(result.error); assert.equal(result.status, 0, `${step.name}: ${result.stderr}`);
  }
});

test('missing mirror configuration fails before network or upload commands', linuxOnly, t => {
  const { run } = fixture(t);
  const result = run(steps.find(step => step.name === 'Check required credentials'), { R2_CONFIGURED: 'false' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Configure R2_ACCOUNT_ID/);
});

test('tag selection supports manual, published and matching workflow tags without shell evaluation', linuxOnly, t => {
  const { directory, mock, run } = fixture(t);
  const step = steps.find(step => step.id === 'tags');
  for (const tag of ['v0.2.0-beta.2', 'v1.0.0']) {
    const result = run(step, { EVENT_NAME: 'workflow_dispatch', MANUAL_TAG: tag });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(resolve(directory, 'release-tags.txt'), 'utf8'), `${tag}\n`);
  }
  const published = run(step, { EVENT_NAME: 'release', PUBLISHED_TAG: 'v0.2.0-beta.2' });
  assert.equal(published.status, 0, published.stderr);
  mock('git', "printf '%s\\n' v0.2.0-beta.2 unrelated-tag");
  const workflow = run(step, { EVENT_NAME: 'workflow_run', RELEASE_SHA: 'a'.repeat(40) });
  assert.equal(workflow.status, 0, workflow.stderr);
  assert.equal(readFileSync(resolve(directory, 'release-tags.txt'), 'utf8'), 'v0.2.0-beta.2\n');
  for (const tag of ['../../outside', 'v0.2.0-beta.2;touch PWNED', '$(touch PWNED)', 'v0.2.0\n../../outside']) {
    const invalid = run(step, { EVENT_NAME: 'workflow_dispatch', MANUAL_TAG: tag });
    assert.equal(invalid.status, 1, tag);
  }
  assert.equal(existsSync(resolve(root, 'PWNED')), false);
});

test('draft releases are skipped automatically but rejected for manual backfills', linuxOnly, t => {
  const { directory, mock, run } = fixture(t);
  const tags = resolve(directory, 'tags'); writeFileSync(tags, 'v0.2.0-beta.2\n');
  mock('gh', '[[ "$1 $2" == "release view" ]] || exit 9\nprintf true');
  const step = steps.find(step => step.id === 'verified');
  const automatic = run(step, { EVENT_NAME: 'workflow_run', TAGS_FILE: tags });
  assert.equal(automatic.status, 0, automatic.stderr);
  assert.equal(readFileSync(resolve(directory, 'verified-tags.txt'), 'utf8'), '');
  const manual = run(step, { EVENT_NAME: 'workflow_dispatch', TAGS_FILE: tags });
  assert.equal(manual.status, 1);
  assert.match(manual.stdout, /still a draft/);
});

test('unsigned or incomplete downloads never enter the verified upload list', linuxOnly, t => {
  const { directory, mock, run } = fixture(t);
  const tags = resolve(directory, 'tags'); writeFileSync(tags, 'v0.2.0-beta.2\n');
  mock('gh', 'if [[ "$1 $2" == "release view" ]]; then printf false; fi');
  const result = run(steps.find(step => step.id === 'verified'), { EVENT_NAME: 'workflow_dispatch', TAGS_FILE: tags });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Artifact validation failed/);
  assert.equal(readFileSync(resolve(directory, 'verified-tags.txt'), 'utf8'), '');
});

test('uploads publish signatures and manifests last and reject invalid account endpoints', linuxOnly, t => {
  const { directory, env, mock, run } = fixture(t);
  const tag = 'v0.2.0-beta.2';
  const tags = resolve(directory, 'verified-tags.txt'); writeFileSync(tags, `${tag}\n`);
  const files = resolve(directory, 'release-files', tag); mkdirSync(files, { recursive: true });
  for (const name of ['release-manifest.json', 'release-manifest.sig', 'installer.exe']) writeFileSync(resolve(files, name), 'test-only');
  mock('aws', 'printf "%s\\n" "$*" >> "$COMMANDS"');
  const step = steps.find(step => step.env?.AWS_SECRET_ACCESS_KEY);
  const invalid = run(step, { TAGS_FILE: tags, R2_ACCOUNT_ID: 'https://invalid.example' });
  assert.equal(invalid.status, 1);
  assert.equal(existsSync(env.COMMANDS), false);
  const valid = run(step, { TAGS_FILE: tags, R2_ACCOUNT_ID: 'a'.repeat(32) });
  assert.equal(valid.status, 0, valid.stderr);
  const commands = readFileSync(env.COMMANDS, 'utf8').trim().split('\n');
  assert.equal(commands.length, 3);
  assert.match(commands[0], /--recursive/);
  assert.match(commands[0], /--exclude release-manifest.json --exclude release-manifest.sig/);
  assert.match(commands[1], /release-manifest.sig/);
  assert.match(commands[2], /release-manifest.json/);
  assert.match(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8'), /https:\/\/download.leoone.uk\/releases\/v0.2.0-beta.2\/installer.exe/);
});
