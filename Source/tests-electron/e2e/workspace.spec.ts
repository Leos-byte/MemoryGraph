import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import type { Command, LoginState, NodeRecord, Snapshot, Trash, UpdateState } from '../../shared/types';

let application: ElectronApplication;
let page: Page;
let root: string;
let updateWindowId: number;
async function invoke<T = any>(command: Command, payload: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(({ command, payload }) => window.memgraph.invoke<T>(command, payload), { command, payload });
}

// Exercise update controls without replacing an installed executable or accessing GitHub.
async function mountUpdateRenderer(state: Partial<UpdateState>, values: Partial<Snapshot> = {}) {
  const snapshot = await invoke<Snapshot>('snapshot');
  Object.assign(snapshot, values);
  snapshot.updates = { ...snapshot.updates, supported: true, ...state };
  const preload = join(root, 'update-renderer-preload.cjs');
  writeFileSync(preload, `
const { contextBridge, ipcRenderer } = require('electron');
const snapshot = ${JSON.stringify(snapshot)};
const calls = [], listeners = new Set();
const change = values => { snapshot.updates = { ...snapshot.updates, ...values }; for (const fn of listeners) fn(); };
ipcRenderer.on('memgraph-test:update', (_event, values) => change(values));
contextBridge.exposeInMainWorld('memgraph', {
  invoke: async (command, payload = {}) => {
    if (command === 'snapshot') return { ...snapshot, testCalls: [...calls] };
    calls.push(command);
    if (command === 'updates.download') change({ status: 'downloading', percent: 42 });
    if (command === 'updates.install') change({ status: 'installing' });
    if (command === 'updates.check' && snapshot.updates.status !== 'downloaded') change({ status: 'upToDate', message: undefined });
    if (command === 'settings.save') { Object.assign(snapshot.settings, payload); change({}); }
  },
  onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
  onLogin: () => () => {}, onGenerationError: () => () => {},
});
`);
  const opened = application.waitForEvent('window');
  updateWindowId = await application.evaluate(async ({ BrowserWindow }, preload) => {
    const window = new BrowserWindow({ width: 1360, height: 840, webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false } });
    window.removeMenu(); await window.loadURL('memgraph://app/index.html'); return window.id;
  }, preload);
  page = await opened;
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('concept-input')).toBeVisible();
}
async function setRendererUpdate(state: Partial<UpdateState>) {
  await application.evaluate(({ BrowserWindow }, { id, state }) => { BrowserWindow.fromId(id)!.webContents.send('memgraph-test:update', state); }, { id: updateWindowId, state });
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).updates.status).toBe(state.status);
}
test.beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'memgraph-e2e-'));
  const environment = { ...process.env, MEMGRAPH_TEST_MODE: '1', MEMGRAPH_TEST_ROOT: root, MEMGRAPH_MOCK_AI: '1' } as Record<string, string>;
  const fakeBin = join(root, 'fake-bin');
  const cli = process.platform === 'win32' ? join(fakeBin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js') : join(fakeBin, 'codex');
  mkdirSync(process.platform === 'win32' ? join(fakeBin, 'node_modules', '@openai', 'codex', 'bin') : fakeBin, { recursive: true });
  writeFileSync(cli, `#!/usr/bin/env node
const { appendFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = ${JSON.stringify(root)};
if (!process.argv.includes('--device-auth')) process.exit(1);
appendFileSync(join(root, 'login-starts'), 'start\\n');
console.log('Open https://auth.example.test/device');
setTimeout(() => console.log('Authorization code: TEST-ONLY'), 50);
const timer = setInterval(() => { if (existsSync(join(root, 'finish-login'))) { clearInterval(timer); console.log('Logged in'); process.exit(0); } }, 50);
process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
`, { mode: 0o755 });
  const currentPath = process.env.PATH || process.env.Path || '';
  for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
  environment.PATH = fakeBin + delimiter + currentPath;
  delete environment.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ args: [...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless'] : []), resolve('.')], env: environment });
  page = await application.firstWindow();
  page.on('pageerror', error => console.error('Renderer error:', error.stack));
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.bringToFront();
  await expect(page.getByTestId('concept-input')).toBeVisible();
  await invoke('settings.save', { language: 'en_US', apiKey: 'test-key' });
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});
test.afterEach(async () => { await application?.close(); rmSync(root, { recursive: true, force: true }); });

test('create, generate, expand and regenerate without losing the parent connection', async () => {
  await page.getByRole('button', { name: 'New map', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Memory science');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('map-item')).toContainText('Memory science');
  await page.getByTestId('concept-input').fill('Memory');
  await page.getByTestId('generate').click();
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).nodes[0]?.status).toBe('ready');
  await expect(page.getByTestId('markdown')).toContainText('test explanation');
  await page.getByTestId('markdown').getByText('encoding', { exact: true }).evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.getByTestId('markdown').getByText('encoding', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create linked node' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).nodes.length).toBe(2);
  let snapshot = await invoke<Snapshot>('snapshot');
  const child = snapshot.nodes.find(node => node.title === 'encoding')!;
  expect(snapshot.edges).toHaveLength(1);
  expect(child.status).not.toBe('generating');
  await expect(page.getByTestId('concept-input')).toHaveValue('encoding');
  await page.getByTestId('generate').click();
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).busy.length).toBe(0);
  snapshot = await invoke<Snapshot>('snapshot');
  expect(snapshot.nodes).toHaveLength(2); expect(snapshot.edges[0].target_node_id).toBe(child.id);
  await invoke('edge.updateRelation', { sourceId: snapshot.nodes.find(node => node.id !== child.id)!.id, targetId: child.id });
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).busy.length).toBe(0);
  snapshot = await invoke<Snapshot>('snapshot');
  expect(snapshot.nodes.find(node => node.id !== child.id)!.markdown).toContain(`memgraph-relation:${child.id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/workspace-desktop.png' });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: 'test-results/workspace-narrow.png' });
});

test('failed database import leaves existing data available and preserves a recovery snapshot', async () => {
  const map = await invoke('map.create', { title: 'Keep this map' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Keep this concept' });
  const invalid = join(root, 'invalid.sqlite3'); writeFileSync(invalid, 'not a SQLite database');
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, invalid);
  await expect(invoke('data.import')).rejects.toThrow();
  const snapshot = await invoke<Snapshot>('snapshot');
  expect(snapshot.maps.map(item => item.title)).toContain('Keep this map');
  expect(snapshot.nodes.find(item => item.id === node.id)?.title).toBe('Keep this concept');
  expect(existsSync(join(root, 'data', 'backups'))).toBe(true);
});

test('map actions have one entry point and recycle bin restores deleted content', async () => {
  const map = await invoke('map.create', { title: 'Recovery test' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Encoding' });
  await expect(page.getByTestId('map-item')).toBeVisible();
  await page.getByTestId('map-item').click({ button: 'right' });
  const menu = page.getByTestId('map-menu');
  await expect(menu.getByRole('menuitem', { name: 'Rename', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Export Markdown', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'File', exact: false }).first().click();
  await expect(page.getByTestId('file-menu').getByRole('menuitem', { name: 'Recycle bin' })).toBeVisible();
  await expect(page.getByTestId('file-menu').getByRole('menuitem', { name: 'Export Markdown' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await invoke('node.delete', { id: node.id }); expect((await invoke<Trash>('trash.list')).nodes).toHaveLength(1);
  await invoke('trash.restore', { kind: 'nodes', id: node.id }); expect((await invoke<Snapshot>('snapshot')).nodes).toHaveLength(1);
  await invoke('map.delete', { id: map.id }); expect((await invoke<Snapshot>('snapshot')).maps).toHaveLength(0);
  await invoke('trash.restore', { kind: 'maps', id: map.id }); expect((await invoke<Snapshot>('snapshot')).nodes).toHaveLength(1);
});

test('switching databases cancels pending work and preserves both databases', async () => {
  const map = await invoke('map.create', { title: 'Original' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Pending' });
  await invoke('node.generate', { id: node.id });
  const directory = join(root, 'second');
  await invoke('settings.save', { dataDirectory: directory });
  const nextMap = await invoke('map.create', { title: 'Second database' });
  const nextNode = await invoke<NodeRecord>('node.create', { mapId: nextMap.id, title: 'Do not overwrite' });
  await page.waitForTimeout(350);
  const snapshot = await invoke<Snapshot>('snapshot');
  expect(snapshot.nodes.find(item => item.id === nextNode.id)!.markdown).not.toContain('test explanation');
  expect(snapshot.busy).toHaveLength(0);
  expect(existsSync(join(root, 'data', 'memgraph.sqlite3'))).toBe(true);
  expect(existsSync(join(directory, 'memgraph.sqlite3'))).toBe(true);
});

test('template validation, Chinese localization, feedback privacy and renderer isolation', async () => {
  await expect(invoke('template.save', { name: 'Invalid', system_prompt: 'Explain', user_prompt: 'No concept variable' })).rejects.toThrow();
  const template = await invoke('template.save', { name: 'Custom', system_prompt: 'Explain in {{language}}', user_prompt: 'Explain {{concept}}' });
  await invoke('template.delete', { id: template.id });
  expect((await invoke<Trash>('trash.list')).templates).toHaveLength(1);
  await invoke('trash.restore', { kind: 'templates', id: template.id });
  const body = await invoke<string>('feedback.copy', { apiKey: 'SECRET', markdown: 'PRIVATE NOTES' });
  expect(body).not.toMatch(/SECRET|PRIVATE NOTES/);
  expect(await invoke<string>('feedback.email')).toMatch(/^mailto:leo\.oceanai@gmail\.com/);
  await expect(invoke('external.open', { url: 'file:///etc/passwd' })).rejects.toThrow();
  expect(await page.evaluate(() => ({ require: typeof (window as any).require, process: typeof (window as any).process }))).toEqual({ require: 'undefined', process: 'undefined' });
  await invoke('settings.save', { language: 'zh_CN' });
  await page.getByRole('button', { name: '模板管理', exact: true }).click();
  await page.getByRole('button', { name: '模板帮助', exact: true }).click();
  await expect(page.getByRole('dialog').last()).toContainText('系统');
  await page.screenshot({ path: 'test-results/templates-zh.png' });
});

test('login keeps real progress across settings reopen, deduplicates, cancels and retries', async () => {
  await invoke('settings.save', { authMode: 'chatgpt_login' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  let dialog = page.getByTestId('settings-dialog');
  await dialog.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(dialog.getByTestId('login-state')).toHaveText('Waiting for login authorization');
  await expect(dialog.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Login output')).toContainText('TEST-ONLY');
  const states = await Promise.all([invoke<LoginState>('codex.login'), invoke<LoginState>('codex.login')]);
  expect(states.every(state => state.status === 'running')).toBe(true);
  expect(readFileSync(join(root, 'login-starts'), 'utf8')).toBe('start\n');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  dialog = page.getByTestId('settings-dialog');
  await expect(dialog.getByRole('button', { name: 'Log in', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Login output')).toContainText('TEST-ONLY');
  expect((await dialog.getByLabel('Login output').innerText()).match(/Open https/g)).toHaveLength(1);
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: 'test-results/login-running-narrow.png' });
  await dialog.getByRole('button', { name: 'Cancel login', exact: true }).click();
  await expect(dialog.getByTestId('login-state')).toHaveText('Login cancelled. You can log in again.');
  await dialog.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect.poll(() => readFileSync(join(root, 'login-starts'), 'utf8')).toBe('start\nstart\n');
  writeFileSync(join(root, 'finish-login'), 'done');
  await expect(dialog.getByTestId('login-state')).toHaveText('Login completed');
  await expect(dialog.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled();
  await expect(dialog).not.toContainText('Login is already running');
  await invoke('settings.save', { language: 'zh_CN' });
  await expect(dialog.getByTestId('login-state')).toHaveText('登录已完成');
});

test('relationship generation errors remain visible without corrupting login state', async () => {
  const map = await invoke('map.create', { title: 'Relationship errors' });
  const source = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Source' });
  const target = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Target' });
  await application.evaluate(() => {
    process.env.MEMGRAPH_MOCK_AI = '0';
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Synthetic relation failure' } }), { status: 429 });
  });
  await invoke('edge.updateRelation', { sourceId: source.id, targetId: target.id });
  await expect(page.getByText('HTTP 429: Synthetic relation failure', { exact: true })).toBeVisible();
  expect((await invoke<LoginState>('codex.loginState')).status).toBe('idle');
});

test('provider changes clear the previous key and block generation until replaced', async () => {
  const map = await invoke('map.create', { title: 'Provider credentials' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Keep provider keys isolated' });
  expect((await invoke<Snapshot>('snapshot')).hasKey).toBe(true);
  await invoke('settings.save', { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro', apiMode: 'chat_completions' });
  expect((await invoke<Snapshot>('snapshot')).hasKey).toBe(false);
  await expect(invoke('node.generate', { id: node.id })).rejects.toThrow('API key');
  await invoke('settings.save', { apiKey: 'TEST_ONLY_NEW_PROVIDER_KEY' });
  expect((await invoke<Snapshot>('snapshot')).hasKey).toBe(true);
});

test('current model presets save exact IDs and keep provider/authentication boundaries', async () => {
  test.setTimeout(90000);
  expect((await invoke<Snapshot>('snapshot')).settings.model).toBe('gpt-6.1-terra');
  for (const model of ['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByTestId('settings-dialog');
    await dialog.getByRole('combobox', { name: 'API preset', exact: true }).selectOption({ label: `OpenAI / ${model}` });
    await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue(model);
    await expect(dialog.getByRole('combobox', { name: 'API mode', exact: true })).toHaveValue('responses');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await invoke<Snapshot>('snapshot')).settings.model).toBe(model);
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  let dialog = page.getByTestId('settings-dialog');
  await dialog.getByRole('combobox', { name: 'API preset', exact: true }).selectOption({ label: 'DeepSeek / deepseek-flash' });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).settings).toMatchObject({ model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', apiMode: 'chat_completions', authMode: 'api_key' });
  expect((await invoke<Snapshot>('snapshot')).hasKey).toBe(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  dialog = page.getByTestId('settings-dialog');
  await dialog.getByRole('combobox', { name: 'Authentication', exact: true }).selectOption('chatgpt_login');
  await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('gpt-6.1-terra');
  await dialog.getByRole('combobox', { name: 'API preset', exact: true }).selectOption({ label: 'OpenAI / gpt-6.1-sol' });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).settings).toMatchObject({ model: 'gpt-6.1-sol', baseUrl: 'https://api.openai.com', apiMode: 'responses', authMode: 'chatgpt_login' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('settings-dialog').getByLabel('Model', { exact: true })).toHaveValue('gpt-6.1-sol');
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({ path: 'test-results/models-settings-desktop.png' });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: 'test-results/models-settings-narrow.png' });
});

test('legacy aliases are localized and custom saved model IDs are preserved', async () => {
  await invoke('settings.save', { model: 'TEST_ONLY_CUSTOM_FUTURE_MODEL' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  let dialog = page.getByTestId('settings-dialog');
  await expect(dialog.getByRole('combobox', { name: 'API preset', exact: true })).toHaveValue('custom');
  await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('TEST_ONLY_CUSTOM_FUTURE_MODEL');
  await expect(dialog.getByRole('combobox', { name: 'API preset', exact: true }).getByRole('option', { name: 'DeepSeek / deepseek-v4-flash (Compatibility alias)', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await invoke('settings.save', { language: 'zh_CN' });
  await page.getByRole('button', { name: '\u8bbe\u7f6e', exact: true }).click();
  dialog = page.getByTestId('settings-dialog');
  await dialog.getByRole('combobox', { name: '\u670d\u52a1\u9884\u8bbe', exact: true }).selectOption({ label: 'DeepSeek / deepseek-v4-flash (\u517c\u5bb9\u522b\u540d)' });
  await dialog.getByRole('button', { name: '\u4fdd\u5b58', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).settings.model).toBe('deepseek-v4-flash');
});

test('update policy and beta channel persist through the settings UI', async () => {
  test.setTimeout(90000);
  expect((await invoke<Snapshot>('snapshot')).settings.updateMode).toBe('notify');
  for (const mode of ['manual', 'download', 'notify']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByTestId('settings-dialog');
    await dialog.getByRole('combobox', { name: 'Update mode', exact: true }).selectOption(mode);
    await dialog.getByRole('checkbox', { name: 'Receive beta updates', exact: true }).check();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await invoke<Snapshot>('snapshot')).settings).toMatchObject({ updateMode: mode, channel: 'beta' });
    expect(JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')).updateMode).toBe(mode);
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog.getByRole('combobox', { name: 'Update mode', exact: true })).toHaveValue('notify');
  await expect(dialog.getByRole('checkbox', { name: 'Receive beta updates', exact: true })).toBeChecked();
  await dialog.getByRole('combobox', { name: 'Update mode', exact: true }).selectOption('manual');
  await expect(dialog.getByRole('button', { name: 'Check for updates', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Discard changes', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).settings.updateMode).toBe('notify');
  await invoke('settings.save', { language: 'zh_CN', updateMode: 'download' });
  await page.getByRole('button', { name: '\u8bbe\u7f6e', exact: true }).click();
  const chinese = page.getByTestId('settings-dialog');
  await expect(chinese.getByRole('combobox', { name: '\u66f4\u65b0\u65b9\u5f0f', exact: true })).toHaveValue('download');
  await expect(chinese.getByRole('option', { name: '\u81ea\u52a8\u68c0\u67e5\u5e76\u4e0b\u8f7d', exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 960, height: 640 });
  await chinese.getByRole('combobox', { name: '\u66f4\u65b0\u65b9\u5f0f', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({ path: 'test-results/update-settings-zh-narrow.png' });
});

test('manual update entry points show a usable release fallback for portable/development builds', async () => {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByTestId('help-menu').getByRole('menuitem', { name: 'Check for updates', exact: true }).click();
  let dialog = page.getByTestId('updates-dialog');
  await expect(dialog.getByRole('status')).toHaveText('In-app updates are unavailable for this build. Download from GitHub');
  await expect(dialog.getByRole('button', { name: 'Download from GitHub', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Restart and install', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Download from GitHub', exact: true }).click();
  await page.screenshot({ path: 'test-results/updates-manual-desktop.png' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByTestId('settings-dialog').getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0);
  await expect(page.getByTestId('updates-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await invoke('settings.save', { language: 'zh_CN' });
  await page.getByRole('button', { name: '\u5e2e\u52a9', exact: true }).click();
  await page.getByTestId('help-menu').getByRole('menuitem', { name: '\u68c0\u67e5\u66f4\u65b0', exact: true }).click();
  dialog = page.getByTestId('updates-dialog');
  await expect(dialog.getByRole('button', { name: '\u524d\u5f80 GitHub \u4e0b\u8f7d', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: 'test-results/updates-manual-zh-narrow.png' });
});

test('renderer update controls show background progress, retain readiness and require restart confirmation', async () => {
  await mountUpdateRenderer({ status: 'available', version: '0.2.0-beta.5', checkedAt: '2026-10-29T00:00:00Z' });
  await page.getByRole('button', { name: 'Update available', exact: true }).click();
  let dialog = page.getByTestId('updates-dialog');
  await dialog.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '42');
  await expect(dialog.getByRole('button', { name: 'Check for updates', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 960, height: 640 });
  await expect(page.getByRole('button', { name: 'Downloading 42%', exact: true })).toBeVisible();
  const menu = await page.locator('.app-menu').boundingBox(), status = await page.locator('.header-status').boundingBox();
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(status!.x);
  await page.screenshot({ path: 'test-results/update-progress-narrow.png' });
  await setRendererUpdate({ status: 'downloaded', percent: 100 });
  await page.getByRole('button', { name: 'Update ready', exact: true }).click();
  dialog = page.getByTestId('updates-dialog');
  await expect(dialog.getByRole('button', { name: 'Check for updates', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Restart and install', exact: true }).click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('backed up before installation');
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await invoke('snapshot')).testCalls).not.toContain('updates.install');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByTestId('help-menu').getByRole('menuitem', { name: 'Check for updates', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Update ready');
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.screenshot({ path: 'test-results/update-ready-desktop.png' });
  await dialog.getByRole('button', { name: 'Restart and install', exact: true }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Restart and install', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Backing up and installing update');
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
  expect((await invoke('snapshot')).testCalls.filter((command: string) => command === 'updates.install')).toHaveLength(1);
});

test('renderer update errors expose retry and fallback, with Chinese ready and current-version states', async () => {
  await mountUpdateRenderer({ status: 'error', message: 'Synthetic update network failure' });
  await page.getByRole('button', { name: 'Software updates', exact: true }).click();
  const dialog = page.getByTestId('updates-dialog');
  await expect(dialog).toContainText('Synthetic update network failure');
  await expect(dialog.getByRole('button', { name: 'Download from GitHub', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Up to date');
  await invoke('settings.save', { language: 'zh_CN' });
  await expect(dialog.getByRole('status')).toHaveText('\u5df2\u662f\u6700\u65b0\u7248\u672c');
  await setRendererUpdate({ status: 'downloaded', version: '0.2.0-beta.5' });
  await dialog.getByRole('button', { name: '\u91cd\u542f\u5e76\u5b89\u88c5', exact: true }).click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('\u81ea\u52a8\u5907\u4efd');
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: 'test-results/update-confirm-zh-narrow.png' });
  await page.keyboard.press('Escape');
  expect((await invoke('snapshot')).testCalls).not.toContain('updates.install');
});

test('Calico computed colors meet contrast targets and graph arrows use the selected token', async () => {
  const map = await invoke('map.create', { title: 'Calico workspace' });
  const parent = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Understanding', x: 0, y: 0 });
  await invoke('node.create', { mapId: map.id, title: 'Connection', parentId: parent.id, x: 270, y: 100 });
  await page.locator('.react-flow__node').first().click();
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible();
  await expect.poll(() => page.locator('marker polyline').count()).toBeGreaterThan(0);
  const results = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const color = (name: string) => { const e = document.createElement('span'); e.style.color = `var(--${name})`; document.body.append(e); const rgb = getComputedStyle(e).color; e.remove(); return rgb; };
    const luminance = (value: string) => {
      const [r, g, b] = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return r * .2126 + g * .7152 + b * .0722;
    };
    const pairs = [['text', 'primary'], ['text', 'primary-hover'], ['muted', 'surface'], ['muted', 'background'], ['text-on-muted', 'surface-muted'], ['accent', 'surface'], ['on-dark', 'dark-surface'], ['success', 'success-bg'], ['danger', 'danger-bg'], ['warning', 'warning-bg'], ['info', 'info-bg']];
    return { background: style.backgroundColor, ratios: pairs.map(([a, b]) => { const x = luminance(color(a)), y = luminance(color(b)); return [a, (Math.max(x, y) + .05) / (Math.min(x, y) + .05)] as const; }),
      primary: getComputedStyle(document.querySelector('.new-map-button')!).backgroundColor,
      edge: getComputedStyle(document.querySelector('.react-flow__edge-path')!).stroke,
      arrows: [...document.querySelectorAll('marker polyline')].map(e => getComputedStyle(e).fill), accent: color('accent') };
  });
  expect(results.background).toBe('rgb(247, 242, 234)');
  expect(results.primary).toBe('rgb(244, 162, 97)');
  for (const [token, ratio] of results.ratios) expect(ratio, token).toBeGreaterThanOrEqual(4.5);
  expect(results.edge).toBe(results.accent); expect(results.arrows).toContain(results.accent);
  await page.getByTestId('concept-input').focus();
  expect(await page.getByTestId('concept-input').evaluate(e => getComputedStyle(e).borderColor)).toBe(results.accent);
  await page.screenshot({ path: 'test-results/calico-workspace-desktop.png' });
});

test('Calico responsive reading, drawers and template controls remain usable', async () => {
  test.setTimeout(90000);
  await application.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setMinimumSize(320, 480); });
  const map = await invoke('map.create', { title: 'Long knowledge map with a readable title' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Understanding and knowledge transfer' });
  await invoke('node.edit', { id: node.id, title: node.title, markdown: '# Understanding\n\nA clear explanation with **connections** and [reference](https://example.com).\n\n> Knowledge becomes useful through practice.\n\n```ts\nconst concept = "A long code sample that must scroll within the reading surface rather than expand the workspace";\n```\n\n| Concept | Relationship | Example |\n| --- | --- | --- |\n| Understanding | Connect ideas | Transfer knowledge |' });
  await page.locator('.react-flow__node').first().click();
  for (const [width, height] of [[1360, 800], [960, 640], [768, 800], [390, 844]]) {
    await page.setViewportSize({ width, height });
    if (width < 660) await page.getByRole('button', { name: 'Show details', exact: true }).click();
    await expect(page.getByTestId('markdown')).toBeVisible();
    expect(await page.getByTestId('markdown').evaluate(e => getComputedStyle(e).fontSize)).toBe('16px');
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, pre: document.querySelector('.markdown pre')!.getBoundingClientRect(), panel: document.querySelector('.details-panel')!.getBoundingClientRect() }));
    expect(sizes.page).toBeLessThanOrEqual(sizes.viewport); expect(sizes.pre.width).toBeLessThan(sizes.panel.width);
    await page.screenshot({ path: `test-results/calico-reading-${width}.png` });
    if (width < 660) await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  const dialog = page.getByTestId('template-dialog');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Template help', exact: true }).click();
  await expect(page.getByTestId('template-help-dialog')).toContainText('required');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('settings-dialog').getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/calico-settings-mobile.png' });
  await page.keyboard.press('Escape');
  await invoke('settings.save', { language: 'zh_CN' });
  await page.getByRole('button', { name: '\u6a21\u677f\u7ba1\u7406', exact: true }).click();
  await page.screenshot({ path: 'test-results/calico-templates-zh-mobile.png' });
});

test('Calico keyboard focus, large text and reduced motion work under a dark OS preference', async () => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Settings', exact: true }).focus();
  expect(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '17.5px'; });
  expect(await dialog.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 252, 248)');
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await save.focus(); await page.keyboard.press('Tab');
  expect(await dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
  const duration = await save.evaluate(e => getComputedStyle(e, '::before').transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(.01);
  await page.screenshot({ path: 'test-results/calico-large-text.png' });
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('Snow Leopard switches instantly, isolates unsaved settings and restores Calico exactly', async () => {
  const map = await invoke('map.create', { title: 'Theme round trip' });
  const parent = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Understanding', x: 0, y: 0 });
  await invoke('node.create', { mapId: map.id, title: 'Connection', parentId: parent.id, x: 270, y: 100 });
  await page.locator('.react-flow__node').first().click();
  const palette = () => page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries([...s].filter(key => key.startsWith('--')).map(key => [key, s.getPropertyValue(key)]));
  });
  const before = await palette();
  const viewport = await page.locator('.react-flow__viewport').getAttribute('style');
  await page.evaluate(() => { (window as any).themeSentinel = 'not-reloaded'; });
  const saved = (await invoke<Snapshot>('snapshot')).settings;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByTestId('settings-dialog'), skin = dialog.getByRole('combobox', { name: 'Skin', exact: true });
  await expect(skin).toHaveValue('calico');
  await dialog.getByLabel('Model', { exact: true }).fill('UNSAVED_THEME_TEST_MODEL');
  await skin.selectOption('snow-leopard');
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).settings.theme).toBe('snow-leopard');
  await expect(skin).toBeEnabled();
  expect((await invoke<Snapshot>('snapshot')).settings).toEqual({ ...saved, theme: 'snow-leopard' });
  await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('UNSAVED_THEME_TEST_MODEL');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Discard changes', exact: true }).click();
  expect(await page.evaluate(() => (window as any).themeSentinel)).toBe('not-reloaded');
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(viewport);
  await expect(page.getByTestId('node-title')).toHaveText('Understanding');
  await page.screenshot({ path: 'test-results/snow-workspace-desktop.png' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await skin.selectOption('calico');
  await expect.poll(async () => (await invoke<Snapshot>('snapshot')).settings.theme).toBe('calico');
  await expect(skin).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await palette()).toEqual(before);
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(viewport);
});

test('Snow Leopard persists across a process restart and is bootstrapped before React', async () => {
  await invoke('settings.save', { theme: 'snow-leopard', language: 'zh_CN' });
  await application.close();
  const env = { ...process.env, MEMGRAPH_TEST_MODE: '1', MEMGRAPH_TEST_ROOT: root, MEMGRAPH_MOCK_AI: '1' } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ args: [...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless'] : []), resolve('.')], env });
  page = await application.firstWindow();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'snow-leopard');
  const html = await application.evaluate(async ({ net }) => (await net.fetch('memgraph://app/index.html')).text());
  expect(html).toContain('data-theme="snow-leopard"');
  expect(html).toContain("script-src 'self'");
  expect((await invoke<Snapshot>('snapshot')).settings.theme).toBe('snow-leopard');
  expect((await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor())).toLowerCase()).toBe('#f5f6f4');
  await page.getByRole('button', { name: '\u8bbe\u7f6e', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '\u76ae\u80a4', exact: true }).getByRole('option', { name: '\u96ea\u8c79 Snow Leopard', exact: true })).toHaveCount(1);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setMinimumSize(320, 480));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: '\u76ae\u80a4', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/snow-settings-zh-mobile.png' });
});

test('Snow Leopard failed autosave rolls back without affecting other settings', async () => {
  const before = (await invoke<Snapshot>('snapshot')).settings;
  mkdirSync(join(root, 'settings.json.tmp'));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByTestId('settings-dialog');
  const skin = dialog.getByRole('combobox', { name: 'Skin', exact: true });
  await skin.selectOption('snow-leopard');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(skin).toBeEnabled(); await expect(skin).toHaveValue('calico');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'calico');
  expect((await invoke<Snapshot>('snapshot')).settings).toEqual(before);
});

test('Snow Leopard real component contrast, graph colors and responsive surfaces', async () => {
  test.setTimeout(90000);
  await invoke('settings.save', { theme: 'snow-leopard' });
  const map = await invoke('map.create', { title: 'Alpine knowledge' });
  const parent = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Knowledge', x: 0, y: 0 });
  await invoke('node.create', { mapId: map.id, title: 'Transfer', parentId: parent.id, x: 270, y: 100 });
  await invoke('node.edit', { id: parent.id, title: parent.title, markdown: '# Knowledge\n\nA calm reading surface with **connections**.\n\n> A practical example.\n\n```ts\nconst knowledge = "understand and connect";\n```\n\n| Concept | Example |\n| --- | --- |\n| Connection | Transfer |' });
  await page.locator('.react-flow__node').first().click();
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible();
  await expect.poll(() => page.locator('marker polyline').count()).toBeGreaterThan(0);
  const ratios = await page.evaluate(() => {
    const color = (key: string) => { const el = document.createElement('span'); el.style.color = `var(--${key})`; document.body.append(el); const rgb = getComputedStyle(el).color; el.remove(); return rgb; };
    const lum = (rgb: string) => { const [r,g,b] = rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return r*.2126+g*.7152+b*.0722; };
    const pairs = [['on-primary','primary'],['on-primary','primary-hover'],['muted','surface'],['text-subtle','background'],['text-on-muted','surface-muted'],['text-on-muted','accent-light'],['accent','surface'],['on-dark-link','dark-surface'],['success','success-bg'],['danger','danger-bg'],['warning','warning-bg'],['info','info-bg']];
    const result = pairs.map(([a,b]) => { const x=lum(color(a)), y=lum(color(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); });
    if (getComputedStyle(document.querySelector('.new-map-button')!).color !== color('on-primary')) throw new Error('Button foreground not themed');
    if (getComputedStyle(document.querySelector('.react-flow__edge-path')!).stroke !== color('accent')) throw new Error('Edge not themed');
    if (![...document.querySelectorAll('marker polyline')].some(el => getComputedStyle(el).fill === color('accent'))) throw new Error('Arrow not themed');
    return result;
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setMinimumSize(320, 480));
  for (const [width,height] of [[1360,800],[960,640],[768,800],[390,844]]) {
    await page.setViewportSize({ width,height });
    if (width<660) await page.getByRole('button', { name: 'Show details', exact: true }).click();
    await expect(page.getByTestId('markdown')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/snow-reading-${width}.png` });
    if (width<660) await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await expect(page.getByTestId('template-dialog').getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/snow-templates-mobile.png' });
  await page.keyboard.press('Escape');
  for (const item of ['Recycle bin', 'Check for updates']) {
    await page.getByRole('button', { name: item === 'Recycle bin' ? 'File' : 'Help', exact: true }).click();
    await page.getByTestId(item === 'Recycle bin' ? 'file-menu' : 'help-menu').getByRole('menuitem', { name: item, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `test-results/snow-${item === 'Recycle bin' ? 'recycle' : 'updates'}-mobile.png` });
    await page.keyboard.press('Escape');
  }
});

test('desktop menu groups preserve single command entry points and direct settings', async () => {
  const file = page.getByRole('button', { name: 'File', exact: true });
  const help = page.getByRole('button', { name: 'Help', exact: true });
  await file.click();
  await expect(file).toHaveAttribute('aria-expanded', 'true');
  const fileMenu = page.getByTestId('file-menu');
  expect(await fileMenu.getByRole('menuitem').evaluateAll(items => items.map(item => item.getAttribute('aria-label')))).toEqual(['New map', 'Import legacy database', 'Back up data', 'Restore backup', 'Recycle bin']);
  await expect(fileMenu.getByRole('separator')).toHaveCount(2);
  await expect(fileMenu.getByRole('menuitem', { name: 'New map', exact: true })).toContainText('Ctrl+N');
  await page.screenshot({ path: 'test-results/desktop-menu-calico-file.png' });
  await file.click();
  await expect(fileMenu).toHaveCount(0);
  await help.click();
  const helpMenu = page.getByTestId('help-menu');
  expect(await helpMenu.getByRole('menuitem').evaluateAll(items => items.map(item => item.getAttribute('aria-label')))).toEqual(['Check for updates', 'GitHub feedback', 'Email feedback', 'Copy feedback details', 'About']);
  await expect(helpMenu.getByRole('separator')).toHaveCount(2);
  await helpMenu.getByRole('menuitem', { name: 'About', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'About', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await file.click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const map = await invoke('map.create', { title: 'Menu structure' });
  await expect(page.getByTestId('map-item')).toBeVisible();
  await page.getByTestId('map-item').click({ button: 'right' });
  expect(await page.getByTestId('map-menu').getByRole('menuitem').evaluateAll(items => items.map(item => item.getAttribute('aria-label')))).toEqual(['Rename', 'Export Markdown', 'Delete']);
  await page.getByTestId('map-menu').getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.getByTestId('rename-map-dialog').getByLabel('Title', { exact: true }).fill('Renamed from menu');
  await page.getByTestId('rename-map-dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).maps.find(item => item.id === map.id)?.title).toBe('Renamed from menu');
});

test('desktop menus support keyboard navigation, type search, focus return and pointer switching', async () => {
  const file = page.getByRole('button', { name: 'File', exact: true });
  const help = page.getByRole('button', { name: 'Help', exact: true });
  await page.keyboard.press('F10');
  await expect(file).toBeFocused();
  await page.keyboard.press('ArrowDown');
  let menu = page.getByTestId('file-menu');
  await expect(menu.getByRole('menuitem', { name: 'New map', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Recycle bin', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'New map', exact: true })).toBeFocused();
  await page.keyboard.press('b');
  await expect(menu.getByRole('menuitem', { name: 'Back up data', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(help).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('help-menu').getByRole('menuitem', { name: 'About', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await page.keyboard.press('Alt+f');
  await expect(menu).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(menu).toBeVisible();
  await help.hover();
  await expect(page.getByTestId('help-menu')).toBeVisible();
  await expect(menu).toHaveCount(0);
  await file.hover();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await file.click();
  await page.getByTestId('concept-input').click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId('concept-input')).toBeFocused();
  await file.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(menu).toHaveCount(0);
  await expect(file).toBeFocused();
});

test('node menus group actions, skip unavailable commands and preserve edit/delete confirmation', async () => {
  const map = await invoke('map.create', { title: 'Node menus' });
  const node = await invoke<NodeRecord>('node.create', { mapId: map.id, title: 'Encoding', markdown: '# Original' });
  await page.getByTestId('graph-node-title').click();
  await page.getByTestId('node-menu').click();
  let menu = page.getByTestId('node-actions-menu');
  expect(await menu.getByRole('menuitem').evaluateAll(items => items.map(item => item.getAttribute('aria-label')))).toEqual(['Edit', 'Copy', 'Regenerate', 'Connect nodes', 'Update relationship', 'Delete']);
  await expect(menu.getByRole('separator')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/desktop-menu-calico-node.png' });
  await menu.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('node-menu')).toBeFocused();
  await page.getByTestId('node-menu').click();
  await menu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await invoke<Snapshot>('snapshot')).nodes.some(item => item.id === node.id)).toBe(true);
  await mountUpdateRenderer({ status: 'idle' }, { busy: [node.id] });
  await page.getByTestId('graph-node-title').click();
  await page.getByTestId('node-menu').click();
  menu = page.getByTestId('node-actions-menu');
  await expect(menu.getByRole('menuitem', { name: 'Edit', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Regenerate', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Connect nodes', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
});

test('desktop menu surfaces fit both skins, languages, narrow windows and large text', async () => {
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setMinimumSize(320, 480));
  for (const theme of ['calico', 'snow-leopard']) {
    for (const language of ['en_US', 'zh_CN']) {
      await invoke('settings.save', { theme, language });
      const zh = language === 'zh_CN';
      for (const width of [1360, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const kind of ['file', 'help'] as const) {
          const label = kind === 'file' ? (zh ? '\u6587\u4ef6' : 'File') : (zh ? '\u5e2e\u52a9' : 'Help');
          await page.getByRole('button', { name: label, exact: true }).click();
          const menu = page.getByTestId(`${kind}-menu`);
          await expect(menu).toBeVisible();
          const box = (await menu.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(box.y + box.height).toBeLessThanOrEqual(844);
          const sizes = await menu.getByRole('menuitem').evaluateAll(items => items.map(item => ({ scroll: item.scrollWidth, width: item.clientWidth })));
          for (const size of sizes) expect(size.scroll).toBeLessThanOrEqual(size.width);
          const contrasts = await menu.evaluate(element => {
            const color = (token: string) => { const el = document.createElement('span'); el.style.color = `var(--${token})`; element.append(el); const value = getComputedStyle(el).color; el.remove(); return value; };
            const luminance = (value: string) => { const [r,g,b] = value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return r*.2126+g*.7152+b*.0722; };
            const backgrounds = [color('surface'), color('accent-light')].map(luminance);
            return [...element.querySelectorAll('.menu-label, .menu-shortcut')].flatMap(el => { const foreground = luminance(getComputedStyle(el).color); return backgrounds.map(background => (Math.max(foreground, background)+.05)/(Math.min(foreground, background)+.05)); });
          });
          for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
          await page.screenshot({ path: `test-results/desktop-menu-${theme}-${language}-${kind}-${width}.png` });
          await page.keyboard.press('Escape');
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 640 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
  await page.getByRole('button', { name: '\u5e2e\u52a9', exact: true }).click();
  await expect(page.getByTestId('help-menu').getByRole('menuitem', { name: '\u5173\u4e8e', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/desktop-menu-snow-large-text.png' });
});

const uiMarkdown = (blocks:unknown[]) => '```memgraph-ui\n'+JSON.stringify({version:1,blocks},null,2)+'\n```';
test('rich content renders charts, formulas and diagrams, links controls and persists state',async()=>{
  const map=await invoke('map.create',{title:'Interactive knowledge'});
  const node=await invoke<NodeRecord>('node.create',{mapId:map.id,title:'Learning dashboard'});
  const rows=[{name:'Alpha',value:12},{name:'Beta',value:7},{name:'Gamma',value:20}];
  const markdown='# Learning dashboard\n\nA readable explanation with **connections**.\n\n$$E=mc^2$$\n\n```mermaid\nflowchart LR\nA[Understand] --> B[Remember]\n```\n\n'+uiMarkdown([
    {id:'filter',type:'input',title:'Filter concepts',state:'search',value:''},
    {id:'summary',type:'metric',title:'Matching concepts',aggregate:'count',data:rows,filter:{field:'name',state:'search'}},
    {id:'chart',type:'chart',title:'Learning progress',chart:'bar',data:rows,x:'name',y:'value',filter:{field:'name',state:'search'}},
    {id:'table',type:'table',title:'Concept data',data:rows,filter:{field:'name',state:'search'}},
    {id:'details',type:'details',title:'Why it matters',children:[{id:'explain',type:'markdown',text:'Connect new knowledge to existing knowledge.'}]}
  ]);
  await invoke('node.edit',{id:node.id,title:node.title,markdown});
  await page.getByTestId('graph-node-title').click();
  await page.getByRole('button',{name:'Expand reading',exact:true}).click();
  await expect(page.locator('.katex')).toHaveCount(1);
  await expect(page.locator('.content-diagram svg')).toBeVisible();
  await expect(page.locator('.content-diagram')).toContainText('Understand');
  const diagramColors=await page.locator('.content-diagram').evaluate(element=>{const luminance=(value:string)=>{const [r,g,b]=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return r*.2126+g*.7152+b*.0722;};const text=luminance(getComputedStyle(element.querySelector('text')!).fill),background=luminance(getComputedStyle(element.querySelector('.node rect')!).fill);return (Math.max(text,background)+.05)/(Math.min(text,background)+.05);});
  expect(diagramColors).toBeGreaterThanOrEqual(4.5);
  const labelsFit=await page.locator('.content-diagram .node').evaluateAll(nodes=>nodes.every(node=>{const text=node.querySelector('text')!.getBoundingClientRect(),shape=node.querySelector('rect')!.getBoundingClientRect();return text.left>=shape.left-1 && text.right<=shape.right+1 && text.top>=shape.top-1 && text.bottom<=shape.bottom+1 && text.height<=32;}));
  expect(labelsFit).toBe(true);
  await expect(page.locator('.content-chart canvas')).toBeVisible();
  expect(await page.locator('.content-chart canvas').evaluate((canvas:HTMLCanvasElement)=>{const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;return pixels.some((value,index)=>index%4===3&&value>0);})).toBe(true);
  await page.getByLabel('Filter concepts',{exact:true}).fill('Alpha');
  await expect(page.locator('[data-block-id=summary] strong')).toHaveText('1');
  await expect(page.locator('[data-block-id=table] tbody tr')).toHaveCount(1);
  await expect.poll(async()=>(await invoke<any>('content.state',{nodeId:node.id})).state.filter?.search).toBe('Alpha');
  await page.getByText('Why it matters',{exact:true}).click();
  await expect(page.getByText('Connect new knowledge to existing knowledge.',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/rich-content-calico-desktop.png'});
  await invoke('settings.save',{theme:'snow-leopard',language:'zh_CN'});
  await page.screenshot({path:'test-results/rich-content-snow-desktop.png'});
  await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setMinimumSize(320,480));
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/rich-content-snow-mobile.png'});
  await page.setViewportSize({width:1360,height:800});
  await page.reload();
  await expect(page.getByTestId('concept-input')).toBeVisible();
  await page.getByTestId('graph-node-title').click();
  await expect(page.getByLabel('Filter concepts',{exact:true})).toHaveValue('Alpha');
});

test('visual and source editing preserve opaque Markdown, support local images and isolate invalid blocks',async()=>{
  const map=await invoke('map.create',{title:'Rich editor'}), node=await invoke<NodeRecord>('node.create',{mapId:map.id,title:'Editable'});
  const original='# Keep\n\n<!-- retain comment -->\n\n```unknown-widget\nnever delete this\n```\n\n$$x^2$$\n\n'+uiMarkdown([{id:'note',type:'callout',title:'Important',text:'Retain this component.'}]);
  await invoke('node.edit',{id:node.id,title:node.title,markdown:original});
  await page.getByTestId('graph-node-title').click();await page.getByTestId('node-menu').click();await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  const dialog=page.getByTestId('edit-node-dialog');
  await expect(dialog.getByRole('textbox',{name:'Visual content',exact:true})).toBeVisible();
  await dialog.getByRole('tab',{name:'Markdown source',exact:true}).click();
  await expect(dialog.getByLabel('Markdown content',{exact:true})).toHaveValue(original);
  await dialog.getByRole('tab',{name:'Visual',exact:true}).click();
  const visual=dialog.getByRole('textbox',{name:'Visual content',exact:true});await visual.locator('h1').click();await page.keyboard.press('Home');
  await expect.poll(()=>visual.evaluate(()=>window.getSelection()?.anchorNode?.parentElement?.closest('h1')?.textContent)).toBe('Keep');
  await page.keyboard.type('Edited ');
  await dialog.getByRole('tab',{name:'Markdown source',exact:true}).click();
  const edited=await dialog.getByLabel('Markdown content',{exact:true}).inputValue();
  for(const retained of ['<!-- retain comment -->','never delete this','$$x^2$$','memgraph-ui','Retain this component.'])expect(edited).toContain(retained);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
  await dialog.locator('input[type=file]').setInputFiles({name:'example.png',mimeType:'image/png',buffer:png});
  await expect(dialog.getByLabel('Markdown content',{exact:true})).toHaveValue(/asset:[a-f0-9]{64}/);
  await page.screenshot({path:'test-results/rich-content-editor-source.png'});
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByTestId('markdown').locator('img.content-image')).toBeVisible();
  const saved=(await invoke<Snapshot>('snapshot')).nodes.find(item=>item.id===node.id)!.markdown;expect(saved).toContain('Edited');expect(saved).toContain('never delete this');
  await invoke('node.edit',{id:node.id,title:node.title,markdown:'# Before\n\n<script>window.PWNED=true</script>\n\n![blocked](https://example.com/tracking.png)\n\n'+uiMarkdown([{id:'bad',type:'script',code:'alert(1)'}])+'\n\n## After'});
  await expect(page.getByTestId('markdown').getByRole('heading',{name:'After',exact:true})).toBeVisible();
  await expect(page.getByTestId('markdown').locator('script, iframe, img')).toHaveCount(0);expect(await page.evaluate(()=>Object.hasOwn(window,'PWNED'))).toBe(false);
  await expect(page.getByTestId('markdown').getByRole('alert')).toBeVisible();
});

test('rich map actions require a preview and confirmation before linking or changing a node',async()=>{
  const map=await invoke('map.create',{title:'Action test'}),node=await invoke<NodeRecord>('node.create',{mapId:map.id,title:'Parent'});
  await invoke('node.edit',{id:node.id,title:node.title,markdown:uiMarkdown([{id:'name',type:'input',title:'Child title',state:'title',value:'Transfer'},{id:'create',type:'button',title:'Create linked concept',action:{kind:'createChild',title:'{{state:title}}',markdown:'# New knowledge'}}])});
  await page.getByTestId('graph-node-title').click();
  await page.getByRole('button',{name:'Create linked concept',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Action preview',exact:true})).toBeVisible();expect((await invoke<Snapshot>('snapshot')).nodes).toHaveLength(1);
  await page.getByRole('dialog',{name:'Action preview',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();expect((await invoke<Snapshot>('snapshot')).nodes).toHaveLength(1);
  await page.getByRole('button',{name:'Create linked concept',exact:true}).click();
  await application.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});
  await page.getByRole('button',{name:'Confirm changes',exact:true}).click();
  await expect.poll(async()=>(await invoke<Snapshot>('snapshot')).nodes.length).toBe(2);expect((await invoke<Snapshot>('snapshot')).edges).toHaveLength(1);
});

test('rich export produces a standalone offline page with working local controls and no network',async()=>{
  const map=await invoke('map.create',{title:'Offline knowledge'}),node=await invoke<NodeRecord>('node.create',{mapId:map.id,title:'Offline'});
  await invoke('node.edit',{id:node.id,title:node.title,markdown:uiMarkdown([{id:'query',type:'input',title:'Search locally',state:'q',value:''},{id:'table',type:'table',data:[{name:'Alpha',value:1},{name:'Beta',value:2}],filter:{field:'name',state:'q'}},{id:'chart',type:'chart',title:'Chart',chart:'bar',x:'name',y:'value',data:[{name:'A',value:2}]},{id:'write',type:'button',title:'Update map',action:{kind:'append',markdown:'Unsafe offline action'}}])});
  const output=join(root,'offline.zip');
  await application.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});},output);
  await page.getByRole('option',{name:'Offline knowledge',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Export Markdown',exact:true}).click();
  const exporting=page.getByTestId('export-dialog');await exporting.getByRole('combobox',{name:'Format',exact:true}).selectOption('interactive');await exporting.getByRole('button',{name:'Export Markdown',exact:true}).click();await expect(exporting).not.toBeVisible();
  const {dirname}=await import('node:path');const folder=join(root,'offline');
  for(const [name,bytes] of Object.entries(unzipSync(readFileSync(output)))){const path=join(folder,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
  const opened=application.waitForEvent('window');
  await application.evaluate(async({BrowserWindow},path)=>{const window=new BrowserWindow({width:1000,height:800,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});await window.loadFile(path);},join(folder,'index.html'));
  const offline=await opened;await offline.setViewportSize({width:1000,height:800});const requests:string[]=[];offline.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await offline.reload();
  await expect(offline.getByLabel('Search locally',{exact:true})).toBeVisible();await offline.getByLabel('Search locally',{exact:true}).fill('Alpha');await expect(offline.locator('[data-block-id=table] tbody tr')).toHaveCount(1);
  await expect(offline.locator('.content-chart canvas')).toBeVisible();await expect(offline.getByRole('button',{name:'Update map',exact:true})).toBeDisabled();
  expect(await offline.evaluate(()=>typeof window.memgraph)).toBe('undefined');expect(requests).toEqual([]);
  await offline.screenshot({path:'test-results/rich-content-offline.png'});await offline.close();
});

test('content settings share save and discard protection and keep credentials out of the renderer',async()=>{
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  let dialog=page.getByTestId('settings-dialog');
  await dialog.getByLabel('xAI API Key',{exact:true}).fill('TEST-IMAGE-SECRET');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog.getByLabel('xAI API Key',{exact:true})).toHaveValue('TEST-IMAGE-SECRET');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const profile=await invoke<any>('content.profile');expect(profile.hasImageKey).toBe(true);expect(JSON.stringify(profile)).not.toContain('TEST-IMAGE-SECRET');
  await page.getByRole('button',{name:'Settings',exact:true}).click();dialog=page.getByTestId('settings-dialog');
  await dialog.getByLabel('Clear image key',{exact:true}).check();
  await dialog.getByRole('button',{name:'Add data source',exact:true}).click();
  await dialog.getByLabel('Name',{exact:true}).fill('Approved data');await dialog.getByLabel('HTTPS GET URL',{exact:true}).fill('https://example.com/rows');
  await application.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});
  await page.screenshot({path:'test-results/rich-content-settings.png'});
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).not.toBeVisible();
  const next=await invoke<any>('content.profile');expect(next.hasImageKey).toBe(false);expect(next.sources[0].authorized).toBe(true);expect(next.sources[0].name).toBe('Approved data');
});
