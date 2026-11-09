import { EventEmitter } from 'events'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { createWriteStream, existsSync, type WriteStream } from 'fs'
import { mkdir, open } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import type { RcloneConfig } from './config'

const execFileAsync = promisify(execFile)

export type RcloneStatus = {
  state: 'mounted' | 'unmounted' | 'error'
  mounted: boolean
  driveLetter: string
  message: string
  error?: string
  logPath: string
}

export class RcloneManager extends EventEmitter {
  private process: ChildProcess | null = null
  private logStream: WriteStream | null = null
  private stopping = false
  private status: RcloneStatus
  private readonly logPath: string

  constructor(
    private readonly getConfig: () => RcloneConfig,
    userDataPath: string,
    private readonly rcloneConfigPath = path.join(userDataPath, 'rclone.conf'),
  ) {
    super()
    this.logPath = path.join(userDataPath, 'rclone.log')
    this.status = {
      state: 'unmounted',
      mounted: false,
      driveLetter: '',
      message: 'Unmounted',
      logPath: this.logPath,
    }
  }

  getStatus(): RcloneStatus {
    return { ...this.status, mounted: this.isMounted() }
  }

  isMounted(): boolean {
    return Boolean(this.process && this.process.exitCode === null && !this.process.killed)
  }

  private updateStatus(next: Partial<RcloneStatus>) {
    this.status = { ...this.status, ...next, mounted: next.mounted ?? this.isMounted() }
    this.emit('status', this.getStatus())
    if (this.status.state === 'mounted') this.emit('mounted', this.getStatus())
    if (this.status.state === 'unmounted') this.emit('unmounted', this.getStatus())
    if (this.status.state === 'error') this.emit('error', this.getStatus())
  }

  private writeLog(source: 'stdout' | 'stderr' | 'system', chunk: Buffer | string) {
    this.logStream?.write(`[${new Date().toISOString()}] [${source}] ${chunk.toString().trimEnd()}\n`)
  }

  private async ensureLogStream() {
    await mkdir(path.dirname(this.logPath), { recursive: true })
    if (this.logStream) return
    this.logStream = createWriteStream(this.logPath, { flags: 'a', encoding: 'utf8' })
    this.logStream.on('error', (cause) => {
      this.logStream = null
      const message = `Tidak bisa menulis log rclone: ${cause.message}`
      this.status = { ...this.status, state: 'error', mounted: false, message, error: message }
      this.emit('status', this.getStatus())
      this.emit('error', this.getStatus())
    })
    await new Promise<void>((resolve, reject) => {
      this.logStream!.once('open', () => resolve())
      this.logStream!.once('error', reject)
    })
  }

  private ensureWinFsp() {
    const winfspPaths = [
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'WinFsp', 'bin', 'winfsp-x64.dll'),
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'WinFsp', 'bin', 'winfsp-x64.dll'),
    ]
    if (!winfspPaths.some(existsSync)) {
      throw new Error('WINFSP_NOT_FOUND: WinFsp belum terpasang.')
    }
  }

  private async validateRclonePath(config: RcloneConfig) {
    try {
      await execFileAsync(config.rclonePath, ['version'], {
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      })
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`RCLONE_NOT_FOUND: Tidak bisa menjalankan rclone "${config.rclonePath}": ${detail}`)
    }
  }

  async testConnection() {
    const config = this.getConfig()
    await this.validateRclonePath(config)
    await this.ensureLogStream()
    const remote = `${config.remoteName}:`
    try {
      const result = await execFileAsync(config.rclonePath, ['lsd', `${remote}drive-files`, '--config', this.rcloneConfigPath], {
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024,
      })
      if (result.stdout) this.writeLog('stdout', result.stdout)
      if (result.stderr) this.writeLog('stderr', result.stderr)
      this.writeLog('system', `Connection test succeeded for ${remote}`)
      const directoryCount = result.stdout.trim().split(/\r?\n/).filter(Boolean).length
      return `Berhasil terhubung ke ${remote} (${directoryCount} folder ditemukan).`
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      this.writeLog('system', `Connection test failed for ${remote}: ${detail}`)
      throw new Error(`Test koneksi ke ${remote} gagal: ${detail}. Periksa remote rclone dan log.`)
    }
  }

  async mount(driveLetter: string) {
    if (this.isMounted()) {
      if (this.status.driveLetter === driveLetter.toUpperCase()) return this.getStatus()
      throw new Error(`Drive ${this.status.driveLetter} masih ter-mount. Unmount sebelum mengganti drive letter.`)
    }

    const config = this.getConfig()
    const normalizedLetter = driveLetter.trim().toUpperCase()
    if (!/^[A-Z]:$/.test(normalizedLetter)) {
      throw new Error('Drive letter harus berupa satu huruf A-Z, contoh Z:.')
    }

    await this.ensureLogStream()
    try {
      if (process.platform !== 'win32') {
        throw new Error('RCLONE_PLATFORM_UNSUPPORTED: Virtual drive hanya didukung di Windows.')
      }
      this.ensureWinFsp()
      await this.validateRclonePath(config)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Prasyarat rclone tidak tersedia.'
      this.writeLog('system', message)
      this.updateStatus({
        state: 'error',
        mounted: false,
        driveLetter: normalizedLetter,
        message,
        error: message,
      })
      throw cause
    }

    const remotePath = `${config.remoteName}:drive-files`
    const args = [
      'mount',
      remotePath,
      normalizedLetter,
      '--config',
      this.rcloneConfigPath,
      '--vfs-cache-mode',
      config.vfsCacheMode,
      ...(config.enableLinks ? ['--links'] : []),
    ]

    this.stopping = false
    this.writeLog('system', `Starting: ${config.rclonePath} ${args.join(' ')}`)
    const child = spawn(config.rclonePath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.process = child

    child.stdout?.on('data', (chunk: Buffer) => this.writeLog('stdout', chunk))
    child.stderr?.on('data', (chunk: Buffer) => this.writeLog('stderr', chunk))
    child.once('error', (cause) => {
      const message = `rclone gagal dijalankan: ${cause.message}`
      this.writeLog('system', message)
      if (this.process === child) this.process = null
      this.updateStatus({
        state: 'error',
        mounted: false,
        driveLetter: normalizedLetter,
        message,
        error: message,
      })
    })
    child.once('exit', (code, signal) => {
      const wasStopping = this.stopping
      if (this.process === child) this.process = null
      this.stopping = false
      if (this.logStream) {
        this.writeLog('system', `rclone exited (code=${code}, signal=${signal ?? 'none'})`)
      }
      if (wasStopping || code === 0) {
        this.updateStatus({
          state: 'unmounted',
          mounted: false,
          driveLetter: '',
          message: 'Unmounted',
          error: undefined,
        })
      } else {
        const message = `rclone berhenti dengan kode ${code ?? 'unknown'}. Periksa log: ${this.logPath}`
        this.updateStatus({
          state: 'error',
          mounted: false,
          driveLetter: normalizedLetter,
          message,
          error: message,
        })
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))
    if (this.process !== child || child.exitCode !== null) {
      const message = this.status.error ?? `Mount gagal. Periksa log: ${this.logPath}`
      throw new Error(message)
    }

    this.updateStatus({
      state: 'mounted',
      mounted: true,
      driveLetter: normalizedLetter,
      message: `Mounted di ${normalizedLetter}`,
      error: undefined,
    })
    return this.getStatus()
  }

  async unmount() {
    const child = this.process
    if (!child || !this.isMounted()) {
      this.process = null
      this.updateStatus({
        state: 'unmounted',
        mounted: false,
        driveLetter: '',
        message: 'Unmounted',
        error: undefined,
      })
      return this.getStatus()
    }

    this.stopping = true
    this.writeLog('system', 'Unmount requested; terminating rclone.')
    child.kill()
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ])
    if (this.process === child && child.exitCode === null) {
      child.kill('SIGKILL')
    }
    if (this.process === child) this.process = null
    this.stopping = false
    this.updateStatus({
      state: 'unmounted',
      mounted: false,
      driveLetter: '',
      message: 'Unmounted',
      error: undefined,
    })
    return this.getStatus()
  }

  async getRecentLogs(limit = 100): Promise<string[]> {
    let file
    try {
      file = await open(this.logPath, 'r')
      const { size } = await file.stat()
      const bytesToRead = Math.min(size, 128 * 1024)
      const buffer = Buffer.alloc(bytesToRead)
      await file.read(buffer, 0, bytesToRead, size - bytesToRead)
      return buffer.toString('utf8').split(/\r?\n/).filter(Boolean).slice(-limit)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw cause
    } finally {
      await file?.close()
    }
  }

  async close() {
    await this.unmount()
    if (this.logStream) {
      await new Promise<void>((resolve, reject) => {
        this.logStream!.end((cause?: Error | null) => {
          if (cause) reject(cause)
          else resolve()
        })
      })
      this.logStream = null
    }
  }
}
