import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySettings, Config } from '../main/config';
import { defaultTheme, isThemeId, resolveTheme, themeBackground, themeHtml, themes } from '../shared/themes';

const roots: string[] = [];
function fixture() { const root = mkdtempSync(join(tmpdir(), 'memgraph-theme-')); roots.push(root); return new Config(root); }
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('registered skins and compatible settings', () => {
  it('registers two distinct skins without changing the default', () => {
    expect(defaultTheme).toBe('calico'); expect(new Set(themes.map(t => t.id)).size).toBe(2);
    expect(isThemeId('snow-leopard')).toBe(true); expect(fixture().settings.theme).toBe('calico');
  });
  it.each([undefined, null, '', 'dark', 'unknown-future-skin', {}, '"><script>bad()</script>'])('normalizes only an invalid stored theme: %j', theme => {
    const config = fixture();
    writeFileSync(config.path, JSON.stringify({ ...config.settings, theme, model: 'keep-model', channel: 'beta' }));
    expect(new Config(config.root).settings).toMatchObject({ theme: 'calico', model: 'keep-model', channel: 'beta' });
    expect(resolveTheme(theme)).toBe('calico');
  });
  it('persists theme alone without changing credentials or other settings', async () => {
    const config = fixture(), before = { ...config.settings };
    const actions = { changeDirectory: vi.fn(async () => {}), storeKey: vi.fn(async () => {}) };
    await applySettings(config, { theme: 'snow-leopard' }, actions);
    expect(new Config(config.root).settings).toEqual({ ...before, theme: 'snow-leopard' });
    expect(actions.storeKey).not.toHaveBeenCalled();
    await applySettings(config, { model: 'later-model' }, actions);
    expect(new Config(config.root).settings.theme).toBe('snow-leopard');
  });
  it('rejects unknown requested themes before settings side effects', async () => {
    const config = fixture(), actions = { changeDirectory: vi.fn(async () => {}), storeKey: vi.fn(async () => {}) };
    await expect(applySettings(config, { theme: 'external-css' }, actions)).rejects.toThrow();
    expect(actions.changeDirectory).not.toHaveBeenCalled(); expect(config.settings.theme).toBe('calico');
  });
  it('keeps the last saved theme if an atomic write fails', async () => {
    const config = fixture(); config.save(config.settings);
    const previous = readFileSync(config.path, 'utf8');
    vi.spyOn(config, 'save').mockImplementationOnce(() => { throw new Error('synthetic disk failure'); });
    await expect(applySettings(config, { theme: 'snow-leopard' }, { changeDirectory: async () => {}, storeKey: async () => {} })).rejects.toThrow('disk failure');
    expect(readFileSync(config.path, 'utf8')).toBe(previous); expect(config.settings.theme).toBe('calico');
  });
  it('bootstraps only allowlisted IDs without touching security policy', () => {
    const html = '<html data-theme="calico"><meta content="script-src self"></html>';
    expect(themeHtml(html, 'snow-leopard')).toBe(html.replace('calico', 'snow-leopard'));
    expect(themeHtml(html, '"><script>bad()</script>')).toBe(html);
    expect(themeBackground('snow-leopard')).toBe('#F5F6F4');
  });
});
