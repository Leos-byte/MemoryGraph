import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const testKey = vi.hoisted(() => ({ pem: '' }));
vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '0.2.0-beta.1' } }));
vi.mock('electron-updater', async () => {
  const { EventEmitter } = await import('node:events');
  return { autoUpdater: Object.assign(new EventEmitter(), { checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn() }) };
});
vi.mock('node:fs', async importOriginal => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original,
    existsSync: (path: string) => path.endsWith('Uninstall MemGraph.exe') || path.endsWith('update-public-key.pem') || original.existsSync(path),
    readFileSync: (path: any, options?: any) => String(path).endsWith('update-public-key.pem') ? testKey.pem : original.readFileSync(path, options)
  };
});
import { autoUpdater } from 'electron-updater';
import { Updates, isNewer } from '../main/updates';

let directory: string;
let artifact: string;
let manifest: string;
let signature: string;
let update: Updates;
let beforeInstall: ReturnType<typeof vi.fn<() => Promise<void>>>;
const version = '0.2.0-beta.2';
const bytes = Buffer.from('synthetic complete application version N+1');
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'memgraph-updates-'));
  vi.stubEnv('APPIMAGE', join(directory, 'current.AppImage'));
  const keys = generateKeyPairSync('ed25519');
  testKey.pem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  writeFileSync(join(directory, 'update-public-key.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  artifact = join(directory, 'cache-file'); writeFileSync(artifact, bytes);
  const file = { name: 'MemGraph.AppImage', size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') };
  manifest = JSON.stringify({ version, channel: 'beta', files: [file] });
  signature = sign(null, Buffer.from(manifest), keys.privateKey).toString('base64');
  vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue({ updateInfo: { version, files: [{ url: file.name, sha512: file.sha512 }] } } as any);
  vi.mocked(autoUpdater.downloadUpdate).mockImplementation(async () => { autoUpdater.emit('update-downloaded', { downloadedFile: artifact } as any); return [artifact]; });
  vi.mocked(autoUpdater.quitAndInstall).mockReset();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('.sig') ? signature : manifest)));
  beforeInstall = vi.fn(async () => {});
  update = new Updates(() => {}, beforeInstall);
});
afterEach(() => { autoUpdater.removeAllListeners(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe('version N to N+1 update state machine', () => {
  it('checks signature, downloads, verifies complete bytes, backs up, then installs', async () => {
    await update.check('beta'); expect(update.state.status).toBe('available');
    expect(beforeInstall).not.toHaveBeenCalled();
    await update.download(); expect(update.state.status).toBe('downloaded');
    await update.install(); expect(beforeInstall).toHaveBeenCalledTimes(1); expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
  });
  it('fails closed for network failure and an invalid signature', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await update.check('beta'); expect(update.state.status).toBe('error'); expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('.sig') ? Buffer.alloc(64).toString('base64') : manifest)));
    await update.check('beta'); expect(update.state.status).toBe('error'); expect(beforeInstall).not.toHaveBeenCalled();
  });
  it('rejects package substitution and does not touch the installed version', async () => {
    await update.check('beta'); writeFileSync(artifact, 'corrupt download');
    await update.download(); expect(update.state.status).toBe('error'); expect(beforeInstall).not.toHaveBeenCalled(); expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
  it('rechecks cached files and refuses install if backup fails', async () => {
    await update.check('beta'); await update.download();
    beforeInstall.mockRejectedValueOnce(new Error('backup directory is not writable'));
    await update.install(); expect(update.state.status).toBe('error'); expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
  it('rejects stable/beta channel mismatches and older versions', async () => {
    await update.check('stable'); expect(update.state.status).toBe('error');
    expect(isNewer('0.2.0-beta.2', '0.2.0-beta.1')).toBe(true);
    expect(isNewer('0.2.0', '0.2.0-beta.2')).toBe(true);
    expect(isNewer('0.2.0-beta.1', '0.2.0')).toBe(false);
    expect(isNewer('0.1.9', '0.2.0')).toBe(false);
  });
});
