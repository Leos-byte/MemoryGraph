import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArchiveRestore, BookOpen, Check, ChevronDown, ChevronRight, CircleAlert, CircleDashed, Copy, Download, FilePlus2, FileText, FolderOpen, Info, Link2, Mail, MoreHorizontal, Network, PanelLeft, PanelRight, Pencil, Plus, RefreshCw, Settings, Sparkles, Square, Trash2, Upload, X } from 'lucide-react';
import type { Command, MapRecord, NodeRecord } from '../shared/types';
import { Graph } from './Graph';
import { languageFor, statusLabel, translator } from './i18n';
import { useWorkspace } from './workspace';
import { ConfirmDialog, IconButton, Menu, Spinner, Toasts, type MenuItem } from './ui';
import { SettingsDialog } from './SettingsDialog';
import { TemplateDialog } from './TemplateDialog';
import { RecycleDialog } from './RecycleDialog';
import { EditNodeDialog, InfoDialog, RelationDialog, TitleDialog, UpdateDialog } from './dialogs';

type Dialog =
  | { kind: 'new-map' }
  | { kind: 'rename-map'; map: MapRecord }
  | { kind: 'new-node'; x?: number; y?: number; parent?: NodeRecord; selectedText?: string }
  | { kind: 'edit-node'; node: NodeRecord }
  | { kind: 'relation'; sourceId?: string; update: boolean }
  | { kind: 'delete'; command: 'map.delete' | 'node.delete'; id: string; title: string }
  | { kind: 'import'; path?: string }
  | { kind: 'restore-backup' }
  | { kind: 'settings' | 'templates' | 'trash' | 'about' | 'updates' };
type OpenMenu = { x: number; y: number; items: MenuItem[]; testId?: string };

export function App() {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh');
  const t = useMemo(() => translator(locale), [locale]);
  const workspace = useWorkspace(t);
  const { snapshot, error, pending, notices, dismiss, notify, refresh, run } = workspace;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [concept, setConcept] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [drawer, setDrawer] = useState<'maps' | 'details' | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const selectedMapRequest = useRef(0);
  const promptedLegacy = useRef(new Set<string>());
  const previousStatuses = useRef(new Map<string, string>());
  const mapId = useRef<string | null>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  const conceptRef = useRef<HTMLInputElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const selected = snapshot?.nodes.find(node => node.id === selectedId && !node.deleted_at) ?? null;
  const selectedBusy = !!selected && (snapshot!.busy.includes(selected.id) || selected.status === 'generating');
  const currentMap = snapshot?.maps.find(map => map.id === snapshot.mapId);

  useEffect(() => { setConcept(selected?.title ?? ''); }, [selected?.id]);

  useEffect(() => {
    const language = languageFor(snapshot?.settings.language);
    setLocale(language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [snapshot?.settings.language]);
  useEffect(() => {
    if (!snapshot) return;
    document.title = currentMap ? `${currentMap.title} · MemGraph` : 'MemGraph';
    if (mapId.current !== snapshot.mapId) { mapId.current = snapshot.mapId; setSelectedId(null); }
    else if (selectedId && !snapshot.nodes.some(node => node.id === selectedId)) setSelectedId(null);
    if (!snapshot.templates.some(template => template.id === templateId && !template.deleted_at)) setTemplateId(snapshot.templates.find(template => template.is_default)?.id ?? snapshot.templates[0]?.id ?? '');
    for (const node of snapshot.nodes) {
      const previous = previousStatuses.current.get(node.id);
      if (previous === 'generating' && node.status !== 'generating') notify(`${node.title}: ${statusLabel(node.status, t)}`, ['failed', 'error'].includes(node.status) ? 'error' : 'success');
      previousStatuses.current.set(node.id, node.status);
    }
  }, [snapshot, currentMap, selectedId, templateId, notify, t]);
  useEffect(() => {
    const path = snapshot?.legacyDatabase;
    if (!path || dialog || promptedLegacy.current.has(path)) return;
    promptedLegacy.current.add(path);
    try { if (localStorage.getItem(`memgraph.legacyPrompted:${path}`)) return; localStorage.setItem(`memgraph.legacyPrompted:${path}`, '1'); } catch { /* Storage may be disabled; the in-memory guard still applies. */ }
    setDialog({ kind: 'import', path });
  }, [snapshot?.legacyDatabase, dialog]);
  useEffect(() => window.memgraph?.onLogin(state => {
    if (state.status === 'failed') notify(t('loginFailed'), 'error');
    else if (state.status === 'timed_out') notify(t('loginTimedOut'), 'error');
    else if (state.status === 'succeeded') notify(t('loginCompleted'), 'success');
  }), [notify, t]);
  useEffect(() => window.memgraph?.onGenerationError(message => notify(message, 'error')), [notify]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !dialog) {
        if (event.key.toLowerCase() === 'n') { event.preventDefault(); setMenu(null); setDialog({ kind: 'new-map' }); }
        if (event.key === ',') { event.preventDefault(); setMenu(null); setDialog({ kind: 'settings' }); }
      }
      if (event.key === 'Delete' && selected && !dialog && !menu && event.target instanceof Element && event.target.closest('.graph-surface') && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault();
        setDialog({ kind: 'delete', command: 'node.delete', id: selected.id, title: selected.title });
      }
      if (event.key === 'Escape') { setMenu(null); setDrawer(null); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [dialog, selected, menu]);

  const canGenerate = () => {
    if (snapshot?.settings.authMode === 'api_key' && !snapshot.hasKey) { notify(t('noKey'), 'error'); return false; }
    return true;
  };
  async function selectMap(id: string) {
    const request = ++selectedMapRequest.current;
    setMenu(null); setSelectedId(null); setSwitching(id); setDrawer(null);
    await refresh(id);
    if (request === selectedMapRequest.current) setSwitching(null);
  }
  async function generateNode(id: string) {
    if (!canGenerate()) return false;
    const result = await run('node.generate', { id, ...(templateId ? { templateId } : {}) }, t('queued'));
    return result.ok;
  }
  async function createNode(title: string, generate: boolean, options?: Extract<Dialog, { kind: 'new-node' }>) {
    if (!snapshot?.mapId) { notify(t('selectMap'), 'error'); return false; }
    if (generate && !canGenerate()) return false;
    const parent = options?.parent;
    const index = snapshot.nodes.length;
    const result = await run<NodeRecord>('node.create', { mapId: snapshot.mapId, title, generate: false,
      x: options?.x ?? (parent ? parent.x + 270 : (index % 3) * 255), y: options?.y ?? (parent ? parent.y + 100 : Math.floor(index / 3) * 130),
      ...(parent ? { parentId: parent.id, selectedText: options?.selectedText ?? '' } : {}),
    }, generate ? undefined : t('created'));
    if (!result.ok) return false;
    setSelectedId(result.value.id);
    if (generate) await generateNode(result.value.id);
    return true;
  }
  function openAt(event: MouseEvent<HTMLElement>, items: MenuItem[], testId?: string) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setMenu({ x: bounds.left, y: bounds.bottom + 4, items, testId });
  }
  function nodeItems(node: NodeRecord): MenuItem[] {
    const busy = snapshot?.busy.includes(node.id) || node.status === 'generating';
    return [
      { label: t('regenerate'), icon: RefreshCw, disabled: busy, action: () => { void generateNode(node.id); } },
      { label: t('copy'), icon: Copy, action: () => { void run('node.copy', { id: node.id }, t('done')); } },
      { label: t('edit'), icon: Pencil, disabled: busy, action: () => setDialog({ kind: 'edit-node', node }) },
      { label: t('connect'), icon: Link2, action: () => setDialog({ kind: 'relation', sourceId: node.id, update: false }) },
      { label: t('updateRelation'), icon: RefreshCw, disabled: busy, action: () => setDialog({ kind: 'relation', sourceId: node.id, update: true }) },
      { label: t('delete'), icon: Trash2, danger: true, separator: true, action: () => setDialog({ kind: 'delete', command: 'node.delete', id: node.id, title: node.title }) },
      ...(node.deleted_at ? [{ label: t('restore'), icon: ArchiveRestore, action: () => { void run('trash.restore', { kind: 'nodes', id: node.id }, t('restored')); } }] : []),
    ];
  }
  function mapItems(map: MapRecord): MenuItem[] {
    return [
      { label: t('rename'), icon: Pencil, action: () => setDialog({ kind: 'rename-map', map }) },
      { label: t('export'), icon: Download, action: () => { void run('map.export', { id: map.id }, t('done')); } },
      { label: t('delete'), icon: Trash2, danger: true, separator: true, action: () => setDialog({ kind: 'delete', command: 'map.delete', id: map.id, title: map.title }) },
    ];
  }
  function updates() { setDialog({ kind: 'updates' }); void run('updates.check'); }
  function fileItems(): MenuItem[] {
    const action = (command: Command) => () => { void run(command, undefined, t('done')); };
    return [
      { label: t('newMap'), icon: FilePlus2, action: () => setDialog({ kind: 'new-map' }) },
      { label: t('trash'), icon: Trash2, separator: true, action: () => setDialog({ kind: 'trash' }) },
      { label: t('backup'), icon: Download, separator: true, action: action('data.backup') },
      { label: t('restoreBackup'), icon: ArchiveRestore, action: () => setDialog({ kind: 'restore-backup' }) },
      { label: t('import'), icon: Upload, action: () => setDialog({ kind: 'import' }) },
      { label: t('feedbackGithub'), icon: Link2, separator: true, action: action('feedback.github') },
      { label: t('feedbackEmail'), icon: Mail, action: action('feedback.email') },
      { label: t('feedbackCopy'), icon: Copy, action: action('feedback.copy') },
      { label: t('updates'), icon: RefreshCw, separator: true, action: updates },
    ];
  }

  if (!snapshot) return <div className="startup"><div className="brand"><Network size={25} />MemGraph</div>{error ? <><CircleAlert size={26} className="danger-text" /><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}><RefreshCw size={16} />{t('retry')}</button></> : <div className="startup-loading" role="status"><Spinner />{t('loading')}</div>}<Toasts notices={notices} dismiss={dismiss} t={t} /></div>;
  const shared = { snapshot, run, t, notify };
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><Network size={21} aria-hidden="true" /><span>MemGraph</span></div><nav className="app-menu" aria-label="MemGraph">
      <button type="button" aria-haspopup="menu" aria-expanded={menu?.testId === 'file-menu'} onClick={event => { if (menu?.testId === 'file-menu') closeMenu(); else openAt(event, fileItems(), 'file-menu'); }}>{t('file')}<ChevronDown size={12} /></button>
      <button type="button" onClick={() => setDialog({ kind: 'settings' })}><Settings size={15} /><span>{t('settings')}</span></button>
      <button type="button" onClick={() => setDialog({ kind: 'templates' })}><BookOpen size={15} /><span>{t('templates')}</span></button>
      <button type="button" onClick={() => setDialog({ kind: 'about' })}><Info size={15} /><span>{t('about')}</span></button>
    </nav><div className="header-status"><span className="version-tag">v{snapshot.version}</span>{snapshot.updates.status === 'available' && <IconButton icon={Download} label={t('available')} onClick={() => setDialog({ kind: 'updates' })} />}</div></header>
    {error && <div className="error-banner" role="alert"><CircleAlert size={15} /><span>{error}</span><button type="button" onClick={() => void refresh()}>{t('retry')}</button></div>}
    <main className={`workbench ${drawer ? `drawer-${drawer}` : ''}`}>
      {drawer && <button type="button" className="drawer-scrim" aria-label={t('close')} onClick={() => setDrawer(null)} />}
      <aside className="maps-panel" aria-label={t('maps')}><div className="panel-heading"><h1>{t('maps')}</h1><span className="count">{snapshot.maps.length}</span><IconButton icon={X} label={t('close')} className="drawer-close" onClick={() => setDrawer(null)} /></div>
        <div className="map-list" role="listbox" aria-label={t('maps')}>{snapshot.maps.filter(map => !map.deleted_at).map((map, index, maps) => <button type="button" role="option" aria-selected={snapshot.mapId === map.id} key={map.id} data-testid="map-item" className={`map-item ${snapshot.mapId === map.id ? 'active' : ''}`} title={map.title} onClick={() => void selectMap(map.id)}
          onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, items: mapItems(map), testId: 'map-menu' }); }}
          onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.right - 20, y: rect.bottom, items: mapItems(map), testId: 'map-menu' }); } if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = maps[(index + (event.key === 'ArrowDown' ? 1 : -1) + maps.length) % maps.length]; void selectMap(next.id); (event.currentTarget.parentElement?.children[maps.indexOf(next)] as HTMLElement)?.focus(); } }}>
          <Network size={16} aria-hidden="true" /><span>{map.title}</span>{switching === map.id ? <Spinner /> : snapshot.mapId === map.id ? <ChevronRight size={13} aria-hidden="true" /> : null}
        </button>)}{!snapshot.maps.length && <div className="empty-state compact"><FolderOpen size={25} /><span>{t('mapsEmpty')}</span></div>}</div>
        <div className="maps-footer"><button type="button" className="primary new-map-button" onClick={() => setDialog({ kind: 'new-map' })}><Plus size={16} />{t('newMap')}</button></div>
      </aside>
      <section className="canvas-panel" aria-label={t('graph')}><div className="canvas-header"><IconButton className="maps-toggle" icon={PanelLeft} label={t('showMaps')} onClick={() => setDrawer('maps')} /><div className="canvas-breadcrumb"><Network size={15} aria-hidden="true" /><h2>{currentMap?.title ?? t('graph')}</h2></div><span className="canvas-count">{snapshot.nodes.length} {t('nodes')}<span> / </span>{snapshot.edges.length} {t('edges')}</span><IconButton icon={Plus} label={t('newNode')} disabled={!snapshot.mapId} onClick={() => setDialog({ kind: 'new-node' })} /><IconButton className="details-toggle" icon={PanelRight} label={t('showDetails')} onClick={() => setDrawer('details')} /></div>
        <Graph snapshot={snapshot} selectedId={selectedId} t={t} onSelect={setSelectedId} onMove={(id, x, y) => { void run('node.move', { id, x, y }); }} onConnect={connection => { if (connection.source && connection.target) void run('edge.connect', { sourceId: connection.source, targetId: connection.target }, t('done')); }} onContext={(node, x, y) => setMenu({ x, y, items: nodeItems(node), testId: 'node-context-menu' })} onBlank={(x, y) => setDialog({ kind: 'new-node', x, y })} />
        {switching && <div className="canvas-loading" role="status"><Spinner />{t('loading')}</div>}
      </section>
      <aside className="details-panel" aria-label={t('concept')}><div className="panel-heading details-heading"><h2>{t('concept')}</h2><IconButton className="drawer-close" icon={X} label={t('close')} onClick={() => setDrawer(null)} /></div>
        <form className="concept-form" onSubmit={async event => { event.preventDefault(); if (!concept.trim() || creating) return; const existing = selected && concept.trim() === selected.title.trim(); if (existing && selectedBusy) return; setCreating(true); if (existing) await generateNode(selected.id); else await createNode(concept.trim(), true); setCreating(false); }}>
          <label className="sr-only" htmlFor="concept-input">{t('concept')}</label><div className="generate-row"><input id="concept-input" ref={conceptRef} data-testid="concept-input" placeholder={t('conceptPlaceholder')} value={concept} disabled={creating} onChange={event => setConcept(event.target.value)} /><button type="submit" className="primary" data-testid="generate" disabled={!snapshot.mapId || !concept.trim() || creating || (selectedBusy && concept.trim() === selected?.title.trim())}>{creating ? <Spinner /> : <Sparkles size={15} />}{t('generate')}</button></div>
          <label className="template-select-label" htmlFor="template-select">{t('template')}</label><select id="template-select" data-testid="template-select" value={templateId} onChange={event => setTemplateId(event.target.value)}>{!snapshot.templates.length && <option value="">{t('noTemplates')}</option>}{snapshot.templates.filter(template => !template.deleted_at).map(template => <option value={template.id} key={template.id}>{template.name}{template.is_default ? ` (${t('default')})` : ''}</option>)}</select>
        </form>
        {selected ? <><div className="node-heading"><div className="node-heading-title"><h2 data-testid="node-title">{selected.title}</h2><IconButton icon={MoreHorizontal} label={t('more')} aria-haspopup="menu" data-testid="node-menu" onClick={event => openAt(event, nodeItems(selected), 'node-actions-menu')} /></div><div className="node-meta"><span className={`status-badge ${['error', 'failed'].includes(selected.status) ? 'status-error' : selectedBusy ? 'status-busy' : ''}`} role="status">{selectedBusy ? <Spinner /> : ['error', 'failed'].includes(selected.status) ? <CircleAlert size={12} /> : <Check size={12} />}{selectedBusy ? t('generating') : statusLabel(selected.status, t)}</span>{selectedBusy && <button type="button" className="text-button" onClick={() => void run('node.cancel', { id: selected.id }, t('cancelled'))}><Square size={12} />{t('stop')}</button>}</div></div>
          <div ref={markdownRef} className="markdown" data-testid="markdown" aria-label={t('markdown')} aria-busy={selectedBusy} onContextMenu={event => {
            const selection = window.getSelection(); const text = selection?.toString().trim();
            if (!text || !selection?.anchorNode || !selection.focusNode || !markdownRef.current?.contains(selection.anchorNode) || !markdownRef.current.contains(selection.focusNode)) return;
            event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, items: [{ label: t('linkedNode'), icon: Plus, action: () => setDialog({ kind: 'new-node', parent: selected, selectedText: text.slice(0, 10000) }) }] });
          }}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']} components={{
            a: ({ href, children }) => href && /^https?:\/\//i.test(href) ? <a href={href} rel="noreferrer" onClick={event => { event.preventDefault(); void run('external.open', { url: href }); }}>{children}</a> : <span>{children}</span>,
            img: () => null,
          }}>{selected.markdown}</ReactMarkdown>{!selected.markdown.trim() && <p className="muted">{t('noContent')}</p>}{selectedBusy && <div className="generation-indicator" role="status"><Spinner /><span>{t('generating')}</span></div>}</div>
        </> : <div className="empty-state details-empty"><FileText size={29} /><span>{t('selectNode')}</span></div>}
      </aside>
    </main>
    <footer className="statusbar"><span className={`workspace-status ${pending || snapshot.busy.length ? 'is-busy' : ''}`}>{pending || snapshot.busy.length ? <Spinner /> : <span className="status-dot" />}{pending ? t('working') : snapshot.busy.length ? `${t('generating')} (${snapshot.busy.length})` : t('ready')}</span><span className="status-model">{snapshot.settings.model}</span><span className="status-map">{currentMap?.title ?? 'MemGraph'}</span><span>{locale === 'zh' ? '中文' : 'EN'}</span></footer>
    {menu && <Menu {...menu} onClose={closeMenu} />}
    {dialog?.kind === 'new-map' && <TitleDialog t={t} title={t('newMap')} onClose={closeDialog} testId="new-map-dialog" onSubmit={async title => { const result = await run<MapRecord>('map.create', { title }, t('created')); if (!result.ok) return false; await selectMap(result.value.id); return true; }} />}
    {dialog?.kind === 'rename-map' && <TitleDialog t={t} title={t('rename')} initial={dialog.map.title} onClose={closeDialog} testId="rename-map-dialog" onSubmit={async title => (await run('map.rename', { id: dialog.map.id, title }, t('saved'))).ok} />}
    {dialog?.kind === 'new-node' && <TitleDialog t={t} title={dialog.parent ? t('linkedNode') : t('newNode')} initial={dialog.selectedText?.slice(0, 250) ?? ''} generate={dialog.parent ? false : snapshot.settings.autoGenerate} onClose={closeDialog} testId="new-node-dialog" onSubmit={(title, generate) => createNode(title, generate, dialog)} />}
    {dialog?.kind === 'edit-node' && <EditNodeDialog {...shared} node={dialog.node} onClose={closeDialog} />}
    {dialog?.kind === 'relation' && <RelationDialog {...shared} sourceId={dialog.sourceId} update={dialog.update} canGenerate={canGenerate} onClose={closeDialog} />}
    {dialog?.kind === 'settings' && <SettingsDialog {...shared} onClose={closeDialog} />}
    {dialog?.kind === 'templates' && <TemplateDialog {...shared} onClose={closeDialog} />}
    {dialog?.kind === 'trash' && <RecycleDialog {...shared} onClose={closeDialog} />}
    {dialog?.kind === 'updates' && <UpdateDialog {...shared} onClose={closeDialog} />}
    {dialog?.kind === 'about' && <InfoDialog title={t('about')} t={t} onClose={closeDialog}><div className="about-brand"><Network size={32} /><h2>MemGraph</h2></div><p>{t('aboutDescription')}</p><dl className="about-meta"><dt>{t('version')}</dt><dd>{snapshot.version}</dd><dt>{t('platform')}</dt><dd>{snapshot.platform}</dd></dl></InfoDialog>}
    {dialog?.kind === 'delete' && <ConfirmDialog t={t} title={`${t('delete')} · ${dialog.title}`} message={t('deleteWarning')} confirm={t('delete')} danger busy={dialogBusy} onClose={() => { if (!dialogBusy) closeDialog(); }} onConfirm={async () => { setDialogBusy(true); const result = await run(dialog.command, { id: dialog.id }, t('movedTrash')); setDialogBusy(false); if (result.ok) closeDialog(); }} />}
    {dialog?.kind === 'import' && <ConfirmDialog t={t} title={t('importTitle')} message={<>{t(dialog.path ? 'importWarning' : 'importManual')}{dialog.path && <code className="legacy-path">{dialog.path}</code>}</>} confirm={t('import')} busy={dialogBusy} onClose={() => { if (!dialogBusy) closeDialog(); }} onConfirm={async () => { setDialogBusy(true); const result = await run<boolean>('data.import', dialog.path ? { path: dialog.path } : {}, t('importSuccess')); setDialogBusy(false); if (result.ok && result.value) { setSelectedId(null); closeDialog(); } }} />}
    {dialog?.kind === 'restore-backup' && <ConfirmDialog t={t} title={t('restoreBackup')} message={t('restoreWarning')} confirm={t('restore')} busy={dialogBusy} onClose={() => { if (!dialogBusy) closeDialog(); }} onConfirm={async () => { setDialogBusy(true); const result = await run('data.restore', undefined, t('restored')); setDialogBusy(false); if (result.ok && result.value !== false) { setSelectedId(null); closeDialog(); } }} />}
    <Toasts notices={notices} dismiss={dismiss} t={t} />
  </div>;
}
