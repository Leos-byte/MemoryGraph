import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSystemPrompt, defaultUserPrompt, importDatabase, isEmptyStore, Store, validateDatabase } from '../main/store';

let directory: string;
const stores: Store[] = [];
const databases: Database.Database[] = [];
const time = '2025-01-02T03:04:05.000Z';

function open(path = join(directory, 'store.sqlite')): Store {
  const store = new Store(path);
  stores.push(store);
  return store;
}

// Independent fixture copied from the Qt schema; do not derive it from Store's DDL.
function legacy(path: string, deletedColumns = true, wrongDefault = false): Database.Database {
  const db = new Database(path);
  databases.push(db);
  db.defaultSafeIntegers(true);
  db.pragma('foreign_keys = ON');
  const deleted = deletedColumns ? "deleted_at TEXT NOT NULL DEFAULT ''," : '';
  db.exec(`
    CREATE TABLE maps(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ${wrongDefault ? "'wrong'" : "''"}, ${deleted} created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE templates(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      system_prompt TEXT NOT NULL, user_prompt TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0,
      ${deleted} created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE nodes(id INTEGER PRIMARY KEY AUTOINCREMENT, map_id INTEGER NOT NULL, title TEXT NOT NULL,
      markdown TEXT NOT NULL DEFAULT '', template_id INTEGER, x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ready', ${deleted}
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL);
    CREATE TABLE edges(id INTEGER PRIMARY KEY AUTOINCREMENT, map_id INTEGER NOT NULL,
      source_node_id INTEGER NOT NULL, target_node_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'explains', label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY(source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY(target_node_id) REFERENCES nodes(id) ON DELETE CASCADE);
    CREATE TABLE generation_history(id INTEGER PRIMARY KEY AUTOINCREMENT, node_id INTEGER NOT NULL,
      model TEXT NOT NULL, api_mode TEXT NOT NULL, prompt_snapshot TEXT NOT NULL,
      status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE);
  `);
  db.prepare('INSERT INTO maps(id, title, description, created_at, updated_at) VALUES (1, ?, ?, ?, ?)')
    .run('Qt knowledge', 'Qt description', time, time);
  db.prepare('INSERT INTO templates(id, name, system_prompt, user_prompt, is_default, created_at, updated_at) VALUES (1, ?, ?, ?, 1, ?, ?)')
    .run('Customized Qt default', 'Keep this system', '{{concept}} / {{selected_text}}', time, time);
  db.prepare('INSERT INTO templates(id, name, system_prompt, user_prompt, created_at, updated_at) VALUES (2, ?, ?, ?, ?, ?)')
    .run('Archived default', 'archived system', 'archived user', time, time);
  const insert = db.prepare('INSERT INTO nodes(id, map_id, template_id, title, markdown, x, y, status, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run(1, 1, 'Root', '# Qt body', 12.5, -8.25, 'generating', time, time);
  insert.run(2, 2, 'Child', 'child body', 40, 50, 'ready', time, time);
  db.prepare('INSERT INTO edges(map_id, source_node_id, target_node_id, type, label, created_at) VALUES (1, 1, 2, ?, ?, ?)')
    .run('explains', 'selected text', time);
  db.prepare('INSERT INTO generation_history(node_id, model, api_mode, prompt_snapshot, status, error, created_at) VALUES (1, ?, ?, ?, ?, ?, ?)')
    .run('qt-model', 'responses', 'SYSTEM:\nKeep this system', 'started', '', time);
  if (deletedColumns) {
    db.prepare('UPDATE nodes SET deleted_at = ?, status = ? WHERE id = 2').run(time, 'deleted');
    db.prepare('UPDATE templates SET deleted_at = ?, is_default = 1 WHERE id = 2').run(time);
  }
  return db;
}

beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'memgraph-store-test-')); });
afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
  for (const db of databases.splice(0)) if (db.open) db.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('Qt schema and migrations', () => {
  it('creates the exact Qt columns, defaults, foreign keys, WAL and owner-only files', () => {
    const store = open();
    expect(store.db.pragma('user_version', { simple: true })).toBe(1n);
    expect(store.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(store.db.pragma('foreign_keys', { simple: true })).toBe(1n);
    const info = store.db.pragma('table_info(maps)') as { name: string; notnull: bigint; dflt_value: string | null }[];
    expect(info.map(c => c.name)).toEqual(['id', 'title', 'description', 'deleted_at', 'created_at', 'updated_at']);
    expect(info.find(c => c.name === 'description')).toMatchObject({ notnull: 1n, dflt_value: "''" });
    const map = store.createMap('  ');
    expect(map).toMatchObject({ id: '1', title: 'Untitled Map', description: '', deleted_at: '' });
    expect(isEmptyStore(store)).toBe(false);
    expect(store.templates()).toEqual([expect.objectContaining({
      id: '1', name: 'Default Memory Explanation', system_prompt: defaultSystemPrompt,
      user_prompt: defaultUserPrompt, is_default: 1, deleted_at: '',
    })]);
    expect(defaultSystemPrompt).toContain('Explain in {{language}}.');
    expect(defaultUserPrompt).toContain('## 如果缺少这些部分会怎样');
    for (const suffix of ['', '-wal', '-shm']) {
      const path = store.path + suffix;
      expect(existsSync(path)).toBe(true);
      if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    }
    validateDatabase(store.path);
  });

  it('preserves full Qt data including generating nodes, deleted defaults and history on repeated opens', () => {
    const path = join(directory, 'qt.sqlite');
    legacy(path).close();
    const store = open(path);
    expect(store.maps()[0]).toMatchObject({ id: '1', description: 'Qt description', created_at: time });
    expect(store.node('1')).toMatchObject({ status: 'generating', x: 12.5, y: -8.25, template_id: '1', markdown: '# Qt body' });
    expect(store.graph('1')).toMatchObject({ nodes: [{ id: '1' }], edges: [] });
    expect(store.templates()).toHaveLength(1);
    expect(store.templates()[0].system_prompt).toBe('Keep this system');
    expect(store.trash().templates[0]).toMatchObject({ id: '2', is_default: 1 });
    expect(store.trash().nodes[0].id).toBe('2');
    expect(store.db.prepare('SELECT * FROM generation_history').get()).toMatchObject({ model: 'qt-model', status: 'started', error: '' });
    store.close();
    store.close();
    expect(open(path).templates()).toHaveLength(1);
  });

  it('adds only deleted_at to older Qt tables and marks the migration version', () => {
    const path = join(directory, 'old.sqlite');
    legacy(path, false).close();
    const store = open(path);
    for (const table of ['maps', 'nodes', 'templates']) {
      expect((store.db.pragma(`table_info(${table})`) as { name: string }[]).filter(c => c.name === 'deleted_at')).toHaveLength(1);
    }
    expect(store.graph('1').nodes).toHaveLength(2);
    expect(store.node('1').deleted_at).toBe('');
    expect(store.node('1').status).toBe('generating');
    expect(store.db.pragma('user_version', { simple: true })).toBe(1n);
    expect(store.db.pragma('foreign_key_check')).toEqual([]);
  });

  it('rolls back all ALTERs and user_version when default creation fails, and releases the connection', () => {
    const path = join(directory, 'rollback.sqlite');
    const db = legacy(path, false);
    db.exec(`DELETE FROM generation_history; DELETE FROM edges; DELETE FROM nodes; DELETE FROM templates;
      CREATE TRIGGER reject_template BEFORE INSERT ON templates BEGIN SELECT RAISE(ABORT, 'blocked default'); END;`);
    db.close();
    expect(() => new Store(path)).toThrow('blocked default');
    const check = new Database(path);
    databases.push(check);
    expect(check.pragma('user_version', { simple: true })).toBe(0);
    for (const table of ['maps', 'nodes', 'templates']) {
      expect((check.pragma(`table_info(${table})`) as { name: string }[]).some(c => c.name === 'deleted_at')).toBe(false);
    }
    check.exec('DROP TRIGGER reject_template');
    check.close();
    expect(open(path).templates()).toHaveLength(1);
  });

  it.each(['incomplete', 'future', 'wrong-default', 'not-sqlite'])('rejects %s without replacing or modifying existing data', kind => {
    const path = join(directory, 'incompatible.sqlite');
    if (kind === 'not-sqlite') writeFileSync(path, 'not a SQLite file');
    else {
      const db = kind === 'incomplete' ? new Database(path) : legacy(path, true, kind === 'wrong-default');
      if (kind === 'incomplete') db.exec('CREATE TABLE precious_data(value TEXT); INSERT INTO precious_data VALUES (\'keep me\')');
      if (kind === 'future') db.pragma('user_version = 99');
      db.close();
    }
    const before = readFileSync(path);
    expect(() => new Store(path)).toThrow();
    expect(readFileSync(path)).toEqual(before);
    expect(existsSync(path + '-wal')).toBe(false);
  });

  it('seeds an active default when a legacy file contains only deleted templates', () => {
    const path = join(directory, 'deleted-default.sqlite');
    const db = legacy(path);
    db.prepare('UPDATE templates SET deleted_at = ?').run(time);
    db.close();
    const store = open(path);
    expect(store.templates()).toHaveLength(1);
    expect(store.templates()[0]).toMatchObject({ name: 'Default Memory Explanation', is_default: 1 });
    expect(store.trash().templates).toHaveLength(2);
  });
});

describe('records and Qt trash semantics', () => {
  it('supports CRUD, quoted SQL payloads, generation history and idempotent close', () => {
    const store = open();
    expect(isEmptyStore(store)).toBe(true);
    const quoteSQL = "Robert'); DROP TABLE maps; -- \" ' \n中文";
    const map = store.createMap(quoteSQL);
    store.renameMap(map.id, ' renamed ');
    expect(store.maps()[0].title).toBe('renamed');
    const node = store.createNode({ mapId: map.id, title: ' title ', markdown: quoteSQL, templateId: store.templates()[0].id });
    expect(node).toMatchObject({ title: 'title', markdown: quoteSQL, x: 0, y: 0, status: 'ready' });
    store.editNode(node.id, ' ', quoteSQL);
    store.moveNode(node.id, 5.5, -20);
    store.setMarkdown(node.id, 'new', 'generating');
    expect(store.node(node.id)).toMatchObject({ title: 'Untitled Node', markdown: 'new', x: 5.5, y: -20, status: 'generating' });
    store.setMarkdown(node.id, quoteSQL);
    expect(store.node(node.id).status).toBe('ready');
    store.recordGeneration(node.id, quoteSQL, 'chat_completions', quoteSQL, 'error', quoteSQL);
    expect(store.db.prepare('SELECT * FROM generation_history').get()).toMatchObject({ model: quoteSQL, prompt_snapshot: quoteSQL, error: quoteSQL });
    expect(store.maps()).toHaveLength(1);
    expect(() => store.node('999')).toThrow(/not found/i);
    expect(() => store.node('9007199254740992 OR 1=1')).toThrow(/ID/);
    expect(() => store.moveNode(node.id, Infinity, 1)).toThrow(/position/);
    store.close();
    expect(() => store.close()).not.toThrow();
  });

  it('creates parent edges atomically and validates same-map active endpoints', () => {
    const store = open(), map = store.createMap('map'), otherMap = store.createMap('other');
    const parent = store.createNode({ mapId: map.id, title: 'parent' });
    const child = store.createNode({ mapId: map.id, title: 'child', parentId: parent.id, selectedText: 'quote' });
    expect(store.graph(map.id).edges[0]).toMatchObject({ source_node_id: parent.id, target_node_id: child.id, type: 'explains', label: 'quote' });
    const edge = store.connect(parent.id, child.id);
    expect(store.connect(parent.id, child.id, 'manual', ' updated ')).toMatchObject({ id: edge.id, type: 'explains', label: 'updated' });
    expect(store.connect(parent.id, child.id, 'manual', ' ').label).toBe('updated');
    expect(store.graph(map.id).edges).toHaveLength(1);
    const foreign = store.createNode({ mapId: otherMap.id, title: 'foreign' });
    expect(() => store.connect(parent.id, parent.id)).toThrow(/itself/);
    expect(() => store.connect(parent.id, foreign.id)).toThrow(/different maps/);
    expect(() => store.createNode({ mapId: map.id, title: 'bad', parentId: foreign.id })).toThrow();
    expect(() => store.createNode({ mapId: map.id, title: 'bad template', templateId: '999' })).toThrow();
    store.db.exec("CREATE TRIGGER reject_edge BEFORE INSERT ON edges BEGIN SELECT RAISE(ABORT, 'edge failed'); END");
    expect(() => store.createNode({ mapId: map.id, title: 'rollback child', parentId: parent.id })).toThrow('edge failed');
    expect(store.graph(map.id).nodes).toHaveLength(2);
    store.deleteNode(child.id);
    expect(() => store.connect(parent.id, child.id)).toThrow(/not found/i);
    expect(() => store.setMarkdown(child.id, 'late result')).toThrow(/not found/i);
    store.deleteMap(map.id);
    expect(() => store.connect(parent.id, foreign.id)).toThrow(/not found/i);
    expect(() => store.setMarkdown(parent.id, 'late result')).toThrow(/not found/i);
    expect(() => store.createNode({ mapId: map.id, title: 'hidden' })).toThrow(/not found/i);
  });

  it('hides related records in trash, restores edges and cascades permanent deletes', () => {
    const store = open(), map = store.createMap('map');
    const root = store.createNode({ mapId: map.id, title: 'root' });
    const child = store.createNode({ mapId: map.id, title: 'child', parentId: root.id, status: 'generating' });
    store.recordGeneration(child.id, 'model', 'responses', 'prompt', 'started');
    store.deleteNode(child.id);
    expect(store.graph(map.id).edges).toEqual([]);
    expect(store.trash().nodes[0]).toMatchObject({ id: child.id, status: 'deleted' });
    store.deleteMap(map.id);
    expect(store.maps()).toEqual([]);
    expect(isEmptyStore(store)).toBe(false);
    expect(store.trash().nodes).toEqual([]);
    expect(store.graph(map.id)).toEqual({ nodes: [], edges: [] });
    expect(store.node(root.id).deleted_at).toBe('');
    expect(() => store.restore('nodes', child.id)).toThrow();
    store.restore('maps', map.id);
    store.restore('nodes', child.id);
    expect(store.node(child.id)).toMatchObject({ status: 'ready', deleted_at: '' });
    expect(store.graph(map.id).edges).toHaveLength(1);
    store.deleteNode(child.id);
    store.emptyTrash();
    expect(() => store.node(child.id)).toThrow(/not found/i);
    expect(store.db.prepare('SELECT * FROM edges').all()).toEqual([]);
    expect(store.db.prepare('SELECT * FROM generation_history').all()).toEqual([]);
    store.deleteMap(map.id);
    store.emptyTrash();
    expect(() => store.node(root.id)).toThrow();
    expect(store.trash()).toEqual({ maps: [], nodes: [], templates: [] });
    expect(store.db.pragma('foreign_key_check')).toEqual([]);
  });

  it('copies and saves templates, replaces a deleted default, and preserves node references until emptyTrash', () => {
    const store = open(), original = store.templates()[0];
    expect(() => store.deleteTemplate(original.id)).toThrow(/At least one/);
    const copy = store.copyTemplate(original.id);
    expect(copy).toMatchObject({ name: `${original.name} Copy`, system_prompt: original.system_prompt, user_prompt: original.user_prompt, is_default: 0 });
    store.saveTemplate({ ...copy, name: ' A default ', is_default: true });
    expect(store.templates()[0]).toMatchObject({ id: copy.id, name: 'A default', is_default: 1 });
    expect(store.templates().find(t => t.id === original.id)?.is_default).toBe(0);
    const map = store.createMap('map');
    const node = store.createNode({ mapId: map.id, title: 'node', templateId: copy.id });
    store.deleteTemplate(copy.id);
    expect(store.templates()[0]).toMatchObject({ id: original.id, is_default: 1 });
    expect(store.trash().templates[0]).toMatchObject({ id: copy.id, is_default: 0 });
    expect(store.node(node.id).template_id).toBe(copy.id);
    store.restore('templates', copy.id);
    expect(store.templates().find(t => t.id === copy.id)?.is_default).toBe(0);
    store.deleteTemplate(copy.id);
    store.emptyTrash();
    expect(store.node(node.id).template_id).toBeNull();
    expect(() => store.copyTemplate(copy.id)).toThrow(/not found/i);
    expect(() => store.restore('invalid' as 'maps', map.id)).toThrow(/kind/);
  });

  it('rolls back default changes on failed template updates and trash cleanup failures', () => {
    const store = open(), original = store.templates()[0], copy = store.copyTemplate(original.id);
    store.db.exec(`CREATE TRIGGER reject_template_update BEFORE UPDATE ON templates WHEN NEW.name = 'reject'
      BEGIN SELECT RAISE(ABORT, 'update failed'); END`);
    expect(() => store.saveTemplate({ ...copy, name: 'reject', is_default: true })).toThrow('update failed');
    expect(store.templates()[0]).toMatchObject({ id: original.id, is_default: 1 });
    const map = store.createMap('map'), node = store.createNode({ mapId: map.id, title: 'node' });
    store.deleteNode(node.id);
    store.deleteMap(map.id);
    store.db.exec("CREATE TRIGGER reject_map_delete BEFORE DELETE ON maps BEGIN SELECT RAISE(ABORT, 'delete failed'); END");
    expect(() => store.emptyTrash()).toThrow('delete failed');
    expect(store.node(node.id).status).toBe('deleted');
    expect(store.trash().maps).toHaveLength(1);
  });

  it('does not invent a default when Qt already has active non-default templates', () => {
    const path = join(directory, 'no-default.sqlite');
    const db = legacy(path);
    db.exec('UPDATE templates SET is_default = 0');
    db.close();
    expect(open(path).templates()).toEqual([expect.objectContaining({ id: '1', is_default: 0 })]);
  });

  it('preserves INTEGER IDs beyond 2^53 in every DTO and binding', () => {
    const store = open();
    const large = 9007199254740993n;
    for (const name of ['maps', 'templates', 'nodes', 'edges', 'generation_history']) {
      const updated = store.db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(large, name);
      if (!updated.changes) store.db.prepare('INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)').run(name, large);
    }
    const map = store.createMap('large'), template = store.copyTemplate(store.templates()[0].id);
    const parent = store.createNode({ mapId: map.id, title: 'parent', templateId: template.id });
    const child = store.createNode({ mapId: map.id, title: 'child', parentId: parent.id });
    const edge = store.graph(map.id).edges[0];
    for (const record of [map, template, parent, child, edge]) expect(BigInt(record.id)).toBeGreaterThan(large);
    expect(parent.map_id).toBe(map.id);
    expect(parent.template_id).toBe(template.id);
    expect(edge).toMatchObject({ map_id: map.id, source_node_id: parent.id, target_node_id: child.id });
    expect(JSON.parse(JSON.stringify(store.graph(map.id))).nodes[0].id).toBe(parent.id);
    store.moveNode(parent.id, 11, 22);
    expect(store.node(parent.id).x).toBe(11);
    store.recordGeneration(parent.id, 'model', 'responses', 'prompt', 'ready');
    expect(store.db.prepare('SELECT node_id FROM generation_history').get()).toEqual({ node_id: BigInt(parent.id) });
    store.deleteNode(child.id);
    expect(store.trash().nodes[0].id).toBe(child.id);
    store.restore('nodes', child.id);
    expect(store.connect(parent.id, child.id).id).toBe(edge.id);
  });
});

describe('Markdown exports', () => {
  it('exports all active nodes once across roots, disconnected cycles and shared descendants', () => {
    const store = open(), map = store.createMap('Knowledge');
    const a = store.createNode({ mapId: map.id, title: 'A', markdown: ' body A ' });
    const b = store.createNode({ mapId: map.id, title: 'B', parentId: a.id, markdown: 'body B' });
    const c = store.createNode({ mapId: map.id, title: 'C', markdown: 'body C' });
    const d = store.createNode({ mapId: map.id, title: 'D', parentId: c.id, markdown: 'body D' });
    const e = store.createNode({ mapId: map.id, title: 'E' });
    store.connect(d.id, c.id);
    store.connect(e.id, b.id);
    const deleted = store.createNode({ mapId: map.id, title: 'Deleted', markdown: 'DO NOT EXPORT' });
    store.connect(a.id, deleted.id);
    store.deleteNode(deleted.id);
    expect(store.exportNode(a.id)).toBe('# A\n\nbody A\n');
    const out = store.exportMap(map.id);
    expect(out.startsWith('# Knowledge\n\n')).toBe(true);
    for (const node of [a, b, c, d, e]) {
      expect(out.split(`<a id="node-${node.id}"></a>`)).toHaveLength(2);
    }
    expect(out).toContain(`- Reused node: [C](#node-${c.id})`);
    expect(out).toContain(`- Reused node: [B](#node-${b.id})`);
    expect(out).not.toContain('DO NOT EXPORT');
    expect(() => store.exportNode(deleted.id)).toThrow();
  });

  it('exports rootless cyclic maps, descriptions and empty maps', () => {
    const store = open(), map = store.createMap('cycle');
    const a = store.createNode({ mapId: map.id, title: 'a' });
    const b = store.createNode({ mapId: map.id, title: 'b', parentId: a.id });
    store.connect(b.id, a.id);
    store.db.prepare('UPDATE maps SET description = ? WHERE id = ?').run(' description ', BigInt(map.id));
    expect(store.exportMap(map.id)).toContain('# cycle\n\ndescription\n\n');
    expect(store.exportMap(map.id)).toContain(`](#node-${a.id})`);
    expect(store.exportMap(store.createMap('empty').id)).toBe('# empty\n\n');
  });
});

describe('SQLite backups and validated imports', () => {
  it('backs up committed WAL data without closing the store or modifying the source', async () => {
    const store = open();
    store.db.pragma('wal_autocheckpoint = 0');
    const map = store.createMap('in WAL');
    const node = store.createNode({ mapId: map.id, title: 'WAL node', markdown: 'committed' });
    const before = readFileSync(store.path);
    const wal = readFileSync(store.path + '-wal');
    const path = join(directory, 'backup.sqlite');
    await store.backup(path);
    expect(readFileSync(store.path)).toEqual(before);
    expect(readFileSync(store.path + '-wal')).toEqual(wal);
    expect(open(path).node(node.id).markdown).toBe('committed');
    expect(store.node(node.id).title).toBe('WAL node');
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    await expect(store.backup(store.path)).rejects.toThrow();
    await expect(store.backup(path)).rejects.toThrow();
  });

  it('imports a WAL-backed legacy snapshot, leaves source unchanged and retains a valid old destination backup', async () => {
    const source = join(directory, 'source.sqlite'), destination = join(directory, 'destination.sqlite');
    const db = legacy(source);
    db.pragma('journal_mode = WAL');
    db.pragma('wal_autocheckpoint = 0');
    db.prepare('UPDATE nodes SET markdown = ? WHERE id = 1').run('new body in WAL');
    const sourceBytes = readFileSync(source), sourceWal = readFileSync(source + '-wal');
    const old = open(destination);
    old.createMap('Previous destination');
    old.close();
    await importDatabase(source, destination);
    expect(readFileSync(source)).toEqual(sourceBytes);
    expect(readFileSync(source + '-wal')).toEqual(sourceWal);
    expect(db.pragma('user_version', { simple: true })).toBe(0n);
    expect(open(destination).node('1').markdown).toBe('new body in WAL');
    const backups = readdirSync(directory).filter(name => name.startsWith('destination.sqlite.backup-'));
    expect(backups).toHaveLength(1);
    expect(open(join(directory, backups[0])).maps()[0].title).toBe('Previous destination');
    expect(readdirSync(directory).some(name => name.startsWith('.memgraph-import-'))).toBe(false);
  });

  it('imports old files without modifying their schema until Store opens the destination', async () => {
    const source = join(directory, 'old.sqlite'), destination = join(directory, 'imported.sqlite');
    legacy(source, false).close();
    const bytes = readFileSync(source);
    await importDatabase(source, destination);
    expect(readFileSync(source)).toEqual(bytes);
    validateDatabase(destination);
    const raw = new Database(destination, { readonly: true });
    databases.push(raw);
    expect(raw.pragma('user_version', { simple: true })).toBe(0);
    expect((raw.pragma('table_info(nodes)') as { name: string }[]).some(c => c.name === 'deleted_at')).toBe(false);
    raw.close();
    expect(open(destination).node('1').deleted_at).toBe('');
  });

  it.each(['corrupt', 'missing-columns', 'foreign-keys', 'future'])('rejects %s imports and leaves destination byte-for-byte unchanged', async kind => {
    const source = join(directory, 'bad.sqlite'), destination = join(directory, 'destination.sqlite');
    const old = open(destination);
    old.createMap('keep this');
    old.close();
    if (kind === 'corrupt') writeFileSync(source, 'invalid sqlite');
    else {
      const db = legacy(source);
      if (kind === 'missing-columns') db.exec('ALTER TABLE generation_history RENAME COLUMN prompt_snapshot TO wrong_column');
      if (kind === 'future') db.pragma('user_version = 2');
      if (kind === 'foreign-keys') {
        db.pragma('foreign_keys = OFF');
        db.exec('UPDATE nodes SET map_id = 999 WHERE id = 1');
      }
      db.close();
    }
    const oldBytes = readFileSync(destination), sourceBytes = readFileSync(source);
    await expect(importDatabase(source, destination)).rejects.toThrow();
    expect(readFileSync(destination)).toEqual(oldBytes);
    expect(readFileSync(source)).toEqual(sourceBytes);
    expect(readdirSync(directory).filter(name => name.includes('.backup-') || name.startsWith('.memgraph-import-'))).toEqual([]);
    expect(open(destination).maps()[0].title).toBe('keep this');
  });

  it('does not overwrite open destinations, self-imports or invalid existing destinations', async () => {
    const source = join(directory, 'source.sqlite'), destination = join(directory, 'destination.sqlite');
    legacy(source).close();
    const active = open(destination);
    const oldMap = active.createMap('open map');
    await expect(importDatabase(source, destination)).rejects.toThrow(/Close/);
    expect(active.maps()[0].id).toBe(oldMap.id);
    await expect(importDatabase(source, source)).rejects.toThrow(/differ/);
    active.close();
    writeFileSync(destination, 'existing invalid data must survive');
    const before = readFileSync(destination);
    await expect(importDatabase(source, destination)).rejects.toThrow();
    expect(readFileSync(destination)).toEqual(before);
  });

  it('cleans up staged files on a refused backup and retains existing backup bytes', async () => {
    const store = open(), destination = join(directory, 'existing.sqlite');
    writeFileSync(destination, 'do not truncate');
    chmodSync(destination, 0o600);
    await expect(store.backup(destination)).rejects.toThrow(/exists/);
    expect(readFileSync(destination, 'utf8')).toBe('do not truncate');
    expect(readdirSync(directory).filter(name => name.startsWith('.memgraph-backup-'))).toEqual([]);
  });

  it('cleans up when the SQLite backup API fails without publishing a partial backup', async () => {
    const store = open(), destination = join(directory, 'failed.sqlite');
    vi.spyOn(store.db, 'backup').mockRejectedValueOnce(new Error('native backup failed'));
    await expect(store.backup(destination)).rejects.toThrow('native backup failed');
    expect(existsSync(destination)).toBe(false);
    expect(readdirSync(directory).filter(name => name.startsWith('.memgraph-backup-'))).toEqual([]);
    expect(store.createMap('still usable').title).toBe('still usable');
  });

  it('rolls back an import when backing up the existing destination fails', async () => {
    const source = join(directory, 'source.sqlite'), destination = join(directory, 'destination.sqlite');
    legacy(source).close();
    const old = open(destination);
    old.createMap('keep old destination');
    old.close();
    const before = readFileSync(destination);
    const original = Database.prototype.backup;
    vi.spyOn(Database.prototype, 'backup').mockImplementation(function (this: Database.Database, path, options) {
      if (this.name === destination) return Promise.reject(new Error('old destination backup failed'));
      return original.call(this, path, options);
    });
    await expect(importDatabase(source, destination)).rejects.toThrow('old destination backup failed');
    expect(readFileSync(destination)).toEqual(before);
    expect(readdirSync(directory).filter(name => name.includes('.backup-') || name.startsWith('.memgraph-import-'))).toEqual([]);
    expect(open(destination).maps()[0].title).toBe('keep old destination');
  });
});
