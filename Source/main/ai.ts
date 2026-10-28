import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { secureEndpoint, stripTerminal } from './core';
import type { Settings } from '../shared/types';

const LIMIT = 4 * 1024 * 1024;
export async function boundedText(response: Response, signal?: AbortSignal) {
  const reader = response.body?.getReader(); if (!reader) return '';
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) { signal?.throwIfAborted(); const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > LIMIT) throw new Error('Response exceeded 4 MiB.'); chunks.push(value); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}
export async function apiGenerate(settings: Settings, key: string, prompts: [string, string], signal: AbortSignal) {
  if (!key.trim()) throw new Error('Open Settings and enter an API key first.');
  const messages = [{ role: 'system', content: prompts[0] }, { role: 'user', content: prompts[1] }];
  const response = await fetch(secureEndpoint(settings.baseUrl, settings.apiMode), {
    method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(settings.apiMode === 'responses' ? { model: settings.model, input: messages, store: false } : { model: settings.model, messages })
  });
  const raw = await boundedText(response, signal);
  let data: Record<string, any>;
  try { data = JSON.parse(raw); } catch { throw new Error(`HTTP ${response.status}: Invalid JSON response.`); }
  if (!response.ok || data.error) throw new Error(`HTTP ${response.status}: ${String(data.error?.message || response.statusText).replaceAll(key, '[redacted]').slice(0, 3000)}`);
  const text = settings.apiMode === 'responses' ? data.output_text || data.output?.flatMap((item: any) => item.content || []).filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join('\n\n') : data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('The response did not contain generated text.');
  return stripTerminal(text).trim();
}
export function codexExecutable(): { executable: string; prefix: string[] } {
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    if (!directory) continue;
    const native = join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex');
    if (process.platform !== 'win32' && existsSync(native)) return { executable: native, prefix: [] };
    if (process.platform === 'win32') {
      if (existsSync(native)) return { executable: native, prefix: [] };
      const entry = join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(entry)) {
        for (const nodeDirectory of (process.env.PATH || '').split(delimiter)) {
          const node = join(nodeDirectory, 'node.exe'); if (existsSync(node)) return { executable: node, prefix: [entry] };
        }
      }
    }
  }
  throw new Error('Codex CLI not found. Install: npm install -g @openai/codex');
}
export function runCodex(args: string[], input: string, signal: AbortSignal, onOutput?: (text: string) => void, cwd?: string): Promise<{ output: string; code: number }> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const command = codexExecutable();
    const processEnv: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', CLICOLOR: '0', TERM: 'dumb' }; delete processEnv.ELECTRON_RUN_AS_NODE;
    const child: ChildProcessWithoutNullStreams = spawn(command.executable, [...command.prefix, ...args], { cwd: cwd || tmpdir(), env: processEnv, shell: false, windowsHide: true });
    let rawOutput = '';
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (child.exitCode !== null || child.signalCode !== null || killTimer) return;
      child.kill();
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
      killTimer.unref();
    };
    const timeout = setTimeout(stop, 600000);
    const abort = stop; signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) stop();
    const append = (chunk: string) => { rawOutput = (rawOutput + chunk).slice(-16384); onOutput?.(stripTerminal(rawOutput)); };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', append); child.stderr.on('data', append);
    child.stdin.on('error', () => {}); child.stdin.end(input);
    const cleanup = () => { clearTimeout(timeout); if (killTimer) clearTimeout(killTimer); signal.removeEventListener('abort', abort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => { cleanup(); if (signal.aborted) reject(new Error('Cancelled')); else resolve({ output: stripTerminal(rawOutput), code: code ?? -1 }); });
  });
}
export async function codexGenerate(model: string, prompts: [string, string], signal: AbortSignal) {
  const directory = mkdtempSync(join(tmpdir(), 'memgraph-codex-')); const output = join(directory, 'answer.md');
  const disabled = ['shell_tool', 'shell_snapshot', 'apps', 'plugins', 'remote_plugin', 'hooks', 'multi_agent', 'multi_agent_v2', 'browser_use', 'computer_use', 'code_mode', 'code_mode_host', 'view_image', 'image_generation'];
  const args = ['exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never', '--model', model, '-c', 'approval_policy="never"', '-c', 'web_search="disabled"', '-c', 'tools.view_image=false', '-c', 'shell_environment_policy.inherit="none"', ...disabled.flatMap(name => ['-c', `features.${name}=false`]), '--output-last-message', output, '-'];
  try {
    const result = await runCodex(args, `Return only the requested Markdown. Do not read files, execute commands, call tools, or use emoji.\n\nSYSTEM:\n${prompts[0]}\n\nUSER:\n${prompts[1]}`, signal, undefined, directory);
    if (result.code !== 0) throw new Error(result.output || 'Codex generation failed.');
    if (!existsSync(output) || statSync(output).size > LIMIT) throw new Error('Codex output is missing or too large.');
    const markdown = stripTerminal(readFileSync(output, 'utf8')).trim(); if (!markdown) throw new Error('Empty Codex response.'); return markdown;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
