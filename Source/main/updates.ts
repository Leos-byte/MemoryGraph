import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { boundedText } from './ai';
import { REPOSITORY, validateManifest, type SignedRelease } from './core';
import type { Settings, UpdateState } from '../shared/types';

type UpdatePreferences = Pick<Settings, 'channel' | 'updateMode'>;
export const UPDATE_START_DELAY = 15_000;
export const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;

export class Updates {
  state: UpdateState;
  private manifest: SignedRelease | null = null;
  private downloadPath: string | null = null;
  private publicKey: string;
  private channel: 'stable' | 'beta' = 'stable';
  private preferences: UpdatePreferences | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private operation: 'checking' | 'downloading' | 'installing' | null = null;
  private disposed = false;
  constructor(private changed: () => void, private beforeInstall: () => Promise<void>) {
    const supported = app.isPackaged && (process.platform === 'linux' ? !!process.env.APPIMAGE : process.platform === 'win32' && existsSync(join(dirname(process.execPath), 'Uninstall MemGraph.exe')));
    this.state = { status: supported ? 'idle' : 'unsupported', supported, releasesUrl: `https://github.com/${REPOSITORY}/releases` };
    const path = app.isPackaged ? join(process.resourcesPath, 'update-public-key.pem') : join(__dirname, '..', 'update-public-key.pem');
    this.publicKey = existsSync(path) ? readFileSync(path, 'utf8') : '';
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.allowDowngrade = false;
    autoUpdater.on('error', this.onError);
    autoUpdater.on('download-progress', this.onProgress);
    autoUpdater.on('update-downloaded', this.onDownloaded);
  }
  private onError = (error: Error) => {
    if (!this.operation) return;
    this.fail(error);
    // Installer failures can be emitted after quitAndInstall has already returned.
    if (this.operation === 'installing') this.operation = null;
  };
  private onProgress = (progress: { percent: number }) => {
    if (this.operation === 'downloading' && Number.isFinite(progress.percent)) this.set({ percent: Math.min(100, Math.max(0, progress.percent)) });
  };
  private onDownloaded = (event: { downloadedFile: string }) => { if (this.operation === 'downloading') this.downloadPath = event.downloadedFile; };
  private set(next: Partial<UpdateState>) { if (!this.disposed) { this.state = { ...this.state, ...next }; this.changed(); } }
  private fail(error: unknown) { this.set({ status: 'error', percent: undefined, message: error instanceof Error ? error.message : String(error) }); }
  private reset() { this.manifest = null; this.downloadPath = null; this.set({ status: this.state.supported ? 'idle' : 'unsupported', version: undefined, percent: undefined, message: undefined, checkedAt: undefined }); }
  configure(preferences: UpdatePreferences) {
    if (this.disposed || (this.preferences?.channel === preferences.channel && this.preferences.updateMode === preferences.updateMode)) return;
    const channelChanged = (this.preferences?.channel ?? this.channel) !== preferences.channel;
    this.preferences = { ...preferences };
    if (channelChanged && !this.operation) this.reset();
    this.schedule(UPDATE_START_DELAY);
  }
  private schedule(delay: number) {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.disposed || !this.state.supported || !this.preferences || this.preferences.updateMode === 'manual') return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.backgroundCheck(); }, delay);
    this.timer.unref();
  }
  private async backgroundCheck() {
    try {
      if (!this.disposed && this.preferences && this.preferences.updateMode !== 'manual' && !this.operation && this.state.status !== 'downloaded') {
        if (this.state.status === 'available' && this.preferences.updateMode === 'download') await this.download();
        else await this.check(this.preferences.channel);
      }
    } catch (error) { this.fail(error); }
    finally { this.schedule(UPDATE_INTERVAL); }
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    autoUpdater.off('error', this.onError);
    autoUpdater.off('download-progress', this.onProgress);
    autoUpdater.off('update-downloaded', this.onDownloaded);
  }
  async check(channel: 'stable' | 'beta') {
    if (this.disposed || this.operation || this.state.status === 'downloaded') return;
    if (!this.state.supported) { this.set({ status: 'unsupported' }); return; }
    this.operation = 'checking';
    this.channel = channel; this.manifest = null; this.downloadPath = null;
    this.set({ status: 'checking', message: undefined, percent: undefined, version: undefined });
    try {
      if (!this.publicKey) throw new Error('Update verification key is missing.');
      autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest'; autoUpdater.allowPrerelease = channel === 'beta';
      // Setting channel enables downgrade in electron-updater; reset it after every switch.
      autoUpdater.allowDowngrade = false;
      const result = await autoUpdater.checkForUpdates();
      if (this.disposed) return;
      if (!result) throw new Error('The update service did not return release metadata.');
      const checkedAt = new Date().toISOString();
      if (!isNewer(result.updateInfo.version, app.getVersion())) { this.set({ status: 'upToDate', checkedAt }); return; }
      const version = result.updateInfo.version;
      const base = `https://github.com/${REPOSITORY}/releases/download/v${encodeURIComponent(version)}`;
      const fetchAsset = async (name: string) => {
        const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Cannot read signed release metadata (${response.status}).`);
        return boundedText(response);
      };
      const manifest = validateManifest(await fetchAsset('release-manifest.json'), await fetchAsset('release-manifest.sig'), this.publicKey, version, channel);
      if (!result.updateInfo.files.length) throw new Error('Update metadata has no packages.');
      for (const file of result.updateInfo.files) {
        const name = basename(new URL(file.url, `${base}/`).pathname);
        if (!manifest.files.some(item => item.name === decodeURIComponent(name) && item.sha512 === file.sha512)) throw new Error('Updater metadata is not covered by release signature.');
      }
      this.manifest = manifest;
      this.set({ status: 'available', version, checkedAt });
    } catch (error) { this.fail(error); }
    finally {
      this.operation = null;
      if (this.preferences && this.preferences.channel !== channel) this.reset();
    }
    if (!this.disposed && this.state.status === 'available' && this.preferences?.updateMode === 'download') await this.download();
  }
  async download() {
    if (this.disposed || this.operation || this.state.status === 'downloaded') return;
    if (this.state.status !== 'available' || !this.manifest) throw new Error('Check for a verified update first.');
    this.operation = 'downloading';
    try {
      this.set({ status: 'downloading', percent: 0, message: undefined });
      await autoUpdater.downloadUpdate();
      await this.verifyDownloaded();
      this.set({ status: 'downloaded', percent: 100 });
    } catch (error) { this.fail(error); }
    finally {
      this.operation = null;
      if (this.preferences && this.preferences.channel !== this.channel) this.reset();
    }
  }
  private async verifyDownloaded() {
    if (!this.downloadPath || !this.manifest) throw new Error('Downloaded update is missing.');
    // electron-updater may rename its cache file; match authenticated content, not its cache filename.
    const size = statSync(this.downloadPath).size;
    const hash = createHash('sha512');
    for await (const chunk of createReadStream(this.downloadPath)) hash.update(chunk);
    const digest = hash.digest('base64');
    if (!this.manifest.files.some(file => file.size === size && file.sha512 === digest)) throw new Error('Downloaded package does not match signed release.');
  }
  async install() {
    if (this.disposed || this.operation) return;
    if (this.state.status !== 'downloaded') throw new Error('Download a verified update first.');
    this.operation = 'installing';
    this.set({ status: 'installing', message: undefined });
    try {
      await this.verifyDownloaded();
      await this.beforeInstall();
      if (!this.disposed && this.operation === 'installing') autoUpdater.quitAndInstall(false, true);
    } catch (error) { this.fail(error); this.operation = null; }
  }
}
export function isNewer(next: string, current: string) {
  const parse = (v: string) => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(v);
    return match?.[4]?.split('.').some(part => /^0\d+$/.test(part)) ? null : match;
  };
  const n = parse(next), c = parse(current); if (!n || !c) return false;
  for (let i = 1; i <= 3; i++) if (BigInt(n[i]) !== BigInt(c[i])) return BigInt(n[i]) > BigInt(c[i]);
  if (!n[4] || !c[4]) return !!c[4] && !n[4];
  const nextParts = n[4].split('.'), currentParts = c[4].split('.');
  for (let i = 0; i < Math.max(nextParts.length, currentParts.length); i++) {
    const a = nextParts[i], b = currentParts[i];
    if (a === b) continue;
    if (a === undefined || b === undefined) return b === undefined;
    const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
    if (an && bn) return BigInt(a) > BigInt(b);
    if (an !== bn) return !an;
    return a > b;
  }
  return false;
}
