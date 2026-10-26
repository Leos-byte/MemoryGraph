import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const directory = resolve(option('--dir', 'dist-release'));
const version = option('--version', JSON.parse(await readFile('package.json', 'utf8')).version);
const channel = option('--channel', version.includes('-') ? 'beta' : 'stable');
if (!['stable', 'beta'].includes(channel) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Invalid version/channel');
const keyText = process.env.SIGNING_PRIVATE_KEY || (option('--private-key', '') ? await readFile(option('--private-key'), 'utf8') : '');
if (!keyText) throw new Error('SIGNING_PRIVATE_KEY or --private-key is required.');
const key = createPrivateKey(keyText);
const expected = createPublicKey(await readFile('update-public-key.pem', 'utf8')).export({ type: 'spki', format: 'der' });
if (!createPublicKey(key).export({ type: 'spki', format: 'der' }).equals(expected)) throw new Error('Signing key does not match the application public key.');
const files = [];
for (const name of (await readdir(directory)).sort()) {
  if (!/\.(exe|zip|AppImage|tar\.gz|yml|blockmap)$/.test(name)) continue;
  const path = join(directory, name); if (!(await stat(path)).isFile()) continue;
  const buffer = await readFile(path); files.push({ name, size: buffer.length, sha512: createHash('sha512').update(buffer).digest('base64') });
}
if (!files.some(file => file.name.endsWith('.exe')) || !files.some(file => file.name.endsWith('.AppImage'))) throw new Error('Both Windows and Linux packages are required for publication.');
const raw = JSON.stringify({ version, channel, files }, null, 2) + '\n';
await writeFile(join(directory, 'release-manifest.json'), raw);
await writeFile(join(directory, 'release-manifest.sig'), sign(null, Buffer.from(raw), key).toString('base64') + '\n');
console.log(`Signed ${files.length} release artifacts for ${version}`);
