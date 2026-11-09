import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  net,
  dialog,
  shell,
  type OpenDialogOptions,
} from 'electron'
import { autoUpdater } from 'electron-updater'
import { promises as fs } from 'fs'
import path from 'path'
import { DriveManager } from './drive'
import { RcloneConfigStore, type DatabaseSummary, type RcloneConfig } from './drive/config'
import { RcloneConfigLoader } from './drive/config-loader'
import { RcloneManager } from './drive/rclone-manager'
import { SyncEngine } from './sync'
import { createDesktopTray, showRcloneError } from './tray'

type DesktopSettings = {
  serverUrl: string
  driveLetter: string
  databaseId: string
  projectId: string
  syncIntervalSeconds: number
  cacheLimitGb: number
  startWithWindows: boolean
}

type Session = {
  accessToken: string
  refreshToken: string
  expiresAt?: number
  email?: string
}

const defaultSettings: DesktopSettings = {
  serverUrl: '',
  driveLetter: 'Z:',
  databaseId: '',
  projectId: '',
  syncIntervalSeconds: 30,
  cacheLimitGb: 10,
  startWithWindows: false,
}

let mainWindow: BrowserWindow | null = null
let desktopTray: ReturnType<typeof createDesktopTray> | null = null
let settings = { ...defaultSettings }
let session: Session | null = null
let driveManager: DriveManager
let syncEngine: SyncEngine
let rcloneConfig: RcloneConfigStore
let rcloneManager: RcloneManager
let configLoader: RcloneConfigLoader
let quitting = false
let cleaningUp = false
let sessionRefreshTimer: NodeJS.Timeout | null = null

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')
const sessionPath = () => path.join(app.getPath('userData'), 'session.enc')

async function loadState() {
  try {
    settings = { ...defaultSettings, ...JSON.parse(await fs.readFile(settingsPath(), 'utf8')) }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
  }

  if (!safeStorage.isEncryptionAvailable()) return
  try {
    const encrypted = await fs.readFile(sessionPath())
    session = JSON.parse(safeStorage.decryptString(encrypted)) as Session
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      session = null
      await fs.rm(sessionPath(), { force: true })
    }
  }
}

async function saveSettings(nextSettings: Partial<DesktopSettings>) {
  settings = { ...settings, ...nextSettings }
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8')
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })
  return settings
}

async function saveSession(nextSession: Session | null) {
  session = nextSession
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  if (!nextSession) {
    await fs.rm(sessionPath(), { force: true })
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    session = null
    throw new Error('Penyimpanan terenkripsi Windows tidak tersedia; sesi tidak disimpan.')
  }
  await fs.writeFile(sessionPath(), safeStorage.encryptString(JSON.stringify(nextSession)))
}

async function requestApi<T>(route: string, init: RequestInit = {}): Promise<T> {
  if (!settings.serverUrl) throw new Error('URL web app belum diatur.')
  if (!session) throw new Error('Silakan login kembali.')

  const send = (token: string) => fetch(new URL(route, settings.serverUrl), {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  })
  let response = await send(session.accessToken)
  if (response.status === 401 && session.refreshToken && route !== '/api/desktop/auth/refresh') {
    const refreshed = await fetch(new URL('/api/desktop/auth/refresh', settings.serverUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
    if (!refreshed.ok) {
      await saveSession(null)
      throw new Error('Sesi login kedaluwarsa. Silakan login kembali.')
    }
    session = await refreshed.json() as Session
    await saveSession(session)
    await driveManager?.updateAccessToken(session.accessToken)
    response = await send(session.accessToken)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const result = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    throw new Error(typeof result === 'object' && result && 'error' in result
      ? String(result.error)
      : String(result || `HTTP ${response.status}`))
  }
  return result as T
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 760,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  if (process.env.DESKTOP_RENDERER_URL) {
    void mainWindow.loadURL(process.env.DESKTOP_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  }
}

function openSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function mountRclone() {
  await configLoader.syncConfig()
  const config = rcloneConfig.get()
  return rcloneManager.mount(config.driveLetter)
}

function registerIpc() {
  ipcMain.handle('cloudDrive:login', async (_event, input: { serverUrl: string; email: string; password: string }) => {
    const serverUrl = new URL(input.serverUrl).origin
    const result = await configLoader.login(serverUrl, input.email, input.password)
    settings.serverUrl = serverUrl
    await saveSettings({ serverUrl })
    await saveSession(result)
    return { email: result.email }
  })
  ipcMain.handle('cloudDrive:logout', async () => {
    if (rcloneManager.isMounted()) await rcloneManager.unmount()
    await configLoader.clearGeneratedConfig()
    configLoader.clearCredentials()
    await saveSession(null)
    await driveManager.unmount()
    return true
  })
  ipcMain.handle('cloudDrive:getState', async () => ({
    settings,
    email: session?.email ?? null,
    status: driveManager.getStatus(),
    paused: syncEngine.isPaused(),
    syncStatus: syncEngine.getStatus(),
    online: net.isOnline(),
  }))
  ipcMain.handle('cloudDrive:saveSettings', async (_event, value: Partial<DesktopSettings>) => {
    const saved = await saveSettings(value)
    await syncEngine.configure(saved.syncIntervalSeconds)
    return saved
  })
  ipcMain.handle('cloudDrive:listDatabases', () => requestApi<Array<{ id: string; name: string; is_default: boolean }>>('/api/desktop/databases'))
  ipcMain.handle('cloudDrive:listProjects', (_event, databaseId: string) =>
    requestApi<Array<{ id: string; name: string }>>(`/api/desktop/databases/${encodeURIComponent(databaseId)}/projects`))
  ipcMain.handle('cloudDrive:mount', async (_event, input: { databaseId: string; projectId: string }) => {
    await saveSettings(input)
    await driveManager.mount({ ...settings, token: session?.accessToken ?? '', serverUrl: settings.serverUrl })
    return driveManager.getStatus()
  })
  ipcMain.handle('cloudDrive:unmount', async () => {
    await driveManager.unmount()
    return driveManager.getStatus()
  })
  ipcMain.handle('cloudDrive:sync', () => syncEngine.syncNow())
  ipcMain.handle('cloudDrive:getVersion', () => app.getVersion())

  ipcMain.handle('rclone:mount', async (_event, driveLetter?: string) => {
    if (driveLetter) rcloneConfig.save({ driveLetter })
    try {
      return await mountRclone()
    } catch (cause) {
      if (cause instanceof Error && /RCLONE_NOT_FOUND|WINFSP_NOT_FOUND/.test(cause.message)) {
        await showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
      }
      throw cause
    }
  })
  ipcMain.handle('rclone:unmount', () => rcloneManager.unmount())
  ipcMain.handle('rclone:isMounted', () => rcloneManager.isMounted())
  ipcMain.handle('rclone:getStatus', () => rcloneManager.getStatus())
  ipcMain.handle('rclone:getConfig', () => rcloneConfig.get())
  ipcMain.handle('rclone:saveConfig', async (_event, value: Partial<RcloneConfig>) => {
    const previous = rcloneConfig.get()
    const wasMounted = rcloneManager.isMounted()
    if (wasMounted) await rcloneManager.unmount()
    const saved = rcloneConfig.save(value)
    try {
      if (session && rcloneConfig.getSelectedDatabase()) {
        if (previous.remoteName !== saved.remoteName) {
          await configLoader.clearGeneratedConfig(previous.remoteName)
        }
        await configLoader.syncConfig()
      }
      if (wasMounted) await rcloneManager.mount(saved.driveLetter)
      return saved
    } catch (cause) {
      if (cause instanceof Error && /RCLONE_NOT_FOUND|WINFSP_NOT_FOUND/.test(cause.message)) {
        await showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
      }
      throw cause
    }
  })
  ipcMain.handle('rclone:testConnection', async () => {
    try {
      return await rcloneManager.testConnection()
    } catch (cause) {
      if (cause instanceof Error && /RCLONE_NOT_FOUND|WINFSP_NOT_FOUND/.test(cause.message)) {
        await showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
      }
      throw cause
    }
  })
  ipcMain.handle('rclone:browsePath', async () => {
    const options: OpenDialogOptions = {
      title: 'Pilih rclone executable',
      properties: ['openFile'],
      filters: [{ name: 'Executable', extensions: ['exe'] }],
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle('rclone:getLogs', () => rcloneManager.getRecentLogs(100))
  ipcMain.handle('rclone:getDatabases', async () => {
    const result = await configLoader.listDatabases()
    return {
      ...result,
      selectedDatabase: rcloneConfig.getSelectedDatabase(),
    }
  })
  ipcMain.handle('rclone:syncConfig', async () => {
    const wasMounted = rcloneManager.isMounted()
    if (wasMounted) await rcloneManager.unmount()
    try {
      const result = await configLoader.syncConfig()
      if (wasMounted) await rcloneManager.mount(rcloneConfig.get().driveLetter)
      return result
    } catch (cause) {
      if (cause instanceof Error && /RCLONE_NOT_FOUND|WINFSP_NOT_FOUND/.test(cause.message)) {
        await showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
      }
      throw cause
    }
  })
  ipcMain.handle('rclone:setDefaultDatabase', async (_event, databaseId: string) => {
    const wasMounted = rcloneManager.isMounted()
    if (wasMounted) await rcloneManager.unmount()
    try {
      const result = await configLoader.setDefaultDatabase(databaseId)
      if (wasMounted) await rcloneManager.mount(rcloneConfig.get().driveLetter)
      return result
    } catch (cause) {
      if (cause instanceof Error && /RCLONE_NOT_FOUND|WINFSP_NOT_FOUND/.test(cause.message)) {
        await showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
      }
      throw cause
    }
  })
  ipcMain.handle('rclone:openDrive', async () => {
    const status = rcloneManager.getStatus()
    if (!status.mounted) throw new Error('Drive belum ter-mount.')
    const error = await shell.openPath(`${status.driveLetter}\\`)
    if (error) throw new Error(`Tidak bisa membuka drive: ${error}`)
    return true
  })

  rcloneManager.on('status', (status) => {
    desktopTray?.update(status)
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('rclone:status', status)
    }
  })
  rcloneManager.on('error', (status) => {
    console.error('rclone error:', status.error ?? status.message)
  })

  if (app.isPackaged) {
    autoUpdater.on('error', (error) => console.error('Auto-update failed:', error.message))
    void autoUpdater.checkForUpdatesAndNotify()
  }
}

app.whenReady().then(async () => {
  await loadState()
  rcloneConfig = new RcloneConfigStore()
  const configPath = path.join(app.getPath('appData'), 'rclone', 'rclone.conf')
  rcloneManager = new RcloneManager(() => rcloneConfig.get(), app.getPath('userData'), configPath)
  configLoader = new RcloneConfigLoader(rcloneConfig, requestApi)
  driveManager = new DriveManager()
  syncEngine = new SyncEngine(driveManager)
  await syncEngine.configure(settings.syncIntervalSeconds)
  registerIpc()
  createWindow()
  desktopTray = createDesktopTray({
    manager: rcloneManager,
    openSettings,
    mount: mountRclone,
    unmount: () => rcloneManager.unmount(),
  })
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })
  if (session) {
    void mountRclone().catch((cause: unknown) => {
      console.error('Startup config sync or automatic rclone mount failed:', cause)
      void showRcloneError(mainWindow, cause, rcloneManager.getStatus().logPath)
    })
  }
  sessionRefreshTimer = setInterval(async () => {
    if (!session?.refreshToken || !settings.serverUrl) return
    if (session.expiresAt && Date.now() < session.expiresAt * 1000 - 10 * 60 * 1000) return
    try {
      const refreshed = await fetch(new URL('/api/desktop/auth/refresh', settings.serverUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })
      if (!refreshed.ok) return
      const nextSession = await refreshed.json() as Session
      await saveSession(nextSession)
      await driveManager.updateAccessToken(nextSession.accessToken)
    } catch (cause) {
      console.error('Desktop access-token refresh failed; retaining the current encrypted session:', cause)
    }
  }, 5 * 60 * 1000)
  sessionRefreshTimer.unref()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', (event) => {
  if (!cleaningUp && (driveManager || rcloneManager)) {
    event.preventDefault()
    cleaningUp = true
    quitting = true
    if (sessionRefreshTimer) clearInterval(sessionRefreshTimer)
    desktopTray?.destroy()
    void Promise.all([
      driveManager?.unmount(),
      rcloneManager?.close(),
    ]).finally(() => app.quit())
    return
  }
  quitting = true
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit()
})

app.on('child-process-gone', (_event, details) => {
  if (details.type === 'GPU') return
})
