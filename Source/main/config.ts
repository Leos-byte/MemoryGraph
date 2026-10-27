import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { Settings } from '../shared/types';

export const settingsSchema = z.object({
  baseUrl: z.string().max(2048), model: z.string().trim().min(1).max(200),
  apiMode: z.enum(['responses', 'chat_completions']), authMode: z.enum(['api_key', 'chatgpt_login']),
  language: z.enum(['system', 'zh_CN', 'en_US']), autoGenerate: z.boolean(),
  dataDirectory: z.string().min(1).max(4096), channel: z.enum(['stable', 'beta'])
});
export function writePrivate(path: string, data: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, data, { mode: 0o600 });
  renameSync(temporary, path);
}
export class Config {
  settings: Settings;
  readonly path: string;
  constructor(readonly root: string) {
    this.path = join(root, 'settings.json');
    this.settings = { baseUrl: 'https://api.openai.com', model: 'gpt-5.6-terra', apiMode: 'responses', authMode: 'api_key', language: 'system', autoGenerate: false, dataDirectory: join(root, 'data'), channel: 'stable' };
    if (existsSync(this.path)) this.settings = settingsSchema.parse({ ...this.settings, ...JSON.parse(readFileSync(this.path, 'utf8')) });
  }
  save(settings: Settings) { const valid = settingsSchema.parse(settings); writePrivate(this.path, JSON.stringify(valid, null, 2)); this.settings = valid; }
}
export function legacyInfo(): { database: string | null; settings: Partial<Settings> } {
  const home = homedir();
  const conf = join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'MemGraph', 'MemGraph.conf');
  const values: Record<string, string> = {};
  if (process.platform !== 'win32' && existsSync(conf)) {
    let section = '';
    for (const line of readFileSync(conf, 'utf8').split(/\r?\n/)) {
      const group = line.match(/^\[([^\]]+)\]/); if (group) { section = group[1]; continue; }
      const pair = line.match(/^([^=]+)=(.*)$/); if (pair) values[`${section}/${pair[1]}`] = pair[2].replace(/^"|"$/g, '');
    }
  }
  const fallback = join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'MemGraph', 'MemGraph', 'memgraph.sqlite3');
  const path = values['database/directory'] ? join(values['database/directory'], 'memgraph.sqlite3') : values['database/path'] || fallback;
  const settings: Partial<Settings> = {};
  const candidate = { baseUrl: values['api/base_url'], model: values['api/model'], apiMode: values['api/mode'], authMode: values['api/auth_mode'], language: values['ui/language'], autoGenerate: values['generation/auto_generate_linked_nodes'] === 'true' };
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== undefined && value !== '') {
      const shape = settingsSchema.shape[key as keyof Settings];
      const parsed = shape.safeParse(value); if (parsed.success) (settings as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return { database: existsSync(path) ? path : null, settings };
}
