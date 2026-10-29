import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const testKey = vi.hoisted(() => ({ pem: '' }));
const runtime = vi.hoisted(() => ({ packaged: true }));
vi.mock('electron', () => ({ app: { get isPackaged() { return runtime.packaged; }, getVersion: () => '0.2.0-beta.1' } }));
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
import { Updates, isNewer, UPDATE_INTERVAL, UPDATE_START_DELAY } from '../main/updates';

let directory: string;
let artifact: string;
let manifest: string;
let signature: string;
let update: Updates;
let beforeInstall: ReturnType<typeof vi.fn<() => Promise<void>>>;
const version = '0.2.0-beta.2';
const bytes = Buffer.from('synthetic complete application version N+1');
beforeEach(() => {
  runtime.packaged = true;
  vi.mocked(autoUpdater.checkForUpdates).mockReset();
  vi.mocked(autoUpdater.downloadUpdate).mockReset();
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
afterEach(() => { update.dispose(); vi.useRealTimers(); autoUpdater.removeAllListeners(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe('version N to N+1 update state machine', () => {
  it.each([
    ['0.2.0-beta.10', '0.2.0-beta.9', true],
    ['0.2.0-beta.1', '0.2.0-beta', true],
    ['0.2.0-beta', '0.2.0-beta.1', false],
    ['0.2.0-beta.a', '0.2.0-beta.1', true],
    ['0.2.0-Beta', '0.2.0-beta', false],
    ['0.2.0+build.2', '0.2.0+build.1', false],
    ['0.2.1+build.1', '0.2.0', true],
    ['0.2.0-beta.01', '0.2.0-beta.1', false],
    ['0.2.0-beta..1', '0.2.0-beta.1', false],
    ['01.2.0', '0.2.0', false],
  ])('compares release versions %s > %s as %s', (next, current, expected) => {
    expect(isNewer(next, current)).toBe(expected);
  });
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
  it('shows a distinct up-to-date state without downloading equal or older releases', async () => {
    for (const version of ['0.2.0-beta.1', '0.1.9']) {
      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce({ updateInfo: { version, files: [] } } as any);
      await update.check('beta');
      expect(update.state).toMatchObject({ status: 'upToDate', checkedAt: expect.any(String) });
    }
    expect(fetch).not.toHaveBeenCalled(); expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('does not label a missing service result as up to date', async () => {
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce(null);
    await update.check('beta'); expect(update.state.status).toBe('error');
  });
  it('keeps downgrade disabled after the library channel setter enables it', async () => {
    let channel: string | null = null;
    Object.defineProperty(autoUpdater, 'channel', { configurable: true, get: () => channel, set: value => { channel = value; autoUpdater.allowDowngrade = true; } });
    await update.check('beta');
    expect(autoUpdater.channel).toBe('beta'); expect(autoUpdater.allowDowngrade).toBe(false);
    await update.check('stable');
    expect(autoUpdater.channel).toBe('latest'); expect(autoUpdater.allowDowngrade).toBe(false);
  });
  it('rejects unsigned updater file lists, even when the manifest itself is signed', async () => {
    for (const files of [[], [{ url: 'other.AppImage', sha512: 'not-signed' }]]) {
      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValueOnce({ updateInfo: { version, files } } as any);
      await update.check('beta'); expect(update.state.status).toBe('error');
    }
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('deduplicates downloads and preserves the ready package when checking again', async () => {
    await update.check('beta');
    await Promise.all([update.download(), update.download(), update.check('beta')]);
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
    expect(update.state.status).toBe('downloaded');
    await update.check('beta'); expect(update.state.status).toBe('downloaded');
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });
  it('deduplicates restart/install actions while awaiting backup', async () => {
    await update.check('beta'); await update.download();
    let release!: () => void;
    beforeInstall.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const install = update.install();
    await vi.waitFor(() => expect(beforeInstall).toHaveBeenCalledOnce());
    expect(update.state.status).toBe('installing');
    await update.install(); await update.check('beta'); await update.download();
    release(); await install;
    expect(beforeInstall).toHaveBeenCalledOnce(); expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });
  it('rejects tampering between download and installation before backup', async () => {
    await update.check('beta'); await update.download();
    writeFileSync(artifact, 'replaced cached package');
    await update.install();
    expect(update.state.status).toBe('error'); expect(beforeInstall).not.toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
  it('unlocks retry after an asynchronous installer failure', async () => {
    await update.check('beta'); await update.download(); await update.install();
    autoUpdater.emit('error', new Error('Synthetic installer launch failure'));
    expect(update.state.status).toBe('error');
    await update.check('beta'); expect(update.state.status).toBe('available');
  });
  it('invalidates an available or downloaded package when the selected channel changes', async () => {
    update.configure({ channel: 'beta', updateMode: 'manual' });
    await update.check('beta'); await update.download();
    update.configure({ channel: 'stable', updateMode: 'manual' });
    expect(update.state).toMatchObject({ status: 'idle', version: undefined });
    await expect(update.install()).rejects.toThrow('Download a verified update');
  });
  it('discards an old-channel response arriving after a settings change', async () => {
    update.configure({ channel: 'beta', updateMode: 'manual' });
    let release!: (value: any) => void;
    vi.mocked(autoUpdater.checkForUpdates).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const checking = update.check('beta');
    update.configure({ channel: 'stable', updateMode: 'download' });
    release({ updateInfo: { version, files: [] } }); await checking;
    expect(update.state).toMatchObject({ status: 'idle', version: undefined });
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('clamps finite download progress and ignores stale progress after verification', async () => {
    await update.check('beta');
    vi.mocked(autoUpdater.downloadUpdate).mockImplementationOnce(async () => {
      autoUpdater.emit('download-progress', { percent: 122 } as any); expect(update.state.percent).toBe(100);
      autoUpdater.emit('download-progress', { percent: NaN } as any); expect(update.state.percent).toBe(100);
      autoUpdater.emit('update-downloaded', { downloadedFile: artifact } as any); return [artifact];
    });
    await update.download();
    autoUpdater.emit('download-progress', { percent: 5 } as any);
    expect(update.state).toMatchObject({ status: 'downloaded', percent: 100 });
  });
});

describe('background update policy', () => {
  it('does not contact the service in manual mode but allows a manual check', async () => {
    vi.useFakeTimers();
    update.configure({ channel: 'beta', updateMode: 'manual' });
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 2);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    await update.check('beta'); expect(update.state.status).toBe('available');
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('automatically checks after startup and every six hours without downloading', async () => {
    vi.useFakeTimers();
    update.configure({ channel: 'beta', updateMode: 'notify' });
    await vi.advanceTimersByTimeAsync(UPDATE_START_DELAY - 1); expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(update.state.status).toBe('available');
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL); expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled(); expect(beforeInstall).not.toHaveBeenCalled();
  });
  it('automatically downloads only verified updates and never silently installs', async () => {
    vi.useFakeTimers();
    update.configure({ channel: 'beta', updateMode: 'download' });
    await vi.advanceTimersByTimeAsync(UPDATE_START_DELAY);
    await vi.waitFor(() => expect(update.state.status).toBe('downloaded'));
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    expect(update.state.status).toBe('downloaded'); expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(beforeInstall).not.toHaveBeenCalled(); expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(autoUpdater.autoDownload).toBe(false); expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
  });
  it('starts a background download for an already available update after opt-in', async () => {
    vi.useFakeTimers();
    await update.check('beta');
    update.configure({ channel: 'beta', updateMode: 'download' });
    await vi.advanceTimersByTimeAsync(UPDATE_START_DELAY);
    await vi.waitFor(() => expect(update.state.status).toBe('downloaded'));
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });
  it('does not download if automatic updates are disabled during a check', async () => {
    update.configure({ channel: 'beta', updateMode: 'download' });
    let release!: () => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (!url.endsWith('.sig')) await new Promise<void>(resolve => { release = resolve; });
      return new Response(url.endsWith('.sig') ? signature : manifest);
    }));
    const checking = update.check('beta');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    update.configure({ channel: 'beta', updateMode: 'manual' });
    release(); await checking;
    expect(update.state.status).toBe('available'); expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('recovers from offline checks at the next interval without a tight retry loop', async () => {
    vi.useFakeTimers();
    vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(new Error('offline'));
    update.configure({ channel: 'beta', updateMode: 'notify' });
    await vi.advanceTimersByTimeAsync(UPDATE_START_DELAY); expect(update.state.status).toBe('error');
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL - 1); expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(update.state.status).toBe('available');
  });
  it('blocks automatic downloads with invalid signatures', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('.sig') ? Buffer.alloc(64).toString('base64') : manifest)));
    update.configure({ channel: 'beta', updateMode: 'download' });
    await vi.advanceTimersByTimeAsync(UPDATE_START_DELAY);
    expect(update.state.status).toBe('error'); expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('stops scheduled checks when disabled and cleans up on shutdown', async () => {
    vi.useFakeTimers();
    update.configure({ channel: 'beta', updateMode: 'notify' });
    update.configure({ channel: 'beta', updateMode: 'manual' });
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL); expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    update.configure({ channel: 'beta', updateMode: 'notify' }); update.dispose();
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL); expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.listenerCount('download-progress')).toBe(0);
  });
  it('offers a manual release link and does not schedule updates for unpacked/development builds', async () => {
    update.dispose(); runtime.packaged = false;
    update = new Updates(() => {}, beforeInstall);
    vi.useFakeTimers();
    update.configure({ channel: 'beta', updateMode: 'download' });
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL); await update.check('beta');
    expect(update.state).toMatchObject({ status: 'unsupported', supported: false, releasesUrl: 'https://github.com/Leos-byte/MemoryGraph/releases' });
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});
