import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runElectronCli } from '../electron-cli.mjs';

test('CLI help works without installing or building', () => {
  const output = [];
  runElectronCli(['--help'], { log: text => output.push(text), execute: () => assert.fail('Help must not spawn a process') });
  assert.match(output.join('\n'), /Source\/dist-release/);
});

test('CLI rejects unknown or combinable options before executing npm', () => {
  for (const args of [['unknown'], ['build', '--publish', 'always'], ['build', '--unpacked', '--build-only'], ['setup', '--install']]) {
    assert.throws(() => runElectronCli(args, { execute: () => assert.fail('Invalid options must not execute npm') }), /Usage/);
  }
});

test('CLI fails clearly on missing or mismatched lockfile without running npm', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'memgraph-cli-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'Source'));
  const options = { source: resolve(root, 'Source'), execute: () => assert.fail('Invalid lockfile must not execute npm') };
  const scripts = Object.fromEntries(['build', 'typecheck', 'test', 'test:e2e', 'verify', 'package', 'package:dir'].map(name => [name, 'test']));
  writeFileSync(resolve(root, 'Source/package.json'), JSON.stringify({ version: '0.2.0-beta.1', scripts }));
  assert.throws(() => runElectronCli(['setup', '--check'], options), /package-lock.json/);
  writeFileSync(resolve(root, 'Source/package-lock.json'), JSON.stringify({ version: '0.1.0' }));
  assert.throws(() => runElectronCli(['setup', '--check'], options), /versions disagree/);
});

test('CLI delegates setup/build/verify without publishing and propagates process errors', t => {
  const source = mkdtempSync(resolve(tmpdir(), 'memgraph-cli-commands-test-'));
  t.after(() => rmSync(source, { recursive: true, force: true }));
  const version = '0.2.0-beta.1';
  const scripts = Object.fromEntries(['build', 'typecheck', 'test', 'test:e2e', 'verify', 'package', 'package:dir'].map(name => [name, 'test']));
  writeFileSync(resolve(source, 'package.json'), JSON.stringify({ version, scripts }));
  writeFileSync(resolve(source, 'package-lock.json'), JSON.stringify({ version, packages: { '': { version } } }));
  const calls = [];
  const options = { source, log: () => {}, execute: (executable, args, spawnOptions) => {
    calls.push({ executable, args, spawnOptions });
    return { status: 0 };
  } };
  runElectronCli(['setup'], options);
  runElectronCli(['build'], options);
  runElectronCli(['build', '--unpacked'], options);
  runElectronCli(['verify'], options);
  const commands = calls.map(call => call.args.join(' ')).join('\n');
  assert.match(commands, /ci/);
  assert.match(commands, /run build/);
  assert.match(commands, /run package -- --publish never/);
  assert.match(commands, /run package:dir -- --publish never/);
  assert.match(commands, /run verify/);
  assert.ok(calls.every(call => call.spawnOptions.cwd === source));
  assert.throws(() => runElectronCli(['build'], { ...options, execute: () => ({ status: 7 }) }), /failed \(7\)/);
});
