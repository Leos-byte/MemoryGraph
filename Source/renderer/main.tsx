import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './themes/snow-leopard.css';
import './content/content.css';
import 'katex/dist/katex.min.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
