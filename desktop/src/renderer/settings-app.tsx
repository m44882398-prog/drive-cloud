import { useEffect, useState, type FormEvent } from 'react'

type Database = { id: string; name: string; is_default: boolean }
type Project = { id: string; name: string }
type AppState = Awaited<ReturnType<typeof window.cloudDrive.getState>>

export function SettingsApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [databases, setDatabases] = useState<Database[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState('')
  const [login, setLogin] = useState({ serverUrl: '', email: '', password: '' })

  async function refreshState() {
    const next = await window.cloudDrive.getState()
    setState(next)
    setLogin((current) => ({ ...current, serverUrl: current.serverUrl || next.settings.serverUrl }))
    setVersion(await window.cloudDrive.getVersion())
    if (next.email) await loadDatabases()
  }

  async function loadDatabases() {
    try {
      const data = await window.cloudDrive.listDatabases()
      setDatabases(data)
      const selected = state?.settings.databaseId || data.find((item) => item.is_default)?.id || data[0]?.id || ''
      if (selected) await loadProjects(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar database.')
    }
  }

  async function loadProjects(databaseId: string) {
    try {
      const data = await window.cloudDrive.listProjects(databaseId)
      setProjects(data)
      const selectedProject = state?.settings.projectId
      const projectId = data.some((project) => project.id === selectedProject)
        ? selectedProject!
        : data[0]?.id ?? ''
      setState((current) => current ? {
        ...current,
        settings: { ...current.settings, databaseId, projectId },
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar project.')
    }
  }

  useEffect(() => {
    void refreshState().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Gagal memuat pengaturan.'))
    const timer = window.setInterval(() => {
      void window.cloudDrive.getState().then((next) => {
        setState((current) => current ? {
          ...current,
          email: next.email,
          status: next.status,
          syncStatus: next.syncStatus,
          online: next.online,
        } : next)
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await window.cloudDrive.login(login)
      await refreshState()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login gagal.')
    } finally {
      setBusy(false)
    }
  }

  async function updateSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const updated = {
        driveLetter: String(form.get('driveLetter')).toUpperCase().replace(/\\?$/, ''),
        syncIntervalSeconds: Number(form.get('syncIntervalSeconds')),
        cacheLimitGb: Number(form.get('cacheLimitGb')),
        startWithWindows: form.get('startWithWindows') === 'on',
        databaseId: state.settings.databaseId,
        projectId: state.settings.projectId,
      }
      await window.cloudDrive.saveSettings(updated)
      setState({ ...state, settings: { ...state.settings, ...updated } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setBusy(false)
    }
  }

  async function selectDatabase(databaseId: string) {
    setError('')
    await loadProjects(databaseId)
  }

  async function mountDrive() {
    if (!state) return
    setBusy(true)
    setError('')
    try {
      await window.cloudDrive.saveSettings(state.settings)
      const status = await window.cloudDrive.mount({
        databaseId: state.settings.databaseId,
        projectId: state.settings.projectId,
      })
      setState({ ...state, status: { ...status, online: true, lastSyncAt: state.status.lastSyncAt } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mount drive.')
    } finally {
      setBusy(false)
    }
  }

  async function unmountDrive() {
    setBusy(true)
    try {
      const status = await window.cloudDrive.unmount()
      setState((current) => current ? {
        ...current,
        status: { ...status, online: current.online, lastSyncAt: current.status.lastSyncAt },
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal melepas drive.')
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setError('')
    try {
      await window.cloudDrive.sync()
      await refreshState()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sync gagal.')
    }
  }

  async function logout() {
    await window.cloudDrive.logout()
    setDatabases([])
    setProjects([])
    await refreshState()
  }

  if (!state) return <main className="shell"><div className="loading">Memuat Cloud Drive…</div></main>

  return (
    <main className="shell">
      <header className="header">
        <div className="brand"><div className="brand-mark">CD</div><div><p className="eyebrow">CLOUD DRIVE</p><h1>Pengaturan desktop</h1></div></div>
        <span className={`connection ${state.online ? 'online' : 'offline'}`}>{state.online ? 'Online' : 'Offline'}</span>
      </header>

      {error && <div role="alert" className="error">{error}</div>}
      {!state.email ? (
        <section className="panel login-panel">
          <div><h2>Login ke Cloud Drive</h2><p>Gunakan akun web app Anda. Token disimpan terenkripsi oleh Windows.</p></div>
          <form onSubmit={submitLogin} className="form-grid">
            <label>Alamat web app<input type="url" required placeholder="https://cloud.example.com" value={login.serverUrl} onChange={(event) => setLogin({ ...login, serverUrl: event.target.value })} /></label>
            <label>Email<input type="email" required autoComplete="username" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
            <label>Password<input type="password" required autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
            <button className="primary" disabled={busy}>{busy ? 'Menghubungkan…' : 'Login'}</button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel account-row">
            <div><p className="eyebrow">AKUN</p><strong>{state.email}</strong></div>
            <button className="quiet" onClick={() => void logout()}>Keluar</button>
          </section>

          <section className="panel">
            <div className="section-heading"><div><p className="eyebrow">VIRTUAL DRIVE</p><h2>Drive letter</h2></div>
              <span className={`drive-state ${state.status.mounted ? 'mounted' : ''}`}>{state.status.message}</span>
            </div>
            <div className="form-grid two-columns">
              <label>Database
                <select value={state.settings.databaseId} onChange={(event) => void selectDatabase(event.target.value)}>
                  <option value="">Pilih database</option>
                  {databases.map((database) => <option key={database.id} value={database.id}>{database.name}</option>)}
                </select>
              </label>
              <label>Project
                <select value={state.settings.projectId} onChange={(event) => setState({ ...state, settings: { ...state.settings, projectId: event.target.value } })}>
                  <option value="">Pilih project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
            </div>
            <form onSubmit={updateSettings} className="form-grid two-columns settings-grid">
              <label>Drive letter
                <select name="driveLetter" defaultValue={state.settings.driveLetter}>
                  {['D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'M:', 'N:', 'O:', 'P:', 'Q:', 'R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:'].map((letter) => <option key={letter}>{letter}</option>)}
                </select>
              </label>
              <label>Interval pemeriksaan sync (detik)<input name="syncIntervalSeconds" type="number" min="15" max="3600" defaultValue={state.settings.syncIntervalSeconds} /></label>
              <label>Batas cache lokal (GB)<input name="cacheLimitGb" type="number" min="1" max="500" defaultValue={state.settings.cacheLimitGb} /></label>
              <label className="check-row"><input name="startWithWindows" type="checkbox" defaultChecked={state.settings.startWithWindows} /> Mulai otomatis saat Windows masuk</label>
              <div className="button-row">
                <button className="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
                {state.status.mounted
                  ? <button className="secondary" type="button" onClick={() => void unmountDrive()} disabled={busy}>Lepas drive</button>
                  : <button className="secondary" type="button" onClick={() => void mountDrive()} disabled={busy || !state.settings.databaseId || !state.settings.projectId}>Mount drive</button>}
              </div>
            </form>
          </section>

          <section className="panel sync-panel">
            <div><p className="eyebrow">STATUS SYNC</p><h2>{state.syncStatus.message}</h2>
              <p className="muted">Terakhir diperiksa: {state.syncStatus.lastSyncAt ? new Date(state.syncStatus.lastSyncAt).toLocaleString() : 'Belum ada'}</p>
              {state.syncStatus.pendingUploads !== null && <p className="muted">Transfer aktif: {state.syncStatus.pendingUploads}</p>}
              {state.syncStatus.error && <p className="error-text">{state.syncStatus.error}</p>}
            </div>
            <button className="secondary" onClick={() => void syncNow()} disabled={!state.status.mounted || !state.online}>Sync sekarang</button>
          </section>
        </>
      )}
      <footer>Cloud Drive Desktop {version} · File yang dibuka diunduh sesuai permintaan; perubahan diunggah melalui WinFsp/rclone.</footer>
    </main>
  )
}
