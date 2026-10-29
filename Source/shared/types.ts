import type { ThemeId } from './themes';

export type Id = string;
export interface MapRecord { id: Id; title: string; description: string; deleted_at: string; created_at: string; updated_at: string }
export interface NodeRecord { id: Id; map_id: Id; template_id: Id | null; title: string; markdown: string; x: number; y: number; status: string; deleted_at: string; created_at: string; updated_at: string }
export interface EdgeRecord { id: Id; map_id: Id; source_node_id: Id; target_node_id: Id; type: string; label: string; created_at: string }
export interface TemplateRecord { id: Id; name: string; system_prompt: string; user_prompt: string; is_default: number; deleted_at: string; created_at: string; updated_at: string }
export interface Settings { baseUrl: string; model: string; apiMode: 'responses' | 'chat_completions'; authMode: 'api_key' | 'chatgpt_login'; language: 'system' | 'zh_CN' | 'en_US'; autoGenerate: boolean; dataDirectory: string; channel: 'stable' | 'beta'; updateMode: 'manual' | 'notify' | 'download'; theme: ThemeId }
export interface UpdateState { status: 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error' | 'unsupported'; version?: string; percent?: number; message?: string; checkedAt?: string; supported: boolean; releasesUrl: string }
export interface LoginState { status: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'; output: string; revision: number }
export interface Snapshot { maps: MapRecord[]; nodes: NodeRecord[]; edges: EdgeRecord[]; templates: TemplateRecord[]; mapId: Id | null; settings: Settings; hasKey: boolean; keyPersistent: boolean; version: string; platform: string; updates: UpdateState; legacyDatabase: string | null; busy: Id[] }
export interface Trash { maps: MapRecord[]; nodes: NodeRecord[]; templates: TemplateRecord[] }
export const commands = ['snapshot', 'map.create', 'map.rename', 'map.delete', 'map.export', 'node.create', 'node.edit', 'node.move', 'node.delete', 'node.copy', 'node.generate', 'node.cancel', 'edge.connect', 'edge.updateRelation', 'template.save', 'template.copy', 'template.delete', 'trash.list', 'trash.restore', 'trash.empty', 'settings.save', 'data.choose', 'data.import', 'data.backup', 'data.restore', 'codex.status', 'codex.login', 'codex.loginState', 'codex.cancelLogin', 'feedback.github', 'feedback.email', 'feedback.copy', 'updates.check', 'updates.download', 'updates.install', 'external.open'] as const;
export type Command = typeof commands[number];
export interface Bridge {
  invoke<T = unknown>(command: Command, payload?: Record<string, unknown>): Promise<T>;
  onChange(listener: () => void): () => void;
  onLogin(listener: (state: LoginState) => void): () => void;
  onGenerationError(listener: (message: string) => void): () => void;
}
declare global { interface Window { memgraph: Bridge } }
