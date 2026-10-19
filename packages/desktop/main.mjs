// BridgeMind Studio — native desktop shell (Electron main process).
// Hosts the Studio server (terminals + workspaces) in-process and shows the UI
// in a native window. Browser login runs in real Electron windows (no API keys).
import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_SERVER_ENTRY = path.resolve(__dirname, '../studio/dist/StudioServer.js');
const AUTH_DIR = path.join(os.homedir(), '.opencode-multi');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');
const LOG_FILE = path.join(AUTH_DIR, 'desktop.log');

let mainWindow = null;
let studioServer = null;
let studioPort = 3888;

async function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
  process.stdout.write(line);
  try {
    await fs.mkdir(AUTH_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line, 'utf-8');
  } catch {}
}

// ---------------------------------------------------------------------------
// Studio server (in-process)
// ---------------------------------------------------------------------------
async function startStudioServer() {
  const { StudioServer } = await import(pathToFileURL(STUDIO_SERVER_ENTRY).href);
  for (let port = 3888; port < 3900; port++) {
    const server = new StudioServer({ port });
    try {
      await server.start();
      studioServer = server;
      studioPort = port;
      await log(`Studio server listening on http://localhost:${port}`);
      return;
    } catch (err) {
      await log(`Port ${port} unavailable: ${err.message}`);
    }
  }
  throw new Error('No free port between 3888 and 3899 for the Studio server.');
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 680,
    title: 'BridgeMind Studio',
    backgroundColor: '#0a0d14',
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e131f', symbolColor: '#cbd5e1', height: 48 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Links that try to open a new window go to the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${studioPort}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Native browser login (OpenCode-style): open the provider's real login page
// in an app window, wait for the session cookie, save it, close the window.
// ---------------------------------------------------------------------------
const LOGIN_TARGETS = {
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/auth/login', cookies: ['__Secure-next-auth.session-token'], localStorage: [] },
  claude: { name: 'Claude', url: 'https://claude.ai/login', cookies: ['sessionKey'], localStorage: [] },
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/app', cookies: ['__Secure-1PSID'], localStorage: [] },
  deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/sign_in', cookies: [], localStorage: ['userToken'] },
};

async function saveAuthToken(service, token) {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));
  } catch {}
  existing[service] = token;
  await fs.writeFile(AUTH_FILE, JSON.stringify(existing, null, 2), 'utf-8');
}

async function removeAuthToken(service) {
  try {
    const existing = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));
    delete existing[service];
    await fs.writeFile(AUTH_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch {}
  await session.fromPartition(`persist:login-${service}`).clearStorageData().catch(() => {});
}

async function readSessionToken(loginSession, webContents, target) {
  if (target.cookies.length) {
    const all = await loginSession.cookies.get({});
    for (const name of target.cookies) {
      // Some providers split large cookies into name.0, name.1, ...
      const parts = all
        .filter((c) => c.name === name || c.name.startsWith(`${name}.`))
        .sort((a, b) => a.name.localeCompare(b.name));
      const value = parts.map((c) => c.value).join('');
      if (value.length > 15) return value;
    }
  }
  for (const key of target.localStorage) {
    try {
      const raw = await webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`, true);
      if (raw && raw.length > 15) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.value) return String(parsed.value);
        } catch {}
        return raw;
      }
    } catch {}
  }
  return null;
}

function browserLogin(service) {
  const target = LOGIN_TARGETS[service];
  if (!target) return Promise.resolve({ success: false, error: `Unknown service: ${service}` });

  return new Promise((resolve) => {
    const partition = `persist:login-${service}`;
    const loginSession = session.fromPartition(partition);
    const loginWindow = new BrowserWindow({
      width: 1100,
      height: 820,
      parent: mainWindow ?? undefined,
      title: `Log in to ${target.name} — BridgeMind Studio`,
      backgroundColor: '#ffffff',
      autoHideMenuBar: true,
      webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });

    // Look like a regular Chrome so login pages don't block the embedded window.
    const chromeUA = loginWindow.webContents
      .getUserAgent()
      .replace(/\s?Electron\/\S+/i, '')
      .replace(/\s?@?bridgemind\S*/gi, '');
    loginWindow.webContents.setUserAgent(chromeUA);

    let finished = false;
    const finish = async (result) => {
      if (finished) return;
      finished = true;
      clearInterval(poller);
      clearTimeout(timeout);
      if (!loginWindow.isDestroyed()) loginWindow.close();
      await log(`Browser login ${service}: ${result.success ? 'success' : result.error}`);
      resolve(result);
    };

    const poller = setInterval(async () => {
      if (loginWindow.isDestroyed()) return;
      const token = await readSessionToken(loginSession, loginWindow.webContents, target);
      if (token) {
        await saveAuthToken(service, token);
        finish({ success: true, service, details: `Session captured from ${target.name}` });
      }
    }, 1500);

    const timeout = setTimeout(
      () => finish({ success: false, error: 'Login timed out after 5 minutes.' }),
      5 * 60 * 1000
    );

    loginWindow.on('closed', () => finish({ success: false, error: 'Login window was closed before login completed.' }));
    loginWindow.loadURL(target.url).catch((err) => finish({ success: false, error: err.message }));
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('auth:browser-login', (_e, service) => browserLogin(String(service)));
ipcMain.handle('auth:logout', async (_e, service) => {
  await removeAuthToken(String(service));
  return { success: true };
});
ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a project folder for the new workspace',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('shell:open-external', (_e, url) => {
  if (/^https?:\/\//.test(String(url))) shell.openExternal(String(url));
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startStudioServer();
      createMainWindow();
    } catch (err) {
      await log(`Fatal startup error: ${err.stack || err.message}`);
      dialog.showErrorBox(
        'BridgeMind Studio failed to start',
        `${err.message}\n\nTry running "npm run build" in d:\\Agent, then start again.\nLog: ${LOG_FILE}`
      );
      app.quit();
    }
  });

  app.on('window-all-closed', async () => {
    if (studioServer) await studioServer.stop().catch(() => {});
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && studioServer) createMainWindow();
  });
}
