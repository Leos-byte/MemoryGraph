import { contextBridge, ipcRenderer } from 'electron';
import { commands, type Bridge, type Command } from '../shared/types';
const api: Bridge = {
  invoke: <T>(command: Command, payload: Record<string, unknown> = {}) => {
    if (!commands.includes(command)) return Promise.reject(new Error('Unknown command'));
    return ipcRenderer.invoke('memgraph:command', command, payload) as Promise<T>;
  },
  onChange: listener => { const fn = () => listener(); ipcRenderer.on('memgraph:changed', fn); return () => ipcRenderer.removeListener('memgraph:changed', fn); },
  onLogin: listener => { const fn = (_: unknown, text: string) => listener(text); ipcRenderer.on('memgraph:login', fn); return () => ipcRenderer.removeListener('memgraph:login', fn); }
};
contextBridge.exposeInMainWorld('memgraph', api);
