import Store from 'electron-store'
import { safeStorage } from 'electron'

export type VfsCacheMode = 'off' | 'minimal' | 'writes' | 'full'

export type RcloneConfig = {
  driveLetter: string
  remoteName: string
  vfsCacheMode: VfsCacheMode
  enableLinks: boolean
  autoMount: boolean
  rclonePath: string
}

export type DesktopDatabaseConfig = {
  id: string
  name: string
  is_default: boolean
  supabase_url: string | null
  s3_access_key: string | null
  s3_secret_key: string | null
  s3_region: string | null
  s3_endpoint: string | null
}

export type DatabaseSummary = {
  id: string
  name: string
  is_default: boolean
  configured: boolean
}

type StoredRcloneConfig = RcloneConfig & {
  encryptedDatabaseCredentials?: string
  databaseId?: string
  databaseName?: string
}

export const defaultRcloneConfig: RcloneConfig = {
  driveLetter: 'Z:',
  remoteName: 'supabase',
  vfsCacheMode: 'writes',
  enableLinks: true,
  autoMount: false,
  rclonePath: 'rclone',
}

const cacheModes: VfsCacheMode[] = ['off', 'minimal', 'writes', 'full']

export class RcloneConfigStore {
  private readonly store = new Store<StoredRcloneConfig>({
    name: 'rclone-config',
    defaults: defaultRcloneConfig,
  })

  get(): RcloneConfig {
    const stored = this.store.store
    return {
      driveLetter: stored.driveLetter,
      remoteName: stored.remoteName,
      vfsCacheMode: stored.vfsCacheMode,
      enableLinks: stored.enableLinks,
      autoMount: stored.autoMount,
      rclonePath: stored.rclonePath,
    }
  }

  getSelectedDatabase(): { id: string; name: string } | null {
    const { databaseId, databaseName } = this.store.store
    return databaseId && databaseName ? { id: databaseId, name: databaseName } : null
  }

  saveDatabaseCredentials(database: DesktopDatabaseConfig): DatabaseSummary {
    if (!database.s3_access_key || !database.s3_secret_key || !database.s3_region || !database.s3_endpoint) {
      throw new Error(`Konfigurasi S3 untuk "${database.name}" belum lengkap. Atur di halaman Databases web app.`)
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Enkripsi Windows tidak tersedia; kredensial S3 tidak disimpan.')
    }
    const credentials = {
      accessKey: database.s3_access_key,
      secretKey: database.s3_secret_key,
      region: database.s3_region,
      endpoint: database.s3_endpoint,
    }
    const encryptedDatabaseCredentials = safeStorage.encryptString(JSON.stringify(credentials)).toString('base64')
    this.store.set('encryptedDatabaseCredentials', encryptedDatabaseCredentials)
    this.store.set('databaseId', database.id)
    this.store.set('databaseName', database.name)
    return {
      id: database.id,
      name: database.name,
      is_default: database.is_default,
      configured: true,
    }
  }

  getDatabaseCredentials() {
    const encrypted = this.store.get('encryptedDatabaseCredentials')
    if (!encrypted) return null
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Enkripsi Windows tidak tersedia; kredensial database tidak dapat dibuka.')
    }
    return JSON.parse(
      safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
    ) as { accessKey: string; secretKey: string; region: string; endpoint: string }
  }

  clearDatabaseCredentials() {
    this.store.delete('encryptedDatabaseCredentials')
    this.store.delete('databaseId')
    this.store.delete('databaseName')
  }

  save(input: Partial<RcloneConfig>): RcloneConfig {
    const config = { ...this.get(), ...input }
    const driveLetter = config.driveLetter.trim().toUpperCase()
    const normalizedDriveLetter = /^[A-Z]$/.test(driveLetter)
      ? `${driveLetter}:`
      : driveLetter

    if (!/^[A-Z]:$/.test(normalizedDriveLetter)) {
      throw new Error('Drive letter harus berupa satu huruf A-Z, contoh Z:.')
    }
    if (!/^[\w.-]+$/.test(config.remoteName)) {
      throw new Error('Nama remote hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.')
    }
    if (!cacheModes.includes(config.vfsCacheMode)) {
      throw new Error('Mode VFS cache tidak valid.')
    }
    if (typeof config.enableLinks !== 'boolean' || typeof config.autoMount !== 'boolean') {
      throw new Error('Nilai checkbox konfigurasi harus boolean.')
    }
    if (!config.rclonePath.trim()) {
      throw new Error('Path rclone wajib diisi.')
    }

    const saved = { ...config, driveLetter: normalizedDriveLetter, rclonePath: config.rclonePath.trim() }
    for (const [key, value] of Object.entries(saved) as Array<[keyof RcloneConfig, RcloneConfig[keyof RcloneConfig]]>) {
      this.store.set(key, value)
    }
    return saved
  }
}
