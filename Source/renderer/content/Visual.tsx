import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import type { RichBlock, Row } from '../../shared/content';
import { chartOption } from '../../shared/content';

export function Chart({ block, rows }: { block: RichBlock; rows: Row[] }) {
  const ref = useRef<HTMLDivElement>(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true; let chart: import('echarts').ECharts | undefined; let observer: ResizeObserver | undefined; let theme:MutationObserver|undefined;
    void import('echarts').then(echarts => {
      if (!active || !ref.current) return;
      chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
      const apply = () => {
        if (!ref.current || !chart) return;
        const css=getComputedStyle(ref.current), colors=['--accent','--primary','--info','--warning'].map(key=>css.getPropertyValue(key).trim()), option=chartOption(block,rows,colors);
        chart.setOption({...option,textStyle:{color:css.color},xAxis:option.xAxis?{...option.xAxis,axisLabel:{color:css.color}}:undefined,yAxis:option.yAxis?{...option.yAxis,axisLabel:{color:css.color},splitLine:{lineStyle:{color:css.getPropertyValue('--line').trim()}}}:undefined},{notMerge:true});
      };
      apply(); theme=new MutationObserver(apply);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      observer = new ResizeObserver(() => chart?.resize()); observer.observe(ref.current);
    }).catch(error => { if (active) setError(String(error)); });
    return () => { active = false; observer?.disconnect(); theme?.disconnect(); chart?.dispose(); };
  }, [block, rows]);
  return <>{error ? <p role="alert">{error}</p> : <div ref={ref} className="content-chart" role="img" aria-label={block.title ?? 'Chart'} />}</>;
}
let diagramId = 0;
export function Diagram({ source }: { source: string }) {
  const [svg, setSvg] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (source.length > 20000 || /%%\{|^\s*---|\bclick\s|<\s*(?:script|iframe|foreignObject|image)\b|https?:|data:/im.test(source)) { setError('Unsupported diagram directive or external content.'); return; }
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels:false, maxTextSize: 20000, maxEdges: 150, suppressErrorRendering: true });
      const result = await mermaid.render(`content-diagram-${++diagramId}`, source);
      const clean=DOMPurify.sanitize(result.svg,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','image','a','style'],FORBID_ATTR:['href','xlink:href','style']});
      const root=new DOMParser().parseFromString(clean,'image/svg+xml').documentElement as unknown as SVGSVGElement;
      const box=root.viewBox?.baseVal;
      if(!box || !Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width<=0 || box.height<=0)throw new Error('Invalid diagram dimensions.');
      root.setAttribute('width',String(Math.min(box.width,1200)));
      if(active)setSvg(new XMLSerializer().serializeToString(root));
    }).catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [source]);
  return error ? <div className="content-error" role="alert"><p>{error}</p><pre>{source}</pre></div> : <div className="content-diagram" role="img" aria-label="Diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
