import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const channel = version.includes('-') ? 'beta' : 'latest';
const cli = resolve('node_modules/electron-builder/cli.js');
const result = spawnSync(process.execPath, [cli, '--config', 'electron-builder.yml', `--config.publish.channel=${channel}`, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
process.exit(result.status ?? 1);
