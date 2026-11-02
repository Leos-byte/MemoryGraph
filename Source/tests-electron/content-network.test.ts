import { describe,expect,it,vi } from 'vitest';
import { publicAddress, publicUrl, publicRequest } from '../main/content-network';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
vi.mock('node:https',()=>({request:vi.fn()}));
function response(status:number,chunks:Buffer[]) {
  vi.mocked(request).mockImplementation(((_url:unknown,options:any,receive:(response:any)=>void)=>{
    const request=new EventEmitter() as any;
    request.end=()=>{const stream=Readable.from(chunks);Object.assign(stream,{statusCode:status});queueMicrotask(()=>receive(stream));};
    options.signal.addEventListener('abort',()=>request.emit('error',options.signal.reason),{once:true});return request;
  }) as any);
}
describe('public-only connector destinations',()=>{
  it.each(['127.0.0.1','10.0.0.1','172.16.1.1','192.168.1.1','169.254.169.254','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])('rejects reserved address %s',address=>expect(publicAddress(address)).toBe(false));
  it('accepts public hosts while forbidding credentials, fragments and cleartext',()=>{
    expect(publicAddress('8.8.8.8')).toBe(true);expect(publicUrl('https://example.com/data?q=hi').hostname).toBe('example.com');
    for(const url of ['file:///tmp/a','http://example.com','https://localhost','https://a.localhost','https://[::ffff:127.0.0.1]/','https://user:pass@example.com','https://example.com/#x'])expect(()=>publicUrl(url)).toThrow();
  });
  it('rejects DNS answers containing even one private address before connecting',async()=>{
    vi.mocked(lookup).mockResolvedValueOnce([{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}] as any);
    await expect(publicRequest('https://example.com',{signal:AbortSignal.timeout(1000)})).rejects.toThrow('DNS target');
  });
  it('pins the checked DNS address and does not follow redirects',async()=>{
    vi.mocked(lookup).mockResolvedValueOnce([{address:'8.8.8.8',family:4}] as any);response(302,[]);
    await expect(publicRequest('https://example.com/path',{signal:AbortSignal.timeout(1000)})).rejects.toThrow('Redirects');
    const [url,options]=vi.mocked(request).mock.calls.at(-1)! as any;expect(url.hostname).toBe('example.com');expect(options.agent).toBe(false);
    const callback=vi.fn();options.lookup('example.com',{all:true},callback);expect(callback).toHaveBeenCalledWith(null,[{address:'8.8.8.8',family:4}]);
  });
  it('bounds streamed responses and aborts before a DNS response arrives',async()=>{
    vi.mocked(lookup).mockResolvedValueOnce([{address:'8.8.8.8',family:4}] as any);response(200,[Buffer.from('123'),Buffer.from('456')]);
    await expect(publicRequest('https://example.com',{signal:AbortSignal.timeout(1000),max:4})).rejects.toThrow('size limit');
    vi.mocked(lookup).mockImplementationOnce(()=>new Promise(()=>{}));const controller=new AbortController(),pending=publicRequest('https://example.com',{signal:controller.signal});controller.abort(new Error('Cancelled during DNS'));await expect(pending).rejects.toThrow('Cancelled during DNS');
  });
});
