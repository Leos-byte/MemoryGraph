import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { boundedText } from './ai';
import { REPOSITORY, validateManifest, type SignedRelease } from './core';
import type { UpdateState } from '../shared/types';

export class Updates {
  state: UpdateState;
  private manifest: SignedRelease | null = null;
  private downloadPath: string | null = null;
  private publicKey: string;
  private channel: 'stable' | 'beta' = 'stable';
  constructor(private changed: () => void, private beforeInstall: () => Promise<void>) {
    const supported = app.isPackaged && (process.platform === 'linux' ? !!process.env.APPIMAGE : process.platform === 'win32' && existsSync(join(dirname(process.execPath), 'Uninstall MemGraph.exe')));
    this.state = { status: supported ? 'idle' : 'unsupported', supported };
    const path = app.isPackaged ? join(process.resourcesPath, 'update-public-key.pem') : join(__dirname, '..', 'update-public-key.pem');
    this.publicKey = existsSync(path) ? readFileSync(path, 'utf8') : '';
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.allowDowngrade = false;
    autoUpdater.on('error', error => this.fail(error));
    autoUpdater.on('download-progress', progress => this.set({ status: 'downloading', percent: progress.percent }));
    autoUpdater.on('update-downloaded', event => { this.downloadPath = event.downloadedFile; });
  }
  private set(next: Partial<UpdateState>) { this.state = { ...this.state, ...next }; this.changed(); }
  private fail(error: unknown) { this.set({ status: 'error', message: error instanceof Error ? error.message : String(error) }); }
  async check(channel: 'stable' | 'beta') {
    if (!this.state.supported) { this.set({ status: 'unsupported', message: `https://github.com/${REPOSITORY}/releases` }); return; }
    if (this.state.status === 'checking' || this.state.status === 'downloading') return;
    this.channel = channel; this.manifest = null; this.downloadPath = null;
    this.set({ status: 'checking', message: undefined, percent: undefined });
    try {
      if (!this.publicKey) throw new Error('Update verification key is missing.');
      autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest'; autoUpdater.allowPrerelease = channel === 'beta';
      const result = await autoUpdater.checkForUpdates();
      if (!result || result.updateInfo.version === app.getVersion() || !(autoUpdater as any).updateAvailable) {
        // checkForUpdates returns metadata even when there is no newer release.
        if (!result || !isNewer(result.updateInfo.version, app.getVersion())) { this.set({ status: 'idle', message: 'No newer version.' }); return; }
      }
      const version = result.updateInfo.version;
      const base = `https://github.com/${REPOSITORY}/releases/download/v${encodeURIComponent(version)}`;
      const fetchAsset = async (name: string) => {
        const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Cannot read signed release metadata (${response.status}).`);
        return boundedText(response);
      };
      this.manifest = validateManifest(await fetchAsset('release-manifest.json'), await fetchAsset('release-manifest.sig'), this.publicKey, version, channel);
      for (const file of result.updateInfo.files) {
        const name = basename(new URL(file.url, `${base}/`).pathname);
        if (!this.manifest.files.some(item => item.name === decodeURIComponent(name) && item.sha512 === file.sha512)) throw new Error('Updater metadata is not covered by release signature.');
      }
      this.set({ status: 'available', version });
    } catch (error) { this.fail(error); }
  }
  async download() {
    if (this.state.status !== 'available' || !this.manifest) throw new Error('Check for a verified update first.');
    try {
      this.set({ status: 'downloading', percent: 0 });
      await autoUpdater.downloadUpdate();
      await this.verifyDownloaded();
      this.set({ status: 'downloaded', percent: 100 });
    } catch (error) { this.fail(error); }
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
    if (this.state.status !== 'downloaded') throw new Error('Download a verified update first.');
    try { await this.verifyDownloaded(); await this.beforeInstall(); autoUpdater.quitAndInstall(false, true); }
    catch (error) { this.fail(error); }
  }
}
export function isNewer(next: string, current: string) {
  const parse = (v: string) => /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/.exec(v);
  const n = parse(next), c = parse(current); if (!n || !c) return false;
  for (let i = 1; i <= 3; i++) if (+n[i] !== +c[i]) return +n[i] > +c[i];
  if (!n[4] || !c[4]) return !!c[4] && !n[4];
  return n[4].localeCompare(c[4], 'en', { numeric: true }) > 0;
}
