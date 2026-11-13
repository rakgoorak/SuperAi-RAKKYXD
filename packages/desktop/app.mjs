import { app, BrowserWindow, ipcMain, shell, dialog, clipboard, nativeImage, nativeTheme, Notification, Tray, Menu } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserController } from "./browser.mjs";
import { createBrowserAutomation } from "./browser-automation.mjs";
import { createComputerControl } from "./computer-control.mjs";
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { prepareDesktopPath } from "./platform-env.mjs";
import { Updater } from "./updater.mjs";
import { UsagePing } from "./usage.mjs";
import { createTrayController } from './tray.mjs';
import { tr } from './i18n.mjs';
prepareDesktopPath();
// Started from inside a Claude Code session: do not pass its session markers on to the CLIs
// opened here (with CLAUDE_CODE_CHILD_SESSION, Claude Code stops saving conversations).
for (const name of ["CLAUDECODE", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_HOST_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_PID"])
  delete process.env[name];
const directory = path.dirname(fileURLToPath(import.meta.url));
if (process.env.SUPERAI_DATA_DIR)
  app.setPath("userData", process.env.SUPERAI_DATA_DIR);
// Multithreaded on-device speech recognition (speak-to-type) needs SharedArrayBuffer.
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");
// Avoid GPU process crash loops / device contention in automated tests and headless environments
if (process.env.SUPERAI_TEST_MODE === "1" || process.argv.includes("--disable-gpu")) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
// Start in a given interface language (tests, or anyone who wants it); otherwise the computer's.
// The language picked in the installer (or later in the app) is the window's starting language.
const chosenLanguage = (() => {
  try { return readFileSync(path.join(process.env.SUPERAI_DATA_DIR || path.join(os.homedir(), ".opencode-multi"), "locale.txt"), "utf8").trim(); } catch { return ""; }
})();
const startLanguage = process.env.SUPERAI_LANG || chosenLanguage;
if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(startLanguage)) app.commandLine.appendSwitch("lang", startLanguage);
// Same id as the installer's shortcuts: Windows groups the taskbar button with them and shows our toasts.
if (process.platform === "win32") app.setAppUserModelId("com.rakgoorak.superai");
let window, server, browser, trayController, browserAutomation, computer;
const updater = new Updater({
  currentVersion: app.getVersion(),
  // SUPERAI_UPDATE_TEST lets a dev build exercise the real download/install path.
  packaged: app.isPackaged || process.env.SUPERAI_UPDATE_TEST === "1",
  onState: (state) => window?.webContents.send("update:state", state),
});
const sanitizeLog = (str) => {
  return String(str || "")
    .replace(/(sk-[a-zA-Z0-9_-]{20,})/g, "sk-***[REDACTED]")
    .replace(/(ghp_[a-zA-Z0-9]{20,})/g, "ghp_***[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1***[REDACTED]")
    .replace(/((?:password|token|secret|apiKey|api_key)["']?\s*[:=]\s*["'])([^"']{4,})(["'])/gi, "$1***[REDACTED]$3");
};
const log = async (text) => {
  try {
    const dir = path.join(os.homedir(), ".opencode-multi");
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.appendFile(
      path.join(dir, "desktop.log"),
      `[${new Date().toISOString()}] ${sanitizeLog(text)}\n`,
      { mode: 0o600 }
    );
  } catch {}
};
function trusted(event) {
  if (
    !window ||
    event.sender.id !== window.webContents.id ||
    event.senderFrame !== window.webContents.mainFrame
  )
    throw new Error(tr("ไม่อนุญาตการเรียกจากหน้าเว็บภายนอก"));
}
ipcMain.handle("app:folder", async (e) => {
  trusted(e);
  const r = await dialog.showOpenDialog(window, {
    title: tr("เลือกโฟลเดอร์โปรเจกต์"),
    properties: ["openDirectory", "createDirectory"],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("app:external", async (e, url) => {
  trusted(e);
  await shell.openExternal(normalizeBrowserUrl(url));
});
ipcMain.handle("clipboard:stage-image", async (e, filePath) => {
  trusted(e);
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error(tr("ตำแหน่งไฟล์ไม่ถูกต้อง"));
  }
  const cleanPath = path.resolve(filePath.trim());
  const ext = path.extname(cleanPath).toLowerCase();
  const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new Error(tr("รองรับเฉพาะไฟล์รูปภาพ"));
  }
  const stat = await fs.stat(cleanPath);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) {
    throw new Error(tr("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 20 MB"));
  }
  const img = nativeImage.createFromPath(cleanPath);
  if (img.isEmpty()) {
    throw new Error(tr("ไม่สามารถอ่านข้อมูลรูปภาพได้"));
  }
  clipboard.writeImage(img);
  return { success: true };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let applying = null;
/**
 * "Update now": finish the download, wait until nothing is mid-answer (unless forced),
 * save the open tabs so they come back on the same conversations, then install and restart.
 */
function applyUpdate() {
  applying ??= (async () => {
    try {
      if (updater.state.status === "available" || (updater.state.status === "error" && updater.state.asset)) await updater.download();
      while (["downloading", "extracting", "checking"].includes(updater.state.status)) await sleep(400);
      if (!["ready", "waiting"].includes(updater.state.status)) return updater.state;
      for (;;) {
        const busy = updater.force ? [] : server?.busy() || [];
        if (!busy.length) break;
        updater.set({ status: "waiting", waitingFor: busy });
        await sleep(2000);
        if (updater.state.status !== "waiting") return updater.state; // cancelled
      }
      updater.set({ waitingFor: [] });
      server?.saveRestore();
      try {
        const state = await updater.install();
        await log(`Installing update ${state.latestVersion}`);
        setTimeout(() => app.quit(), 300);
        return state;
      } catch (error) {
        server?.discardRestore();
        updater.set({ status: "ready" });
        throw error;
      }
    } finally {
      updater.force = false;
      applying = null;
    }
  })();
  return applying;
}
// Check shortly after launch and every 30 minutes; a newer release downloads in the background.
async function checkForUpdate() {
  const state = await updater.check();
  if (state.status === "available" && updater.packaged) void updater.download();
}
ipcMain.handle("update:action", async (e, action) => {
  trusted(e);
  if (action === "state") return updater.state;
  if (action === "check") return updater.check();
  if (action === "download") return updater.download();
  if (action === "apply") return applyUpdate();
  if (action === "force") {
    updater.force = true;
    return applying ? updater.state : applyUpdate();
  }
  if (action === "cancel") {
    if (updater.state.status === "waiting") return updater.set({ status: "ready", waitingFor: [] });
    return updater.cancel(), updater.state;
  }
  if (action === "install") return applyUpdate();
  throw new Error(tr("คำสั่งอัปเดตไม่ถูกต้อง"));
});
// Anonymous usage count (see usage.mjs). Only installed builds count, never dev or test runs.
let usage;
const usagePing = () => usage ||= new UsagePing({
  dir: app.getPath("userData"),
  version: app.getVersion(),
  active: app.isPackaged && !process.env.SUPERAI_TEST_MODE,
});
// "Let the AI control this computer" (Settings > AI control): read and switched by the window only.
ipcMain.handle("computer:action", async (e, action, value) => {
  trusted(e);
  if (!computer) throw new Error(tr("คำสั่งไม่ถูกต้อง"));
  if (action === "state") return computer.state();
  if (action === "set") return computer.setEnabled(value === true);
  throw new Error(tr("คำสั่งไม่ถูกต้อง"));
});
ipcMain.handle("usage:action", async (e, action, value) => {
  trusted(e);
  if (action === "state") return usagePing().state();
  if (action === "set") return usagePing().setEnabled(value === true);
  throw new Error(tr("คำสั่งไม่ถูกต้อง"));
});
ipcMain.handle("browser:action", async (e, action, payload) => {
  trusted(e);
  if (
    ![
      "create",
      "close",
      "select",
      "navigate",
      "back",
      "forward",
      "reload",
      "stop",
      "state",
      "bounds",
    ].includes(action)
  )
    throw new Error(tr("คำสั่ง browser ไม่ถูกต้อง"));
  return browser.action(action, payload);
});
// Kept referenced until closed: a garbage-collected Notification loses its click handler.
const notices = new Set();
ipcMain.handle("app:notify", async (e, notice) => {
  trusted(e);
  if (!window || !notice || typeof notice.title !== "string") return;
  if (!window.isFocused()) window.flashFrame(true);
  if (!Notification.isSupported()) return;
  const shown = new Notification({
    title: notice.title.slice(0, 120),
    body: String(notice.body || "").slice(0, 240),
    icon: path.join(directory, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
  });
  notices.add(shown);
  const forget = () => notices.delete(shown);
  shown.on("close", forget);
  shown.on("click", () => {
    forget();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.send("notify:open", notice.target);
  });
  shown.show();
});
ipcMain.handle("credentials:forget", async (e, service) => {
  trusted(e);
  try {
    const { BrowserLoginManager } = await import("../core/dist/providers/BrowserLogin.js");
    await new BrowserLoginManager().logout(service);
    // Preview tabs share one partition: close them before clearing its session data.
    await browser.forgetSession();
    return { success: true, previewCleared: true };
  } catch {
    return { success: false, error: tr("ลืมข้อมูลไม่สำเร็จ กรุณาตรวจคลัง credential ของระบบ") };
  }
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(async () => {
    // The UI is dark-only; without this Windows draws <select> popups and scrollbars in the light OS theme.
    nativeTheme.themeSource = "dark";
    try {
      const { StudioServer } = await import(
        pathToFileURL(path.resolve(directory, "../studio/dist/StudioServer.js"))
          .href
      );
      // The page's saved state (tab layout, mode, unsent text) belongs to its origin, so the
      // last port is tried first: after an update the app comes back on the same address.
      const portFile = path.join(app.getPath("userData"), "last-port.json");
      const lastPort = await fs.readFile(portFile, "utf8").then((t) => Number(JSON.parse(t).port)).catch(() => 0);
      const ports = Array.from({ length: 12 }, (_, i) => 3888 + i);
      if (ports.includes(lastPort)) ports.unshift(...ports.splice(ports.indexOf(lastPort), 1));
      for (const port of ports) {
        const candidate = new StudioServer({
          port,
          // The AI's browser tools act on the side browser panel of this window.
          browser: (tool, args) => {
            if (tool.startsWith("computer_")) return computer ? computer.run(tool, args) : Promise.reject(new Error("The SuperAi window is not open yet"));
            if (!browserAutomation) return Promise.reject(new Error("The SuperAi window is not open yet"));
            return browserAutomation(tool, args);
          },
          customWorkspacePath: process.env.SUPERAI_DATA_DIR
            ? path.join(process.env.SUPERAI_DATA_DIR, "workspaces.json")
            : undefined,
        });
        try {
          await candidate.start();
          server = candidate;
          break;
        } catch {
          await candidate.stop().catch(() => {});
        }
      }
      if (!server) throw new Error(tr("พอร์ต 3888–3899 ถูกใช้งานทั้งหมด"));
      await fs.mkdir(path.dirname(portFile), { recursive: true }).catch(() => {});
      await fs.writeFile(portFile, JSON.stringify({ port: server.getPort() })).catch(() => {});
      window = new BrowserWindow({
        width: 1540,
        height: 980,
        minWidth: 1040,
        minHeight: 680,
        title: "SuperAi & RAKKYXD",
        icon: path.join(directory, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
        backgroundColor: "#242422",
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: "hidden",
        ...(process.platform === "darwin"
          ? { trafficLightPosition: { x: 16, y: 19 } }
          : {}),
        titleBarOverlay: {
          color: "#0d1117",
          symbolColor: "#e2e8f0",
          height: 38,
        },
        webPreferences: {
          preload: path.join(directory, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      browser = new BrowserController(window);
      computer = createComputerControl({
        settingsFile: path.join(app.getPath("userData"), "computer-use.json"),
        // The Stop button on the bar turns it off; the settings screen shows the new state.
        onStop: () => { if (!window.isDestroyed()) window.webContents.send("computer:state", computer.state()); },
      });
      browserAutomation = createBrowserAutomation(browser, {
        reveal: () => { if (!window.isDestroyed()) window.webContents.send("browser:reveal", {}); },
      });
      try {
        // Windows picks the right size out of the .ico; elsewhere the 1024px PNG must be shrunk
        // to menu-bar size or it would cover the whole bar.
        trayController = createTrayController({ app, window, Tray, Menu,
          icon: process.platform === 'win32' ? path.join(directory, 'assets', 'icon.ico')
            : nativeImage.createFromPath(path.join(directory, 'assets', 'icon.png')).resize({ width: 18, height: 18 }) });
      } catch (error) {
        // If the OS cannot create a tray icon, closing still exits instead of hiding an unreachable app.
        await log(`System tray unavailable: ${error.message}`);
      }
      window.once("ready-to-show", () => window.show());
      window.webContents.setWindowOpenHandler(({ url }) => {
        try {
          shell.openExternal(normalizeBrowserUrl(url));
        } catch {}
        return { action: "deny" };
      });
      const appUrl = `http://127.0.0.1:${server.getPort()}`;
      window.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== appUrl) event.preventDefault();
      });
      window.webContents.on("console-message", (_event, _level, message) =>
        log(message),
      );
      window.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
          window.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
      window.on("resize", () => browser.layout());
      window.on("focus", () => window.flashFrame(false));
      window.on("closed", () => {
        window = null;
        if (!app.isQuitting) app.quit();
      });
      await window.loadURL(appUrl).catch((error) => {
        // A reload (Ctrl+R, the error screen's reload button) before the first load finished
        // replaces it and rejects this promise with ERR_ABORTED. The page is fine: never show
        // "could not open" and quit for that.
        if (error?.code !== "ERR_ABORTED" && error?.errno !== -3) throw error;
      });
      await log(`SuperAi & RAKKYXD ${app.getVersion()} started at ${appUrl}`);
      usagePing().start();
      if (updater.packaged && !process.env.SUPERAI_TEST_MODE) {
        setTimeout(() => void checkForUpdate(), 4000);
        setInterval(() => void checkForUpdate(), 30 * 60_000);
      }
    } catch (error) {
      await log(error.stack || error.message);
      dialog.showErrorBox(
        tr("เปิด SuperAi & RAKKYXD ไม่สำเร็จ"),
        tr`${error.message}\nลอง npm run build แล้วเปิดใหม่`,
      );
      app.quit();
    }
  });
  app.on("before-quit", () => {
    app.isQuitting = true;
    browser?.destroy();
    computer?.dispose();
    server?.stop().catch(() => {});
  });
  app.on("window-all-closed", () => app.quit());
}
