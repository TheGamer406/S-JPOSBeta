const { app, BrowserWindow, dialog } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

let serverUrl = null;

/**
 * En una app empaquetada, console.log no va a ninguna parte visible en Linux.
 * Todo queda en un archivo junto a la base de datos, para poder diagnosticar
 * un arranque fallido el día del evento sin tener que abrir una terminal.
 */
function log(mensaje) {
  const linea = `[${new Date().toISOString()}] ${mensaje}\n`;
  console.log(mensaje);
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'sj-pos.log'), linea);
  } catch {
    // Si ni el log se puede escribir, no vale la pena tumbar el arranque por eso.
  }
}

/** Puerto libre elegido acá, para no depender de parsear la salida del servidor. */
function buscarPuertoLibre() {
  return new Promise((resolve, reject) => {
    const probador = net.createServer();
    probador.unref();
    probador.on('error', reject);
    probador.listen(0, '127.0.0.1', () => {
      const { port } = probador.address();
      probador.close(() => resolve(port));
    });
  });
}

function getBasePath() {
  if (process.resourcesPath) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) return unpackedPath;
    const appPath = path.join(process.resourcesPath, 'app');
    if (fs.existsSync(appPath)) return appPath;
  }
  return path.join(__dirname, '..');
}

/** Espera a que el servidor conteste de verdad, no solo a que el proceso exista. */
function esperarServidor(url, intentos = 60) {
  return new Promise((resolve, reject) => {
    const probar = (restantes) => {
      const peticion = net.connect({ host: '127.0.0.1', port: Number(new URL(url).port) }, () => {
        peticion.end();
        resolve(url);
      });
      peticion.on('error', () => {
        peticion.destroy();
        if (restantes <= 0) return reject(new Error('El servidor no respondió a tiempo'));
        setTimeout(() => probar(restantes - 1), 500);
      });
    };
    probar(intentos);
  });
}

async function startServer() {
  if (isDev) {
    return 'http://localhost:4321';
  }

  const dbPath = path.join(app.getPath('userData'), 'sj-pos.db');
  log(`Base de datos: ${dbPath}`);

  const basePath = getBasePath();
  const serverPath = path.join(basePath, 'dist', 'server', 'entry.mjs');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`No se encontró el servidor en ${serverPath}. ¿Falta correr "npm run build"?`);
  }

  const puerto = await buscarPuertoLibre();
  const url = `http://localhost:${puerto}`;

  // El servidor corre DENTRO de este proceso, no como subproceso. Lanzarlo
  // aparte con ELECTRON_RUN_AS_NODE colgaba al cargar better-sqlite3 (el .node
  // está compilado contra el ABI de Electron, y ese modo no lo resuelve bien).
  // Acá, en el proceso principal de Electron, el módulo nativo carga sin más.
  process.env.PORT = String(puerto);
  process.env.HOST = '127.0.0.1';
  process.env.SJ_POS_DB_PATH = dbPath;
  process.env.SJ_POS_MIGRACIONES = path.join(basePath, 'drizzle');

  log(`Levantando el servidor en ${url}`);
  // Importar el entry del adaptador de Astro (modo standalone) lo arranca.
  await import(require('url').pathToFileURL(serverPath).href);

  return esperarServidor(url);
}

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

  ventana.loadURL(serverUrl || 'http://localhost:4321');
}

app.whenReady().then(async () => {
  try {
    serverUrl = await startServer();
    log(`Servidor listo en ${serverUrl}`);
    crearVentana();
  } catch (error) {
    // Cerrar en silencio dejaba al cajero con una app que "no abre" y sin
    // ninguna pista. Mejor decir qué pasó y dónde está el log.
    log(`No se pudo arrancar: ${error.message}`);
    dialog.showErrorBox(
      'S&J POS no pudo arrancar',
      `${error.message}\n\nDetalle en:\n${path.join(app.getPath('userData'), 'sj-pos.log')}`,
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // El servidor vive en este mismo proceso, así que se va con la app.
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) crearVentana();
});

