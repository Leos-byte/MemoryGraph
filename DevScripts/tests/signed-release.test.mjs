import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkSignedRelease } from '../verify-signed-release.mjs';
import { validateDraft, validateRemoteRefs } from '../publish-electron.mjs';

const version = '0.2.0-beta.1';
const runtimeSigner = resolve(dirname(fileURLToPath(import.meta.url)), '../../Source/scripts/sign-release.mjs');

function fixture(t, version = '0.2.0-beta.1') {
  const root = mkdtempSync(resolve(tmpdir(), 'memgraph-signing-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = resolve(root, 'dist-release');
  mkdirSync(source);
  const channel = version.includes('-') ? 'beta' : 'stable';
  const updaterChannel = channel === 'beta' ? 'beta' : 'latest';
  const names = [`MemGraph-${version}-windows-x64-setup.exe`, `MemGraph-${version}-windows-x64.zip`,
    `MemGraph-${version}-linux-x86_64.AppImage`, `MemGraph-${version}-linux-x64.tar.gz`, `${updaterChannel}.yml`, `${updaterChannel}-linux.yml`];
  const files = names.map(name => {
    const raw = Buffer.from(`synthetic content: ${name}`);
    writeFileSync(resolve(source, name), raw);
    return { name, size: raw.length, sha512: createHash('sha512').update(raw).digest('base64') };
  });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPath = resolve(root, 'update-public-key.pem');
  writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  writeFileSync(resolve(root, 'package.json'), JSON.stringify({ version }));
  const manifest = { version, channel, files };
  const writeManifest = () => {
    const raw = JSON.stringify(manifest, null, 2) + '\n';
    writeFileSync(resolve(source, 'release-manifest.json'), raw);
    writeFileSync(resolve(source, 'release-manifest.sig'), sign(null, Buffer.from(raw), privateKey).toString('base64') + '\n');
  };
  writeManifest();
  return { root, source, version, publicKeyPath, privateKey, manifest, writeManifest };
}

test('verifies the detached Ed25519 signature, six assets, sizes and SHA-512 hashes', async t => {
  const data = fixture(t);
  assert.equal((await checkSignedRelease(data)).length, 8);
});

test('standalone check-signed CLI completes verification and rejects package tampering', t => {
  const data = fixture(t);
  const scripts = resolve(data.root, 'DevScripts');
  mkdirSync(scripts);
  mkdirSync(resolve(data.root, 'Source'));
  copyFileSync(data.publicKeyPath, resolve(data.root, 'Source/update-public-key.pem'));
  for (const name of ['release-artifacts.mjs', 'release-package-files.mjs', 'release-metadata.mjs', 'verify-signed-release.mjs']) {
    copyFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', name), resolve(scripts, name));
  }
  const run = () => spawnSync(process.execPath, [resolve(scripts, 'release-artifacts.mjs'), 'check-signed',
    '--source', data.source, '--version', version], { encoding: 'utf8', timeout: 10000 });
  const valid = run();
  assert.ifError(valid.error);
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /check-signed passed/);
  const file = data.manifest.files[0];
  writeFileSync(resolve(data.source, file.name), Buffer.alloc(file.size, 1));
  const invalid = run();
  assert.ifError(invalid.error);
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.match(invalid.stderr, /SHA-512 mismatch/);
});

test('runtime signing script and release verifier agree', async t => {
  const data = fixture(t);
  const result = spawnSync(process.execPath, [runtimeSigner, '--dir', 'dist-release', '--version', version, '--channel', 'beta'], {
    cwd: data.root, encoding: 'utf8', env: { ...process.env, SIGNING_PRIVATE_KEY: data.privateKey.export({ type: 'pkcs8', format: 'pem' }) },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await checkSignedRelease(data)).length, 8);
});

test('stable signer and verifier agree on stable manifest and latest updater metadata', async t => {
  const data = fixture(t, '0.2.0');
  const result = spawnSync(process.execPath, [runtimeSigner, '--dir', 'dist-release', '--version', data.version, '--channel', 'stable'], {
    cwd: data.root, encoding: 'utf8', env: { ...process.env, SIGNING_PRIVATE_KEY: data.privateKey.export({ type: 'pkcs8', format: 'pem' }) },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await checkSignedRelease(data)).length, 8);
  data.manifest.channel = 'beta';
  data.writeManifest();
  await assert.rejects(checkSignedRelease(data), /wrong version, channel/);
});

test('runtime signing fails without a key or when the key mismatches the bundled key', t => {
  const data = fixture(t);
  const wrong = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  for (const key of ['', wrong]) {
    const result = spawnSync(process.execPath, [runtimeSigner, '--dir', 'dist-release', '--version', version, '--channel', 'beta'], {
      cwd: data.root, encoding: 'utf8', env: { ...process.env, SIGNING_PRIVATE_KEY: key },
    });
    assert.notEqual(result.status, 0);
  }
});

test('rejects a modified manifest before reading its file list', async t => {
  const data = fixture(t);
  writeFileSync(resolve(data.source, 'release-manifest.json'), '{}');
  await assert.rejects(checkSignedRelease(data), /signature/);
});

test('rejects a same-size modified package', async t => {
  const data = fixture(t);
  const file = data.manifest.files[0];
  writeFileSync(resolve(data.source, file.name), Buffer.alloc(file.size, 1));
  await assert.rejects(checkSignedRelease(data), /SHA-512 mismatch/);
});

test('rejects missing public key and mismatched public key', async t => {
  const data = fixture(t);
  await assert.rejects(checkSignedRelease({ ...data, publicKeyPath: resolve(data.root, 'absent.pem') }));
  writeFileSync(data.publicKeyPath, generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }));
  await assert.rejects(checkSignedRelease(data), /signature/);
});

for (const [name, edit] of [
  ['wrong channel', manifest => { manifest.channel = 'stable'; }],
  ['wrong version', manifest => { manifest.version = '0.2.0-beta.2'; }],
  ['missing metadata coverage', manifest => { manifest.files.pop(); }],
  ['duplicate descriptor', manifest => { manifest.files.push(manifest.files[0]); }],
  ['unsafe asset path', manifest => { manifest.files[0].name = '../secret.pem'; }],
  ['wrong signed size', manifest => { manifest.files[0].size += 1; }],
]) {
  test(`rejects signed manifest with ${name}`, async t => {
    const data = fixture(t);
    edit(data.manifest);
    data.writeManifest();
    await assert.rejects(checkSignedRelease(data));
  });
}

test('rejects unsigned extra files even with a valid manifest', async t => {
  const data = fixture(t);
  writeFileSync(resolve(data.source, 'private-key.pem'), 'must never upload');
  await assert.rejects(checkSignedRelease(data), /unapproved/);
});

test('a noncanonical or truncated signature is rejected', async t => {
  const data = fixture(t);
  const signature = readFileSync(resolve(data.source, 'release-manifest.sig'), 'utf8').trim();
  writeFileSync(resolve(data.source, 'release-manifest.sig'), signature.slice(2));
  await assert.rejects(checkSignedRelease(data), /signature/);
});

test('publication permits only an existing draft prerelease at the same tag and SHA', () => {
  const metadata = { tag: 'v0.2.0-beta.1', sha: 'a'.repeat(40), channel: 'beta' };
  const draft = { isDraft: true, isPrerelease: true, tagName: metadata.tag, targetCommitish: metadata.sha };
  assert.doesNotThrow(() => validateDraft(draft, metadata));
  for (const override of [{ isDraft: false }, { isPrerelease: false }, { tagName: 'another' }, { targetCommitish: 'main' }]) {
    assert.throws(() => validateDraft({ ...draft, ...override }, metadata), /Refusing/);
  }
});

test('publication rejects moved remote main or tag', () => {
  const sha = 'a'.repeat(40);
  assert.doesNotThrow(() => validateRemoteRefs({ main: sha, tag: sha }, sha));
  assert.throws(() => validateRemoteRefs({ main: 'b'.repeat(40), tag: sha }, sha));
  assert.throws(() => validateRemoteRefs({ main: sha, tag: 'b'.repeat(40) }, sha));
});

test('stable drafts must not be prereleases and published stable releases remain immutable to tooling', () => {
  const metadata = { tag: 'v0.2.0', sha: 'a'.repeat(40), channel: 'stable' };
  const release = { isDraft: true, isPrerelease: false, tagName: metadata.tag, targetCommitish: metadata.sha };
  assert.doesNotThrow(() => validateDraft(release, metadata));
  assert.throws(() => validateDraft({ ...release, isPrerelease: true }, metadata));
  assert.throws(() => validateDraft({ ...release, isDraft: false }, metadata));
});
