import { EventEmitter } from 'events'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { app, net } from 'electron'
import { WebDavProxy } from './webdav-proxy'

const execFileAsync = promisify(execFile)

export type MountOptions = {
  serverUrl: string
  token: string
  databaseId: string
  projectId: string
  driveLetter: string
  cacheLimitGb: number
  syncIntervalSeconds: number
}

export type DriveStatus = {
  mounted: boolean
  driveLetter: string
  message: string
  online: boolean
  lastSyncAt: string | null
}

export type TransferStats = {
  transfers: number
  errors: number
  bytes: number
}

export class DriveManager extends EventEmitter {
  private process: ChildProcess | null = null
  private proxy: WebDavProxy | null = null
  private options: MountOptions | null = null
  private proxyPort = 0
  private status: DriveStatus = {
    mounted: false,
    driveLetter: '',
    message: 'Tidak terhubung',
    online: true,
    lastSyncAt: null,
  }
  private readonly configPath = path.join(app.getPath('userData'), 'rclone.conf')
  private readonly cachePath = path.join(app.getPath('userData'), 'vfs-cache')

  getStatus() {
    return { ...this.status, online: this.isOnline() }
  }

  isPaused() {
    return false
  }

  isOnline() {
    return net.isOnline()
  }

  private updateStatus(next: Partial<DriveStatus>) {
    this.status = { ...this.status, ...next, online: this.isOnline() }
    this.emit('status', this.getStatus())
  }

  private getRclonePath() {
    const packaged = path.join(process.resourcesPath, 'rclone.exe')
    if (existsSync(packaged)) return packaged
    const configured = process.env.RCLONE_PATH
    if (configured && existsSync(configured)) return configured
    return 'rclone.exe'
  }

  private async assertPrerequisites() {
    if (process.platform !== 'win32') throw new Error('Virtual drive saat ini hanya didukung di Windows.')
    const winfspPaths = [
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'WinFsp', 'bin', 'winfsp-x64.dll'),
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'WinFsp', 'bin', 'winfsp-x64.dll'),
    ]
    if (!winfspPaths.some(existsSync)) {
      throw new Error('WinFsp belum terpasang. Install WinFsp, lalu jalankan ulang Cloud Drive.')
    }
    try {
      await execFileAsync(this.getRclonePath(), ['version'], { windowsHide: true })
    } catch {
      throw new Error('rclone belum ditemukan. Install rclone atau atur environment variable RCLONE_PATH.')
    }
    if (!/^[A-Z]:$/i.test(this.options?.driveLetter ?? '')) {
      throw new Error('Pilih drive letter yang valid, contoh Z:.')
    }
  }

  private async obscure(value: string) {
    const { stdout } = await execFileAsync(this.getRclonePath(), ['obscure', value], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim()
  }

  private async writeConfig() {
    if (!this.options) throw new Error('Konfigurasi drive belum dipilih.')
    if (!this.proxyPort) throw new Error('WebDAV proxy belum aktif.')
    const password = await this.obscure(this.options.token)
    await fs.mkdir(path.dirname(this.configPath), { recursive: true })
    await fs.mkdir(this.cachePath, { recursive: true })
    const url = `http://127.0.0.1:${this.proxyPort}/`
    const config = [
      '[cloud]',
      'type = webdav',
      `url = ${url}`,
      'vendor = other',
      'user = cloud-drive',
      `pass = ${password}`,
      '',
    ].join('\r\n')
    await fs.writeFile(this.configPath, config, { encoding: 'utf8', mode: 0o600 })
  }

  async mount(options: MountOptions) {
    await this.unmount()
    this.options = { ...options, driveLetter: options.driveLetter.toUpperCase() }
    await this.assertPrerequisites()
    this.proxy = new WebDavProxy({
      serverUrl: this.options.serverUrl,
      databaseId: this.options.databaseId,
      projectId: this.options.projectId,
      token: this.options.token,
    })
    this.proxyPort = await this.proxy.start()
    await this.writeConfig()

    const mountPoint = `${this.options.driveLetter}\\`
    const args = [
      'mount',
      'cloud:',
      mountPoint,
      '--config', this.configPath,
      '--cache-dir', this.cachePath,
      '--vfs-cache-mode', 'full',
      '--vfs-cache-max-size', `${Math.max(1, this.options.cacheLimitGb)}G`,
      '--vfs-cache-max-age', '24h',
      '--vfs-write-back', `${Math.max(5, this.options.syncIntervalSeconds)}s`,
      '--dir-cache-time', '30s',
      '--poll-interval', '30s',
      '--log-level', 'INFO',
      '--log-file', path.join(app.getPath('userData'), 'rclone.log'),
      '--volname', 'Cloud Drive',
      '--rc',
      '--rc-addr', '127.0.0.1:5573',
    ]

    this.process = spawn(this.getRclonePath(), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    this.process.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim()
      if (line) this.updateStatus({ message: line.slice(-240) })
    })
    this.process.once('error', (error) => {
      this.process = null
      this.updateStatus({ mounted: false, message: `rclone gagal dijalankan: ${error.message}` })
    })
    this.process.once('exit', (code) => {
      this.process = null
      this.updateStatus({ mounted: false, message: `Drive berhenti (kode ${code ?? 'unknown'}).` })
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))
    if (!this.process || this.process.exitCode !== null) {
      throw new Error('rclone berhenti sebelum drive berhasil di-mount. Periksa rclone.log.')
    }
    this.updateStatus({
      mounted: true,
      driveLetter: this.options.driveLetter,
      message: `Drive ${this.options.driveLetter} aktif`,
    })
    return this.getStatus()
  }

  async updateAccessToken(token: string) {
    if (!this.options || this.options.token === token) return
    const next = { ...this.options, token }
    const wasMounted = Boolean(this.process)
    if (wasMounted) await this.mount(next)
    else {
      this.options = next
      this.proxy?.updateToken(token)
    }
  }

  async unmount() {
    const process = this.process
    this.process = null
    if (process && !process.killed) {
      process.kill()
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 3000)
        process.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
    await this.proxy?.stop()
    this.proxy = null
    this.proxyPort = 0
    this.updateStatus({ mounted: false, driveLetter: '', message: 'Drive tidak terhubung' })
  }

  private getDrivePath(...segments: string[]) {
    if (!this.status.driveLetter) throw new Error('Drive belum ter-mount.')
    return path.join(`${this.status.driveLetter}\\`, ...segments)
  }

  async listDirectory(relativePath = '') {
    const target = this.getDrivePath(relativePath)
    const entries = await fs.readdir(target, { withFileTypes: true })
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
  }

  async readFile(relativePath: string) {
    return fs.readFile(this.getDrivePath(relativePath))
  }

  async writeFile(relativePath: string, content: Buffer) {
    const target = this.getDrivePath(relativePath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }

  async createDirectory(relativePath: string) {
    return fs.mkdir(this.getDrivePath(relativePath), { recursive: true })
  }

  async deletePath(relativePath: string) {
    return fs.rm(this.getDrivePath(relativePath), { recursive: true })
  }

  async renamePath(oldPath: string, newPath: string) {
    return fs.rename(this.getDrivePath(oldPath), this.getDrivePath(newPath))
  }

  async refresh() {
    if (!this.process) throw new Error('Drive belum ter-mount.')
    const response = await fetch('http://127.0.0.1:5573/vfs/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recursive: true }),
    })
    if (!response.ok) throw new Error(`Rclone refresh gagal: HTTP ${response.status}`)
    this.updateStatus({ lastSyncAt: new Date().toISOString(), message: 'Drive tersinkronisasi' })
    return this.getStatus()
  }

  async getTransferStats(): Promise<TransferStats> {
    if (!this.process) return { transfers: 0, errors: 0, bytes: 0 }
    const response = await fetch('http://127.0.0.1:5573/core/stats')
    if (!response.ok) throw new Error(`Tidak bisa mengambil status rclone: HTTP ${response.status}`)
    const result = await response.json() as {
      transferring?: unknown[]
      errors?: number
      bytes?: number
    }
    return {
      transfers: result.transferring?.length ?? 0,
      errors: result.errors ?? 0,
      bytes: result.bytes ?? 0,
    }
  }
}
