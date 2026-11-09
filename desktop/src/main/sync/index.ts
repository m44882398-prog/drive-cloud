import { EventEmitter } from 'events'
import { net } from 'electron'
import { DriveManager } from '../drive'

export type SyncStatus = {
  online: boolean
  mounted: boolean
  pendingUploads: number | null
  pendingDownloads: number | null
  lastSyncAt: string | null
  message: string
  error: string | null
}

export class SyncEngine extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private paused = false
  private syncing = false
  private status: SyncStatus = {
    online: true,
    mounted: false,
    pendingUploads: null,
    pendingDownloads: null,
    lastSyncAt: null,
    message: 'Belum tersinkronisasi',
    error: null,
  }

  constructor(private readonly drive: DriveManager) {
    super()
    drive.on('status', (driveStatus) => {
      this.update({ mounted: driveStatus.mounted })
    })
  }

  private update(next: Partial<SyncStatus>) {
    this.status = { ...this.status, ...next, online: net.isOnline() }
    this.emit('status', this.getStatus())
  }

  getStatus() {
    return { ...this.status }
  }

  isPaused() {
    return this.paused
  }

  togglePause() {
    this.paused = !this.paused
    this.update({ message: this.paused ? 'Sync terjadwal dijeda' : 'Sync terjadwal aktif' })
    return this.paused
  }

  async configure(intervalSeconds: number) {
    if (this.timer) clearInterval(this.timer)
    const interval = Math.max(15, Math.min(3600, Number(intervalSeconds) || 30))
    this.timer = setInterval(() => {
      if (net.isOnline()) this.update({ online: true })
      else this.update({ online: false, message: 'Offline; menunggu koneksi' })
      if (!this.paused) {
        void this.syncNow().catch((cause: unknown) => {
          console.error('Scheduled Cloud Drive sync failed:', cause)
        })
      }
    }, interval * 1000)
    this.timer.unref()
  }

  async syncNow() {
    if (this.syncing) return this.getStatus()
    if (this.paused) {
      this.update({ message: 'Sync dijeda' })
      return this.getStatus()
    }
    if (!net.isOnline()) {
      this.update({ online: false, message: 'Offline; perubahan lokal menunggu koneksi' })
      return this.getStatus()
    }
    if (!this.drive.getStatus().mounted) {
      this.update({ mounted: false, message: 'Mount drive untuk memulai sync' })
      return this.getStatus()
    }

    this.syncing = true
    this.update({ error: null, message: 'Memeriksa perubahan...' })
    try {
      const driveStatus = await this.drive.refresh()
      const transferStats = await this.drive.getTransferStats()
      this.update({
        mounted: true,
        lastSyncAt: driveStatus.lastSyncAt,
        pendingUploads: transferStats.transfers,
        pendingDownloads: null,
        message: transferStats.transfers
          ? `${transferStats.transfers} transfer sedang berjalan`
          : 'Drive diperbarui; upload dilakukan oleh rclone setelah file ditutup',
        error: null,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Sync gagal.'
      this.update({ error: message, message })
      throw cause
    } finally {
      this.syncing = false
    }
    return this.getStatus()
  }
}
