import { Component, createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowLeft, ArrowRight, RefreshCw, Search, X } from 'lucide-react';
import { parseRich, blockRows, metricValue, bindText, type RichBlock, type Values, type Row, type DataResult, type RichProfile } from '../../shared/content';
import type { NodeRecord } from '../../shared/types';

const Chart = lazy(() => import('./Visual').then(module => ({ default: module.Chart })));
const Diagram = lazy(() => import('./Visual').then(module => ({ default: module.Diagram })));
export interface ContentRuntime { nodeId?: string; offline?: boolean; assets?: Record<string,string>; state?: Record<string,Values>; cache?: Record<string,DataResult>; language?: 'zh' | 'en'; onNavigate?: (id: string) => void; onChanged?: () => void }
const Runtime = createContext<ContentRuntime>({});
export function assetUrl(value: string, assets?: Record<string,string>): string | undefined {
  const match = /^asset:([a-f0-9]{64})$/.exec(value); return match ? assets ? assets[match[1]] : `memgraph://app/assets/${match[1]}` : undefined;
}
const words = (zh: boolean, a: string, b: string) => zh ? a : b;
class ContentBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }; static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <p role="alert">Component could not be displayed. / 组件显示失败。</p> : this.props.children; }
}
function Image({ src = '', alt = '' }: { src?: string; alt?: string }) {
  const runtime = useContext(Runtime), [expanded, setExpanded] = useState(false), [failed, setFailed] = useState(false); const url = assetUrl(src, runtime.assets);
  if (!url || failed) return <span className="content-image-missing">{alt || words(runtime.language === 'zh', '图片未导入或不可用', 'Image not imported or unavailable')}</span>;
  return <><img className="content-image" src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} onClick={() => setExpanded(true)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setExpanded(true); }} />{expanded && <span className="image-lightbox" role="dialog" aria-label={alt || 'Image'} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false); } }}><button type="button" autoFocus aria-label="Close / 关闭" onClick={() => setExpanded(false)}><X size={20} /></button><img src={url} alt={alt} /></span>}</>;
}
function Markdown({ markdown, components = true }: { markdown: string; components?: boolean }) {
  const runtime = useContext(Runtime);
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { trust: false, strict: 'error', maxExpand: 200, maxSize: 10 }]]} skipHtml urlTransform={value => value.startsWith('asset:') ? value : defaultUrlTransform(value)} components={{
    a: ({ href, children }) => href && /^https?:\/\//i.test(href) ? <a href={href} rel="noreferrer" target="_blank" onClick={event => { if (!runtime.offline) { event.preventDefault(); void window.memgraph.invoke('external.open', { url: href }); } }}>{children}</a> : <span>{children}</span>,
    img: ({ src, alt }) => <Image src={typeof src === 'string' ? src : ''} alt={alt} />,
    table: ({ children }) => <div className="markdown-table" tabIndex={0} role="region" aria-label="Table"><table>{children}</table></div>,
    pre: ({ children }) => <div className="content-code-container">{children}</div>,
    code: ({ children, className }) => {
      const source = String(children).replace(/\n$/, ''), language = className?.replace('language-','');
      if (components && language === 'memgraph-ui') return <ContentBoundary key={source}><UIBlock raw={source} /></ContentBoundary>;
      if (components && language === 'mermaid') return <Suspense fallback={<p role="status">...</p>}><Diagram source={source} /></Suspense>;
      return className || source.includes('\n') ? <pre><code className={className}>{source}</code></pre> : <code>{children}</code>;
    }
  }}>{markdown}</ReactMarkdown>;
}
export function RichContent({ markdown, ...runtime }: ContentRuntime & { markdown: string }) {
  return <Runtime.Provider value={runtime}><ContentBoundary key={markdown}><Markdown markdown={markdown} /></ContentBoundary></Runtime.Provider>;
}
function DataTable({ block, rows }: { block: RichBlock; rows: Row[] }) {
  const [search, setSearch] = useState(''), [sort, setSort] = useState<{ key: string; direction: number }>(), [page, setPage] = useState(0);
  const columns = block.columns ?? Object.keys(rows[0] ?? {}).slice(0,30).map(key => ({ key, label: key }));
  const data = useMemo(() => { const filtered = rows.filter(row => Object.values(row).some(value => String(value ?? '').toLocaleLowerCase().includes(search.toLocaleLowerCase()))); return sort ? [...filtered].sort((a,b) => (typeof a[sort.key] === 'number' && typeof b[sort.key] === 'number' ? Number(a[sort.key])-Number(b[sort.key]) : String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''))) * sort.direction) : filtered; }, [rows, search, sort]);
  const start = Math.min(page * 50, Math.max(0, Math.floor((data.length - 1) / 50) * 50));
  return <><label className="content-table-search"><Search size={15} /><input aria-label="Filter / 筛选" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label><div className="markdown-table"><table><thead><tr>{columns.map(column => <th key={column.key}><button type="button" onClick={() => setSort({ key: column.key, direction: sort?.key === column.key ? -sort.direction : 1 })}>{column.label}{sort?.key === column.key ? sort.direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>)}</tr></thead><tbody>{data.slice(start,start+50).map((row,index) => <tr key={index}>{columns.map(column => <td key={column.key}>{String(row[column.key] ?? '')}</td>)}</tr>)}</tbody></table></div><div className="content-pagination"><button type="button" disabled={!start} onClick={() => setPage(Math.max(0, page-1))}>←</button><span>{data.length ? start+1 : 0}–{Math.min(start+50,data.length)} / {data.length}</span><button type="button" disabled={start+50>=data.length} onClick={() => setPage(page+1)}>→</button></div></>;
}
function UIBlock({ raw }: { raw: string }) {
  const runtime = useContext(Runtime), zh = runtime.language === 'zh', [values, setValues] = useState<Values>({}), [cache, setCache] = useState<Record<string,DataResult>>(runtime.cache ?? {}), [profile, setProfile] = useState<RichProfile>(), [error, setError] = useState(''), [pending, setPending] = useState(false), [auto, setAuto] = useState(false), [preview, setPreview] = useState<{ token: string; title: string; markdown: string; kind: string; target: string }>();
  const host = useRef<HTMLDivElement>(null), hydrated = useRef(false);
  const pendingSave = useRef<Values | undefined>(undefined), saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const parsed = useMemo(() => { try { return { document: parseRich(raw), error: '' }; } catch (error) { return { document: undefined, error: String(error) }; } }, [raw]);
  const rootId = parsed.document?.blocks[0]?.id ?? 'content';
  const sourceIds = useMemo(() => { const ids = new Set<string>(); const visit = (blocks: RichBlock[]) => { for (const block of blocks) { if (block.sourceId) ids.add(block.sourceId); if (block.action?.sourceId) ids.add(block.action.sourceId); if (block.children) visit(block.children); } }; if (parsed.document) visit(parsed.document.blocks); return [...ids]; }, [parsed]);
  useEffect(() => {
    let active = true; hydrated.current = false;
    const defaults: Values = {}; const visit = (blocks: RichBlock[]) => { for (const block of blocks) { if (block.state) defaults[block.state] = block.value ?? (block.type === 'toggle' ? false : block.type === 'slider' ? block.min ?? 0 : ''); if (block.children) visit(block.children); } }; if (parsed.document) visit(parsed.document.blocks);
    setValues({ ...defaults, ...runtime.state?.[rootId] });
    if (!runtime.offline && runtime.nodeId) void Promise.all([window.memgraph.invoke<{ state: Record<string,Values>; cache: Record<string,DataResult> }>('content.state', { nodeId: runtime.nodeId }), window.memgraph.invoke<RichProfile>('content.profile')]).then(([result, profile]) => { if (!active) return; setValues({ ...defaults, ...result.state[rootId] }); setCache(result.cache); setProfile(profile); hydrated.current = true; }).catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [runtime.nodeId, rootId, parsed, runtime.offline]);
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    if (pendingSave.current && !runtime.offline && runtime.nodeId) void window.memgraph.invoke('content.saveState',{nodeId:runtime.nodeId,blockId:rootId,values:pendingSave.current}).catch(() => {});
    pendingSave.current = undefined;
  }, [runtime.nodeId,rootId,runtime.offline]);
  function updateValue(key: string, value: Values[string]) {
    const next = {...values,[key]:value}; setValues(next);
    if (!hydrated.current || runtime.offline || !runtime.nodeId) return;
    pendingSave.current = next; clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      pendingSave.current = undefined;
      void window.memgraph.invoke('content.saveState',{nodeId:runtime.nodeId,blockId:rootId,values:next}).catch(error => setError(String(error)));
    },400);
  }
  async function query(sourceId: string) {
    if (runtime.offline || !runtime.nodeId) return;
    const source = profile?.sources.find(source => source.id === sourceId); if (!source) throw new Error(words(zh, '请在设置中配置数据源', 'Configure the data source in Settings.'));
    const params = Object.fromEntries(source.params.filter(key => Object.hasOwn(values,key)).map(key => [key,values[key]]));
    const result = await window.memgraph.invoke<DataResult>('content.query', { nodeId:runtime.nodeId, sourceId, params }); setCache(current => ({ ...current, [sourceId]:result }));
  }
  async function refresh() { if (pending) return; setPending(true); setError(''); try { for (const id of sourceIds) await query(id); } catch (error) { setError(String(error)); } finally { setPending(false); } }
  useEffect(() => {
    if (!auto || runtime.offline) return;
    let visible = true; const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; }); if (host.current) observer.observe(host.current);
    const timer = setInterval(() => { if (visible && document.visibilityState === 'visible') void refresh(); },60000);
    return () => { clearInterval(timer); observer.disconnect(); };
  }, [auto, values, profile, pending, runtime.offline]);
  async function action(block: RichBlock) {
    if (!block.action) return; setError('');
    try {
      if (block.action.kind === 'query') { setPending(true); await query(block.action.sourceId ?? block.sourceId ?? ''); }
      else if (block.action.kind === 'navigate') { if (runtime.offline) { location.hash = `node-${block.action.target}`; } else runtime.onNavigate?.(block.action.target ?? ''); }
      else if (!runtime.offline && runtime.nodeId) setPreview(await window.memgraph.invoke('content.actionPreview', { nodeId:runtime.nodeId, action:block.action, values }));
    } catch (error) { setError(String(error)); } finally { setPending(false); }
  }
  function render(block: RichBlock): ReactNode {
    const rows = blockRows(block, values, block.sourceId ? cache[block.sourceId]?.rows : undefined), text = bindText(block.text ?? '', values), label = block.title ?? block.id;
    const children = () => block.children?.map(child => <div key={child.id}>{render(child)}</div>);
    if (block.type === 'markdown') return <Markdown markdown={text} components={false} />;
    if (block.type === 'callout') return <aside className="content-callout"><strong>{block.title}</strong><Markdown markdown={text} components={false} /></aside>;
    if (block.type === 'details') return <details className="content-details"><summary>{label}</summary>{text && <Markdown markdown={text} components={false} />}{children()}</details>;
    if (block.type === 'tabs') return <Tabs block={block} render={render} />;
    if (block.type === 'columns') return <div className="content-columns">{children()}</div>;
    if (block.type === 'metric') return <div className="content-metric"><span>{label}</span><strong>{String(metricValue(block,rows))}</strong></div>;
    if (block.type === 'table') return <section aria-label={label}>{block.title && <h3>{block.title}</h3>}<DataTable block={block} rows={rows} /></section>;
    if (block.type === 'chart') return <figure><figcaption>{label}</figcaption><Suspense fallback={<p role="status">...</p>}><Chart block={block} rows={rows} /></Suspense><details><summary>{words(zh,'数据表','Data table')}</summary><DataTable block={block} rows={rows} /></details></figure>;
    if (block.type === 'image') return <figure><Image src={`asset:${block.assetId}`} alt={block.text ?? label} /><figcaption>{block.title}</figcaption></figure>;
    if (block.type === 'button') return <button type="button" disabled={pending || (runtime.offline && block.action?.kind !== 'navigate')} title={runtime.offline ? words(zh,'联网及地图写入仅在 MemGraph 中可用','Network and map writes require MemGraph') : undefined} onClick={() => void action(block)}>{label}</button>;
    if (block.type === 'form') return <form className="content-form" onSubmit={event => { event.preventDefault(); void action(block); }}>{block.title && <h3>{block.title}</h3>}{children()}<button type="submit" disabled={pending || (runtime.offline && !!block.action)}>{words(zh,'提交','Submit')}</button></form>;
    const key = block.state ?? block.id, value = values[key] ?? block.value ?? '';
    const update = (value: Values[string]) => updateValue(key,value);
    if (block.type === 'toggle') return <label className="check-field"><input type="checkbox" checked={!!value} onChange={event => update(event.target.checked)} />{label}</label>;
    if (block.type === 'select') return <label className="field">{label}<select value={String(value)} onChange={event => update(event.target.value)}>{['',...(block.options ?? [])].map(option => <option key={option}>{option}</option>)}</select></label>;
    if (block.type === 'slider') return <label className="field">{label}<span className="content-range"><input type="range" min={block.min ?? 0} max={block.max ?? 100} step={block.step ?? 1} value={Number(value)||0} onChange={event => update(event.target.valueAsNumber)} /><output>{String(value)}</output></span></label>;
    return <label className="field">{label}<input value={String(value)} onChange={event => update(event.target.value)} /></label>;
  }
  if (!parsed.document) return <div className="content-error" role="alert"><p>{parsed.error}</p><pre>{raw}</pre></div>;
  return <div ref={host} className="rich-ui" data-testid="rich-ui">{sourceIds.length > 0 && <div className="content-data-tools">{!runtime.offline && <><button type="button" disabled={pending} onClick={() => void refresh()}><RefreshCw size={14} />{words(zh,'刷新数据','Refresh data')}</button><label className="check-field"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />{words(zh,'每分钟刷新','Refresh every minute')}</label></>}{sourceIds.map(id => <small key={id}>{profile?.sources.find(source=>source.id===id)?.name ?? id} · {cache[id]?.fetchedAt ? new Date(cache[id].fetchedAt).toLocaleString() : words(zh,'未获取数据','No data fetched')}{cache[id]?.stale ? words(zh,' · 缓存已过期',' · stale cache') : ''}{cache[id]?.error && <span role="alert">{cache[id].error}</span>}</small>)}</div>}{parsed.document.blocks.map(block => <ContentBoundary key={block.id}><div className="rich-block" data-block-id={block.id}>{render(block)}</div></ContentBoundary>)}{error && <p className="inline-error" role="alert">{error}</p>}{preview && <section className="content-action-preview" role="dialog" aria-label={words(zh,'操作预览','Action preview')}><h3>{preview.kind} · {preview.target}</h3><strong>{preview.title}</strong><pre>{preview.markdown}</pre><div className="button-row"><button type="button" onClick={() => setPreview(undefined)}>{words(zh,'取消','Cancel')}</button><button type="button" className="primary" disabled={pending} onClick={async () => { setPending(true); try { const result = await window.memgraph.invoke<NodeRecord | null>('content.actionCommit', { token:preview.token }); if (result) { setPreview(undefined); runtime.onChanged?.(); } } catch (error) { setError(String(error)); } finally { setPending(false); } }}>{words(zh,'确认应用','Confirm changes')}</button></div></section>}</div>;
}
function Tabs({ block, render }: { block: RichBlock; render: (block: RichBlock) => ReactNode }) {
  const [selected, setSelected] = useState(0), tabs = block.children ?? [];
  return <div className="content-tabs"><div role="tablist" aria-label={block.title ?? block.id}>{tabs.map((tab,index) => <button type="button" role="tab" aria-selected={selected===index} key={tab.id} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { const next = (selected + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setSelected(next); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); } }}>{tab.title ?? tab.id}</button>)}</div><div role="tabpanel">{tabs[selected] && render(tabs[selected])}</div></div>;
}
