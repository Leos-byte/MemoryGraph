import Database from 'better-sqlite3';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EdgeRecord, MapRecord, NodeRecord, TemplateRecord, Trash } from '../shared/types';

export const defaultSystemPrompt = `You are MemGraph, a knowledge-learning assistant. Explain concepts for building a durable knowledge graph.

Rules:
- Output Markdown only.
- Be precise, concrete, and easy to review later.
- Explain in {{language}}.
- If the user selected text from a parent node, connect the new explanation to the parent concept.
- Do not invent citations. If uncertainty matters, state the uncertainty briefly.`;

export const defaultUserPrompt = `Knowledge map: {{map_title}}
Parent concept: {{parent_concept}}
Selected text: {{selected_text}}
Target concept: {{concept}}

Existing context:
{{context_markdown}}

Please explain the target concept using this Markdown structure:

## 讲了什么
Explain what the concept means.

## 解决什么问题
Explain the scenarios or problems it helps solve.

## 组成部分或条件
List the important components, prerequisites, or conditions.

## 如果缺少这些部分会怎样
Explain what fails, becomes confusing, or changes if those components or conditions are missing.

## 和已有节点的联系
Explain how this concept connects to the parent concept or current knowledge map.`;

// Keep this schema compatible with Qt GraphStore, including its defaults and FK actions.
const schema = `
CREATE TABLE maps(
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE templates(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  system_prompt TEXT NOT NULL, user_prompt TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0, deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE nodes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, map_id INTEGER NOT NULL, title TEXT NOT NULL,
  markdown TEXT NOT NULL DEFAULT '', template_id INTEGER,
  x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready', deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,
  FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL);
CREATE TABLE edges(
  id INTEGER PRIMARY KEY AUTOINCREMENT, map_id INTEGER NOT NULL,
  source_node_id INTEGER NOT NULL, target_node_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'explains', label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
  FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,
  FOREIGN KEY(source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(target_node_id) REFERENCES nodes(id) ON DELETE CASCADE);
CREATE TABLE generation_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT, node_id INTEGER NOT NULL,
  model TEXT NOT NULL, api_mode TEXT NOT NULL, prompt_snapshot TEXT NOT NULL,
  status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
  FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE);
`;

const columns: Record<string, string> = {
  maps: 'id title description deleted_at created_at updated_at',
  templates: 'id name system_prompt user_prompt is_default deleted_at created_at updated_at',
  nodes: 'id map_id title markdown template_id x y status deleted_at created_at updated_at',
  edges: 'id map_id source_node_id target_node_id type label created_at',
  generation_history: 'id node_id model api_mode prompt_snapshot status error created_at',
};
const foreignKeys: Record<string, string[]> = {
  maps: [], templates: [],
  nodes: ['map_id:maps:CASCADE', 'template_id:templates:SET NULL'],
  edges: ['map_id:maps:CASCADE', 'source_node_id:nodes:CASCADE', 'target_node_id:nodes:CASCADE'],
  generation_history: ['node_id:nodes:CASCADE'],
};
const openStores = new Set<Store>();
const importing = new Set<string>();
const now = () => new Date().toISOString();
const canonical = (path: string) => existsSync(path) ? realpathSync(path) : resolve(path);

function sameFile(a: string, b: string): boolean {
  if (canonical(a) === canonical(b)) return true;
  if (!existsSync(a) || !existsSync(b)) return false;
  const x = statSync(a), y = statSync(b);
  return x.dev === y.dev && x.ino === y.ino;
}

function assertDestinationClosed(path: string): void {
  for (const store of openStores) {
    if (store.db.open && sameFile(store.path, path)) throw new Error('Close the destination database first.');
  }
}

function idValue(id: string): bigint {
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id)) throw new Error('Invalid ID.');
  const value = BigInt(id);
  if (value > 9223372036854775807n) throw new Error('Invalid ID.');
  return value;
}

function dto<T>(row: unknown): T {
  const record = row as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key,
    value == null ? value : key === 'id' || key.endsWith('_id') ? String(value)
      : typeof value === 'bigint' ? Number(value) : value,
  ])) as T;
}

function restrictFiles(path: string): void {
  if (path === ':memory:') return;
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (existsSync(path + suffix)) chmodSync(path + suffix, 0o600);
  }
}

function checkDatabase(db: Database.Database, allowEmpty = false): boolean {
  const version = Number(db.pragma('user_version', { simple: true }));
  if (version > 1 || version < 0) throw new Error(`Unsupported database version: ${version}`);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  if (!tables.length && allowEmpty && version === 0) return true;
  for (const [table, names] of Object.entries(columns)) {
    if (!tables.some(t => t.name === table)) throw new Error(`Incompatible database: missing table ${table}`);
    const info = db.pragma(`table_info(${table})`) as { name: string; type: string; pk: number | bigint; notnull: number | bigint; dflt_value: string | null }[];
    for (const name of names.split(' ')) {
      const column = info.find(c => c.name === name);
      if (!column && name === 'deleted_at' && version === 0) continue;
      const integer = name === 'id' || name.endsWith('_id') || name === 'is_default';
      const type = integer ? 'INTEGER' : name === 'x' || name === 'y' ? 'REAL' : 'TEXT';
      if (!column || column.type.toUpperCase() !== type ||
          (name === 'id' ? Number(column.pk) !== 1 : name !== 'template_id' && Number(column.notnull) !== 1)) {
        throw new Error(`Incompatible database column: ${table}.${name}`);
      }
      const defaults: Record<string, string> = {
        description: "''", deleted_at: "''", markdown: "''", label: "''", error: "''",
        is_default: '0', x: '0', y: '0', status: "'ready'", type: "'explains'",
      };
      // generation_history.status has no default, unlike nodes.status.
      const expectedDefault = table === 'generation_history' && name === 'status' ? undefined : defaults[name];
      if (expectedDefault !== undefined && column.dflt_value !== expectedDefault) {
        throw new Error(`Incompatible default: ${table}.${name}`);
      }
    }
    const keys = db.pragma(`foreign_key_list(${table})`) as { from: string; table: string; to: string; on_delete: string }[];
    for (const expected of foreignKeys[table]) {
      if (!keys.some(k => `${k.from}:${k.table}:${k.on_delete}` === expected && k.to === 'id')) {
        throw new Error(`Incompatible foreign keys: ${table}`);
      }
    }
  }
  const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Database integrity check failed.');
  if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Database foreign key check failed.');
  return false;
}

export function validateDatabase(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try { checkDatabase(db); } finally { db.close(); }
}

export class Store {
  public readonly db: Database.Database;
  public readonly path: string;

  constructor(path: string) {
    this.path = path === ':memory:' ? path : canonical(path);
    if (importing.has(this.path)) throw new Error('Database import is in progress.');
    if (path !== ':memory:') {
      if (existsSync(path)) {
        const probe = new Database(path, { readonly: true, fileMustExist: true });
        try { checkDatabase(probe, true); } finally { probe.close(); }
      }
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      restrictFiles(path);
    }
    this.db = new Database(path);
    try {
      restrictFiles(path);
      this.db.defaultSafeIntegers(true);
      this.db.pragma('foreign_keys = ON');
      this.db.transaction(() => {
        if (checkDatabase(this.db, true)) this.db.exec(schema);
        else {
          for (const table of ['maps', 'nodes', 'templates']) {
            const info = this.db.pragma(`table_info(${table})`) as { name: string }[];
            if (!info.some(c => c.name === 'deleted_at')) {
              this.db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''`);
            }
          }
        }
        this.db.pragma('user_version = 1');
        if (!this.db.prepare("SELECT id FROM templates WHERE deleted_at = '' LIMIT 1").get()) {
          this.saveTemplate({ name: 'Default Memory Explanation', system_prompt: defaultSystemPrompt, user_prompt: defaultUserPrompt, is_default: true });
        }
      })();
      this.db.pragma('journal_mode = WAL');
      restrictFiles(path);
      openStores.add(this);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private rows<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params).map(row => dto<T>(row));
  }

  private one<T>(sql: string, ...params: unknown[]): T {
    const row = this.db.prepare(sql).get(...params);
    if (!row) throw new Error('Record not found.');
    return dto<T>(row);
  }

  private activeMap(id: string): MapRecord {
    return this.one<MapRecord>("SELECT * FROM maps WHERE id = ? AND deleted_at = ''", idValue(id));
  }

  private activeNode(id: string): NodeRecord {
    const node = this.node(id);
    if (node.deleted_at) throw new Error('Node not found.');
    this.activeMap(node.map_id);
    return node;
  }

  maps(): MapRecord[] {
    return this.rows("SELECT * FROM maps WHERE deleted_at = '' ORDER BY updated_at DESC, id DESC");
  }

  graph(mapId: string): { nodes: NodeRecord[]; edges: EdgeRecord[] } {
    const id = idValue(mapId);
    return {
      nodes: this.rows(`SELECT n.* FROM nodes n JOIN maps m ON m.id = n.map_id
        WHERE n.map_id = ? AND n.deleted_at = '' AND m.deleted_at = '' ORDER BY n.created_at, n.id`, id),
      edges: this.rows(`SELECT e.* FROM edges e
        JOIN maps m ON m.id = e.map_id AND m.deleted_at = ''
        JOIN nodes s ON s.id = e.source_node_id AND s.deleted_at = '' AND s.map_id = e.map_id
        JOIN nodes t ON t.id = e.target_node_id AND t.deleted_at = '' AND t.map_id = e.map_id
        WHERE e.map_id = ? ORDER BY e.created_at, e.id`, id),
    };
  }

  node(id: string): NodeRecord {
    return this.one('SELECT * FROM nodes WHERE id = ?', idValue(id));
  }

  createMap(title: string): MapRecord {
    const time = now();
    const result = this.db.prepare('INSERT INTO maps(title, description, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(title.trim() || 'Untitled Map', '', time, time);
    return this.activeMap(String(result.lastInsertRowid));
  }

  renameMap(id: string, title: string): void {
    this.activeMap(id);
    this.db.prepare('UPDATE maps SET title = ?, updated_at = ? WHERE id = ?').run(title.trim() || 'Untitled Map', now(), idValue(id));
  }

  deleteMap(id: string): void {
    this.activeMap(id);
    const time = now();
    this.db.prepare('UPDATE maps SET deleted_at = ?, updated_at = ? WHERE id = ?').run(time, time, idValue(id));
  }

  createNode(args: { mapId: string; title: string; markdown?: string; templateId?: string | null; parentId?: string; selectedText?: string; x?: number; y?: number; status?: string }): NodeRecord {
    return this.db.transaction(() => {
      this.activeMap(args.mapId);
      if (args.templateId) this.one("SELECT * FROM templates WHERE id = ? AND deleted_at = ''", idValue(args.templateId));
      if (args.parentId && this.activeNode(args.parentId).map_id !== args.mapId) throw new Error('Parent belongs to a different map.');
      const x = args.x ?? 0, y = args.y ?? 0;
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid node position.');
      const time = now();
      const result = this.db.prepare(`INSERT INTO nodes(map_id, title, markdown, template_id, x, y, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(idValue(args.mapId), args.title.trim(), args.markdown ?? '',
        args.templateId ? idValue(args.templateId) : null, x, y, args.status ?? 'ready', time, time);
      const node = this.node(String(result.lastInsertRowid));
      if (args.parentId) this.connect(args.parentId, node.id, 'explains', args.selectedText ?? '');
      return node;
    })();
  }

  editNode(id: string, title: string, markdown: string): void {
    this.activeNode(id);
    this.db.prepare('UPDATE nodes SET title = ?, markdown = ?, updated_at = ? WHERE id = ?')
      .run(title.trim() || 'Untitled Node', markdown, now(), idValue(id));
  }

  moveNode(id: string, x: number, y: number): void {
    this.activeNode(id);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid node position.');
    this.db.prepare('UPDATE nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?').run(x, y, now(), idValue(id));
  }

  deleteNode(id: string): void {
    this.activeNode(id);
    const time = now();
    this.db.prepare("UPDATE nodes SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(time, time, idValue(id));
  }

  setMarkdown(id: string, markdown: string, status = 'ready'): void {
    this.activeNode(id);
    this.db.prepare('UPDATE nodes SET markdown = ?, status = ?, updated_at = ? WHERE id = ?').run(markdown, status, now(), idValue(id));
  }

  connect(sourceId: string, targetId: string, type = 'manual', label = ''): EdgeRecord {
    return this.db.transaction(() => {
      if (sourceId === targetId) throw new Error('A node cannot connect to itself.');
      const source = this.activeNode(sourceId), target = this.activeNode(targetId);
      if (source.map_id !== target.map_id) throw new Error('Nodes belong to different maps.');
      const existing = this.db.prepare('SELECT * FROM edges WHERE map_id = ? AND source_node_id = ? AND target_node_id = ? LIMIT 1')
        .get(idValue(source.map_id), idValue(sourceId), idValue(targetId));
      if (existing) {
        const edge = dto<EdgeRecord>(existing);
        if (label.trim()) {
          this.db.prepare('UPDATE edges SET label = ? WHERE id = ?').run(label.trim(), idValue(edge.id));
          edge.label = label.trim();
        }
        return edge;
      }
      const result = this.db.prepare('INSERT INTO edges(map_id, source_node_id, target_node_id, type, label, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(idValue(source.map_id), idValue(sourceId), idValue(targetId), type, label, now());
      return this.one<EdgeRecord>('SELECT * FROM edges WHERE id = ?', result.lastInsertRowid);
    })();
  }

  templates(): TemplateRecord[] {
    return this.rows("SELECT * FROM templates WHERE deleted_at = '' ORDER BY is_default DESC, name ASC");
  }

  saveTemplate(args: { id?: string; name: string; system_prompt: string; user_prompt: string; is_default?: boolean | number }): TemplateRecord {
    return this.db.transaction(() => {
      if (args.id) this.one("SELECT * FROM templates WHERE id = ? AND deleted_at = ''", idValue(args.id));
      if (args.is_default) this.db.prepare("UPDATE templates SET is_default = 0 WHERE deleted_at = ''").run();
      const time = now(), name = args.name.trim() || 'New Template';
      let id = args.id;
      if (id) {
        this.db.prepare("UPDATE templates SET name = ?, system_prompt = ?, user_prompt = ?, is_default = ?, updated_at = ? WHERE id = ?")
          .run(name, args.system_prompt, args.user_prompt, args.is_default ? 1 : 0, time, idValue(id));
      } else {
        id = String(this.db.prepare('INSERT INTO templates(name, system_prompt, user_prompt, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(name, args.system_prompt, args.user_prompt, args.is_default ? 1 : 0, time, time).lastInsertRowid);
      }
      return this.one<TemplateRecord>('SELECT * FROM templates WHERE id = ?', idValue(id));
    })();
  }

  copyTemplate(id: string): TemplateRecord {
    const source = this.one<TemplateRecord>("SELECT * FROM templates WHERE id = ? AND deleted_at = ''", idValue(id));
    return this.saveTemplate({ name: `${source.name.trim() || 'Template'} Copy`, system_prompt: source.system_prompt, user_prompt: source.user_prompt });
  }

  deleteTemplate(id: string): void {
    this.db.transaction(() => {
      const templates = this.templates();
      const target = templates.find(t => t.id === id);
      if (!target) throw new Error('Template not found.');
      if (templates.length <= 1) throw new Error('At least one template must remain.');
      const time = now();
      this.db.prepare('UPDATE templates SET deleted_at = ?, is_default = 0, updated_at = ? WHERE id = ?').run(time, time, idValue(id));
      if (target.is_default) {
        const remaining = this.templates()[0];
        this.db.prepare('UPDATE templates SET is_default = 1, updated_at = ? WHERE id = ?').run(time, idValue(remaining.id));
      }
    })();
  }

  trash(): Trash {
    return {
      maps: this.rows("SELECT * FROM maps WHERE deleted_at <> '' ORDER BY deleted_at DESC, id DESC"),
      nodes: this.rows(`SELECT n.* FROM nodes n JOIN maps m ON m.id = n.map_id AND m.deleted_at = ''
        WHERE n.deleted_at <> '' ORDER BY n.deleted_at DESC, n.id DESC`),
      templates: this.rows("SELECT * FROM templates WHERE deleted_at <> '' ORDER BY deleted_at DESC, id DESC"),
    };
  }

  restore(kind: 'maps' | 'nodes' | 'templates', id: string): void {
    if (!['maps', 'nodes', 'templates'].includes(kind)) throw new Error('Invalid trash kind.');
    this.db.transaction(() => {
      const record = this.one<{ map_id?: string }>(`SELECT * FROM ${kind} WHERE id = ? AND deleted_at <> ''`, idValue(id));
      if (kind === 'nodes') this.activeMap(record.map_id!);
      const extra = kind === 'nodes' ? ", status = 'ready'" : kind === 'templates'
        ? `, is_default = ${this.templates().length === 0 ? 1 : 0}` : '';
      this.db.prepare(`UPDATE ${kind} SET deleted_at = '', updated_at = ?${extra} WHERE id = ?`).run(now(), idValue(id));
    })();
  }

  emptyTrash(): void {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM nodes WHERE deleted_at <> ''").run();
      this.db.prepare("DELETE FROM maps WHERE deleted_at <> ''").run();
      this.db.prepare("DELETE FROM templates WHERE deleted_at <> ''").run();
    })();
  }

  recordGeneration(nodeId: string, model: string, apiMode: string, promptSnapshot: string, status: string, error = ''): void {
    this.db.prepare('INSERT INTO generation_history(node_id, model, api_mode, prompt_snapshot, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(idValue(nodeId), model, apiMode, promptSnapshot, status, error, now());
  }

  exportNode(id: string): string {
    const node = this.activeNode(id);
    return `# ${node.title}\n\n${node.markdown.trim()}\n`;
  }

  exportMap(id: string): string {
    const map = this.activeMap(id), { nodes, edges } = this.graph(id);
    const byId = new Map(nodes.map(node => [node.id, node]));
    const children = new Map<string, string[]>();
    const targeted = new Set(edges.map(edge => edge.target_node_id));
    for (const edge of edges) {
      const list = children.get(edge.source_node_id);
      if (list) list.push(edge.target_node_id);
      else children.set(edge.source_node_id, [edge.target_node_id]);
    }
    const visited = new Set<string>();
    let out = `# ${map.title}\n\n${map.description.trim() ? `${map.description.trim()}\n\n` : ''}`;
    // Iterative DFS also handles deep maps without overflowing the JS stack.
    for (const root of [...nodes.filter(node => !targeted.has(node.id)), ...nodes]) {
      if (visited.has(root.id)) continue;
      const stack = [{ id: root.id, depth: 2 }];
      while (stack.length) {
        const item = stack.pop()!, node = byId.get(item.id)!;
        if (visited.has(node.id)) {
          out += `- Reused node: [${node.title.replace(/[\[\]\\]/g, '\\$&')}](#node-${node.id})\n\n`;
          continue;
        }
        visited.add(node.id);
        out += `<a id="node-${node.id}"></a>\n\n${'#'.repeat(Math.min(item.depth, 6))} ${node.title}\n\n`;
        if (node.markdown.trim()) out += `${node.markdown.trim()}\n\n`;
        for (const child of [...(children.get(node.id) ?? [])].reverse()) stack.push({ id: child, depth: item.depth + 1 });
      }
    }
    return out;
  }

  async backup(destination: string): Promise<void> {
    assertDestinationClosed(destination);
    if (this.path !== ':memory:' && sameFile(this.path, destination)) throw new Error('Backup destination must differ from source.');
    // Never let SQLite's backup API truncate an existing file on a failed backup.
    if (existsSync(destination)) throw new Error('Backup destination already exists.');
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    const directory = mkdtempSync(join(dirname(destination), '.memgraph-backup-'));
    const staged = join(directory, 'database.sqlite');
    try {
      await this.db.backup(staged);
      validateDatabase(staged);
      restrictFiles(staged);
      if (existsSync(destination)) throw new Error('Backup destination already exists.');
      renameSync(staged, destination);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }

  close(): void {
    if (this.db.open) this.db.close();
    openStores.delete(this);
  }
}

export function isEmptyStore(store: Store): boolean {
  return !store.db.prepare('SELECT id FROM maps LIMIT 1').get();
}

export async function importDatabase(source: string, destination: string): Promise<void> {
  if (sameFile(source, destination)) throw new Error('Import source must differ from destination.');
  assertDestinationClosed(destination);
  const target = canonical(destination);
  if (importing.has(target)) throw new Error('Database import is in progress.');
  importing.add(target);
  let directory: string | undefined;
  const moved: [string, string][] = [];
  try {
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    directory = mkdtempSync(join(dirname(target), '.memgraph-import-'));
    const staged = join(directory, 'database.sqlite');
    const input = new Database(source, { readonly: true, fileMustExist: true });
    try { await input.backup(staged); } finally { input.close(); }
    validateDatabase(staged);
    restrictFiles(staged);
    if (existsSync(target)) {
      // A standalone SQLite backup retains any committed WAL contents as well.
      validateDatabase(target);
      const backup = `${target}.backup-${randomUUID()}.sqlite`;
      const stagedBackup = join(directory, 'previous.sqlite');
      const previous = new Database(target, { readonly: true, fileMustExist: true });
      try {
        await previous.backup(stagedBackup);
        validateDatabase(stagedBackup);
        restrictFiles(stagedBackup);
        renameSync(stagedBackup, backup);
      } finally { previous.close(); }
    }
    assertDestinationClosed(target);
    // Retire old sidecars before the single atomic main-file replacement. Restore on error.
    for (const suffix of ['-wal', '-shm', '-journal']) {
      if (existsSync(target + suffix)) {
        const retired = join(directory, `old${suffix}`);
        renameSync(target + suffix, retired);
        moved.push([retired, target + suffix]);
      }
    }
    try { renameSync(staged, target); }
    catch (error) {
      for (const [retired, original] of moved) renameSync(retired, original);
      moved.length = 0;
      throw error;
    }
  } catch (error) {
    for (const [retired, original] of moved) {
      if (existsSync(retired)) renameSync(retired, original);
    }
    throw error;
  } finally {
    importing.delete(target);
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
