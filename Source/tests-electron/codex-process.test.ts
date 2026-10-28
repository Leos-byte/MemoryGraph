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

  it.each(['stdout', 'stderr'])('decodes split Chinese and emoji bytes on %s without replacement characters', async stream => {
    const output = vi.fn();
    const pending = runCodex(['login'], '', new AbortController().signal, output);
    const text = '\x1b[90m\u6388\u6743\u7801\uff1aTEST \u{1f642}\x1b[0m\n\u767b\u5f55\u6210\u529f';
    for (const byte of Buffer.from(text, 'utf8')) holder.child[stream].write(Buffer.from([byte]));
    holder.child[stream].end();
    holder.child.emit('close', 0);
    await expect(pending).resolves.toEqual({ output: '\u6388\u6743\u7801\uff1aTEST \u{1f642}\n\u767b\u5f55\u6210\u529f', code: 0 });
    expect(output).toHaveBeenLastCalledWith('\u6388\u6743\u7801\uff1aTEST \u{1f642}\n\u767b\u5f55\u6210\u529f');
    expect(output.mock.calls.every(([text]) => !text.includes('\ufffd'))).toBe(true);
  });

  it('keeps stdout and stderr decoders independent when partial characters interleave', async () => {
    const pending = runCodex(['login'], '', new AbortController().signal);
    const first = Buffer.from('\u4e2d'), second = Buffer.from('\u{1f642}');
    holder.child.stdout.write(first.subarray(0, 1));
    holder.child.stderr.write(second.subarray(0, 2));
    holder.child.stdout.write(first.subarray(1));
    holder.child.stderr.write(second.subarray(2));
    holder.child.emit('close', 0);
    await expect(pending).resolves.toEqual({ output: '\u4e2d\u{1f642}', code: 0 });
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
