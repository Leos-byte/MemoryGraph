import type { JSONContent } from '@tiptap/core';
import type { MarkdownManager } from '@tiptap/markdown';
import { markdownParser } from '../../shared/markdown';

export function editorDocument(markdown: string, manager: MarkdownManager): JSONContent {
  const raw = new Map<string, { value: string; block: boolean }>();
  const ranges: { start: number; end: number; marker: string }[] = [];
  const prefix = `MEMGRAPHRAW${crypto.randomUUID().replaceAll('-','')}`;
  const visit = (node: any, top: boolean) => {
    const supported = ['heading','paragraph','list','blockquote','table','thematicBreak'];
    if ((top && !supported.includes(node.type)) || ['html','inlineMath'].includes(node.type)) {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (typeof start !== 'number' || typeof end !== 'number') return;
      const marker = `${prefix}X${raw.size}END`; raw.set(marker, { value: markdown.slice(start,end), block: top }); ranges.push({ start,end,marker }); return;
    }
    for (const child of node.children ?? []) visit(child, false);
  };
  for (const node of markdownParser.parse(markdown).children) visit(node,true);
  let input = markdown; for (const range of ranges.sort((a,b) => b.start-a.start)) input = input.slice(0,range.start)+range.marker+input.slice(range.end);
  const document = manager.parse(input);
  const walk = (node: JSONContent): JSONContent[] => {
    if (node.type === 'paragraph' && node.content?.length === 1 && node.content[0].type === 'text' && raw.get(node.content[0].text ?? '')?.block) return [{ type:'rawBlock', attrs:{ raw:raw.get(node.content[0].text!)!.value } }];
    if (node.type === 'text' && node.text?.includes(prefix)) {
      const output: JSONContent[] = []; let remaining = node.text;
      while (remaining) {
        const start = remaining.indexOf(prefix); if (start < 0) { output.push({ ...node, text:remaining }); break; }
        if (start) output.push({ ...node, text:remaining.slice(0,start) });
        const end = remaining.indexOf('END',start); const marker = remaining.slice(start,end+3), value = raw.get(marker);
        if (end < 0 || !value) { output.push({ ...node, text:remaining.slice(start) }); break; }
        output.push({ type:'rawInline', attrs:{ raw:value.value } }); remaining = remaining.slice(end+3);
      }
      return output;
    }
    return [{ ...node, ...(node.content ? { content:node.content.flatMap(walk) } : {}) }];
  };
  return walk(document)[0];
}
