// App desktop: finestra che carica la pagina locale, con accesso al microfono
// e salvataggio automatico delle registrazioni in Documenti/Rilievo Acustico.
const { app, BrowserWindow, session, shell, systemPreferences, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const ALLOWED = new Set(['media', 'audioCapture', 'speaker-selection']);
const dataDir = () => path.join(app.getPath('documents'), 'Rilievo Acustico');

function uniquePath(dir, name) {
  const ext = path.extname(name), stem = path.basename(name, ext);
  let p = path.join(dir, name), n = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${stem} (${n++})${ext}`);
  return p;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 900, minWidth: 420, minHeight: 560, backgroundColor: '#0b3540', title: 'Rilievo Acustico',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // i link esterni si aprono nel browser, mai dentro l'app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(ALLOWED.has(permission)));
  ses.setPermissionCheckHandler((wc, permission) => ALLOWED.has(permission));
  ses.on('will-download', (event, item) => {
    const name = item.getFilename();
    if (/\.wav$/i.test(name)) {
      // registrazioni: salvate senza chiedere
      const dir = path.join(dataDir(), 'Registrazioni');
      fs.mkdirSync(dir, { recursive: true });
      item.setSavePath(uniquePath(dir, name));
    } else {
      // relazioni PDF: finestra «Salva con nome» nella cartella dell'app
      fs.mkdirSync(dataDir(), { recursive: true });
      item.setSaveDialogOptions({ defaultPath: path.join(dataDir(), name) });
      item.once('done', (e, state) => { if (state === 'completed') shell.showItemInFolder(item.getSavePath()); });
    }
  });
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('microphone'); } catch (e) { /* richiesto di nuovo al primo uso */ }
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'Apri la cartella delle registrazioni', click: () => { fs.mkdirSync(dataDir(), { recursive: true }); shell.openPath(dataDir()); } },
      { type: 'separator' }, process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'Vista', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Aiuto', submenu: [{ label: 'Informazioni', click: () => dialog.showMessageBox({ message: 'Rilievo Acustico', detail: `Versione ${app.getVersion()}\nStudio M · Massimiliano Mascioli Trippa` }) }] },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
