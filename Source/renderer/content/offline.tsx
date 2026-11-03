import React from 'react';
import { createRoot } from 'react-dom/client';
import { RichContent } from './RichContent';
import '../styles.css';
import '../themes/snow-leopard.css';
import './content.css';
import 'katex/dist/katex.min.css';
const data=JSON.parse(document.getElementById('content-data')!.textContent!);
createRoot(document.getElementById('root')!).render(<main className="offline-content"><h1>{data.title}</h1>{data.nodes.map((node:any)=><article className="markdown" key={node.id} id={`node-${node.id}`}><h2>{node.title}</h2><RichContent markdown={node.markdown} offline assets={data.assets} state={node.state} cache={node.cache} language={data.language}/></article>)}</main>);
