export {}

import type { DatabaseSummary, RcloneConfig } from '../main/drive/config'
import type { RcloneStatus } from '../main/drive/rclone-manager'

declare global {
  interface Window {
    cloudDrive: {
      login(input: { serverUrl: string; email: string; password: string }): Promise<{ email?: string }>
      logout(): Promise<boolean>
      getState(): Promise<{
        settings: {
          serverUrl: string
          driveLetter: string
          databaseId: string
          projectId: string
          syncIntervalSeconds: number
          cacheLimitGb: number
          startWithWindows: boolean
        }
        email: string | null
        status: { mounted: boolean; driveLetter: string; message: string; online: boolean; lastSyncAt: string | null }
        paused: boolean
        syncStatus: {
          message: string
          error: string | null
          lastSyncAt: string | null
          pendingUploads: number | null
          pendingDownloads: number | null
        }
        online: boolean
      }>
      saveSettings(settings: Record<string, unknown>): Promise<unknown>
      listDatabases(): Promise<Array<{ id: string; name: string; is_default: boolean }>>
      listProjects(databaseId: string): Promise<Array<{ id: string; name: string }>>
      mount(selection: { databaseId: string; projectId: string }): Promise<{ mounted: boolean; driveLetter: string; message: string }>
      unmount(): Promise<{ mounted: boolean; driveLetter: string; message: string }>
      sync(): Promise<{
        message: string
        error: string | null
        lastSyncAt: string | null
        pendingUploads: number | null
        pendingDownloads: number | null
      }>
      getVersion(): Promise<string>
    }
    rcloneDrive: {
      mount(driveLetter?: string): Promise<RcloneStatus>
      unmount(): Promise<RcloneStatus>
      isMounted(): Promise<boolean>
      getStatus(): Promise<RcloneStatus>
      getConfig(): Promise<RcloneConfig>
      saveConfig(config: Partial<RcloneConfig>): Promise<RcloneConfig>
      testConnection(): Promise<string>
      browsePath(): Promise<string | null>
      getLogs(): Promise<string[]>
      getDatabases(): Promise<{
        databases: DatabaseSummary[]
        defaultDatabaseId: string | null
        selectedDatabase: { id: string; name: string } | null
      }>
      syncConfig(): Promise<{
        databases: DatabaseSummary[]
        defaultDatabaseId: string
        configPath: string
      }>
      setDefaultDatabase(databaseId: string): Promise<{
        databases: DatabaseSummary[]
        defaultDatabaseId: string
        configPath: string
      }>
      openDrive(): Promise<boolean>
      onStatusChange(callback: (status: RcloneStatus) => void): () => void
    }
  }
}
