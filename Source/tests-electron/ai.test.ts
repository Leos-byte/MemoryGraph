import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGenerate, boundedText } from '../main/ai';
import type { Settings } from '../shared/types';
const settings = { baseUrl: 'https://provider.example', model: 'test', apiMode: 'responses' } as Settings;
afterEach(() => vi.unstubAllGlobals());
describe('model API adapter', () => {
  it('preserves system/user messages, authorization and no-store requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: '# Explanation' }] }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await apiGenerate(settings, 'test-key', ['system', 'user'], new AbortController().signal)).toBe('# Explanation');
    const options = fetcher.mock.calls[0][1]; expect(options.redirect).toBe('error'); expect(JSON.parse(options.body).store).toBe(false);
    expect(options.headers.Authorization).toBe('Bearer test-key');
  });
  it('redacts provider error messages and rejects empty or malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'wrong test-key' } }), { status: 401 })));
    await expect(apiGenerate(settings, 'test-key', ['system', 'user'], new AbortController().signal)).rejects.toThrow('[redacted]');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(apiGenerate(settings, 'key', ['', ''], new AbortController().signal)).rejects.toThrow('generated text');
  });
  it('limits streamed response size', async () => {
    const response = new Response(new Uint8Array(4 * 1024 * 1024 + 1));
    await expect(boundedText(response)).rejects.toThrow('4 MiB');
  });
  it('sends Chat Completions-compatible requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Compatible' } }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await apiGenerate({ ...settings, apiMode: 'chat_completions' }, 'key', ['system', 'user'], new AbortController().signal)).toBe('Compatible');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages).toHaveLength(2);
  });
});
