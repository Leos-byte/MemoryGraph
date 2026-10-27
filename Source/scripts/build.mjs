import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
await build({ entryPoints: { main: 'main/main.ts', preload: 'main/preload.ts' }, outdir: 'dist-main', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'better-sqlite3', 'electron-updater'], sourcemap: true });
await viteBuild();
