import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformAssets } from './release-package-files.mjs';
import { releaseChannel } from './release-metadata.mjs';

const bundledKey = resolve(dirname(fileURLToPath(import.meta.url)), '../Source/update-public-key.pem');

export async function checkSignedRelease({ source, version, publicKeyPath = bundledKey }) {
  const channel = releaseChannel(version);
  const names = ['release-manifest.json', 'release-manifest.sig'];
  for (const name of names) {
    const stat = lstatSync(resolve(source, name));
    if (!stat.isFile() || stat.size === 0 || stat.size > 1024 * 1024) throw new Error(`Invalid signed metadata: ${name}`);
  }
  const raw = readFileSync(resolve(source, names[0]));
  const signatureText = readFileSync(resolve(source, names[1]), 'utf8').trim();
  const signature = Buffer.from(signatureText, 'base64');
  const key = createPublicKey(readFileSync(publicKeyPath, 'utf8'));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The bundled update public key must be Ed25519.');
  if (signature.length !== 64 || signature.toString('base64') !== signatureText || !verify(null, raw, key, signature)) {
    throw new Error('Update manifest signature does not verify with the bundled public key.');
  }
  const manifest = JSON.parse(raw.toString('utf8'));
  if (manifest.version !== version || manifest.channel !== channel || !Array.isArray(manifest.files)) {
    throw new Error('Signed manifest has the wrong version, channel, or file list.');
  }
  const expected = [...platformAssets(source, 'windows', version), ...platformAssets(source, 'linux', version)].sort();
  const covered = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file.name !== 'string' || !expected.includes(file.name) || covered.has(file.name)) {
      throw new Error('Signed manifest contains unexpected or duplicate assets.');
    }
    covered.add(file.name);
    const path = resolve(source, file.name);
    const stat = lstatSync(path);
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size !== stat.size) throw new Error(`Signed size mismatch: ${file.name}`);
    const hash = createHash('sha512');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (hash.digest('base64') !== file.sha512) throw new Error(`Signed SHA-512 mismatch: ${file.name}`);
  }
  if (expected.some(name => !covered.has(name))) throw new Error('Signed manifest is missing required packages or updater metadata.');
  const allowed = [...expected, ...names].sort();
  if (JSON.stringify(readdirSync(source).sort()) !== JSON.stringify(allowed)) throw new Error('Release directory contains unapproved files or directories.');
  return allowed;
}
