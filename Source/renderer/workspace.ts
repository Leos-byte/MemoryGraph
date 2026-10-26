import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, Snapshot } from '../shared/types';
import type { Translate } from './i18n';

export type ActionResult<T> = { ok: true; value: T } | { ok: false };
export type Run = <T = unknown>(command: Command, payload?: Record<string, unknown>, success?: string) => Promise<ActionResult<T>>;
export interface Notice { id: number; message: string; kind: 'success' | 'error' | 'info' }
export interface WorkspaceUI { snapshot: Snapshot; run: Run; t: Translate; notify: (message: string, kind?: Notice['kind']) => void }

export function useWorkspace(t: Translate) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const mapId = useRef<string | undefined>(undefined);
  const request = useRef(0);
  const noticeId = useRef(0);
  const active = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const translate = useRef(t);
  translate.current = t;

  const dismiss = useCallback((id: number) => setNotices(items => items.filter(item => item.id !== id)), []);
  const notify = useCallback((message: string, kind: Notice['kind'] = 'success') => {
    if (!active.current) return;
    const id = ++noticeId.current;
    setNotices(items => [...items.slice(-1), { id, message, kind }]);
    timers.current.push(setTimeout(() => dismiss(id), kind === 'error' ? 10000 : 4500));
  }, [dismiss]);

  const refresh = useCallback(async (id?: string) => {
    if (id !== undefined) mapId.current = id;
    const version = ++request.current;
    try {
      if (!window.memgraph) throw new Error(translate.current('bridgeMissing'));
      const value = await window.memgraph.invoke<Snapshot>('snapshot', mapId.current ? { mapId: mapId.current } : {});
      if (!active.current || version !== request.current) return;
      mapId.current = value.mapId ?? undefined;
      setSnapshot(value);
      setError('');
    } catch (cause) {
      if (!active.current || version !== request.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const run: Run = useCallback(async <T,>(command: Command, payload?: Record<string, unknown>, success?: string): Promise<ActionResult<T>> => {
    setPending(count => count + 1);
    try {
      if (!window.memgraph) throw new Error(translate.current('bridgeMissing'));
      const value = await window.memgraph.invoke<T>(command, payload);
      if (!['snapshot', 'codex.status', 'codex.login', 'data.choose', 'trash.list', 'external.open'].includes(command)) await refresh();
      if (success && value !== false && value !== null) notify(success);
      return { ok: true, value };
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : String(cause), 'error');
      return { ok: false };
    } finally {
      if (active.current) setPending(count => Math.max(0, count - 1));
    }
  }, [refresh, notify]);

  useEffect(() => {
    active.current = true;
    void refresh();
    const unsubscribe = window.memgraph?.onChange(() => { void refresh(); });
    return () => {
      active.current = false;
      request.current++;
      unsubscribe?.();
      timers.current.forEach(clearTimeout);
    };
  }, [refresh]);

  return { snapshot, error, pending, notices, dismiss, notify, refresh, run };
}
