import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cloudDrive', {
  sync: () => ipcRenderer.invoke('cloudDrive:sync'),
  getVersion: () => ipcRenderer.invoke('cloudDrive:getVersion'),
});
