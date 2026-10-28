import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySettings, Config, legacyInfo, validateSettings } from '../main/config';
import { apiGenerate } from '../main/ai';

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'memgraph-settings-test-')); roots.push(root);
  const config = new Config(root);
  const credential = join(root, 'test-only-credential');
  let key = 'TEST_ONLY_OLD_PROVIDER_KEY';
  writeFileSync(credential, key, { mode: 0o600 });
  const actions = {
    changeDirectory: vi.fn(async (_directory: string) => {}),
    storeKey: vi.fn(async (value: string) => {
      key = value;
      if (value) writeFileSync(credential, value, { mode: 0o600 });
      else if (existsSync(credential)) unlinkSync(credential);
    }),
  };
  return { config, credential, actions, key: () => key };
}

describe('shared settings and legacy-import policy', () => {
  it('clears memory and persisted credentials before adopting another provider', async () => {
    const { config, credential, actions, key } = fixture();
    const imported = validateSettings({ ...config.settings, baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro', apiMode: 'chat_completions' });
    const save = vi.spyOn(config, 'save').mockImplementation(settings => {
      expect(key()).toBe('');
      expect(existsSync(credential)).toBe(false);
      config.settings = settings;
    });
    await applySettings(config, { ...imported }, actions);
    expect(save).toHaveBeenCalledOnce();
    expect(config.settings.baseUrl).toBe('https://api.deepseek.com');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(apiGenerate(config.settings, key(), ['', ''], new AbortController().signal)).rejects.toThrow('API key');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('persists imported settings without copying an API key into settings.json', async () => {
    const { config, credential, actions, key } = fixture();
    await applySettings(config, { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiMode: 'chat_completions' }, actions);
    expect(key()).toBe(''); expect(existsSync(credential)).toBe(false);
    const saved = readFileSync(config.path, 'utf8');
    expect(JSON.parse(saved).baseUrl).toBe('https://api.deepseek.com');
    expect(saved).not.toContain('TEST_ONLY_OLD_PROVIDER_KEY');
  });

  it.skipIf(process.platform === 'win32')('applies the same policy to provider settings parsed from a Qt configuration', async () => {
    const { config, credential, actions, key } = fixture();
    const configHome = join(config.root, 'qt-config'), dataHome = join(config.root, 'qt-data');
    mkdirSync(join(configHome, 'MemGraph'), { recursive: true });
    mkdirSync(join(dataHome, 'MemGraph', 'MemGraph'), { recursive: true });
    writeFileSync(join(configHome, 'MemGraph', 'MemGraph.conf'), '[api]\nbase_url=https://api.deepseek.com\nmodel=deepseek-v4-pro\nmode=chat_completions\nauth_mode=api_key\n');
    writeFileSync(join(dataHome, 'MemGraph', 'MemGraph', 'memgraph.sqlite3'), 'test-only path fixture');
    vi.stubEnv('XDG_CONFIG_HOME', configHome); vi.stubEnv('XDG_DATA_HOME', dataHome);
    const legacy = legacyInfo();
    expect(legacy.database).toBe(join(dataHome, 'MemGraph', 'MemGraph', 'memgraph.sqlite3'));
    const imported = validateSettings({ ...config.settings, ...legacy.settings });
    await applySettings(config, { ...imported }, actions);
    expect(config.settings.baseUrl).toBe('https://api.deepseek.com');
    expect(key()).toBe(''); expect(existsSync(credential)).toBe(false);
  });

  it('keeps credentials for the same origin, including a different API path', async () => {
    const { config, credential, actions, key } = fixture();
    await applySettings(config, { baseUrl: 'https://API.OPENAI.COM:443/custom', model: 'custom-model' }, actions);
    expect(key()).toBe('TEST_ONLY_OLD_PROVIDER_KEY');
    expect(existsSync(credential)).toBe(true);
    expect(actions.storeKey).not.toHaveBeenCalled();
  });

  it('clears the old credential before storing an explicitly supplied replacement', async () => {
    const { config, credential, actions, key } = fixture();
    await applySettings(config, { baseUrl: 'https://api.deepseek.com', apiMode: 'chat_completions', apiKey: ' TEST_ONLY_NEW_PROVIDER_KEY ' }, actions);
    expect(actions.storeKey.mock.calls.map(call => call[0])).toEqual(['', 'TEST_ONLY_NEW_PROVIDER_KEY']);
    expect(key()).toBe('TEST_ONLY_NEW_PROVIDER_KEY');
    expect(readFileSync(credential, 'utf8')).toBe('TEST_ONLY_NEW_PROVIDER_KEY');
    expect(readFileSync(config.path, 'utf8')).not.toContain('TEST_ONLY_NEW_PROVIDER_KEY');
  });

  it('honors explicit clearing on the same origin', async () => {
    const { config, actions, key } = fixture();
    await applySettings(config, { clearKey: true }, actions);
    expect(key()).toBe('');
  });

  it.each([
    { baseUrl: 'http://provider.example' },
    { baseUrl: 'https://user:password@provider.example' },
    { baseUrl: 'https://provider.example/?key=secret' },
    { baseUrl: 'https://api.deepseek.com', authMode: 'chatgpt_login' },
    { authMode: 'chatgpt_login', apiMode: 'chat_completions' },
    { apiKey: 42 },
    { apiKey: 'x'.repeat(4097) },
  ])('rejects invalid imported/saved values before any side effect: %o', async changes => {
    const { config, credential, actions, key } = fixture();
    const before = { ...config.settings };
    await expect(applySettings(config, changes, actions)).rejects.toThrow();
    expect(config.settings).toEqual(before); expect(key()).toBe('TEST_ONLY_OLD_PROVIDER_KEY');
    expect(existsSync(credential)).toBe(true); expect(existsSync(config.path)).toBe(false);
    expect(actions.changeDirectory).not.toHaveBeenCalled(); expect(actions.storeKey).not.toHaveBeenCalled();
  });

  it('does not clear credentials if switching the data directory fails', async () => {
    const { config, actions, key } = fixture();
    actions.changeDirectory.mockRejectedValueOnce(new Error('Directory unavailable'));
    await expect(applySettings(config, { baseUrl: 'https://api.deepseek.com' }, actions)).rejects.toThrow('Directory unavailable');
    expect(config.settings.baseUrl).toBe('https://api.openai.com');
    expect(key()).toBe('TEST_ONLY_OLD_PROVIDER_KEY'); expect(actions.storeKey).not.toHaveBeenCalled();
  });
});
