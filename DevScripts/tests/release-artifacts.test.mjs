import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { assemble, packageFiles, stage } from '../release-artifacts.mjs';

const version = '0.2.0-beta.1';
const require = createRequire(new URL('../../Source/package.json', import.meta.url));
const tar = require('tar');
function directory(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'memgraph-artifacts-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function packages(path, platform, version = '0.2.0-beta.1') {
  mkdirSync(path, { recursive: true });
  const names = platform === 'windows'
    ? [`MemGraph-${version}-win-x64.exe`, `MemGraph-${version}-win-x64.zip`]
    : [`MemGraph-${version}-linux-x86_64.AppImage`, `MemGraph-${version}-linux-x64.tar.gz`];
  for (const name of names) writeFileSync(resolve(path, name), 'synthetic package');
  const channel = version.includes('-') ? 'beta' : 'latest';
  writeFileSync(resolve(path, `${channel}${platform === 'windows' ? '' : '-linux'}.yml`), 'synthetic updater metadata');
  return names;
}

test('requires both expected formats and x64 versioned filenames', t => {
  const root = directory(t);
  packages(root, 'windows');
  assert.equal(packageFiles(root, 'windows', version).length, 2);
  assert.throws(() => packageFiles(root, 'windows', '0.2.0-beta.10'), /Package name/);
  assert.throws(() => packageFiles(root, 'linux', version), /exactly one/);
  assert.throws(() => packageFiles(root, 'mac', version), /Platform/);
});

test('rejects empty packages and extra package candidates', t => {
  const root = directory(t);
  const names = packages(root, 'windows');
  writeFileSync(resolve(root, names[0]), '');
  assert.throws(() => packageFiles(root, 'windows', version), /empty/);
  writeFileSync(resolve(root, 'another.exe'), 'extra');
  assert.throws(() => packageFiles(root, 'windows', version), /exactly one/);
});

test('accepts electron-builder AppImage x86_64 alias but rejects wrong architectures', t => {
  const root = directory(t);
  const names = packages(root, 'linux');
  assert.ok(packageFiles(root, 'linux', version).some(name => name.endsWith('x86_64.AppImage')));
  renameSync(resolve(root, names[0]), resolve(root, `MemGraph-${version}-linux-arm64.AppImage`));
  assert.throws(() => packageFiles(root, 'linux', version), /Package name/);
  renameSync(resolve(root, `MemGraph-${version}-linux-arm64.AppImage`), resolve(root, names[0]));
  renameSync(resolve(root, names[1]), resolve(root, `MemGraph-${version}-linux-x86_64.tar.gz`));
  assert.throws(() => packageFiles(root, 'linux', version), /Package name/);
});

test('archives unpacked directory and copies only packages', t => {
  const root = directory(t);
  const source = resolve(root, 'build');
  packages(source, 'linux');
  mkdirSync(resolve(source, 'linux-unpacked'));
  writeFileSync(resolve(source, 'linux-unpacked/memgraph'), 'synthetic executable', { mode: 0o755 });
  writeFileSync(resolve(source, 'builder-debug.yml'), 'must not ship');
  const out = resolve(root, 'staged');
  stage({ source, out, platform: 'linux', version });
  assert.equal(readdirSync(resolve(out, 'packages')).length, 3);
  const archive = resolve(out, 'unpacked', readdirSync(resolve(out, 'unpacked'))[0]);
  const entries = [];
  tar.t({ file: archive, sync: true, onReadEntry: entry => entries.push(entry.path) });
  assert.ok(entries.includes('linux-unpacked/memgraph'));
  assert.throws(() => stage({ source, out, platform: 'linux', version }), /nonempty/);
});

test('assembles both platforms and refuses to overwrite existing output', t => {
  const root = directory(t);
  const source = resolve(root, 'incoming');
  for (const platform of ['windows', 'linux']) packages(resolve(source, `release-packages-${platform}-x64`), platform);
  const out = resolve(root, 'release');
  assert.equal(assemble({ source, out, version }).length, 6);
  assert.equal(readdirSync(out).length, 6);
  assert.throws(() => assemble({ source, out, version }), /nonempty/);
});

test('refuses to assemble an incomplete platform set', t => {
  const root = directory(t);
  const source = resolve(root, 'incoming');
  packages(resolve(source, 'release-packages-windows-x64'), 'windows');
  assert.throws(() => assemble({ source, out: resolve(root, 'release'), version }));
});

test('stable assembly requires latest metadata and versioned stable packages', t => {
  const root = directory(t);
  const source = resolve(root, 'incoming');
  for (const platform of ['windows', 'linux']) packages(resolve(source, `release-packages-${platform}-x64`), platform, '0.2.0');
  const assets = assemble({ source, out: resolve(root, 'release'), version: '0.2.0' });
  assert.ok(assets.includes('latest.yml'));
  assert.ok(assets.includes('latest-linux.yml'));
  assert.ok(!assets.includes('beta.yml'));
});
