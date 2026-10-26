import { createHash, createPublicKey, verify } from 'node:crypto';
import type { NodeRecord, TemplateRecord } from '../shared/types';

export const REPOSITORY = 'Leos-byte/MemoryGraph';
export function secureEndpoint(base: string, mode: string): URL {
  const url = new URL(base || 'https://api.openai.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('API URL must be HTTPS without credentials, query, or fragment.');
  let path = url.pathname.replace(/\/+$/, '');
  if (!path.endsWith('/v1')) path += '/v1';
  url.pathname = path + (mode === 'responses' ? '/responses' : '/chat/completions');
  return url;
}
export function renderTemplate(template: TemplateRecord, context: Record<string, string>): [string, string] {
  const render = (text: string) => text.replace(/\{\{(concept|parent_concept|selected_text|context_markdown|map_title|language)\}\}/g, (match, key: string) => context[key] ?? match);
  return [render(template.system_prompt), render(template.user_prompt)];
}
export function upsertRelation(source: NodeRecord, target: NodeRecord, text: string, chinese: boolean) {
  const start = `<!-- memgraph-relation:${target.id} -->`;
  const end = `<!-- /memgraph-relation:${target.id} -->`;
  const section = `${start}\n\n## ${chinese ? '与' : 'Relationship to'} ${target.title.replace(/[\r\n]/g, ' ')}${chinese ? '的联系' : ''}\n\n${text.trim()}\n\n${end}`;
  const index = source.markdown.indexOf(start), last = source.markdown.indexOf(end, index);
  return index >= 0 && last >= 0 ? source.markdown.slice(0, index) + section + source.markdown.slice(last + end.length) : `${source.markdown.trim()}\n\n${section}\n`;
}
export function stripTerminal(text: string) {
  return text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}
export function feedbackText(version: string, platform: string, details: Record<string, unknown> = {}) {
  const field = (key: string) => typeof details[key] === 'string' ? (details[key] as string).slice(0, 1200) : '';
  return `MemGraph ${version}\nOS: ${platform}\n\nSteps / 复现步骤:\n${field('steps')}\n\nExpected / 预期结果:\n${field('expected')}\n\nActual / 实际结果:\n${field('description')}\n${field('knowledge') ? `\nUser-selected content / 用户选择的内容:\n${field('knowledge')}` : ''}`;
}
export function feedbackUrl(kind: 'github' | 'email', text: string, title = 'MemGraph feedback') {
  if (kind === 'email') { const params = new URLSearchParams({ subject: title.slice(0, 150), body: text }); return `mailto:leo.oceanai@gmail.com?${params.toString()}`; }
  const url = new URL(`https://github.com/${REPOSITORY}/issues/new`);
  url.searchParams.set('template', 'bug.yml'); url.searchParams.set('title', title.slice(0, 150)); url.searchParams.set('environment', text);
  return url.href;
}
export interface SignedRelease { version: string; channel: 'stable' | 'beta'; files: { name: string; sha512: string; size: number }[] }
export function validateManifest(raw: string, signature: string, publicKey: string, version: string, channel: string): SignedRelease {
  if (!publicKey || !verify(null, Buffer.from(raw), createPublicKey(publicKey), Buffer.from(signature.trim(), 'base64'))) throw new Error('Release signature is invalid.');
  const manifest = JSON.parse(raw) as SignedRelease;
  if (manifest.version !== version || manifest.channel !== channel || !Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error('Release metadata does not match this update.');
  for (const file of manifest.files) if (!/^[\w .()+-]+$/.test(file.name) || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.sha512) || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('Invalid release file.');
  return manifest;
}
export function validateArtifact(bytes: Buffer, file: SignedRelease['files'][number]) {
  if (bytes.length !== file.size || createHash('sha512').update(bytes).digest('base64') !== file.sha512) throw new Error('Update checksum mismatch.');
}
