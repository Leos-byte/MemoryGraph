import { safeStorage, dialog, type BrowserWindow } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { imageSize } from 'image-size';
import { z } from 'zod';
import { writePrivate } from './config';
import { Store } from './store';
import { ContentStore } from './content-store';
import { publicRequest, publicUrl } from './content-network';
import { actionSchema, bindText, rowsSchema, sourceSchema, valuesSchema, type DataResult, type DataSource, type ImageJob, type RichProfile } from '../shared/content';
import type { NodeRecord } from '../shared/types';

const revision = (node:NodeRecord) => createHash('sha256').update(JSON.stringify([node.updated_at,node.title,node.markdown])).digest('hex');

export async function validateImage(bytes: Buffer): Promise<string> {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error('Image exceeds 25 MiB.');
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !['image/png','image/jpeg','image/webp','image/gif'].includes(type.mime)) throw new Error('Only PNG, JPEG, WebP and GIF images are accepted.');
  const size = imageSize(bytes); if (!size.width || !size.height || size.width * size.height > 16_777_216) throw new Error('Image dimensions exceed 16 megapixels.');
  return type.mime;
}
class Credentials {
  values: Record<string,string> = Object.create(null);
  constructor(readonly path: string, readonly persistent: boolean) {}
  async load() { if (this.persistent && existsSync(this.path)) { try { this.values = z.record(z.string(), z.string()).parse(JSON.parse((await safeStorage.decryptStringAsync(readFileSync(this.path))).result)); } catch { this.values = Object.create(null); } } }
  async set(id: string, value: string) { const next = { ...this.values, [id]: value }; if (this.persistent) writePrivate(this.path, await safeStorage.encryptStringAsync(JSON.stringify(next))); this.values = next; }
  redact(message: string) { for (const value of Object.values(this.values)) if (value && value !== '@authorized') message = message.replaceAll(value, '[redacted]'); return message; }
}
export class ContentService {
  readonly credentials: Credentials;
  private queue: Promise<unknown> = Promise.resolve();
  private imageModel = 'grok-imagine-image-2.0';
  private jobs = new Map<string, ImageJob & { abort: AbortController }>();
  private requests = new Set<AbortController>();
  private epoch = 0;
  private previews = new Map<string, { store: Store; source: string; target: string; revision: string; action: z.infer<typeof actionSchema>; expires: number }>();
  constructor(private getStore: () => Store, readonly root: string, persistent: boolean, private window: () => BrowserWindow, private isBusy: (id: string) => boolean, private changed: () => void) {
    this.credentials = new Credentials(join(root, 'rich-credentials.bin'), persistent);
    try { this.imageModel = z.string().regex(/^[\w.-]{1,100}$/).parse(JSON.parse(readFileSync(join(root, 'rich-profile.json'), 'utf8')).imageModel); } catch { /* Use the documented default on missing/invalid configuration. */ }
  }
  private get content() { return new ContentStore(this.getStore().db); }
  private sourcePrefix(id:string,store=this.getStore()) { return `source:${createHash('sha256').update(store.path).digest('hex')}:${id}:`; }
  private fingerprint(source: DataSource, store = this.getStore()) { return this.sourcePrefix(source.id,store)+createHash('sha256').update(JSON.stringify(source)).digest('hex'); }
  private async serial<T>(operation: () => Promise<T>): Promise<T> { const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result; }
  async revokeSources() { this.cancel(); this.jobs.clear(); this.previews.clear(); await this.serial(async () => { for (const id of Object.keys(this.credentials.values)) if (id.startsWith('source:')) await this.credentials.set(id, ''); }); }
  cancel() { this.epoch++; for (const request of this.requests) request.abort(); for (const job of this.jobs.values()) { if (job.status === 'running') { job.abort.abort(); job.status = 'cancelled'; } } }
  profile(): RichProfile { return { imageModel: this.imageModel, hasImageKey: !!this.credentials.values.images, persistent: this.credentials.persistent, sources: this.content.sources().map(source => { const value = this.credentials.values[this.fingerprint(source)]; return { ...source, authorized: !!value, hasKey: !!value && value !== '@authorized' }; }) }; }
  async configure(p: Record<string, unknown>) { return this.serial(async () => {
    const model = z.string().regex(/^[\w.-]{1,100}$/).parse(p.imageModel ?? this.imageModel);
    if (p.clear === true) await this.credentials.set('images', '');
    if (p.clear !== true && p.apiKey !== undefined && p.apiKey !== '') await this.credentials.set('images', z.string().trim().min(1).max(4096).parse(p.apiKey));
    writePrivate(join(this.root, 'rich-profile.json'), JSON.stringify({ imageModel: model })); this.imageModel = model; return this.profile();
  }); }
  async saveSource(p: Record<string,unknown>) {
    const source = sourceSchema.parse(p.source); publicUrl(source.url);
    const store = this.getStore(), epoch = this.epoch;
    const answer = await dialog.showMessageBox(this.window(), { type: 'question', message: `Authorize read-only requests? / 授权只读请求？\n${source.name}\n${source.url}`, buttons: ['Cancel / 取消','Authorize / 授权'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return false;
    if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.');
    return this.serial(async () => {
      if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.');
      const fingerprint = this.fingerprint(source,store);
      const secret = p.apiKey ? z.string().trim().max(4096).parse(p.apiKey) : this.credentials.values[fingerprint];
      if (source.auth !== 'none' && (!secret || secret === '@authorized')) throw new Error('Enter the data-source API key.');
      await this.credentials.set(fingerprint, source.auth === 'none' ? '@authorized' : secret!);
      if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.');
      new ContentStore(store.db).saveSource(source); return this.profile();
    });
  }
  async deleteSource(id: string) {
    const store = this.getStore();
    return this.serial(async () => {
      if (store !== this.getStore()) throw new Error('Data directory changed.');
      for(const key of Object.keys(this.credentials.values))if(key.startsWith(this.sourcePrefix(id,store)))await this.credentials.set(key,'');
      if (store !== this.getStore()) throw new Error('Data directory changed.');
      this.content.deleteSource(id); return this.profile();
    });
  }
  async query(nodeId: string, sourceId: string, params: unknown): Promise<DataResult> {
    const store = this.getStore(), content = this.content, epoch = this.epoch; content.activeNode(nodeId);
    const source = content.sources().find(item => item.id === sourceId); if (!source) throw new Error('Data source unavailable.');
    const secret = this.credentials.values[this.fingerprint(source)]; if (!secret) throw new Error('Authorize this data source in Settings.');
    const authorized = () => { const current=content.sources().find(item=>item.id===sourceId); return current && this.fingerprint(current,store)===this.fingerprint(source,store) && this.credentials.values[this.fingerprint(source,store)]===secret; };
    const input = valuesSchema.parse(params), url = publicUrl(source.url);
    for (const [key,value] of Object.entries(input)) { if (!source.params.includes(key)) throw new Error(`Query parameter not allowed: ${key}`); url.searchParams.set(key, String(value ?? '')); }
    const headers: Record<string,string> = { Accept: 'application/json' };
    if (source.auth === 'bearer') headers.Authorization = `Bearer ${secret}`; else if (source.auth === 'header') headers[source.header] = secret;
    if(this.requests.size>=4)throw new Error('Too many data requests. Try again shortly.');
    const abort = new AbortController(); this.requests.add(abort);
    try {
      const bytes = await publicRequest(url.href, { signal: AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]), headers });
      let data: unknown = JSON.parse(bytes.toString('utf8'));
      for (const field of source.path.split('.').filter(Boolean)) { if (!data || typeof data !== 'object' || !Object.hasOwn(data, field) || ['__proto__','constructor','prototype'].includes(field)) throw new Error('Data path is missing.'); data = (data as Record<string,unknown>)[field]; }
      const rows = rowsSchema.parse(data), result = { rows, fetchedAt: new Date().toISOString() };
      if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.'); if(!authorized())throw new Error('Data-source authorization changed.');content.cache(nodeId, sourceId, result); return result;
    } catch (error) { if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.');if(!authorized())throw new Error('Data-source authorization changed.'); const previous = content.cache(nodeId, sourceId); if (!previous) throw new Error(this.credentials.redact(String(error))); return { ...previous, stale: true, error: this.credentials.redact(String(error)).slice(0,4000) }; }
    finally { this.requests.delete(abort); }
  }
  async importAsset(nodeId: string, p: Record<string,unknown>) {
    const store = this.getStore(); this.content.activeNode(nodeId); let bytes: Buffer;
    if (p.bytes !== undefined) { const raw = z.string().max(36 * 1024 * 1024).parse(p.bytes); bytes = Buffer.from(raw, 'base64'); }
    else if (p.url) { const url = publicUrl(z.string().max(2048).parse(p.url)); const answer = await dialog.showMessageBox(this.window(), { message: `Import image from this address? / 从该地址导入图片？\n${url.href}`, buttons: ['Cancel / 取消','Import / 导入'], defaultId: 0, cancelId: 0 }); if (answer.response !== 1) return null; bytes = await publicRequest(url.href, { signal: AbortSignal.timeout(20000), max: 25 * 1024 * 1024 }); }
    else { const result = await dialog.showOpenDialog(this.window(), { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif'] }] }); if (!result.filePaths[0]) return null; const { statSync } = await import('node:fs'); if (statSync(result.filePaths[0]).size > 25 * 1024 * 1024) throw new Error('Image exceeds 25 MiB.'); bytes = readFileSync(result.filePaths[0]); }
    const mime = await validateImage(bytes); if (store !== this.getStore()) throw new Error('Data directory changed.'); return { assetId: this.content.asset(nodeId, bytes, mime) };
  }
  async startImage(nodeId: string, p: Record<string,unknown>) {
    this.content.activeNode(nodeId); const store = this.getStore(), epoch = this.epoch, model = this.imageModel;
    if ([...this.jobs.values()].filter(job => job.status === 'running').length >= 3 || [...this.jobs.values()].some(job => job.nodeId === nodeId && job.status === 'running')) throw new Error('An image job is already running.');
    const prompt = z.string().trim().min(1).max(16000).parse(p.prompt), ratio = z.enum(['1:1','16:9','9:16','4:3','3:4']).parse(p.ratio ?? '16:9'), quality = z.enum(['low','medium']).parse(p.quality ?? 'low');
    const key = this.credentials.values.images; if (!key) throw new Error('Configure an xAI API key in Settings.');
    const result = await dialog.showMessageBox(this.window(), { type: 'question', message: `Paid xAI image request / 付费 xAI 生图请求\n${model} · 1 image · 1K · ${quality}\n${prompt}`, buttons: ['Cancel / 取消','Generate / 生成'], defaultId: 0, cancelId: 0 }); if (result.response !== 1) return null;
    if (store !== this.getStore() || epoch !== this.epoch) throw new Error('Data directory changed.');
    this.content.activeNode(nodeId);
    if ([...this.jobs.values()].filter(job => job.status === 'running').length >= 3 || [...this.jobs.values()].some(job => job.nodeId === nodeId && job.status === 'running')) throw new Error('An image job is already running.');
    const job = { id: randomUUID(), nodeId, status: 'running' as ImageJob['status'], abort: new AbortController(), assetId: undefined as string | undefined, message: undefined as string | undefined };
    if (this.jobs.size >= 100) for (const [id, old] of this.jobs) if (old.status !== 'running') { this.jobs.delete(id); break; }
    this.jobs.set(job.id, job);
    void publicRequest('https://api.x.ai/v1/images/generations', { method: 'POST', signal: AbortSignal.any([job.abort.signal, AbortSignal.timeout(180000)]), max: 36 * 1024 * 1024, headers: { 'Content-Type':'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, prompt, n: 1, resolution: '1k', quality, aspect_ratio: ratio, response_format:'b64_json' }) }).then(async bytes => {
      const response = JSON.parse(bytes.toString('utf8')); const raw = z.string().max(36 * 1024 * 1024).parse(response.data?.[0]?.b64_json); const image = Buffer.from(raw, 'base64'), mime = await validateImage(image);
      if (job.abort.signal.aborted || store !== this.getStore()) return;
      job.assetId = this.content.asset(nodeId, image, mime); job.status = 'ready';
    }).catch(error => { job.status = job.abort.signal.aborted ? 'cancelled' : 'error'; job.message = this.credentials.redact(String(error)); }).finally(() => this.changed());
    return this.job(job.id);
  }
  job(id: string): ImageJob { const job = this.jobs.get(id); if (!job) throw new Error('Image job unavailable.'); const { abort: _abort, ...publicJob } = job; return publicJob; }
  cancelImage(id: string) { const job = this.jobs.get(id); if (job?.status === 'running') { job.abort.abort(); job.status = 'cancelled'; } return this.job(id); }
  preview(source: string, raw: unknown, values: unknown) {
    const state = valuesSchema.parse(values), action = actionSchema.parse(raw), store = this.getStore(), node = store.node(source);
    this.content.activeNode(source); if (!['createChild','append','update'].includes(action.kind)) throw new Error('Unsupported map action.');
    const target = action.target ?? source; const next = store.node(target); this.content.activeNode(target);
    if (node.map_id !== next.map_id || this.isBusy(source) || this.isBusy(target)) throw new Error('Target must be idle and in the same map.');
    const resolved = { ...action, title: bindText(action.title ?? next.title, state), markdown: bindText(action.markdown ?? '', state) };
    const token = randomUUID(); if (this.previews.size > 50) this.previews.clear();
    this.previews.set(token, { store, source, target, revision: revision(next), action: resolved, expires: Date.now() + 60000 });
    return { token, kind: action.kind, target: next.title, title: resolved.title, markdown: resolved.markdown };
  }
  commit(token: string) {
    const preview = this.previews.get(token); this.previews.delete(token); if (!preview || preview.store !== this.getStore() || preview.expires < Date.now()) throw new Error('Action preview expired.');
    const store = this.getStore(), node = store.node(preview.target); this.content.activeNode(preview.source); this.content.activeNode(preview.target);
    if (revision(node) !== preview.revision || this.isBusy(preview.source) || this.isBusy(preview.target)) throw new Error('Node changed; preview the action again.');
    return store.db.transaction(() => { if (preview.action.kind === 'createChild') return store.createNode({ mapId: node.map_id, parentId: preview.source, title: preview.action.title || 'Concept', markdown: preview.action.markdown || '', x: node.x + 270, y: node.y + 100 });
      const markdown = preview.action.kind === 'append' ? `${node.markdown}\n\n${preview.action.markdown}` : preview.action.markdown!;
      store.editNode(node.id, preview.action.title || node.title, markdown); return store.node(node.id);
    })();
  }
}
