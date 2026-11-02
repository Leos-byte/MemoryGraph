import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';

export function publicAddress(address: string): boolean { try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; } }
export function publicUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.hostname.toLowerCase() === 'localhost' || url.hostname.toLowerCase().endsWith('.localhost')) throw new Error('Only public HTTPS URLs without credentials are allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(host) && !publicAddress(host)) throw new Error('Private or reserved addresses are blocked.');
  if ([...url.searchParams.keys()].some(key => /^(api[-_]?key|token|secret|password|access_token)$/i.test(key))) throw new Error('Put credentials in secure authentication settings, not in URLs.');
  return url;
}
export async function publicRequest(value: string, options: { signal: AbortSignal; method?: 'GET' | 'POST'; headers?: Record<string,string>; body?: string; max?: number }): Promise<Buffer> {
  const url = publicUrl(value), host = url.hostname.replace(/^\[|\]$/g, '');
  options.signal.throwIfAborted();
  const addresses = await new Promise<LookupAddress[]>((resolve,reject) => {
    const aborted = () => reject(options.signal.reason);
    options.signal.addEventListener('abort',aborted,{once:true});
    void lookup(host,{all:true}).then(resolve,reject).finally(() => options.signal.removeEventListener('abort',aborted));
  });
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Private or reserved DNS target blocked.');
  options.signal.throwIfAborted();
  // Pin the validated address for this connection; TLS still checks the original hostname.
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method ?? 'GET', headers: options.headers, signal: options.signal, agent: false, lookup: (_host, settings, callback) => {
      if (typeof settings === 'object' && settings.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    } }, res => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) { res.destroy(); reject(new Error(`Remote service returned HTTP ${res.statusCode ?? 0}. Redirects are not followed.`)); return; }
      const chunks: Buffer[] = []; let length = 0;
      res.on('data', (chunk: Buffer) => { length += chunk.length; if (length > (options.max ?? 4 * 1024 * 1024)) { res.destroy(new Error('Response exceeds size limit.')); return; } chunks.push(chunk); });
      res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject);
    });
    req.on('error', reject); req.end(options.body);
  });
}
