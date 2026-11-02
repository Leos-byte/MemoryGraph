import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { dataResultSchema, sourceSchema, valuesSchema, type DataResult, type DataSource, type Values } from '../shared/content';
import { markdownAssets } from '../shared/markdown';

export const assetExtensions: Record<string,string> = { 'image/png':'png', 'image/jpeg':'jpeg', 'image/webp':'webp', 'image/gif':'gif' };

export const contentSchema = `
CREATE TABLE IF NOT EXISTS content_assets(id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS content_refs(node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, asset_id TEXT NOT NULL REFERENCES content_assets(id), PRIMARY KEY(node_id,asset_id));
CREATE TABLE IF NOT EXISTS content_state(node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, block_id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(node_id,block_id));
CREATE TABLE IF NOT EXISTS content_sources(id TEXT PRIMARY KEY, config TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS content_cache(node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, source_id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(node_id,source_id));`;

const richColumns = {
  content_assets: {id:'TEXT',mime:'TEXT',bytes:'BLOB',created_at:'TEXT'},
  content_refs: {node_id:'INTEGER',asset_id:'TEXT'},
  content_state: {node_id:'INTEGER',block_id:'TEXT',value:'TEXT'},
  content_sources: {id:'TEXT',config:'TEXT'},
  content_cache: {node_id:'INTEGER',source_id:'TEXT',value:'TEXT'}
};
export function validateContentSchema(db:Database.Database) {
  for (const [table,columns] of Object.entries(richColumns)) {
    const info = db.pragma(`table_info(${table})`) as {name:string;type:string;pk:number|bigint;notnull:number|bigint}[];
    const primary = table==='content_assets'||table==='content_sources'?['id']:table==='content_refs'?['node_id','asset_id']:table==='content_state'?['node_id','block_id']:['node_id','source_id'];
    for (const [name,type] of Object.entries(columns)) {
      const column=info.find(item=>item.name===name);
      if (!column || column.type.toUpperCase()!==type || Number(column.pk)!==primary.indexOf(name)+1 || (name!=='id' && !Number(column.notnull))) throw new Error(`Incompatible rich-content column: ${table}.${name}`);
    }
    if (table==='content_refs'||table==='content_state'||table==='content_cache') {
      const keys=db.pragma(`foreign_key_list(${table})`) as {from:string;table:string;to:string;on_delete:string}[];
      if (!keys.some(key=>key.from==='node_id' && key.table==='nodes' && key.to==='id' && key.on_delete==='CASCADE')) throw new Error(`Incompatible rich-content foreign keys: ${table}`);
      if (table==='content_refs' && !keys.some(key=>key.from==='asset_id' && key.table==='content_assets' && key.to==='id')) throw new Error('Incompatible asset references.');
    }
  }
}

export class ContentStore {
  constructor(readonly db: Database.Database) {}
  activeNode(id: string) { const node = this.db.prepare("SELECT nodes.* FROM nodes JOIN maps ON maps.id=nodes.map_id WHERE nodes.id=? AND nodes.deleted_at='' AND maps.deleted_at=''").get(id) as Record<string, unknown> | undefined; if (!node) throw new Error('Node unavailable.'); return node; }
  asset(nodeId: string, bytes: Buffer, mime: string) {
    this.activeNode(nodeId); const id = createHash('sha256').update(bytes).digest('hex');
    this.db.transaction(() => { this.db.prepare('INSERT OR IGNORE INTO content_assets VALUES (?,?,?,?)').run(id, mime, bytes, new Date().toISOString()); this.db.prepare('INSERT OR IGNORE INTO content_refs VALUES (?,?)').run(nodeId, id); })(); return id;
  }
  readAsset(id: string): { mime: string; bytes: Buffer } | undefined {
    if (!/^[a-f0-9]{64}$/.test(id)) return undefined;
    const meta = this.db.prepare('SELECT mime,length(bytes) AS size FROM content_assets WHERE id=?').get(id) as { mime:string; size:number|bigint } | undefined;
    if (!meta || !Object.hasOwn(assetExtensions,meta.mime) || Number(meta.size)>25*1024*1024) return undefined;
    return this.db.prepare('SELECT mime,bytes FROM content_assets WHERE id=?').get(id) as { mime:string; bytes:Buffer };
  }
  linkAssets(nodeId: string, markdown: string) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO content_refs SELECT ?,id FROM content_assets WHERE id=?');
    for (const id of markdownAssets(markdown)) insert.run(nodeId,id);
  }
  assets(nodeIds: string[], max = 128 * 1024 * 1024) {
    const result = new Map<string, { mime: string; bytes: Buffer }>();
    let length = 0;
    for (const nodeId of nodeIds) for (const id of markdownAssets(String(this.activeNode(nodeId).markdown))) {
      if (result.has(id)) continue;
      const meta = this.db.prepare('SELECT length(bytes) AS size FROM content_assets WHERE id=?').get(id) as {size:number|bigint}|undefined;
      if (!meta) continue;
      if ((length += Number(meta.size)) > max) throw new Error('Export exceeds asset size limit.');
      const asset = this.readAsset(id); if (asset) result.set(id,asset);
    }
    return result;
  }
  state(nodeId: string): Record<string, Values> {
    this.activeNode(nodeId);
    return Object.fromEntries((this.db.prepare('SELECT block_id,value FROM content_state WHERE node_id=?').all(nodeId) as { block_id: string; value: string }[]).map(row => [row.block_id, valuesSchema.parse(JSON.parse(row.value))]));
  }
  saveState(nodeId: string, blockId: string, values: unknown) {
    this.activeNode(nodeId); z.string().regex(/^[a-zA-Z][\w-]{0,63}$/).parse(blockId);
    this.db.prepare('INSERT INTO content_state VALUES (?,?,?) ON CONFLICT(node_id,block_id) DO UPDATE SET value=excluded.value').run(nodeId, blockId, JSON.stringify(valuesSchema.parse(values)));
  }
  sources(): DataSource[] { return (this.db.prepare('SELECT config FROM content_sources ORDER BY rowid').all() as { config: string }[]).map(row => sourceSchema.parse(JSON.parse(row.config))); }
  saveSource(value: unknown) {
    const source=sourceSchema.parse(value), serialized=JSON.stringify(source);
    this.db.transaction(()=>{
      const previous=this.db.prepare('SELECT config FROM content_sources WHERE id=?').get(source.id) as {config:string}|undefined;
      if(previous && previous.config!==serialized)this.db.prepare('DELETE FROM content_cache WHERE source_id=?').run(source.id);
      this.db.prepare('INSERT INTO content_sources VALUES (?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config').run(source.id,serialized);
    })();return source;
  }
  deleteSource(id: string) { this.db.prepare('DELETE FROM content_sources WHERE id=?').run(id); this.db.prepare('DELETE FROM content_cache WHERE source_id=?').run(id); }
  cache(nodeId: string, sourceId: string, value?: DataResult): DataResult | undefined {
    this.activeNode(nodeId);
    if (value) this.db.prepare('INSERT INTO content_cache VALUES (?,?,?) ON CONFLICT(node_id,source_id) DO UPDATE SET value=excluded.value').run(nodeId, sourceId, JSON.stringify(value));
    const result = this.db.prepare('SELECT value FROM content_cache WHERE node_id=? AND source_id=?').get(nodeId, sourceId) as { value: string } | undefined;
    if (!result) return undefined;
    try { if (result.value.length > 4*1024*1024) return undefined; return dataResultSchema.parse(JSON.parse(result.value)); } catch { return undefined; }
  }
}
