import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { init } from 'echarts';
import type { Store } from './store';
import { ContentStore, assetExtensions } from './content-store';
import { richFences } from '../shared/markdown';
import { parseRich, blockRows, chartOption, type RichBlock, type Values } from '../shared/content';
import { writePrivate } from './config';

export async function exportRich(store: Store, mapId: string, destination: string, viewer: string, interactive: boolean, theme: string, language = 'en') {
  const map = store.maps().find(map => map.id === mapId); if (!map) throw new Error('Map unavailable.');
  const { nodes } = store.graph(mapId), content = new ContentStore(store.db);
  if (nodes.reduce((sum,node) => sum+node.markdown.length,0)>16*1024*1024) throw new Error('Export exceeds 16 MiB of text.');
  const files: Record<string,Uint8Array> = {}, assets: Record<string,string> = {}; let length = 0;
  const put = (path: string, bytes: Uint8Array) => { if ((length+=bytes.length)>128*1024*1024) throw new Error('Export exceeds 128 MiB.'); files[path]=bytes; };
  for (const [id,asset] of content.assets(nodes.map(node=>node.id))) { const path=`assets/${id}.${assetExtensions[asset.mime]}`; assets[id]=path; put(path,asset.bytes); }
  const dataNodes = nodes.map(node => { const cache = Object.fromEntries(content.sources().flatMap(source => { const value=content.cache(node.id,source.id); return value?[[source.id,value]]:[]; })); return { ...node, state:content.state(node.id), cache }; });
  let markdown = store.exportMap(mapId); let chartIndex = 0;
  for (const node of dataNodes) for (const fence of richFences(node.markdown)) {
      let document: ReturnType<typeof parseRich>;
      try { document=parseRich(fence.raw); } catch { continue; }
      const values=node.state[document.blocks[0]?.id] ?? {};
      const fallback: string[] = [];
      const visit = (blocks:RichBlock[]) => { for(const block of blocks){
        if(block.title)fallback.push(`### ${block.title}`);
        if(block.text)fallback.push(block.text);
        const rows=blockRows(block,values,block.sourceId?node.cache[block.sourceId]?.rows:undefined);
        if(block.type==='chart' && rows.length) { const chart=init(null,undefined,{renderer:'svg',ssr:true,width:800,height:360}); try { chart.setOption(chartOption(block,rows)); const path=`assets/chart-${++chartIndex}.svg`; put(path,strToU8(chart.renderToSVGString())); fallback.push(`![${(block.title??'Chart').replace(/[\[\]]/g,'')} ](${path})`); } finally { chart.dispose(); } }
        if(['chart','table'].includes(block.type) && rows.length) { const keys=Object.keys(rows[0]).slice(0,30), escape=(value:unknown)=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' '); fallback.push(`| ${keys.map(escape).join(' | ')} |\n| ${keys.map(()=> '---').join(' | ')} |\n${rows.slice(0,100).map(row=>`| ${keys.map(key=>escape(row[key])).join(' | ')} |`).join('\n')}`); }
        if(block.type==='image' && block.assetId)fallback.push(`![${(block.text??'').replace(/[\[\]]/g,'')}](${assets[block.assetId]??''})`);
        if(block.children)visit(block.children);
      }}; visit(document.blocks);
      const original=node.markdown.slice(fence.start,fence.end); markdown=markdown.replace(original,`${fallback.join('\n\n')}\n\n${original}`);
  }
  for(const [id,path] of Object.entries(assets))markdown=markdown.replaceAll(`asset:${id}`,path);
  put('content.md',strToU8(markdown)); put('source.md',strToU8(store.exportMap(mapId)));
  if(interactive){
    const add = (directory:string) => { for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())add(path);else put('viewer/'+relative(viewer,path).replaceAll('\\','/'),readFileSync(path));} }; add(viewer);
    const data=JSON.stringify({title:map.title,nodes:dataNodes,assets,theme,language}).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
    put('index.html',strToU8(`<!doctype html><html lang="${language==='zh'?'zh-CN':'en'}" data-theme="${theme==='snow-leopard'?'snow-leopard':'calico'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>MemGraph</title><link rel="stylesheet" href="viewer/viewer.css"></head><body><div id="root"></div><script type="application/json" id="content-data">${data}</script><script src="viewer/viewer.js" defer></script></body></html>`));
  }
  writePrivate(destination,Buffer.from(zipSync(files,{level:6})));
}
