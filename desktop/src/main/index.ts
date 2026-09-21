import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.loadURL('https://example.com');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'resources', 'icon.png'));
  tray = new Tray(icon.resize({ width: 18, height: 18 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Drive', click: () => mainWindow?.show() },
    { label: 'Pause Sync', click: () => undefined },
    { label: 'Exit', click: () => app.quit() },
  ]);

  tray.setToolTip('Cloud Drive');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
