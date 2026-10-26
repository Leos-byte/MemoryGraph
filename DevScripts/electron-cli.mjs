#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const defaultSource = resolve(dirname(fileURLToPath(import.meta.url)), '../Source');
const usage = `Usage: node DevScripts/electron-cli.mjs setup [--check]
       node DevScripts/electron-cli.mjs build [--unpacked | --build-only]
       node DevScripts/electron-cli.mjs verify

setup installs locked dependencies with npm ci; --check only checks prerequisites.
build creates host x64 packages without publishing; --unpacked uses package:dir.
verify runs npm run verify, using Xvfb on headless Linux.
Requires Node.js 22 x64, npm, and Source/package-lock.json.
Output: Source/dist-release. Backup/ and Releases/ are never modified.`;

export function runElectronCli(argv, { source = defaultSource, execute = spawnSync, log = console.log } = {}) {
  const [command, ...args] = argv;
  function run(executable, parameters, options = {}) {
    log(`> ${executable} ${parameters.join(' ')}`);
    const result = execute(executable, parameters, { cwd: source, stdio: 'inherit', ...options });
    if (result.error) throw new Error(`Cannot run ${executable}: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${executable} failed (${result.signal ?? result.status}).`);
  }
  function npm(parameters, headless = false) {
    const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
    if (headless && process.platform === 'linux' && !process.env.DISPLAY) {
      run('xvfb-run', ['-a', 'npm', ...parameters], { env });
    } else if (process.platform === 'win32') {
      // All parameters are fixed by this CLI; never put user-provided text in cmd.exe.
      run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${parameters.join(' ')}`], { env });
    } else {
      run('npm', parameters, { env });
    }
  }
  if (args.includes('--help') || command === '--help') {
    log(usage);
    return;
  }
  const allowed = { setup: ['', '--check'], build: ['', '--unpacked', '--build-only'], verify: [''] };
  if (!allowed[command]?.includes(args.join(' '))) throw new Error(usage);
  if (Number(process.versions.node.split('.')[0]) !== 22 || process.arch !== 'x64') {
    throw new Error('Install Node.js 22 x64 (including npm), then reopen your terminal.');
  }
  if (!['linux', 'win32'].includes(process.platform)) throw new Error('Only Linux x64 and Windows x64 are release targets.');
  let pkg;
  let lock;
  try {
    pkg = JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8'));
    lock = JSON.parse(readFileSync(resolve(source, 'package-lock.json'), 'utf8'));
  } catch {
    throw new Error('Source/package.json and Source/package-lock.json must exist and be valid JSON. Finish the Electron runtime migration first.');
  }
  for (const name of ['build', 'typecheck', 'test', 'test:e2e', 'verify', 'package', 'package:dir']) {
    if (!pkg.scripts?.[name]) throw new Error(`Missing agreed npm script: ${name}`);
  }
  if (pkg.version !== lock.version || pkg.version !== lock.packages?.['']?.version) {
    throw new Error('Package and lockfile versions disagree; update the lockfile before using npm ci.');
  }
  if (command === 'setup') {
    npm(['--version']);
    log('Linux: Electron needs GTK3/NSS/ALSA/GBM; headless tests also need Xvfb. See docs/electron_release.md.');
    if (!args.includes('--check')) npm(['ci']);
  } else if (command === 'verify') {
    npm(['run', 'verify'], true);
  } else {
    npm(['run', 'build']);
    if (!args.includes('--build-only')) {
      npm(['run', args.includes('--unpacked') ? 'package:dir' : 'package', '--', '--publish', 'never']);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runElectronCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
