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

export interface MenuItem { label: string; icon: LucideIcon; action: () => void; danger?: boolean; disabled?: boolean; separator?: boolean }
export function Menu({ x, y, items, onClose, testId = 'context-menu' }: { x: number; y: number; items: MenuItem[]; onClose: () => void; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const rect = ref.current!.getBoundingClientRect();
    setPosition({ left: Math.max(6, Math.min(x, window.innerWidth - rect.width - 6)), top: Math.max(6, Math.min(y, window.innerHeight - rect.height - 6)) });
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const resize = () => onClose();
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('resize', resize); if (document.activeElement === document.body) previous?.focus(); };
  }, [onClose]);
  return createPortal(<div role="menu" ref={ref} className="menu" style={position} data-testid={testId} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const items = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); onClose(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
  }}>{items.map((item, i) => <div key={i}>{item.separator && <div role="separator" className="menu-separator" />}<button type="button" role="menuitem" disabled={item.disabled} className={item.danger ? 'danger-text' : ''} onClick={() => { onClose(); item.action(); }}><item.icon size={15} aria-hidden="true" /><span>{item.label}</span></button></div>)}</div>, document.body);
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
