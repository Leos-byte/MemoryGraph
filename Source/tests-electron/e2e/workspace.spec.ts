import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import type { Command, LoginState, NodeRecord, Snapshot, Trash } from '../../shared/types';

let application: ElectronApplication;
let page: Page;
let root: string;
async function invoke<T = any>(command: Command, payload: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(({ command, payload }) => window.memgraph.invoke<T>(command, payload), { command, payload });
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
