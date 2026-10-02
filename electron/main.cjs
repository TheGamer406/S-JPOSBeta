const { app, BrowserWindow } = require('electron');

// En desarrollo, Astro corre aparte (astro dev) y esta ventana solo apunta a localhost.
// En producción, este archivo también debe levantar el servidor Node del build de Astro
// (dist/server/entry.mjs) antes de crear la ventana — pendiente para el empaquetado final.
const DEV_URL = 'http://localhost:4321';

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'S&J POS',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ventana.loadURL(DEV_URL);
}

app.whenReady().then(crearVentana);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) crearVentana();
});
