import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { Store, importDatabase, validateDatabase } from '../main/store';
import { ContentStore } from '../main/content-store';
import { parseRich, blockRows, metricValue, chartOption, bindText } from '../shared/content';
import { richFences } from '../shared/markdown';
import { ContentService, validateImage } from '../main/content-service';
import { publicRequest } from '../main/content-network';
import { exportRich } from '../main/content-export';
import { dialog } from 'electron';

vi.mock('electron', () => ({ safeStorage: {}, dialog: { showMessageBox: vi.fn(async () => ({ response:1 })), showOpenDialog: vi.fn(async () => ({ filePaths:[] })) } }));
vi.mock('../main/content-network', async original => ({ ...await original<object>(), publicRequest:vi.fn() }));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
let directory:string,store:Store,nodeId:string,service:ContentService;
beforeEach(()=>{ directory=mkdtempSync(join(tmpdir(),'memgraph-content-'));store=new Store(join(directory,'db.sqlite'));const map=store.createMap('Rich knowledge');nodeId=store.createNode({mapId:map.id,title:'Memory',markdown:'# Keep me'}).id;service=new ContentService(()=>store,directory,false,()=>({} as any),()=>false,()=>{});vi.mocked(publicRequest).mockReset(); });
afterEach(()=>{service.cancel();store.close();rmSync(directory,{recursive:true,force:true});vi.restoreAllMocks();});
const raw=(blocks:unknown[])=>JSON.stringify({version:1,blocks});
describe('bounded declarative content',()=>{
  it('parses rich blocks without executing supplied properties',()=>{
    expect(parseRich(raw([{id:'chart',type:'chart',data:[{x:'A',y:1}]}])).blocks[0].type).toBe('chart');
    for(const value of [raw([{id:'a',type:'script'}]),raw([{id:'a',type:'button',onClick:'fetch()'}]),raw([{id:'a',type:'markdown'},{id:'a',type:'table'}]),'{"version":1,"blocks":[],"__proto__":{}}'])expect(()=>parseRich(value)).toThrow();
    expect(()=>parseRich('x'.repeat(1048577))).toThrow();
    let child:any={id:'end',type:'markdown'};for(let i=0;i<12;i++)child={id:`nested${i}`,type:'details',children:[child]};expect(()=>parseRich(raw([child]))).toThrow();
  });
  it('uses a Markdown parser for code fences including nested fences',()=>{
    const markdown='~~~~memgraph-ui\n'+raw([{id:'example',type:'markdown',text:'```not a closing fence'}])+'\n~~~~\n\n```other\ntext\n```';
    expect(richFences(markdown)).toHaveLength(1);expect(parseRich(richFences(markdown)[0].raw).blocks[0].id).toBe('example');
  });
  it('binds values, filters rows and aggregates through known operations',()=>{
    const block:any={id:'b',type:'metric',aggregate:'sum',field:'n',filter:{field:'name',state:'search'}};
    const rows=blockRows(block,{search:'a'},[{name:'Alpha',n:4},{name:'Beta',n:6},{name:'Zero',n:12}]);expect(metricValue(block,rows)).toBe(10);expect(bindText('Value: {{state:value}}',{value:'<script>'})).toBe('Value: <script>');
    const chart=chartOption({id:'c',type:'chart',chart:'pie',x:'name',y:'n'},rows);expect(chart.tooltip.renderMode).toBe('richText');expect(chart.series[0].type).toBe('pie');
  });
});
describe('durable assets and component state',()=>{
  it('deduplicates images and preserves them through backup, restore and recycle bin',async()=>{
    const content=new ContentStore(store.db);expect(await validateImage(png)).toBe('image/png');const id=content.asset(nodeId,png,'image/png');expect(content.asset(nodeId,png,'image/png')).toBe(id);
    content.saveState(nodeId,'panel',{query:'saved',amount:3});store.deleteNode(nodeId);expect(content.readAsset(id)?.bytes).toEqual(png);store.restore('nodes',nodeId);
    const path=join(directory,'backup.sqlite');await store.backup(path);store.close();await importDatabase(path,join(directory,'restored.sqlite'));store=new Store(join(directory,'restored.sqlite'));expect(new ContentStore(store.db).state(nodeId).panel.amount).toBe(3);expect(new ContentStore(store.db).readAsset(id)?.bytes).toEqual(png);
  });
  it('rejects active SVG, oversized and malformed images',async()=>{
    await expect(validateImage(Buffer.from('<svg onload="alert(1)"/>'))).rejects.toThrow();await expect(validateImage(Buffer.alloc(25*1024*1024+1))).rejects.toThrow();await expect(validateImage(Buffer.from('broken'))).rejects.toThrow();
  });
  it('upgrades a v1 database without changing existing Markdown',()=>{
    store.close();const Database=store.db.constructor as any;const db=new Database(join(directory,'db.sqlite'));db.exec('DROP TABLE content_cache;DROP TABLE content_state;DROP TABLE content_refs;DROP TABLE content_assets;DROP TABLE content_sources;PRAGMA user_version=1;');db.close();
    store=new Store(join(directory,'db.sqlite'));expect(store.db.pragma('user_version',{simple:true})).toBe(2n);expect(store.node(nodeId).markdown).toBe('# Keep me');
  });
  it('rolls back all rich tables and the version on a failed migration',()=>{
    store.close();const Database=store.db.constructor as any;const db=new Database(join(directory,'db.sqlite'));
    db.exec('DROP TABLE content_cache;DROP TABLE content_state;DROP TABLE content_refs;DROP TABLE content_assets;DROP TABLE content_sources;CREATE VIEW content_sources AS SELECT 1;PRAGMA user_version=1;');db.close();
    expect(()=>new Store(join(directory,'db.sqlite'))).toThrow();
    const probe=new Database(join(directory,'db.sqlite'));expect(probe.pragma('user_version',{simple:true})).toBe(1);expect(probe.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'content_%'").all()).toHaveLength(0);probe.exec('DROP VIEW content_sources;');probe.close();store=new Store(join(directory,'db.sqlite'));
  });
  it('preserves shared assets after the original node is permanently removed',()=>{
    const content=new ContentStore(store.db),id=content.asset(nodeId,png,'image/png');
    const copy=store.createNode({mapId:'1',title:'Copy',markdown:`![shared](asset:${id})`});
    store.deleteNode(nodeId);store.emptyTrash();expect(content.readAsset(id)?.bytes).toEqual(png);expect(content.assets([copy.id]).has(id)).toBe(true);
    store.deleteNode(copy.id);store.emptyTrash();expect(content.readAsset(id)).toBeUndefined();
  });
  it('bounds assets before loading and rejects active MIME/cache values from imported data',()=>{
    const content=new ContentStore(store.db),id=content.asset(nodeId,png,'image/png');store.editNode(nodeId,'Asset',`![image](asset:${id})`);expect(()=>content.assets([nodeId],1)).toThrow('size');
    store.db.prepare('UPDATE content_assets SET mime=? WHERE id=?').run('text/html',id);expect(content.readAsset(id)).toBeUndefined();
    store.db.prepare('INSERT INTO content_cache VALUES (?,?,?)').run(nodeId,'bad','{"rows":[{"nested":{"script":"bad"}}],"fetchedAt":"now"}');expect(content.cache(nodeId,'bad')).toBeUndefined();
  });
  it('rejects a version-two database with incompatible rich table columns',()=>{
    store.db.exec('ALTER TABLE content_state RENAME COLUMN value TO broken;');expect(()=>validateDatabase(store.path)).toThrow('rich-content column');
  });
});
describe('authorized data and image services',()=>{
  const source=()=>({id:crypto.randomUUID(),name:'Public data',url:'https://example.com/rows',params:['q'],path:'data.rows',auth:'bearer' as const,header:'X-API-Key'});
  it('requires authorization, bounds queries and retains the last successful snapshot',async()=>{
    const config=source();new ContentStore(store.db).saveSource(config);await expect(service.query(nodeId,config.id,{})).rejects.toThrow('Authorize');
    await service.saveSource({source:config,apiKey:'SOURCE-ONLY-SECRET'});vi.mocked(publicRequest).mockResolvedValueOnce(Buffer.from(JSON.stringify({data:{rows:[{name:'A',value:4}]}})));
    const result=await service.query(nodeId,config.id,{q:'a'});expect(result.rows[0].value).toBe(4);expect(vi.mocked(publicRequest).mock.calls[0][1].headers?.Authorization).toBe('Bearer SOURCE-ONLY-SECRET');
    await expect(service.query(nodeId,config.id,{notAllowed:'x'})).rejects.toThrow();vi.mocked(publicRequest).mockRejectedValueOnce(new Error('failure SOURCE-ONLY-SECRET'));
    const stale=await service.query(nodeId,config.id,{});expect(stale.stale).toBe(true);expect(stale.error).not.toContain('SOURCE-ONLY-SECRET');
    await service.revokeSources();expect(service.profile().sources[0].authorized).toBe(false);
  });
  it('rejects unsafe URLs before approval or network access',async()=>{
    for(const url of ['http://example.com','https://127.0.0.1/a','https://[::1]/','https://user:secret@example.com','https://example.com?api_key=secret'])await expect(service.saveSource({source:{...source(),url}})).rejects.toThrow();
    expect(publicRequest).not.toHaveBeenCalled();
  });
  it('does not inherit credentials after a source origin changes',async()=>{
    const config=source();await service.saveSource({source:config,apiKey:'KEY'});await expect(service.saveSource({source:{...config,url:'https://other.example/rows'}})).rejects.toThrow('API key');
  });
  it('invalidates cached and in-flight data after connector configuration changes',async()=>{
    const config=source();await service.saveSource({source:config,apiKey:'KEY'});
    const content=new ContentStore(store.db);content.cache(nodeId,config.id,{rows:[{old:1}],fetchedAt:new Date().toISOString()});
    let resolve!:(value:Buffer)=>void;vi.mocked(publicRequest).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));const pending=service.query(nodeId,config.id,{});
    await service.saveSource({source:{...config,url:'https://example.com/new'},apiKey:'NEW-KEY'});expect(content.cache(nodeId,config.id)).toBeUndefined();
    resolve(Buffer.from(JSON.stringify({data:{rows:[{old:2}]}})));await expect(pending).rejects.toThrow('authorization changed');expect(content.cache(nodeId,config.id)).toBeUndefined();
  });
  it('creates a paid image job only on explicit invocation with a separate key',async()=>{
    await service.configure({apiKey:'IMAGE-ONLY-SECRET'});vi.mocked(publicRequest).mockResolvedValueOnce(Buffer.from(JSON.stringify({data:[{b64_json:png.toString('base64')}]})));
    const job=await service.startImage(nodeId,{prompt:'Explain memory'});expect(job?.status).toBe('running');await vi.waitFor(()=>expect(service.job(job!.id).status).toBe('ready'));
    const [url,options]=vi.mocked(publicRequest).mock.calls[0];expect(url).toBe('https://api.x.ai/v1/images/generations');expect(JSON.parse(options.body!).n).toBe(1);expect(service.profile()).not.toHaveProperty('apiKey');expect(new ContentStore(store.db).readAsset(service.job(job!.id).assetId!)?.bytes).toEqual(png);
  });
  it('does not charge when confirmation is cancelled and enforces one job per node after confirmation',async()=>{
    await service.configure({apiKey:'IMAGE-KEY'});vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({response:0,checkboxChecked:false});expect(await service.startImage(nodeId,{prompt:'Cancelled'})).toBeNull();expect(publicRequest).not.toHaveBeenCalled();
    vi.mocked(publicRequest).mockImplementation(()=>new Promise(()=>{}));
    const jobs=await Promise.allSettled([service.startImage(nodeId,{prompt:'One'}),service.startImage(nodeId,{prompt:'Two'})]);expect(jobs.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(publicRequest).toHaveBeenCalledTimes(1);
  });
  it('forgets data-source credentials when the connector is deleted',async()=>{
    const config=source();await service.saveSource({source:config,apiKey:'REVOKED'});await service.deleteSource(config.id);new ContentStore(store.db).saveSource(config);expect(service.profile().sources[0].authorized).toBe(false);
  });
  it('previews map writes, rejects stale revisions and creates linked children atomically',()=>{
    const preview=service.preview(nodeId,{kind:'createChild',title:'{{state:title}}',markdown:'## Child'},{title:'Child'});expect(store.graph('1').nodes).toHaveLength(1);service.commit(preview.token);expect(store.graph('1').edges).toHaveLength(1);
    const old=service.preview(nodeId,{kind:'append',markdown:'new'},{});store.db.prepare('UPDATE nodes SET updated_at=? WHERE id=?').run('new revision',nodeId);expect(()=>service.commit(old.token)).toThrow('changed');expect(store.node(nodeId).markdown).toBe('# Keep me');
    const sameTime=service.preview(nodeId,{kind:'append',markdown:'new'},{});store.db.prepare('UPDATE nodes SET markdown=? WHERE id=?').run('Changed without a new timestamp',nodeId);expect(()=>service.commit(sameTime.token)).toThrow('changed');
  });
});
describe('portable Markdown and offline export',()=>{
  it('exports assets and data snapshots without credentials and includes a read-only offline runtime',async()=>{
    const content=new ContentStore(store.db),asset=content.asset(nodeId,png,'image/png');
    const block={id:'chart',type:'chart',chart:'bar',x:'label',y:'n',data:[{label:'A',n:4}]};store.editNode(nodeId,'Rich',`![image](asset:${asset})\n\n\`\`\`memgraph-ui\n${raw([block])}\n\`\`\``);
    const path=join(directory,'export.zip');await exportRich(store,'1',path,join(process.cwd(),'dist-offline'),true,'snow-leopard','en');
    const files=unzipSync(readFileSync(path));expect(files['viewer/viewer.js']).toBeDefined();expect(files[`assets/${asset}.png`]).toEqual(new Uint8Array(png));
    const markdown=strFromU8(files['content.md']);expect(markdown).toContain('assets/chart-1.svg');expect(markdown).toContain('| label | n |');expect(markdown).toContain('memgraph-ui');
    const html=strFromU8(files['index.html']);expect(html).toContain("connect-src 'none'");expect(html).not.toContain('apiKey');expect(html).toContain('snow-leopard');expect(strFromU8(files['source.md'])).toContain(`asset:${asset}`);
  });
});
