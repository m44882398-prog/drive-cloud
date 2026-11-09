import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { DatabaseSummary, RcloneConfig } from '../../main/drive/config'
import type { RcloneStatus } from '../../main/drive/rclone-manager'

const initialConfig: RcloneConfig = {
  driveLetter: 'Z:',
  remoteName: 'supabase',
  vfsCacheMode: 'writes',
  enableLinks: true,
  autoMount: false,
  rclonePath: 'rclone',
}

export default function Settings() {
  const [config, setConfig] = useState<RcloneConfig>(initialConfig)
  const [status, setStatus] = useState<RcloneStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [databases, setDatabases] = useState<DatabaseSummary[]>([])
  const [defaultDatabaseId, setDefaultDatabaseId] = useState('')
  const [databaseChoice, setDatabaseChoice] = useState('')

  const loadDatabases = useCallback(async () => {
    const result = await window.rcloneDrive.getDatabases()
    setDatabases(result.databases)
    setDefaultDatabaseId(result.defaultDatabaseId ?? '')
    setDatabaseChoice(result.defaultDatabaseId ?? '')
  }, [])

  const refresh = useCallback(async () => {
    const [nextConfig, nextStatus, nextLogs, state] = await Promise.all([
      window.rcloneDrive.getConfig(),
      window.rcloneDrive.getStatus(),
      window.rcloneDrive.getLogs(),
      window.cloudDrive.getState(),
    ])
    setConfig(nextConfig)
    setStatus(nextStatus)
    setLogs(nextLogs)
    setServerUrl(state.settings.serverUrl)
    setSignedInEmail(state.email)
    if (state.email) {
      try {
        await loadDatabases()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar database dari web app.')
      }
    }
  }, [loadDatabases])

  useEffect(() => {
    let active = true
    const onStatus = window.rcloneDrive.onStatusChange((nextStatus) => {
      setStatus(nextStatus)
      void window.rcloneDrive.getLogs().then(setLogs).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Tidak bisa memuat log rclone.')
      })
    })
    void refresh().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat konfigurasi desktop.')
    })
    const timer = window.setInterval(() => {
      void window.rcloneDrive.getLogs().then((nextLogs) => {
        if (active) setLogs(nextLogs)
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Tidak bisa memuat log rclone.')
      })
    }, 3000)

    return () => {
      active = false
      window.clearInterval(timer)
      onStatus()
    }
  }, [refresh])

  function update<K extends keyof RcloneConfig>(key: K, value: RcloneConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  async function showActionError(cause: unknown, fallback: string) {
    const message = cause instanceof Error ? cause.message : fallback
    setError(message)
    try {
      setLogs(await window.rcloneDrive.getLogs())
    } catch (logCause) {
      const logError = logCause instanceof Error ? logCause.message : 'Tidak bisa memuat log rclone.'
      setError(`${message} (${logError})`)
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('login')
    setError('')
    setNotice('')
    try {
      const result = await window.cloudDrive.login({ serverUrl, email, password })
      setSignedInEmail(result.email ?? email)
      setPassword('')
      await loadDatabases()
      setNotice('Login berhasil. Pilih database default lalu sinkronkan konfigurasi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login ke web app gagal.')
    } finally {
      setBusy('')
    }
  }

  async function logout() {
    setBusy('logout')
    setError('')
    setNotice('')
    try {
      await window.cloudDrive.logout()
      setSignedInEmail(null)
      setDatabases([])
      setDefaultDatabaseId('')
      setDatabaseChoice('')
      setNotice('Logout berhasil; konfigurasi S3 lokal telah dihapus.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Logout gagal.')
    } finally {
      setBusy('')
    }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setBusy('save')
    setError('')
    setNotice('')
    try {
      const saved = await window.rcloneDrive.saveConfig(config)
      setConfig(saved)
      setNotice('Pengaturan berhasil disimpan.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setBusy('')
    }
  }

  async function syncConfig() {
    setBusy('sync')
    setError('')
    setNotice('')
    try {
      const result = await window.rcloneDrive.syncConfig()
      setDatabases(result.databases)
      setDefaultDatabaseId(result.defaultDatabaseId)
      setDatabaseChoice(result.defaultDatabaseId)
      setNotice(`Konfigurasi database berhasil disinkronkan ke ${result.configPath}.`)
    } catch (cause) {
      await showActionError(cause, 'Sinkronisasi konfigurasi gagal.')
    } finally {
      setBusy('')
    }
  }

  async function setDefaultDatabase() {
    if (!databaseChoice) return
    setBusy('default')
    setError('')
    setNotice('')
    try {
      const result = await window.rcloneDrive.setDefaultDatabase(databaseChoice)
      setDatabases(result.databases)
      setDefaultDatabaseId(result.defaultDatabaseId)
      setDatabaseChoice(result.defaultDatabaseId)
      setNotice('Database default berhasil diubah dan konfigurasi rclone disinkronkan.')
    } catch (cause) {
      await showActionError(cause, 'Tidak bisa mengubah database default.')
    } finally {
      setBusy('')
    }
  }

  async function testConnection() {
    setBusy('test')
    setError('')
    setNotice('')
    try {
      if (signedInEmail) await window.rcloneDrive.syncConfig()
      await window.rcloneDrive.saveConfig(config)
      const result = await window.rcloneDrive.testConnection()
      setNotice(result || 'Test koneksi berhasil.')
      setLogs(await window.rcloneDrive.getLogs())
    } catch (cause) {
      await showActionError(cause, 'Test koneksi gagal.')
    } finally {
      setBusy('')
    }
  }

  async function mount() {
    setBusy('mount')
    setError('')
    setNotice('')
    try {
      await window.rcloneDrive.saveConfig(config)
      await window.rcloneDrive.mount(config.driveLetter)
    } catch (cause) {
      await showActionError(cause, 'Mount drive gagal.')
    } finally {
      setBusy('')
    }
  }

  async function unmount() {
    setBusy('unmount')
    setError('')
    setNotice('')
    try {
      await window.rcloneDrive.unmount()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unmount drive gagal.')
    } finally {
      setBusy('')
    }
  }

  async function browsePath() {
    setError('')
    try {
      const selected = await window.rcloneDrive.browsePath()
      if (selected) update('rclonePath', selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dialog pemilihan rclone gagal dibuka.')
    }
  }

  async function openDrive() {
    setError('')
    try {
      await window.rcloneDrive.openDrive()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Drive tidak dapat dibuka.')
    }
  }

  const mounted = status?.mounted ?? false
  const hasUnconfiguredDatabase = databases.some((database) => !database.configured)

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">CD</div>
          <div><p className="eyebrow">CLOUD DRIVE</p><h1>Pengaturan Desktop</h1></div>
        </div>
        <span className={`connection ${mounted ? 'online' : status?.state === 'error' ? 'offline' : ''}`}>
          {status?.state === 'error' ? 'Error' : mounted ? `Mounted ${status?.driveLetter}` : 'Unmounted'}
        </span>
      </header>

      {error && <div role="alert" className="error">{error}</div>}
      {notice && <div role="status" className="notice">{notice}</div>}

      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">KONTROL WEB APP</p><h2>Akun dan database BASE</h2></div>
          <span className={`drive-state ${signedInEmail ? 'mounted' : ''}`}>
            {signedInEmail ? `Login: ${signedInEmail}` : 'Belum login'}
          </span>
        </div>
        {signedInEmail ? (
          <>
            <div className="form-grid two-columns">
              <label>Alamat web app
                <input value={serverUrl} readOnly aria-label="Alamat web app" />
              </label>
              <label>Database default
                <select
                  value={databaseChoice}
                  onChange={(event) => setDatabaseChoice(event.target.value)}
                  disabled={!databases.length || Boolean(busy)}
                >
                  <option value="">Pilih database</option>
                  {databases.map((database) => (
                    <option key={database.id} value={database.id}>
                      {database.name}{database.is_default ? ' (default)' : ''}
                      {!database.configured ? ' - S3 belum lengkap' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                <button type="button" className="primary" disabled={!databaseChoice || databaseChoice === defaultDatabaseId || Boolean(busy)} onClick={() => void setDefaultDatabase()}>
                  {busy === 'default' ? 'Menyimpan...' : 'Jadikan default'}
                </button>
                <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void syncConfig()}>
                  {busy === 'sync' ? 'Menyinkronkan...' : 'Sync Config'}
                </button>
                <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void loadDatabases().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Gagal memuat database.'))}>
                  Muat ulang
                </button>
                <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void logout()}>
                  {busy === 'logout' ? 'Logout...' : 'Logout'}
                </button>
              </div>
            </div>
            {databases.length === 0 && <p>Belum ada database aktif. Tambahkan database melalui web app.</p>}
            {hasUnconfiguredDatabase && <p>Database dengan S3 belum lengkap. Atur kredensial S3 pada web app sebelum sinkronisasi.</p>}
          </>
        ) : (
          <form className="form-grid two-columns" onSubmit={(event) => void login(event)}>
            <label>URL web app
              <input
                required
                type="url"
                placeholder="https://cloud-drive.example.com"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
              />
            </label>
            <label>Email
              <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>Password
              <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="submit" className="primary" disabled={Boolean(busy)}>
                {busy === 'login' ? 'Login...' : 'Login dan ambil database'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">RCLONE</p><h2>Pengaturan drive</h2></div>
          <span className={`drive-state ${mounted ? 'mounted' : ''}`}>{status?.message ?? 'Memeriksa status...'}</span>
        </div>
        <form className="form-grid two-columns settings-grid" onSubmit={(event) => void save(event)}>
          <label>Drive letter
            <input
              aria-label="Drive letter"
              required
              maxLength={2}
              pattern="[A-Za-z]:?"
              title="Masukkan satu huruf drive, contoh Z atau Z:"
              value={config.driveLetter}
              onChange={(event) => update('driveLetter', event.target.value)}
            />
          </label>
          <label>Nama remote
            <input required value={config.remoteName} onChange={(event) => update('remoteName', event.target.value)} />
          </label>
          <label>VFS cache mode
            <select
              value={config.vfsCacheMode}
              onChange={(event) => update('vfsCacheMode', event.target.value as RcloneConfig['vfsCacheMode'])}
            >
              <option value="off">off</option>
              <option value="minimal">minimal</option>
              <option value="writes">writes</option>
              <option value="full">full</option>
            </select>
          </label>
          <label>Path rclone
            <span className="input-with-button">
              <input required value={config.rclonePath} onChange={(event) => update('rclonePath', event.target.value)} />
              <button type="button" className="secondary" onClick={() => void browsePath()}>Browse</button>
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={config.enableLinks} onChange={(event) => update('enableLinks', event.target.checked)} />
            Aktifkan symbolic links (--links)
          </label>
          <label className="check-row">
            <input type="checkbox" checked={config.autoMount} onChange={(event) => update('autoMount', event.target.checked)} />
            Mount otomatis saat aplikasi dimulai
          </label>
          <div className="button-row">
            <button type="submit" className="primary" disabled={Boolean(busy)}>
              {busy === 'save' ? 'Menyimpan...' : 'Simpan pengaturan'}
            </button>
            <button type="button" className="secondary" disabled={Boolean(busy) || !signedInEmail} onClick={() => void testConnection()}>
              {busy === 'test' ? 'Menguji...' : 'Test Connection'}
            </button>
            {mounted ? (
              <>
                <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void unmount()}>
                  {busy === 'unmount' ? 'Unmounting...' : 'Unmount'}
                </button>
                <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void openDrive()}>
                  Open Drive
                </button>
              </>
            ) : (
              <button type="button" className="secondary" disabled={Boolean(busy) || !signedInEmail} onClick={() => void mount()}>
                {busy === 'mount' ? 'Mounting...' : 'Mount'}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">DIAGNOSTIK</p><h2>Log rclone</h2></div>
          <span className="muted">{status?.logPath ?? ''} · 100 baris terakhir</span>
        </div>
        <pre className="log-viewer" aria-label="100 baris log rclone terakhir">
          {logs.length ? logs.join('\n') : 'Belum ada log.'}
        </pre>
      </section>
      <footer>Cloud Drive Desktop · Remote: {config.remoteName}:drive-files</footer>
    </main>
  )
}
