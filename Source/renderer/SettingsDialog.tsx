import { useEffect, useState } from 'react';
import { Eye, EyeOff, FolderOpen, LogIn, RefreshCw, Save, Square } from 'lucide-react';
import type { LoginState, Settings } from '../shared/types';
import { defaultOpenAiPreset, modelPresets as presets } from '../shared/models';
import type { WorkspaceUI } from './workspace';
import { ConfirmDialog, IconButton, Modal, Spinner } from './ui';

const loginLabels = { running: 'loginWaiting', succeeded: 'loginCompleted', failed: 'loginFailed', cancelled: 'loginCancelled', timed_out: 'loginTimedOut' } as const;

export function SettingsDialog({ snapshot, run, t, notify, onClose, onUpdates }: WorkspaceUI & { onClose: () => void; onUpdates: () => void }) {
  const [form, setForm] = useState<Settings>({ ...snapshot.settings });
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<LoginState>({ status: 'idle', output: '', revision: 0 });
  const [loginStarting, setLoginStarting] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(snapshot.settings) || !!apiKey || clearKey;
  const loginBusy = loginStarting || login.status === 'running';
  const acceptLogin = (next: LoginState) => setLogin(current => next.revision >= current.revision ? next : current);
  const close = () => { if (busy) return; if (dirty) setDiscard(true); else onClose(); };
  useEffect(() => {
    let active = true;
    const receive = (next: LoginState) => { if (active) setLogin(current => next.revision >= current.revision ? next : current); };
    const unsubscribe = window.memgraph.onLogin(receive);
    void run<LoginState>('codex.loginState').then(result => { if (result.ok) receive(result.value); });
    return () => { active = false; unsubscribe(); };
  }, [run]);
  useEffect(() => {
    if (login.status !== 'succeeded') return;
    let active = true;
    void run<string>('codex.status').then(result => { if (active && result.ok) setLoginStatus(result.value); });
    return () => { active = false; };
  }, [login.status, run]);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm(current => ({ ...current, [key]: value }));
  const preset = presets.findIndex(item => item.baseUrl === form.baseUrl.replace(/\/$/, '') && item.model === form.model && item.apiMode === form.apiMode);
  let originChanged = false;
  try { originChanged = new URL(form.baseUrl).origin !== new URL(snapshot.settings.baseUrl).origin; } catch { /* URL validation is shown on save. */ }

  async function save() {
    try {
      const url = new URL(form.baseUrl);
      if (url.protocol !== 'https:') throw new Error();
      if (form.authMode === 'chatgpt_login' && (url.origin !== 'https://api.openai.com' || form.apiMode !== 'responses')) { notify(t('chatgptRequiresOpenAi'), 'error'); return; }
    } catch { notify(t('invalidUrl'), 'error'); return; }
    setBusy(true);
    const result = await run('settings.save', { ...form, baseUrl: form.baseUrl.trim(), model: form.model.trim(), ...(apiKey.trim() && !clearKey ? { apiKey: apiKey.trim() } : {}), clearKey: clearKey || originChanged }, t('saved'));
    setBusy(false);
    if (result.ok) { setApiKey(''); onClose(); }
  }

  return <><Modal title={t('settings')} onClose={close} testId="settings-dialog" wide>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="modal-body settings-body"><fieldset disabled={busy}>
        <h3>{t('api')}</h3>
        <label className="field">{t('preset')}<select value={preset < 0 ? 'custom' : preset} onChange={event => { const chosen = presets[Number(event.target.value)]; if (chosen) setForm(current => ({ ...current, baseUrl: chosen.baseUrl, model: chosen.model, apiMode: chosen.apiMode, authMode: chosen.baseUrl === 'https://api.deepseek.com' ? 'api_key' : current.authMode })); }}><option value="custom">{t('custom')}</option>{presets.map((item, index) => <option key={item.name} value={index}>{item.name}{item.compatibilityAlias ? ` (${t('compatibilityAlias')})` : ''}</option>)}</select></label>
        <div className="form-grid"><label className="field">{t('authMode')}<select value={form.authMode} onChange={event => { const authMode = event.target.value as Settings['authMode']; if (authMode === 'chatgpt_login') { let official = false; try { official = new URL(form.baseUrl).origin === 'https://api.openai.com'; } catch { /* Use the official preset for invalid origins. */ } setForm(current => ({ ...current, authMode, ...(official ? { apiMode: 'responses' } : { baseUrl: defaultOpenAiPreset.baseUrl, model: defaultOpenAiPreset.model, apiMode: 'responses' }) })); } else update('authMode', authMode); }}><option value="api_key">{t('apiKey')}</option><option value="chatgpt_login">{t('chatgpt')}</option></select></label>
          <label className="field">{t('apiMode')}<select value={form.apiMode} onChange={event => update('apiMode', event.target.value as Settings['apiMode'])}><option value="responses">Responses API</option><option value="chat_completions">Chat Completions</option></select></label></div>
        <label className="field">{t('baseUrl')}<input type="url" required value={form.baseUrl} onChange={event => update('baseUrl', event.target.value)} /></label>
        <label className="field">{t('model')}<input required value={form.model} onChange={event => update('model', event.target.value)} /></label>
        {form.authMode === 'api_key' ? <>
          <label className="field">{t('apiKey')}<span className="input-action"><input type={showKey ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={apiKey} disabled={clearKey} placeholder={t('replaceKey')} onChange={event => setApiKey(event.target.value)} /><IconButton icon={showKey ? EyeOff : Eye} label={t(showKey ? 'hideKey' : 'showKey')} onClick={() => setShowKey(!showKey)} /></span></label>
          {originChanged ? <p className="inline-warning">{t('originChanged')}</p> : <div className={`key-state ${snapshot.hasKey ? 'success-text' : 'muted'}`}>{snapshot.hasKey ? t(snapshot.keyPersistent ? 'keyStored' : 'keySession') : t('keyMissing')}</div>}
          <label className="check-field"><input type="checkbox" checked={clearKey} onChange={event => { setClearKey(event.target.checked); setApiKey(''); }} />{t('clearKey')}</label>
        </> : <div className="login-section"><div className="button-row"><button type="button" disabled={loginBusy} onClick={async () => { setLoginStarting(true); setLoginStatus(''); try { const result = await run<LoginState>('codex.login'); if (result.ok) acceptLogin(result.value); } finally { setLoginStarting(false); } }}>{loginBusy ? <Spinner /> : <LogIn size={15} />}{t('login')}</button>{login.status === 'running' && <button type="button" onClick={async () => { const result = await run<LoginState>('codex.cancelLogin'); if (result.ok) acceptLogin(result.value); }}><Square size={15} />{t('cancelLogin')}</button>}<button type="button" disabled={checkingLogin} onClick={async () => { setCheckingLogin(true); try { const result = await run<string>('codex.status'); if (result.ok) setLoginStatus(result.value); } finally { setCheckingLogin(false); } }}>{checkingLogin ? <Spinner /> : <RefreshCw size={15} />}{t('checkStatus')}</button></div>
          {login.status !== 'idle' && <p className="login-status" data-testid="login-state" role="status">{t(loginLabels[login.status])}</p>}
          {loginStatus && <p className="login-status" role="status">{loginStatus}</p>}
          {login.output && <pre className="login-output" aria-label={t('loginOutput')} aria-live="polite">{login.output.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} onClick={event => { event.preventDefault(); void run('external.open', { url: part }); }}>{part}</a> : part)}</pre>}
        </div>}
        <h3 className="section-heading">{t('general')}</h3>
        <label className="field">{t('language')}<select value={form.language} onChange={event => update('language', event.target.value as Settings['language'])}><option value="system">{t('system')}</option><option value="zh_CN">简体中文</option><option value="en_US">English</option></select></label>
        <label className="check-field"><input type="checkbox" checked={form.autoGenerate} onChange={event => update('autoGenerate', event.target.checked)} />{t('autoGenerate')}</label>
        <label className="field">{t('directory')}<span className="input-action"><input readOnly value={form.dataDirectory} /><IconButton icon={FolderOpen} label={t('chooseDirectory')} onClick={async () => { const result = await run<string | null>('data.choose'); if (result.ok && result.value) update('dataDirectory', result.value); }} /></span></label>
        <h3 className="section-heading">{t('softwareUpdates')}</h3>
        <label className="field">{t('updateMode')}<select value={form.updateMode} onChange={event => update('updateMode', event.target.value as Settings['updateMode'])}><option value="manual">{t('updateManual')}</option><option value="notify">{t('updateNotify')}</option><option value="download">{t('updateAutoDownload')}</option></select></label>
        <label className="check-field"><input type="checkbox" checked={form.channel === 'beta'} onChange={event => update('channel', event.target.checked ? 'beta' : 'stable')} />{t('beta')}</label>
        <div className="button-row"><button type="button" disabled={dirty} onClick={onUpdates}><RefreshCw size={15} />{t('updates')}</button></div>
      </fieldset></div>
      <footer className="dialog-actions"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="primary" type="submit" disabled={busy}>{busy ? <Spinner /> : <Save size={15} />}{t('save')}</button></footer>
    </form>
  </Modal>{discard && <ConfirmDialog t={t} title={t('unsaved')} message={t('discardWarning')} confirm={t('discard')} onConfirm={onClose} onClose={() => setDiscard(false)} />}</>;
}
