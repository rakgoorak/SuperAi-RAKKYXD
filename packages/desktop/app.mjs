import { app, BrowserWindow, ipcMain, shell, dialog, clipboard, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserController } from "./browser.mjs";
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { prepareDesktopPath } from "./platform-env.mjs";
import { Updater } from "./updater.mjs";
prepareDesktopPath();
const directory = path.dirname(fileURLToPath(import.meta.url));
if (process.env.SUPERAI_DATA_DIR)
  app.setPath("userData", process.env.SUPERAI_DATA_DIR);
// Multithreaded on-device speech recognition (speak-to-type) needs SharedArrayBuffer.
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");
let window, server, browser;
const updater = new Updater({
  currentVersion: app.getVersion(),
  // SUPERAI_UPDATE_TEST lets a dev build exercise the real download/install path.
  packaged: app.isPackaged || process.env.SUPERAI_UPDATE_TEST === "1",
  onState: (state) => window?.webContents.send("update:state", state),
});
const log = async (text) => {
  try {
    const dir = path.join(os.homedir(), ".opencode-multi");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(
      path.join(dir, "desktop.log"),
      `[${new Date().toISOString()}] ${text}\n`,
    );
  } catch {}
};
function trusted(event) {
  if (
    !window ||
    event.sender.id !== window.webContents.id ||
    event.senderFrame !== window.webContents.mainFrame
  )
    throw new Error("ไม่อนุญาตการเรียกจากหน้าเว็บภายนอก");
}
ipcMain.handle("app:folder", async (e) => {
  trusted(e);
  const r = await dialog.showOpenDialog(window, {
    title: "เลือกโฟลเดอร์โปรเจกต์",
    properties: ["openDirectory", "createDirectory"],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("app:external", async (e, url) => {
  trusted(e);
  await shell.openExternal(normalizeBrowserUrl(url));
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
  throw new Error("คำสั่งอัปเดตไม่ถูกต้อง");
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
    throw new Error("คำสั่ง browser ไม่ถูกต้อง");
  return browser.action(action, payload);
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
    try {
      const { StudioServer } = await import(
        pathToFileURL(path.resolve(directory, "../studio/dist/StudioServer.js"))
          .href
      );
      for (let port = 3888; port < 3900; port++) {
        const candidate = new StudioServer({
          port,
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
      if (!server) throw new Error("พอร์ต 3888–3899 ถูกใช้งานทั้งหมด");
      window = new BrowserWindow({
        width: 1540,
        height: 980,
        minWidth: 1040,
        minHeight: 680,
        title: "SuperAi & RAKKYXD",
        icon: path.join(directory, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
        backgroundColor: "#111519",
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#111519",
          symbolColor: "#dce7ef",
          height: 39,
        },
        webPreferences: {
          preload: path.join(directory, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      browser = new BrowserController(window);
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
      window.on("closed", () => {
        window = null;
        app.quit();
      });
      await window.loadURL(appUrl);
      await log(`SuperAi & RAKKYXD ${app.getVersion()} started at ${appUrl}`);
      if (updater.packaged && !process.env.SUPERAI_TEST_MODE) {
        setTimeout(() => void checkForUpdate(), 4000);
        setInterval(() => void checkForUpdate(), 30 * 60_000);
      }
    } catch (error) {
      await log(error.stack || error.message);
      dialog.showErrorBox(
        "เปิด SuperAi & RAKKYXD ไม่สำเร็จ",
        `${error.message}\nลอง npm run build แล้วเปิดใหม่`,
      );
      app.quit();
    }
  });
  app.on("before-quit", () => {
    app.isQuitting = true;
    browser?.destroy();
    server?.stop().catch(() => {});
  });
  app.on("window-all-closed", () => app.quit());
}
