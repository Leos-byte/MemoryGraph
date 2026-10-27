#!/usr/bin/env node
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { platformAssets } from './release-package-files.mjs';
export { packageFiles, platformAssets } from './release-package-files.mjs';

const formats = { windows: ['.exe', '.zip'], linux: ['.AppImage', '.tar.gz'] };

function emptyDirectory(path) {
  mkdirSync(path, { recursive: true });
  if (readdirSync(path).length) throw new Error(`Refusing to overwrite a nonempty staging directory: ${path}`);
}

export function stage({ source, out, platform, version }) {
  if (resolve(source) === resolve(out)) throw new Error('Staging output must differ from build output.');
  const packages = platformAssets(source, platform, version);
  const unpacked = platform === 'windows' ? 'win-unpacked' : 'linux-unpacked';
  if (!lstatSync(resolve(source, unpacked)).isDirectory()) throw new Error(`Missing ${unpacked}.`);
  emptyDirectory(out);
  mkdirSync(resolve(out, 'packages'));
  mkdirSync(resolve(out, 'unpacked'));
  for (const name of packages) copyFileSync(resolve(source, name), resolve(out, 'packages', name));
  const tar = process.platform === 'win32' ? resolve(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
  // Git Bash's GNU tar treats a drive-letter archive path as a remote host.
  execFileSync(tar, ['-czf', `MemGraph-${version}-${platform}-x64-unpacked.tar.gz`, '-C', resolve(source), unpacked], { cwd: resolve(out, 'unpacked'), stdio: 'inherit' });
  return packages;
}

export function assemble({ source, out, version }) {
  const files = [];
  for (const platform of Object.keys(formats)) {
    const directory = resolve(source, `release-packages-${platform}-x64`);
    for (const name of platformAssets(directory, platform, version)) {
      if (files.some(file => file.name === name)) throw new Error(`Duplicate artifact name: ${name}`);
      files.push({ name, from: resolve(directory, name) });
    }
  }
  emptyDirectory(out);
  for (const file of files) copyFileSync(file.from, resolve(out, file.name));
  return files.map(file => file.name);
}

export async function checkSigned(options) {
  const { checkSignedRelease } = await import('./verify-signed-release.mjs');
  return checkSignedRelease(options);
}

async function main() {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { source: { type: 'string' }, out: { type: 'string' }, platform: { type: 'string' }, version: { type: 'string' } },
    });
    const [command] = positionals;
    if (positionals.length !== 1 || !values.source) throw new Error('Usage: release-artifacts.mjs stage|assemble|check-signed --source DIR [--out DIR] [--platform windows|linux] --version VERSION');
    const options = { ...values, source: resolve(values.source) };
    if (!options.version && command === 'stage') {
      options.version = JSON.parse(readFileSync(resolve(options.source, '../package.json'), 'utf8')).version;
    }
    if (command === 'check-signed') {
      await checkSigned(options);
    } else {
      if (!options.out) throw new Error('--out is required.');
      options.out = resolve(options.out);
      if (command === 'stage') stage(options);
      else if (command === 'assemble') assemble(options);
      else throw new Error(`Unknown command: ${command}`);
    }
    console.log(`${basename(process.argv[1])}: ${command} passed.`);
  } catch (error) {
    console.error(`Artifact validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
