import { contextBridge, ipcRenderer } from 'electron';
import { commands, type Bridge, type Command, type LoginState } from '../shared/types';
const api: Bridge = {
  invoke: <T>(command: Command, payload: Record<string, unknown> = {}) => {
    if (!commands.includes(command)) return Promise.reject(new Error('Unknown command'));
    return ipcRenderer.invoke('memgraph:command', command, payload) as Promise<T>;
  },
  onChange: listener => { const fn = () => listener(); ipcRenderer.on('memgraph:changed', fn); return () => ipcRenderer.removeListener('memgraph:changed', fn); },
  onLogin: listener => { const fn = (_: unknown, state: LoginState) => listener(state); ipcRenderer.on('memgraph:login', fn); return () => ipcRenderer.removeListener('memgraph:login', fn); },
  onGenerationError: listener => { const fn = (_: unknown, message: string) => listener(message); ipcRenderer.on('memgraph:generation-error', fn); return () => ipcRenderer.removeListener('memgraph:generation-error', fn); }
};
contextBridge.exposeInMainWorld('memgraph', api);
