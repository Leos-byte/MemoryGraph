import { useCallback, useEffect, useRef, useState } from 'react';
import { ArchiveRestore, FileText, Network, RefreshCw, Trash2 } from 'lucide-react';
import type { Trash } from '../shared/types';
import type { WorkspaceUI } from './workspace';
import { ConfirmDialog, IconButton, Modal, Spinner } from './ui';

export function RecycleDialog({ run, t, onClose }: WorkspaceUI & { onClose: () => void }) {
  const [trash, setTrash] = useState<Trash | null>(null);
  const [kind, setKind] = useState<keyof Trash>('maps');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true);
    const result = await run<Trash>('trash.list');
    if (version !== sequence.current) return;
    if (result.ok) setTrash(result.value);
    setLoading(false);
  }, [run]);
  useEffect(() => { void load(); const unsubscribe = window.memgraph.onChange(() => { void load(); }); return () => { sequence.current++; unsubscribe(); }; }, [load]);
  const count = trash ? trash.maps.length + trash.nodes.length + trash.templates.length : 0;
  const Icon = kind === 'maps' ? Network : kind === 'nodes' ? FileText : FileText;
  return <><Modal title={t('trash')} onClose={() => { if (!busy) onClose(); }} testId="recycle-dialog" wide>
    <div className="trash-tabs" role="tablist" aria-label={t('trash')}>{(['maps', 'nodes', 'templates'] as const).map(tab => <button type="button" id={`trash-tab-${tab}`} role="tab" key={tab} aria-selected={kind === tab} aria-controls="trash-content" onClick={() => setKind(tab)}>{t(tab)}<span className="count">{trash?.[tab].length ?? 0}</span></button>)}<IconButton icon={RefreshCw} label={t('retry')} disabled={loading} onClick={() => void load()} /></div>
    <div className="modal-body recycle-body" role="tabpanel" id="trash-content" aria-labelledby={`trash-tab-${kind}`}>
      {loading && !trash ? <div className="empty-state"><Spinner />{t('loading')}</div> : !trash ? <div className="empty-state"><p>{t('failed')}</p><button type="button" onClick={() => void load()}><RefreshCw size={15} />{t('retry')}</button></div> : !trash[kind].length ? <div className="empty-state"><Trash2 size={26} /><span>{t('trashEmpty')}</span></div> : <ul className="recycle-list">{trash[kind].map(item => <li key={item.id}><Icon size={17} /><div><strong>{'title' in item ? item.title : item.name}</strong><time>{item.deleted_at ? new Date(item.deleted_at).toLocaleString() : ''}</time></div><button type="button" disabled={busy} onClick={async () => { setBusy(true); const result = await run('trash.restore', { kind, id: item.id }, t('restored')); if (result.ok) await load(); setBusy(false); }}><ArchiveRestore size={15} />{t('restore')}</button></li>)}</ul>}
    </div><footer className="dialog-actions"><button type="button" className="danger-text push-left" disabled={!count || busy} onClick={() => setConfirm(true)}><Trash2 size={15} />{t('emptyTrash')}</button><button type="button" onClick={onClose} disabled={busy}>{t('close')}</button></footer>
  </Modal>{confirm && <ConfirmDialog t={t} title={t('emptyTrash')} message={t('emptyWarning')} confirm={t('permanentDelete')} danger busy={busy} onClose={() => { if (!busy) setConfirm(false); }} onConfirm={async () => { setBusy(true); const result = await run('trash.empty', undefined, t('done')); if (result.ok) { await load(); setConfirm(false); } setBusy(false); }} />}</>;
}
