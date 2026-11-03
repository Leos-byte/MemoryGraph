import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
await build({ entryPoints: { main: 'main/main.ts', preload: 'main/preload.ts' }, outdir: 'dist-main', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'better-sqlite3', 'electron-updater'], sourcemap: true });
await viteBuild();
await build({ entryPoints: ['renderer/content/offline.tsx'], outfile: 'dist-offline/viewer.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome130', minify: true, loader: { '.woff':'file', '.woff2':'file', '.ttf':'file' }, assetNames:'assets/[name]-[hash]' });
