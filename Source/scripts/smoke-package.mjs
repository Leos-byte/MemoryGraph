import { _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const directory = mkdtempSync(join(tmpdir(), 'memgraph-package-'));
const executablePath = process.argv[2] ? resolve(process.argv[2]) : resolve('dist-release', process.platform === 'win32' ? 'win-unpacked/MemGraph.exe' : 'linux-unpacked/memgraph');
const environment = { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }; delete environment.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({ executablePath, args: [`--user-data-dir=${directory}`, '--disable-renderer-backgrounding', ...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless'] : [])], env: environment });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.getByTestId('concept-input').waitFor();
  await page.keyboard.press('Escape');
  const initial = await page.evaluate(() => window.memgraph.invoke('snapshot'));
  if (initial.maps.length) throw new Error('Packaged smoke test is not isolated.');
  const snapshot = await page.evaluate(async () => {
    const map = await window.memgraph.invoke('map.create', { title: 'Packaged workspace' });
    const parent = await window.memgraph.invoke('node.create', { mapId: map.id, title: 'Memory', x: 0, y: 0 });
    await window.memgraph.invoke('node.create', { mapId: map.id, title: 'Encoding', parentId: parent.id, x: 270, y: 100 });
    return window.memgraph.invoke('snapshot');
  });
  if (snapshot.nodes.length !== 2 || snapshot.edges.length !== 1) throw new Error('Packaged SQLite/graph workflow failed.');
  if (await page.evaluate(() => typeof window.require !== 'undefined')) throw new Error('Renderer has Node access.');
  await page.screenshot({ path: 'test-results/packaged-workspace.png' });
  console.log(`Packaged ${snapshot.version} smoke passed (${snapshot.platform}; updates supported: ${snapshot.updates.supported}).`);
} finally { await app?.close(); rmSync(directory, { recursive: true, force: true }); }
