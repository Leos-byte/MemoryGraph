import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { feedbackText, feedbackUrl, renderTemplate, secureEndpoint, upsertRelation, validateArtifact, validateManifest, stripTerminal } from '../main/core';
import type { NodeRecord, TemplateRecord } from '../shared/types';

describe('provider and template boundaries', () => {
  it('requires secure API origins and builds both provider endpoints', () => {
    expect(secureEndpoint('https://example.com/v1/', 'responses').href).toBe('https://example.com/v1/responses');
    expect(secureEndpoint('https://example.com', 'chat_completions').href).toBe('https://example.com/v1/chat/completions');
    for (const base of ['http://example.com', 'https://u:p@example.com', 'file:///tmp/test', 'https://example.com?key=1', 'https://example.com#x']) expect(() => secureEndpoint(base, 'responses')).toThrow();
  });
  it('never recursively expands user-provided placeholder-like text', () => {
    const template = { system_prompt: '{{language}}', user_prompt: '{{concept}} {{context_markdown}}' } as TemplateRecord;
    expect(renderTemplate(template, { language: 'English', concept: '{{context_markdown}}', context_markdown: 'private' })).toEqual(['English', '{{context_markdown}} private']);
  });
  it('keeps generated relationships at the end of the source and replaces only that target', () => {
    const source = { markdown: 'Original explanation', id: '1' } as NodeRecord;
    const target = { id: '2', title: 'Encoding' } as NodeRecord;
    const first = upsertRelation(source, target, 'first relation', false);
    const second = upsertRelation({ ...source, markdown: first }, target, 'new relation', false);
    expect(second).toContain('Original explanation'); expect(second).not.toContain('first relation');
    expect(second.match(/<!-- memgraph-relation:2 -->/g)).toHaveLength(1); expect(second).toContain('new relation');
  });
  it('removes CLI ANSI formatting', () => expect(stripTerminal('\x1b[90mCodex\x1b[0m')).toBe('Codex'));
});

describe('feedback privacy and routing', () => {
  it('includes only explicitly selected fields and no unknown sensitive fields', () => {
    const body = feedbackText('0.2.0', 'linux x64', { apiKey: 'SECRET', database: '/private/path', markdown: 'private notes' });
    expect(body).toContain('0.2.0'); expect(body).not.toMatch(/SECRET|private/);
    const issue = new URL(feedbackUrl('github', body, 'Chinese 中文 & ?'));
    expect(issue.host).toBe('github.com'); expect(issue.searchParams.get('environment')).toBe(body); expect(issue.searchParams.get('title')).toBe('Chinese 中文 & ?');
    expect(feedbackUrl('email', body)).toMatch(/^mailto:leo\.oceanai@gmail\.com\?/);
  });
});

describe('signed update verification', () => {
  const pair = generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const bytes = Buffer.from('test artifact');
  const file = { name: 'MemGraph.AppImage', size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') };
  const raw = JSON.stringify({ version: '0.2.1-beta.1', channel: 'beta', files: [file] });
  const signature = sign(null, Buffer.from(raw), pair.privateKey).toString('base64');
  it('accepts authentic version/platform artifact metadata', () => {
    expect(validateManifest(raw, signature, publicKey, '0.2.1-beta.1', 'beta').files).toEqual([file]);
    expect(() => validateArtifact(bytes, file)).not.toThrow();
  });
  it('rejects tampering, wrong versions/channels and damaged downloads', () => {
    expect(() => validateManifest(raw + ' ', signature, publicKey, '0.2.1-beta.1', 'beta')).toThrow();
    expect(() => validateManifest(raw, signature, publicKey, '0.2.2', 'beta')).toThrow();
    expect(() => validateManifest(raw, signature, publicKey, '0.2.1-beta.1', 'stable')).toThrow();
    expect(() => validateArtifact(Buffer.from('damaged'), file)).toThrow();
  });
});
