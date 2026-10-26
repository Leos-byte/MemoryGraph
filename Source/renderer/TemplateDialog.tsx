import { useState } from 'react';
import { Check, Copy, HelpCircle, Plus, Save, Trash2 } from 'lucide-react';
import type { TemplateRecord } from '../shared/types';
import type { WorkspaceUI } from './workspace';
import { ConfirmDialog, IconButton, Modal, Spinner } from './ui';

type Draft = { id?: string; name: string; system_prompt: string; user_prompt: string; is_default: boolean };
const fromRecord = (record: TemplateRecord): Draft => ({ id: record.id, name: record.name, system_prompt: record.system_prompt, user_prompt: record.user_prompt, is_default: !!record.is_default });

export function TemplateDialog({ snapshot, run, t, notify, onClose }: WorkspaceUI & { onClose: () => void }) {
  const blank = (): Draft => ({ name: t('newTemplate'), system_prompt: t('newTemplateSystem'), user_prompt: t('newTemplateUser'), is_default: false });
  const [draft, setDraft] = useState<Draft>(() => snapshot.templates[0] ? fromRecord(snapshot.templates[0]) : blank());
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deferred, setDeferred] = useState<(() => void) | null>(null);
  const dirty = baseline !== JSON.stringify(draft);
  const load = (next: Draft) => { setDraft(next); setBaseline(JSON.stringify(next)); };
  const guard = (action: () => void) => { if (busy) return; if (dirty) setDeferred(() => action); else action(); };
  const variables = [ ['concept', 'helpConcept'], ['selected_text', 'helpSelected'], ['parent_concept', 'helpParent'], ['map_title', 'helpMap'], ['context_markdown', 'helpContext'], ['language', 'helpLanguage'] ] as const;

  async function save() {
    if (![draft.name, draft.system_prompt, draft.user_prompt].every(value => value.trim())) { notify(t('requiredFields'), 'error'); return; }
    if (!draft.user_prompt.includes('{{concept}}')) { notify(t('conceptRequired'), 'error'); return; }
    setBusy(true);
    const result = await run<TemplateRecord>('template.save', { ...draft, name: draft.name.trim() }, t('saved'));
    setBusy(false);
    if (result.ok && result.value?.id) load(fromRecord(result.value));
  }

  return <><Modal title={t('templates')} onClose={() => guard(onClose)} testId="template-dialog" wide>
    <div className="template-layout"><aside className="template-sidebar" aria-label={t('templates')}>
      <div className="panel-heading"><h3>{t('templates')}</h3><IconButton icon={Plus} label={t('newTemplate')} disabled={busy} onClick={() => guard(() => load(blank()))} /></div>
      <div className="template-list">{snapshot.templates.filter(item => !item.deleted_at).map(item => <button type="button" key={item.id} className={`template-item ${draft.id === item.id ? 'active' : ''}`} aria-current={draft.id === item.id ? 'true' : undefined} onClick={() => guard(() => load(fromRecord(item)))}><span>{item.name}</span>{!!item.is_default && <Check size={14} aria-label={t('default')} />}</button>)}</div>
    </aside><form className="template-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="modal-body"><div className="panel-heading"><h3>{draft.id ? t('edit') : t('newTemplate')}</h3><div className="button-row">
        <IconButton icon={Copy} label={t('copy')} disabled={!draft.id || busy} onClick={() => guard(async () => { setBusy(true); const result = await run<TemplateRecord>('template.copy', { id: draft.id }, t('created')); setBusy(false); if (result.ok && result.value?.id) load(fromRecord(result.value)); })} />
        <IconButton icon={Trash2} label={t('delete')} disabled={!draft.id || busy} onClick={() => setDeleteOpen(true)} />
        <IconButton icon={HelpCircle} label={t('templateHelp')} onClick={() => setHelp(true)} />
      </div></div><fieldset disabled={busy}>
        <label className="field">{t('name')} *<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field">{t('systemPrompt')} *<textarea required rows={5} value={draft.system_prompt} onChange={event => setDraft({ ...draft, system_prompt: event.target.value })} /></label>
        <label className="field">{t('userPrompt')} *<textarea required rows={8} value={draft.user_prompt} onChange={event => setDraft({ ...draft, user_prompt: event.target.value })} /></label>
        <label className="check-field"><input type="checkbox" checked={draft.is_default} onChange={event => setDraft({ ...draft, is_default: event.target.checked })} />{t('defaultTemplate')}</label>
      </fieldset></div>
      <footer className="dialog-actions"><button type="button" disabled={busy} onClick={() => guard(onClose)}>{t('close')}</button><button type="submit" className="primary" disabled={busy}>{busy ? <Spinner /> : <Save size={15} />}{t('save')}</button></footer>
    </form></div>
  </Modal>
  {help && <Modal title={t('templateHelp')} onClose={() => setHelp(false)} testId="template-help-dialog"><div className="modal-body template-help"><p>{t('requiredFields')}</p><p>{t('conceptRequired')}</p><h3>{t('variables')}</h3><dl>{variables.map(([variable, description]) => <div key={variable}><dt><code>{`{{${variable}}}`}</code></dt><dd>{t(description)}</dd></div>)}</dl></div><footer className="dialog-actions"><button type="button" onClick={() => setHelp(false)}>{t('close')}</button></footer></Modal>}
  {deferred && <ConfirmDialog t={t} title={t('unsaved')} message={t('discardWarning')} confirm={t('discard')} onClose={() => setDeferred(null)} onConfirm={() => { const action = deferred; setDeferred(null); action(); }} />}
  {deleteOpen && <ConfirmDialog t={t} title={`${t('delete')} · ${draft.name}`} message={t('deleteWarning')} confirm={t('delete')} danger busy={busy} onClose={() => { if (!busy) setDeleteOpen(false); }} onConfirm={async () => {
    setBusy(true); const result = await run('template.delete', { id: draft.id }, t('movedTrash')); setBusy(false);
    if (result.ok) { const next = snapshot.templates.find(item => item.id !== draft.id); load(next ? fromRecord(next) : blank()); setDeleteOpen(false); }
  }} />}
  </>;
}
