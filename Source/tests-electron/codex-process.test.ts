import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ child: undefined as any }));
vi.mock('node:child_process', () => ({ spawn: vi.fn(() => holder.child) }));
vi.mock('node:fs', async original => ({
  ...await original<typeof import('node:fs')>(),
  existsSync: (path: string) => /[/\\]codex(?:\.exe)?$/.test(path),
}));
import { spawn } from 'node:child_process';
import { runCodex } from '../main/ai';

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  holder.child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    exitCode: null, signalCode: null, kill: vi.fn(() => true),
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('Codex process lifecycle', () => {
  it('does not spawn a process for an already cancelled request', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(runCodex(['login'], '', abort.signal)).rejects.toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('cleans output and removes termination timers after a normal exit', async () => {
    const output = vi.fn();
    const pending = runCodex(['login'], '', new AbortController().signal, output);
    holder.child.stdout.write('\x1b[90mDevice URL');
    holder.child.stdout.write('\x1b[0m\nCode');
    holder.child.emit('close', 0);
    await expect(pending).resolves.toEqual({ output: 'Device URL\nCode', code: 0 });
    expect(output).toHaveBeenLastCalledWith('Device URL\nCode');
    await vi.advanceTimersByTimeAsync(610000);
    expect(holder.child.kill).not.toHaveBeenCalled();
  });

  it('escalates cancellation if a process ignores termination and then clears timers', async () => {
    const abort = new AbortController();
    const pending = runCodex(['login'], '', abort.signal);
    const rejection = expect(pending).rejects.toThrow('Cancelled');
    abort.abort();
    expect(holder.child.kill).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(holder.child.kill).toHaveBeenLastCalledWith('SIGKILL');
    holder.child.emit('close', null);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears timers after a spawn error', async () => {
    const pending = runCodex(['login'], '', new AbortController().signal);
    const rejection = expect(pending).rejects.toThrow('Spawn failed');
    holder.child.emit('error', new Error('Spawn failed'));
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
