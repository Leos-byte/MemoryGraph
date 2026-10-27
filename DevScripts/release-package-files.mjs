import { lstatSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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
