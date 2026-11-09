import { execFile } from 'child_process'
import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import type { RcloneConfig, RcloneConfigStore, DatabaseSummary, DesktopDatabaseConfig } from './config'

const execFileAsync = promisify(execFile)

export type DesktopSession = {
  accessToken: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

type ApiRequest = <T>(route: string, init?: RequestInit) => Promise<T>

export class RcloneConfigLoader {
  readonly configPath = path.join(app.getPath('appData'), 'rclone', 'rclone.conf')

  constructor(
    private readonly configStore: RcloneConfigStore,
    private readonly requestApi: ApiRequest,
  ) {}

  async login(serverUrl: string, email: string, password: string): Promise<DesktopSession> {
    const normalizedUrl = new URL(serverUrl)
    const isLocalHttp = normalizedUrl.protocol === 'http:' &&
      (normalizedUrl.hostname === 'localhost' || normalizedUrl.hostname === '127.0.0.1')
    if (normalizedUrl.protocol !== 'https:' && !isLocalHttp) {
      throw new Error('URL web app harus menggunakan HTTPS.')
    }

    const response = await fetch(new URL('/api/desktop/auth', normalizedUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const result = await response.json() as DesktopSession & { error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Login ke BASE gagal.')
    return result
  }

  async listDatabases(): Promise<{ databases: DatabaseSummary[]; defaultDatabaseId: string | null }> {
    const records = await this.requestApi<DesktopDatabaseConfig[]>('/api/desktop/config')
    return {
      databases: this.summaries(records),
      defaultDatabaseId: records.find((record) => record.is_default)?.id ?? null,
    }
  }

  async setDefaultDatabase(databaseId: string) {
    await this.requestApi('/api/desktop/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultDatabaseId: databaseId }),
    })
    return this.syncConfig()
  }

  async syncConfig(): Promise<{ databases: DatabaseSummary[]; defaultDatabaseId: string; configPath: string }> {
    const records = await this.requestApi<DesktopDatabaseConfig[]>('/api/desktop/config')
    if (!records.length) throw new Error('Belum ada database aktif. Tambahkan database di web app terlebih dahulu.')

    const selected = records.find((record) => record.is_default)
    if (!selected) {
      throw new Error('Belum ada database default. Pilih database lalu jadikan default di Settings desktop.')
    }

    const preferences = this.configStore.get()
    const endpointUrl = getS3Endpoint(selected)
    const credentials = {
      accessKey: selected.s3_access_key,
      secretKey: selected.s3_secret_key,
      region: selected.s3_region,
      endpoint: endpointUrl,
    }
    if (Object.values(credentials).some((value) => typeof value !== 'string' || !value.trim())) {
      throw new Error(`Konfigurasi S3 database "${selected.name}" belum lengkap. Lengkapi di web app.`)
    }

    for (const [label, value] of Object.entries(credentials)) {
      if (value!.includes('\n') || value!.includes('\r')) {
        throw new Error(`Nilai S3 ${label} tidak boleh berisi baris baru.`)
      }
    }

    let obscuredSecret: string
    try {
      const { stdout } = await execFileAsync(preferences.rclonePath, ['obscure', credentials.secretKey!], {
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      })
      obscuredSecret = stdout.trim()
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`RCLONE_NOT_FOUND: Tidak bisa menjalankan rclone "${preferences.rclonePath}" untuk membuat config: ${detail}`)
    }

    this.configStore.saveDatabaseCredentials({ ...selected, s3_endpoint: endpointUrl })
    const configContents = [
      `[${preferences.remoteName}]`,
      'type = s3',
      'provider = Other',
      `access_key_id = ${credentials.accessKey}`,
      `secret_access_key = ${obscuredSecret}`,
      `region = ${credentials.region}`,
      `endpoint = ${endpointUrl}`,
      '',
    ].join('\r\n')

    await mkdir(path.dirname(this.configPath), { recursive: true })
    const existing = await readFile(this.configPath, 'utf8').catch((cause: unknown) => {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw cause
    })
    const merged = replaceRemoteSection(existing, preferences.remoteName, configContents)
    const temporaryPath = `${this.configPath}.${process.pid}.tmp`
    await writeFile(temporaryPath, merged, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.configPath)

    return {
      databases: this.summaries(records),
      defaultDatabaseId: selected.id,
      configPath: this.configPath,
    }
  }

  clearCredentials() {
    this.configStore.clearDatabaseCredentials()
  }

  async clearGeneratedConfig(remoteName = this.configStore.get().remoteName) {
    const existing = await readFile(this.configPath, 'utf8').catch((cause: unknown) => {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw cause
    })
    const withoutGeneratedRemote = removeRemoteSection(existing, remoteName)
    if (withoutGeneratedRemote === existing) return
    const temporaryPath = `${this.configPath}.${process.pid}.tmp`
    await writeFile(temporaryPath, withoutGeneratedRemote, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.configPath)
  }

  getConfig(): RcloneConfig {
    return this.configStore.get()
  }

  private summaries(records: DesktopDatabaseConfig[]): DatabaseSummary[] {
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      is_default: record.is_default,
      configured: Boolean(record.s3_access_key && record.s3_secret_key && record.s3_region && (record.supabase_url || record.s3_endpoint)),
    }))
  }
}

function getS3Endpoint(database: DesktopDatabaseConfig) {
  if (database.supabase_url) {
    let url: URL
    try {
      url = new URL(database.supabase_url)
    } catch {
      throw new Error(`URL Supabase database "${database.name}" tidak valid.`)
    }
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/i.test(url.hostname) ||
      url.port ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error(`URL database "${database.name}" harus berupa URL project Supabase HTTPS yang valid.`)
    }
    return `${url.origin}/storage/v1/s3`
  }

  if (database.s3_endpoint) {
    let endpoint: URL
    try {
      endpoint = new URL(database.s3_endpoint)
    } catch {
      throw new Error('Endpoint S3 database default bukan URL yang valid.')
    }
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error('Endpoint S3 database default harus berupa HTTPS URL yang valid tanpa kredensial.')
    }
    return endpoint.toString().replace(/\/$/, '')
  }

  throw new Error(`Konfigurasi S3 database "${database.name}" belum memiliki URL Supabase.`)
}

function replaceRemoteSection(existing: string, remoteName: string, replacement: string) {
  const sectionHeader = `[${remoteName}]`
  const lines = existing.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === sectionHeader)
  if (start < 0) return `${existing.trimEnd()}${existing.trim() ? '\r\n\r\n' : ''}${replacement}`

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index
      break
    }
  }
  return [
    ...lines.slice(0, start),
    replacement.trimEnd(),
    ...lines.slice(end),
  ].join('\r\n').replace(/(?:\r?\n){3,}/g, '\r\n\r\n')
}

function removeRemoteSection(existing: string, remoteName: string) {
  const sectionHeader = `[${remoteName}]`
  const lines = existing.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === sectionHeader)
  if (start < 0) return existing
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index
      break
    }
  }
  return [...lines.slice(0, start), ...lines.slice(end)]
    .join('\r\n')
    .replace(/(?:\r?\n){3,}/g, '\r\n\r\n')
    .trim()
    .concat('\r\n')
}
