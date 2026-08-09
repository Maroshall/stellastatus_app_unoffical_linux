const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const core = require('./installer-core');

const isUninstall = process.argv.includes('--uninstall');
const isUpdate = process.argv.includes('--update');
const isDev = process.argv.includes('--dev');
const dirIdx = process.argv.indexOf('--dir');
const targetDirArg = dirIdx >= 0 ? process.argv[dirIdx + 1] : null;
let win = null;

app.setAppUserModelId('com.stellastatus.installer');

function createWindow() {
  win = new BrowserWindow({
    width: isUpdate ? 460 : 760,
    height: isUpdate ? 250 : 540,
    resizable: false,
    frame: false,
    backgroundColor: '#1a1418',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    title: '스텔라상태 설치',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.whenReady().then(() => {
    createWindow();
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('boot', {
        mode: isUninstall ? 'uninstall' : isUpdate ? 'update' : 'install',
        appName: core.APP_NAME,
        version: app.getVersion(),
        defaultDir: core.defaultInstallDir(),
        targetDir: targetDirArg || core.defaultInstallDir(),
      });
    });
  });
}

app.on('window-all-closed', () => app.quit());

// ── IPC ───────────────────────────────────────
ipcMain.handle('choose-dir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

ipcMain.handle('install', async (_e, opts) => {
  try {
    const result = await core.install({
      ...opts,
      onProgress: (p) => win.webContents.send('progress', p),
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('uninstall', async () => {
  try {
    const result = await core.uninstall({ onProgress: (p) => win.webContents.send('progress', p) });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('launch', (_e, exePath) => { core.launch(exePath); });
ipcMain.handle('open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

ipcMain.on('win-minimize', () => win && win.minimize());
ipcMain.on('win-close', () => app.quit());
