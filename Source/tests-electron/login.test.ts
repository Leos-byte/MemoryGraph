import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginSession } from '../main/login';

const sessions: LoginSession[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { sessions.splice(0).forEach(session => session.cancel()); vi.useRealTimers(); });
function setup(timeout = 600000) {
  const attempts: { signal: AbortSignal; output: (text: string) => void; resolve: (result: { code: number; output: string }) => void; reject: (error: Error) => void }[] = [];
  const run = vi.fn((signal: AbortSignal, output: (text: string) => void) => new Promise<{ code: number; output: string }>((resolve, reject) => attempts.push({ signal, output, resolve, reject })));
  const notify = vi.fn();
  const session = new LoginSession(run, notify, timeout);
  sessions.push(session);
  return { session, attempts, run, notify };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('application-owned Codex login session', () => {
  it('reuses a running login instead of spawning another process or throwing', async () => {
    const { session, run } = setup();
    expect(session.state.status).toBe('idle');
    const first = session.start();
    expect(first.status).toBe('running');
    expect(session.start()).toEqual(first);
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(session.start().status).toBe('running');
  });

  it('retains cumulative output for reopening settings without duplicating text', async () => {
    const { session, attempts } = setup();
    session.start(); await flush();
    attempts[0].output('Open device URL');
    attempts[0].output('Open device URL\nCode: TEST');
    expect(session.state.output).toBe('Open device URL\nCode: TEST');
    expect(session.start()).toEqual(session.state);
    const revision = session.state.revision;
    attempts[0].resolve({ code: 0, output: 'Logged in' }); await flush();
    expect(session.state).toMatchObject({ status: 'succeeded', output: 'Logged in' });
    expect(session.state.revision).toBeGreaterThan(revision);
  });

  it('cancels immediately and ignores late output and exit from the previous login', async () => {
    const { session, attempts } = setup();
    session.start(); await flush();
    expect(session.cancel().status).toBe('cancelled');
    expect(attempts[0].signal.aborted).toBe(true);
    session.start(); await flush();
    attempts[1].output('New authorization code');
    attempts[0].output('Old code');
    attempts[0].resolve({ code: 0, output: 'Old completion' }); await flush();
    expect(session.state).toMatchObject({ status: 'running', output: 'New authorization code' });
    expect(attempts[1].signal.aborted).toBe(false);
  });

  it('times out a hung process and permits a new attempt without extending the old deadline', async () => {
    const { session, attempts } = setup(1000);
    session.start(); await flush();
    await vi.advanceTimersByTimeAsync(900);
    session.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(session.state.status).toBe('timed_out');
    expect(attempts[0].signal.aborted).toBe(true);
    session.start(); await flush();
    attempts[0].reject(new Error('Old cancellation')); await flush();
    expect(session.state.status).toBe('running');
    expect(attempts).toHaveLength(2);
  });

  it('clears the timeout on completion and allows retry after nonzero exit or rejection', async () => {
    const { session, attempts } = setup(1000);
    session.start(); await flush();
    attempts[0].resolve({ code: 1, output: 'Authorization denied' }); await flush();
    expect(session.state.status).toBe('failed');
    session.start(); await flush();
    attempts[1].reject(new Error('CLI unavailable')); await flush();
    expect(session.state).toMatchObject({ status: 'failed', output: 'CLI unavailable' });
    session.start(); await flush();
    attempts[2].resolve({ code: 0, output: 'Success' }); await flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(session.state.status).toBe('succeeded');
  });

  it('handles cancellation before the process starts and synchronous runner failure', async () => {
    const { session, run } = setup();
    session.start(); session.cancel(); await flush();
    expect(run).not.toHaveBeenCalled();
    const broken = new LoginSession(() => { throw new Error('Spawn failed'); }, vi.fn());
    sessions.push(broken); broken.start(); await flush();
    expect(broken.state).toMatchObject({ status: 'failed', output: 'Spawn failed' });
  });

  it('bounds retained output and returns state copies', async () => {
    const { session, attempts } = setup();
    session.start(); await flush();
    attempts[0].output('x'.repeat(30000));
    const state = session.state;
    expect(state.output).toHaveLength(24000);
    state.status = 'idle';
    expect(session.state.status).toBe('running');
  });
});
