import { useState, type ReactNode } from 'react';
import { Download, ExternalLink, Link2, RefreshCw, RotateCw, Save } from 'lucide-react';
import type { NodeRecord } from '../shared/types';
import type { WorkspaceUI } from './workspace';
import type { Translate } from './i18n';
import { ConfirmDialog, Modal, Spinner } from './ui';

export function TitleDialog({ title, initial = '', generate, t, onClose, onSubmit, testId }: { title: string; initial?: string; generate?: boolean; t: Translate; onClose: () => void; onSubmit: (title: string, generate: boolean) => Promise<boolean>; testId: string }) {
  const [value, setValue] = useState(initial);
  const [autoGenerate, setAutoGenerate] = useState(generate ?? false);
  const [busy, setBusy] = useState(false);
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }} testId={testId}><form onSubmit={async event => { event.preventDefault(); if (!value.trim()) return; setBusy(true); const success = await onSubmit(value.trim(), autoGenerate); setBusy(false); if (success) onClose(); }}>
    <div className="modal-body"><label className="field">{t('title')}<input data-autofocus required value={value} onChange={event => setValue(event.target.value)} disabled={busy} /></label>{generate !== undefined && <label className="check-field"><input type="checkbox" checked={autoGenerate} disabled={busy} onChange={event => setAutoGenerate(event.target.checked)} />{t('generateNow')}</label>}</div>
    <footer className="dialog-actions"><button type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button type="submit" className="primary" disabled={busy || !value.trim()}>{busy && <Spinner />}{t('confirm')}</button></footer>
  </form></Modal>;
}

export function EditNodeDialog({ node, run, t, onClose }: WorkspaceUI & { node: NodeRecord; onClose: () => void }) {
  const [title, setTitle] = useState(node.title);
  const [markdown, setMarkdown] = useState(node.markdown);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const close = () => { if (busy) return; if (title !== node.title || markdown !== node.markdown) setDiscard(true); else onClose(); };
  return <><Modal title={t('edit')} onClose={close} testId="edit-node-dialog" wide><form onSubmit={async event => { event.preventDefault(); setBusy(true); const result = await run('node.edit', { id: node.id, title: title.trim(), markdown }, t('saved')); setBusy(false); if (result.ok) onClose(); }}>
    <div className="modal-body"><label className="field">{t('title')}<input required value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label><label className="field">{t('markdown')}<textarea className="markdown-editor" rows={18} value={markdown} disabled={busy} onChange={event => setMarkdown(event.target.value)} spellCheck={false} /></label></div>
    <footer className="dialog-actions"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button type="submit" disabled={busy || !title.trim()} className="primary">{busy ? <Spinner /> : <Save size={15} />}{t('save')}</button></footer>
  </form></Modal>{discard && <ConfirmDialog t={t} title={t('unsaved')} message={t('discardWarning')} confirm={t('discard')} onConfirm={onClose} onClose={() => setDiscard(false)} />}</>;
}

export function RelationDialog({ snapshot, run, t, sourceId, update, canGenerate, onClose }: WorkspaceUI & { sourceId?: string; update: boolean; canGenerate: () => boolean; onClose: () => void }) {
  const nodes = snapshot.nodes.filter(node => !node.deleted_at);
  const [source, setSource] = useState(sourceId ?? nodes[0]?.id ?? '');
  const [target, setTarget] = useState(nodes.find(node => node.id !== source)?.id ?? '');
  const [busy, setBusy] = useState(false);
  const title = t(update ? 'updateRelation' : 'connect');
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }} testId="relation-dialog"><form onSubmit={async event => { event.preventDefault(); if (source === target || !source || !target || (update && !canGenerate())) return; setBusy(true); const result = await run(update ? 'edge.updateRelation' : 'edge.connect', { sourceId: source, targetId: target }, t(update ? 'working' : 'done')); setBusy(false); if (result.ok) onClose(); }}>
    <div className="modal-body">{nodes.length < 2 && <p className="inline-warning">{t('relationNeedsTwo')}</p>}<label className="field">{t('source')}<select required value={source} onChange={event => { setSource(event.target.value); if (target === event.target.value) setTarget(nodes.find(node => node.id !== event.target.value)?.id ?? ''); }}>{nodes.map(node => <option value={node.id} key={node.id}>{node.title}</option>)}</select></label><label className="field">{t('target')}<select required value={target} onChange={event => setTarget(event.target.value)}>{!target && <option value="">{t('chooseNode')}</option>}{nodes.filter(node => node.id !== source).map(node => <option value={node.id} key={node.id}>{node.title}</option>)}</select></label></div>
    <footer className="dialog-actions"><button type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button type="submit" className="primary" disabled={busy || !source || !target || source === target}>{busy ? <Spinner /> : update ? <RefreshCw size={15} /> : <Link2 size={15} />}{title}</button></footer>
  </form></Modal>;
}

export function UpdateDialog({ snapshot, run, t, onClose }: WorkspaceUI & { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const state = snapshot.updates;
  const status = state.status === 'idle' ? 'updateIdle' : state.status;
  const blocked = busy || ['checking', 'downloading', 'installing'].includes(state.status);
  const close = () => { if (state.status !== 'installing') onClose(); };
  async function action(command: 'updates.check' | 'updates.download' | 'updates.install') { setBusy(true); try { await run(command); } finally { setBusy(false); } }
  return <><Modal title={t('softwareUpdates')} onClose={close} testId="updates-dialog"><div className="modal-body update-body"><div className="update-symbol"><Download size={26} /></div><h3>MemGraph {snapshot.version}</h3><p role="status">{['checking', 'downloading', 'installing'].includes(state.status) && <Spinner />}{t(status)}</p>{state.version && <p>{t('version')}: {state.version}</p>}{state.status === 'downloading' && <><progress aria-label={t('downloading')} value={state.percent ?? 0} max={100} /><p>{Math.floor(state.percent ?? 0)}%</p></>}{state.message && <p className={state.status === 'error' ? 'inline-error' : 'muted'}>{state.message}</p>}{state.checkedAt && <p className="muted">{t('lastChecked')}: {new Date(state.checkedAt).toLocaleString()}</p>}</div>
    <footer className="dialog-actions"><button type="button" disabled={state.status === 'installing'} onClick={close}>{t('close')}</button>{!state.supported || state.status === 'error' ? <button type="button" onClick={() => void run('external.open', { url: state.releasesUrl })}><ExternalLink size={15} />{t('releases')}</button> : null}{state.status === 'available' && <button type="button" className="primary" disabled={blocked || !state.supported} onClick={() => void action('updates.download')}><Download size={15} />{t('download')}</button>}{state.status === 'downloaded' ? <button type="button" className="primary" disabled={blocked || !state.supported} onClick={() => setConfirmInstall(true)}><RotateCw size={15} />{t('install')}</button> : state.supported && <button type="button" disabled={blocked} onClick={() => void action('updates.check')}>{blocked ? <Spinner /> : <RefreshCw size={15} />}{t('updates')}</button>}</footer>
  </Modal>{confirmInstall && <ConfirmDialog t={t} title={t('install')} message={t('restartWarning')} confirm={t('install')} onClose={() => setConfirmInstall(false)} onConfirm={() => { setConfirmInstall(false); void action('updates.install'); }} />}</>;
}

export function InfoDialog({ title, children, onClose, t }: { title: string; children: ReactNode; onClose: () => void; t: Translate }) {
  return <Modal title={title} onClose={onClose} testId="about-dialog"><div className="modal-body">{children}</div><footer className="dialog-actions"><button type="button" onClick={onClose}>{t('close')}</button></footer></Modal>;
}
