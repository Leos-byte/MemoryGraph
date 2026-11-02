import { z } from 'zod';

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export type Values = Record<string, Cell>;
export interface ContentAction { kind: 'query' | 'navigate' | 'createChild' | 'append' | 'update'; target?: string; sourceId?: string; title?: string; markdown?: string }
export interface RichBlock {
  id: string; type: 'markdown' | 'callout' | 'details' | 'tabs' | 'columns' | 'metric' | 'table' | 'chart' | 'input' | 'select' | 'toggle' | 'slider' | 'form' | 'button' | 'image';
  title?: string; text?: string; children?: RichBlock[]; value?: Cell; state?: string; options?: string[];
  min?: number; max?: number; step?: number; data?: Row[]; sourceId?: string; columns?: { key: string; label: string }[];
  chart?: 'line' | 'bar' | 'pie' | 'scatter'; x?: string; y?: string; filter?: { field: string; state: string };
  aggregate?: 'count' | 'sum' | 'mean'; field?: string; assetId?: string; action?: ContentAction;
}
const name = z.string().regex(/^[a-zA-Z][\w-]{0,63}$/);
const cell = z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.null()]);
export const valuesSchema = z.record(name, cell).refine(value => Object.keys(value).length <= 100);
export const rowsSchema = z.array(z.record(z.string().max(100), cell)).max(10000);
export const dataResultSchema = z.object({ rows: rowsSchema, fetchedAt: z.string().datetime(), error: z.string().max(4000).optional(), stale: z.boolean().optional() }).strict();
export const actionSchema = z.object({ kind: z.enum(['query', 'navigate', 'createChild', 'append', 'update']), target: z.string().regex(/^[1-9]\d{0,18}$/).optional(), sourceId: z.string().uuid().optional(), title: z.string().max(200).optional(), markdown: z.string().max(100000).optional() }).strict();
const blockSchema: z.ZodType<RichBlock> = z.lazy(() => z.object({
  id: name, type: z.enum(['markdown','callout','details','tabs','columns','metric','table','chart','input','select','toggle','slider','form','button','image']),
  title: z.string().max(300).optional(), text: z.string().max(100000).optional(), children: z.array(blockSchema).max(100).optional(),
  value: cell.optional(), state: name.optional(), options: z.array(z.string().max(300)).max(100).optional(),
  min: z.number().finite().optional(), max: z.number().finite().optional(), step: z.number().positive().optional(),
  data: rowsSchema.optional(), sourceId: z.string().uuid().optional(), columns: z.array(z.object({ key: z.string().max(100), label: z.string().max(100) }).strict()).max(30).optional(),
  chart: z.enum(['line','bar','pie','scatter']).optional(), x: z.string().max(100).optional(), y: z.string().max(100).optional(),
  filter: z.object({ field: z.string().max(100), state: name }).strict().optional(), aggregate: z.enum(['count','sum','mean']).optional(), field: z.string().max(100).optional(),
  assetId: z.string().regex(/^[a-f0-9]{64}$/).optional(), action: actionSchema.optional()
}).strict());
export interface RichDocument { version: 1; blocks: RichBlock[] }
export function parseRich(raw: string): RichDocument {
  if (raw.length > 1024 * 1024) throw new Error('Component block exceeds 1 MiB.');
  const value: unknown = JSON.parse(raw);
  // Bound recursion before a recursive schema or renderer can exhaust the stack.
  let count = 0; const stack = [{ value, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++count > 200000 || depth > 24) throw new Error('Component data is too complex.');
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__','prototype','constructor'].includes(key)) throw new Error('Forbidden property.');
      if (child && typeof child === 'object') stack.push({ value: child, depth: depth + 1 });
    }
  }
  const document = z.object({ version: z.literal(1), blocks: z.array(blockSchema).max(100) }).strict().parse(value);
  const ids = new Set<string>(); const visit = (blocks: RichBlock[], depth: number, inForm = false) => {
    if (depth > 8) throw new Error('Component nesting exceeds 8 levels.');
    for (const block of blocks) { if (ids.has(block.id) || ids.size >= 256) throw new Error('Duplicate or excessive component IDs.'); if (inForm && block.type==='form') throw new Error('Forms cannot be nested.'); ids.add(block.id); if (block.children) visit(block.children, depth + 1, inForm || block.type==='form'); }
  }; visit(document.blocks, 0); return document;
}
export function bindText(text: string, values: Values): string { return text.replace(/\{\{state:([a-zA-Z][\w-]{0,63})\}\}/g, (_match, name: string) => String(values[name] ?? '')).slice(0, 100000); }
export function blockRows(block: RichBlock, values: Values, data?: Row[]): Row[] {
  const rows = data ?? block.data ?? [];
  return block.filter && values[block.filter.state] !== undefined ? rows.filter(row => String(row[block.filter!.field] ?? '').toLowerCase().includes(String(values[block.filter!.state] ?? '').toLowerCase())) : rows;
}
export function metricValue(block: RichBlock, rows: Row[]): Cell {
  if (!block.aggregate) return block.value ?? '';
  if (block.aggregate === 'count') return rows.length;
  const numbers = rows.map(row => row[block.field ?? '']).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const sum = numbers.reduce((a, b) => a + b, 0); return block.aggregate === 'mean' ? (numbers.length ? sum / numbers.length : 0) : sum;
}
export function chartOption(block: RichBlock, rows: Row[], colors = ['#57756C','#D78A52','#647EAD','#9A718A']) {
  const keys = Object.keys(rows[0] ?? {}), x = block.x ?? keys[0], y = block.y ?? keys[1];
  return { color: colors, animation: false, aria: { enabled: true }, tooltip: { trigger: 'item', renderMode: 'richText' as const }, grid: { left: 55, right: 25, top: 25, bottom: 55 },
    ...(block.chart === 'pie' ? {} : { xAxis: { type: block.chart === 'scatter' ? 'value' : 'category', data: block.chart === 'scatter' ? undefined : rows.map(row => String(row[x] ?? '')) }, yAxis: { type: 'value' } }),
    series: [{ type: block.chart ?? 'bar', ...(block.chart === 'pie' ? { radius: ['25%','65%'] } : {}), data: rows.slice(0, 2000).map(row => block.chart === 'pie' ? { name: String(row[x] ?? ''), value: Number(row[y]) || 0 } : block.chart === 'scatter' ? [Number(row[x]) || 0, Number(row[y]) || 0] : Number(row[y]) || 0) }] };
}
export interface DataSource { id: string; name: string; url: string; params: string[]; path: string; auth: 'none' | 'bearer' | 'header'; header: string }
export const sourceSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), url: z.string().url().max(2048), params: z.array(name).max(20), path: z.string().regex(/^(?:[a-zA-Z_][\w-]*|\d+)(?:\.(?:[a-zA-Z_][\w-]*|\d+))*$|^$/).max(300), auth: z.enum(['none','bearer','header']), header: z.enum(['X-API-Key','Api-Key']).default('X-API-Key') }).strict();
export type DataResult = z.infer<typeof dataResultSchema>;
export interface ImageJob { id: string; nodeId: string; status: 'running' | 'ready' | 'error' | 'cancelled'; assetId?: string; message?: string }
export interface RichProfile { imageModel: string; hasImageKey: boolean; persistent: boolean; sources: (DataSource & { authorized: boolean; hasKey: boolean })[] }
export const richPrompt = `Enhanced Markdown is supported. Keep the explanation readable as ordinary Markdown. When useful, add fenced memgraph-ui blocks containing JSON {"version":1,"blocks":[...]}. Each block needs a unique id starting with a letter and a type. Allowed types: markdown,callout,details,tabs,columns,metric,table,chart,input,select,toggle,slider,form,button,image. Use title,text,value,children,options,state,min,max,step,data (array of flat objects),columns ([{key,label}]),chart (line/bar/pie/scatter),x,y,filter ({field,state}),aggregate (count/sum/mean),field as appropriate. Controls bind by state; text may reference {{state:name}}. Never invent assetIds, sourceIds, node IDs, sources or statistics. Mark invented demonstration data as simulated. Never output executable HTML, JavaScript or external resource requests. Mermaid diagrams and LaTeX math are supported. Image generation and map writes require explicit user confirmation and must not be requested automatically.`;
