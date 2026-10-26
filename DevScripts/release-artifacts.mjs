#!/usr/bin/env node
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { releaseChannel } from './release-metadata.mjs';

const formats = { windows: ['.exe', '.zip'], linux: ['.AppImage', '.tar.gz'] };

export function packageFiles(directory, platform, version) {
  if (!formats[platform]) throw new Error('Platform must be windows or linux.');
  releaseChannel(version);
  const entries = readdirSync(directory);
  return formats[platform].map(extension => {
    const candidates = entries.filter(name => name.endsWith(extension));
    if (candidates.length !== 1) throw new Error(`Expected exactly one ${platform} ${extension} package, found ${candidates.length}.`);
    const name = candidates[0];
    const architecture = extension === '.AppImage' ? /(?:^|[-_.])(?:x64|x86_64)(?:[-_.]|$)/ : /(?:^|[-_.])x64(?:[-_.]|$)/;
    if (!name.includes(`-${version}-`) || !architecture.test(name) || !/^[A-Za-z0-9._-]+$/.test(name)) {
      throw new Error(`Package name must contain -${version}- and x64 (or AppImage x86_64) and use safe ASCII characters: ${name}`);
    }
    const stat = lstatSync(resolve(directory, name));
    if (!stat.isFile() || stat.size === 0) throw new Error(`Package is empty, a symlink, or not a file: ${name}`);
    return name;
  });
}

export function platformAssets(directory, platform, version) {
  const packages = packageFiles(directory, platform, version);
  const channel = releaseChannel(version) === 'beta' ? 'beta' : 'latest';
  const metadata = `${channel}${platform === 'windows' ? '' : '-linux'}.yml`;
  const stat = lstatSync(resolve(directory, metadata));
  if (!stat.isFile() || stat.size === 0) throw new Error(`Missing nonempty updater metadata: ${metadata}`);
  const entries = readdirSync(directory);
  const blockmaps = packages.map(name => `${name}.blockmap`).filter(name => entries.includes(name));
  for (const name of blockmaps) {
    const item = lstatSync(resolve(directory, name));
    if (!item.isFile() || item.size === 0) throw new Error(`Invalid blockmap: ${name}`);
  }
  return [...packages, metadata, ...blockmaps];
}

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
  execFileSync('tar', ['-czf', resolve(out, 'unpacked', `MemGraph-${version}-${platform}-x64-unpacked.tar.gz`), '-C', resolve(source), unpacked], { stdio: 'inherit' });
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
