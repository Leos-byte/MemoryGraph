import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultOpenAiPreset, modelPresets } from '../shared/models';
import { Config } from '../main/config';
import { apiGenerate } from '../main/ai';
import { secureEndpoint } from '../main/core';
import { translator } from '../renderer/i18n';

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); vi.unstubAllGlobals(); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'memgraph-models-test-')); roots.push(root);
  return new Config(root);
}

describe('documented model catalog', () => {
  it('includes the current GPT-6 choices and canonical DeepSeek ID without duplicates', () => {
    const ids = modelPresets.map(preset => preset.model);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'deepseek-flash', 'deepseek-v4-pro']));
    expect(ids).not.toContain('deepseek-v4.1-flash');
    expect(modelPresets.find(preset => preset.model === 'deepseek-flash')?.compatibilityAlias).not.toBe(true);
    expect(modelPresets.find(preset => preset.model === 'deepseek-v4-flash')?.compatibilityAlias).toBe(true);
  });

  it('uses the same current OpenAI default for a fresh configuration and authentication fallback', () => {
    expect(defaultOpenAiPreset.model).toBe('gpt-6.1-terra');
    expect(fixture().settings).toMatchObject({ baseUrl: defaultOpenAiPreset.baseUrl, model: defaultOpenAiPreset.model, apiMode: 'responses', authMode: 'api_key' });
  });

  it.each(['gpt-5.6-terra', 'deepseek-v4-flash', 'deepseek-v4-pro', 'TEST_ONLY_CUSTOM_FUTURE_MODEL'])('does not silently migrate a saved model: %s', model => {
    const config = fixture();
    config.save({ ...config.settings, model });
    expect(new Config(config.root).settings.model).toBe(model);
  });

  it('localizes the compatibility-alias label', () => {
    expect(translator('zh')('compatibilityAlias')).toBe('\u517c\u5bb9\u522b\u540d');
    expect(translator('en')('compatibilityAlias')).toBe('Compatibility alias');
  });

  it.each(modelPresets)('sends the exact model and protocol for $model without unsupported tuning fields', async preset => {
    const fetcher = vi.fn(async (_url: URL, _options: RequestInit) => new Response(JSON.stringify(preset.apiMode === 'responses'
      ? { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Test explanation' }] }] }
      : { choices: [{ message: { content: 'Test explanation', reasoning_content: 'Not an explanation' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const settings = { ...fixture().settings, baseUrl: preset.baseUrl, model: preset.model, apiMode: preset.apiMode };
    await expect(apiGenerate(settings, 'TEST_ONLY_MODEL_KEY', ['Test system', 'Test concept'], new AbortController().signal)).resolves.toBe('Test explanation');
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url.href).toBe(secureEndpoint(preset.baseUrl, preset.apiMode).href);
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe(preset.model);
    const messages = [{ role: 'system', content: 'Test system' }, { role: 'user', content: 'Test concept' }];
    expect(body[preset.apiMode === 'responses' ? 'input' : 'messages']).toEqual(messages);
    if (preset.apiMode === 'responses') expect(body.store).toBe(false);
    for (const field of ['temperature', 'top_p', 'logprobs', 'reasoning_effort']) expect(body).not.toHaveProperty(field);
    expect(options.redirect).toBe('error');
  });
});
