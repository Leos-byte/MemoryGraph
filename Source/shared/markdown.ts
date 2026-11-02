import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { parseRich, type RichBlock } from './content';
export const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
export function richFences(markdown: string): { raw: string; start: number; end: number }[] {
  const result: { raw: string; start: number; end: number }[] = [];
  const visit = (node: any) => { if (node.type === 'code' && node.lang === 'memgraph-ui') result.push({ raw: node.value, start: node.position.start.offset, end: node.position.end.offset }); else for (const child of node.children ?? []) visit(child); };
  visit(markdownParser.parse(markdown)); return result;
}
export function markdownAssets(markdown: string): Set<string> {
  const ids = new Set<string>();
  const blocks = (items: RichBlock[]) => { for (const item of items) { if (item.assetId) ids.add(item.assetId); if (item.children) blocks(item.children); } };
  const visit = (node: any) => {
    if (typeof node.url === 'string' && /^asset:[a-f0-9]{64}$/.test(node.url)) ids.add(node.url.slice(6));
    if (node.type === 'code' && node.lang === 'memgraph-ui') { try { blocks(parseRich(node.value).blocks); } catch { /* Preserve unknown blocks without interpreting their properties. */ } }
    for (const child of node.children ?? []) visit(child);
  };
  visit(markdownParser.parse(markdown)); return ids;
}
