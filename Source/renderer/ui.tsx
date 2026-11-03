import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X, type LucideIcon } from 'lucide-react';
import type { Notice } from './workspace';
import type { Translate } from './i18n';

export function IconButton({ icon: Icon, label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}><Icon size={16} aria-hidden="true" /></button>;
}

export function Spinner() { return <LoaderCircle className="spin" size={16} aria-hidden="true" />; }

export function Modal({ title, children, onClose, testId = 'dialog', wide = false }: { title: string; children: ReactNode; onClose: () => void; testId?: string; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const heading = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const focusable = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(item => item.getClientRects().length > 0);
    (element?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? focusable()[1] ?? element)?.focus();
    function keydown(event: KeyboardEvent) {
      if (Array.from(document.querySelectorAll('[data-modal]')).at(-1) !== element) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (!first) { event.preventDefault(); element?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return createPortal(<div className="modal-backdrop"><section ref={ref} role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1} data-modal data-testid={testId} className={`modal ${wide ? 'modal-wide' : ''}`}>
    <header className="modal-header"><h2 id={heading}>{title}</h2><IconButton icon={X} label={title + ' / Close'} onClick={onClose} /></header>
    {children}
  </section></div>, document.body);
}

export interface MenuItem { label: string; icon: LucideIcon; action: () => void; danger?: boolean; disabled?: boolean; separator?: boolean; shortcut?: string; requiresInput?: boolean }
export interface MenuProps { x: number; y: number; items: MenuItem[]; onClose: () => void; testId?: string; label?: string; trigger?: HTMLElement; focusLast?: boolean; onNavigate?: (direction: -1 | 1) => void }
export function Menu({ x, y, items, onClose, testId = 'context-menu', label, trigger, focusLast, onNavigate }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const search = useRef({ text: '', time: 0 });
  const [position, setPosition] = useState({ left: x, top: y });
  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  function focus(button?: HTMLButtonElement) { button?.focus(); button?.scrollIntoView({ block: 'nearest' }); }
  function dismiss() { previous.current?.isConnected && previous.current.focus({ preventScroll: true }); onClose(); }
  useLayoutEffect(() => {
    previous.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const rect = ref.current!.getBoundingClientRect();
    setPosition({ left: Math.max(6, Math.min(x, window.innerWidth - rect.width - 6)), top: Math.max(6, Math.min(y, window.innerHeight - rect.height - 6)) });
    search.current = { text: '', time: 0 };
    const enabled = buttons(); focus(focusLast ? enabled.at(-1) : enabled[0]);
  }, [x, y, items, trigger, focusLast]);
  useEffect(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const close = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-menu-trigger]')) return;
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    // Electron can emit a delayed resize notification without changing the viewport.
    const resize = () => { if (window.innerWidth !== viewport.width || window.innerHeight !== viewport.height) { previous.current?.focus({ preventScroll: true }); onClose(); } };
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('resize', resize); };
  }, [onClose]);
  return createPortal(<div role="menu" aria-label={label} id={testId} ref={ref} className="menu" style={position} data-testid={testId} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const enabled = buttons();
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') { event.stopPropagation(); if (event.key === 'Escape') event.preventDefault(); dismiss(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); focus(enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]); }
    if (event.key === 'Home') { event.preventDefault(); focus(enabled[0]); }
    if (event.key === 'End') { event.preventDefault(); focus(enabled.at(-1)); }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && onNavigate) { event.preventDefault(); onNavigate(event.key === 'ArrowLeft' ? -1 : 1); }
    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const letter = event.key.toLocaleLowerCase(), now = Date.now();
      const prefix = now - search.current.time < 700 ? search.current.text + letter : letter;
      const text = [...prefix].every(value => value === letter) ? letter : prefix;
      search.current = { text, time: now };
      const ordered = [...enabled.slice(index + 1), ...enabled.slice(0, index + 1)];
      focus(ordered.find(button => button.getAttribute('aria-label')?.toLocaleLowerCase().startsWith(text)));
      event.preventDefault();
    }
  }}>{items.map((item, i) => <div key={item.label} role="none">{i > 0 && item.separator && <div role="separator" className="menu-separator" />}<button type="button" role="menuitem" aria-label={item.label} aria-keyshortcuts={item.shortcut?.replace('Ctrl', 'Control')} disabled={item.disabled} className={item.danger ? 'danger-text' : ''} onPointerMove={event => { if (!item.disabled) event.currentTarget.focus({ preventScroll: true }); }} onClick={() => { dismiss(); item.action(); }}><span className="menu-icon"><item.icon size={16} aria-hidden="true" /></span><span className="menu-label">{item.label}{item.requiresInput && <span aria-hidden="true">...</span>}</span>{item.shortcut && <span className="menu-shortcut" aria-hidden="true">{item.shortcut}</span>}</button></div>)}</div>, document.body);
}

export function ConfirmDialog({ title, message, confirm, onConfirm, onClose, busy = false, danger = false, t }: { title: string; message: ReactNode; confirm?: string; onConfirm: () => void; onClose: () => void; busy?: boolean; danger?: boolean; t: Translate }) {
  return <Modal title={title} onClose={onClose} testId="confirm-dialog"><div className="modal-body"><p className="confirmation-copy">{message}</p></div><footer className="dialog-actions"><button type="button" onClick={onClose} disabled={busy}>{t('cancel')}</button><button type="button" className={danger ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirm ?? t('confirm')}</button></footer></Modal>;
}

export function Toasts({ notices, dismiss, t }: { notices: Notice[]; dismiss: (id: number) => void; t: Translate }) {
  return <div className="toasts" aria-live="polite" aria-relevant="additions">{notices.map(notice => {
    const Icon = notice.kind === 'error' ? AlertCircle : notice.kind === 'info' ? Info : CheckCircle2;
    return <div className={`toast toast-${notice.kind}`} key={notice.id} role={notice.kind === 'error' ? 'alert' : 'status'}><Icon size={18} aria-hidden="true" /><span>{notice.message}</span><IconButton icon={X} label={t('close')} onClick={() => dismiss(notice.id)} /></div>;
  })}</div>;
}
