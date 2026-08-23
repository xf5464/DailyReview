const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

let mainWindow = null;
let staticServer = null;
let appOrigin = null;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function openExternalUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url);
  } catch {
    // Ignore malformed or unsupported external links.
  }
}

function startStaticServer() {
  const root = path.join(app.getAppPath(), 'dist');
  const indexPath = path.join(root, 'index.html');

  if (!fs.existsSync(indexPath)) {
    throw new Error('缺少 dist/index.html，请先运行 npm run build。');
  }

  staticServer = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const requested = pathname === '/' ? '/index.html' : pathname;
      const filePath = path.resolve(root, '.' + requested);

      if (!filePath.startsWith(root + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
          return;
        }
        response.writeHead(200, {
          'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(content);
      });
    } catch {
      response.writeHead(400).end('Bad request');
    }
  });

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      const address = staticServer.address();
      appOrigin = `http://127.0.0.1:${address.port}`;
      resolve(appOrigin);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Daily Review',
    width: 1480,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin + '/')) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(appOrigin + '/');
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    try {
      await startStaticServer();
      createWindow();
    } catch (error) {
      dialog.showErrorBox('Daily Review 无法启动', error.message);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && appOrigin) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
});
