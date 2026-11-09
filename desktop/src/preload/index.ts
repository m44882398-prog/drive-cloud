import { contextBridge, ipcRenderer } from 'electron'
import type { RcloneConfig } from '../main/drive/config'
import type { DatabaseSummary } from '../main/drive/config'
import type { RcloneStatus } from '../main/drive/rclone-manager'

contextBridge.exposeInMainWorld('cloudDrive', {
  login: (input: { serverUrl: string; email: string; password: string }) =>
    ipcRenderer.invoke('cloudDrive:login', input),
  logout: () => ipcRenderer.invoke('cloudDrive:logout'),
  getState: () => ipcRenderer.invoke('cloudDrive:getState'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('cloudDrive:saveSettings', settings),
  listDatabases: () => ipcRenderer.invoke('cloudDrive:listDatabases'),
  listProjects: (databaseId: string) => ipcRenderer.invoke('cloudDrive:listProjects', databaseId),
  mount: (selection: { databaseId: string; projectId: string }) =>
    ipcRenderer.invoke('cloudDrive:mount', selection),
  unmount: () => ipcRenderer.invoke('cloudDrive:unmount'),
  sync: () => ipcRenderer.invoke('cloudDrive:sync'),
  getVersion: () => ipcRenderer.invoke('cloudDrive:getVersion'),
  rcloneDrive: {
    mount: (driveLetter?: string) => ipcRenderer.invoke('rclone:mount', driveLetter) as Promise<RcloneStatus>,
    unmount: () => ipcRenderer.invoke('rclone:unmount') as Promise<RcloneStatus>,
    isMounted: () => ipcRenderer.invoke('rclone:isMounted') as Promise<boolean>,
    getStatus: () => ipcRenderer.invoke('rclone:getStatus') as Promise<RcloneStatus>,
    getConfig: () => ipcRenderer.invoke('rclone:getConfig') as Promise<RcloneConfig>,
    saveConfig: (config: Partial<RcloneConfig>) =>
      ipcRenderer.invoke('rclone:saveConfig', config) as Promise<RcloneConfig>,
    testConnection: () => ipcRenderer.invoke('rclone:testConnection') as Promise<string>,
    browsePath: () => ipcRenderer.invoke('rclone:browsePath') as Promise<string | null>,
    getLogs: () => ipcRenderer.invoke('rclone:getLogs') as Promise<string[]>,
    getDatabases: () => ipcRenderer.invoke('rclone:getDatabases') as Promise<{
      databases: DatabaseSummary[]
      defaultDatabaseId: string | null
      selectedDatabase: { id: string; name: string } | null
    }>,
    syncConfig: () => ipcRenderer.invoke('rclone:syncConfig') as Promise<{
      databases: DatabaseSummary[]
      defaultDatabaseId: string
      configPath: string
    }>,
    setDefaultDatabase: (databaseId: string) =>
      ipcRenderer.invoke('rclone:setDefaultDatabase', databaseId) as Promise<{
        databases: DatabaseSummary[]
        defaultDatabaseId: string
        configPath: string
      }>,
    openDrive: () => ipcRenderer.invoke('rclone:openDrive') as Promise<boolean>,
    onStatusChange(callback: (status: RcloneStatus) => void) {
      const listener = (_event: Electron.IpcRendererEvent, status: RcloneStatus) => callback(status)
      ipcRenderer.on('rclone:status', listener)
      return () => ipcRenderer.removeListener('rclone:status', listener)
    },
  },
})
