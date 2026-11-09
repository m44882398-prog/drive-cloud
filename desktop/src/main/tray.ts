import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray } from 'electron'
import { existsSync } from 'fs'
import path from 'path'
import type { RcloneManager, RcloneStatus } from './drive/rclone-manager'

type TrayOptions = {
  manager: RcloneManager
  openSettings: () => void
  mount: () => Promise<unknown>
  unmount: () => Promise<unknown>
}

export async function showRcloneError(
  parent: BrowserWindow | null,
  cause: unknown,
  logPath: string,
) {
  const message = cause instanceof Error ? cause.message : String(cause)
  let link: string | null = null
  let prompt: string

  if (message.includes('RCLONE_NOT_FOUND')) {
    link = 'https://rclone.org/downloads/'
    prompt = 'rclone tidak ditemukan. Unduh rclone dari situs resminya, atau pilih rclone.exe melalui Settings.'
  } else if (message.includes('WINFSP_NOT_FOUND')) {
    link = 'https://winfsp.dev/rel/'
    prompt = 'WinFsp belum terpasang. Instal WinFsp untuk mengaktifkan drive virtual.'
  } else {
    prompt = message
  }

  const options = {
    type: 'error',
    title: 'Cloud Drive - Mount gagal',
    message: prompt,
    detail: `${message}\n\nLog rclone: ${logPath}`,
    buttons: link ? ['Buka halaman download', 'Buka log', 'Tutup'] : ['Buka log', 'Tutup'],
    defaultId: 0,
    cancelId: link ? 2 : 1,
  } as const
  const result = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options)

  if (link && result.response === 0) await shell.openExternal(link)
  else if ((!link && result.response === 0) || (link && result.response === 1)) {
    const openError = await shell.openPath(logPath)
    if (openError) {
      const options = {
        type: 'warning',
        title: 'Log tidak dapat dibuka',
        message: openError,
        detail: logPath,
      } as const
      if (parent) await dialog.showMessageBox(parent, options)
      else await dialog.showMessageBox(options)
    }
  }
}

export function createDesktopTray(options: TrayOptions) {
  const iconPath = path.join(process.resourcesPath, 'icon.ico')
  const image = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromDataURL(
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="%232563eb"/><path d="M7 10h18v14H7zM10 7h12v3H10z" fill="white"/></svg>',
    )
  const tray = new Tray(image.resize({ width: 18, height: 18 }))

  const update = (status: RcloneStatus = options.manager.getStatus()) => {
    const statusText = status.state === 'mounted'
      ? `Mounted ${status.driveLetter}`
      : status.state === 'error'
        ? 'Error'
        : 'Unmounted'
    tray.setToolTip(`Cloud Drive - ${statusText}`)
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: status.mounted ? 'Unmount' : 'Mount',
        click: () => {
          const operation = status.mounted ? options.unmount() : options.mount()
          void operation.catch((cause: unknown) =>
            showRcloneError(BrowserWindow.getFocusedWindow(), cause, options.manager.getStatus().logPath),
          )
        },
      },
      {
        label: `Open Drive${status.driveLetter ? ` (${status.driveLetter})` : ''}`,
        enabled: status.mounted,
        click: async () => {
          const openError = await shell.openPath(`${status.driveLetter}\\`)
          if (openError) {
            await dialog.showMessageBox({
              type: 'error',
              title: 'Drive tidak dapat dibuka',
              message: openError,
            })
          }
        },
      },
      { label: 'Settings', click: options.openSettings },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ]))
  }

  options.manager.on('status', update)
  tray.on('double-click', options.openSettings)
  update()

  return {
    tray,
    update,
    destroy() {
      options.manager.removeListener('status', update)
      tray.destroy()
    },
  }
}
