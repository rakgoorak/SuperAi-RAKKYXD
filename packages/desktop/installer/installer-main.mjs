// Branded Windows installer UI. Setup.exe (installer/windows/installer.nsi) unpacks the app to a
// temp folder and starts it with --superai-installer; this copies it to the chosen folder,
// creates shortcuts and registers the app in Settings > Apps.
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const APPID = "SuperAi-RAKKYXD";
const APPNAME = "SuperAi & RAKKYXD";
const EXE = "SuperAi-RAKKYXD.exe";
const UNINSTALLER = `Uninstall ${APPID}.exe`;
const MARKER = ".superai-install";
// Tests point these somewhere harmless instead of the real registry and Start menu.
const REGKEY = process.env.SUPERAI_INSTALL_REGKEY || `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPID}`;
const SHORTCUT_DIR = process.env.SUPERAI_INSTALL_SHORTCUT_DIR || "";

// Keep installer state out of the real app's profile and single-instance lock.
app.setPath("userData", path.join(os.tmpdir(), `superai-installer-${process.pid}`));
const argValue = (name) => process.argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
// The unpacked app to install: the folder Setup.exe extracted (the running exe's folder).
const payload = path.resolve(argValue("--payload") || path.dirname(process.execPath));
const version = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(payload, "resources", "app", "package.json"), "utf8")).version;
  } catch {
    return app.getVersion();
  }
})();

async function existingInstall() {
  try {
    const { stdout } = await run("reg", ["query", REGKEY, "/v", "InstallLocation"], { windowsHide: true });
    const dir = /InstallLocation\s+REG_SZ\s+(.+)/.exec(stdout)?.[1]?.trim();
    return dir && fs.existsSync(path.join(dir, EXE)) ? dir : "";
  } catch {
    return "";
  }
}

/** Never install loose into a folder that already holds other things (e.g. Documents). */
function resolveTarget(dir) {
  const target = path.resolve(dir);
  try {
    const entries = fs.readdirSync(target);
    if (entries.length && !entries.includes(EXE) && !entries.includes(MARKER)) return path.join(target, APPID);
  } catch {}
  return target;
}

async function listFiles(root) {
  const files = [];
  let bytes = 0;
  async function walk(dir) {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        const size = (await fsp.stat(full)).size;
        files.push({ rel: path.relative(root, full), size });
        bytes += size;
      }
    }
  }
  await walk(root);
  return { files, bytes };
}

let window;
let manifest; // files of the payload, listed once
const send = (channel, data) => window?.webContents.send(channel, data);

function trusted(event) {
  if (!window || event.sender.id !== window.webContents.id) throw new Error("ไม่อนุญาต");
}

async function defaultDir() {
  const existing = await existingInstall();
  return { existing, dir: process.env.SUPERAI_INSTALL_DIR || existing || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Programs", APPID) };
}

ipcMain.handle("installer:info", async (e) => {
  trusted(e);
  manifest ||= await listFiles(payload);
  const { existing, dir } = await defaultDir();
  let free = 0;
  try {
    const s = await fsp.statfs(path.parse(dir).root);
    free = s.bavail * s.bsize;
  } catch {}
  return { version, dir, existing: !!existing, required: manifest.bytes, free };
});

ipcMain.handle("installer:pick", async (e, current) => {
  trusted(e);
  const r = await dialog.showOpenDialog(window, {
    title: "เลือกโฟลเดอร์ที่จะติดตั้ง",
    defaultPath: current,
    properties: ["openDirectory", "createDirectory"],
  });
  return r.canceled ? null : resolveTarget(r.filePaths[0]);
});

async function shortcut(file, target) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const ok = shell.writeShortcutLink(file, "create", {
    target,
    cwd: path.dirname(target),
    icon: target,
    iconIndex: 0,
    description: APPNAME,
    appUserModelId: "com.rakgoorak.superai",
  });
  if (!ok) throw new Error(`สร้างทางลัดไม่สำเร็จ: ${file}`);
}

async function register(dir, sizeKB) {
  const values = [
    ["DisplayName", "REG_SZ", APPNAME],
    ["DisplayVersion", "REG_SZ", version],
    ["Publisher", "REG_SZ", "RAKKYXD"],
    ["DisplayIcon", "REG_SZ", path.join(dir, EXE)],
    ["InstallLocation", "REG_SZ", dir],
    ["UninstallString", "REG_SZ", `"${path.join(dir, UNINSTALLER)}"`],
    ["QuietUninstallString", "REG_SZ", `"${path.join(dir, UNINSTALLER)}" /S`],
    ["NoModify", "REG_DWORD", "1"],
    ["NoRepair", "REG_DWORD", "1"],
    ["EstimatedSize", "REG_DWORD", String(sizeKB)],
  ];
  for (const [name, type, data] of values)
    await run("reg", ["add", REGKEY, "/v", name, "/t", type, "/d", data, "/f"], { windowsHide: true });
}

let busy = false;
ipcMain.handle("installer:install", async (e, opts) => {
  trusted(e);
  return install(opts);
});

/** Copy the app, create shortcuts and register it. Used by the UI and by `Setup.exe /S`. */
async function install(opts) {
  if (busy) throw new Error("กำลังติดตั้งอยู่");
  busy = true;
  try {
    const dir = resolveTarget(String(opts?.dir || ""));
    if (!path.isAbsolute(dir)) throw new Error("กรุณาเลือกโฟลเดอร์ติดตั้ง");
    if (path.resolve(dir) === payload) throw new Error("เลือกโฟลเดอร์อื่น");
    manifest ||= await listFiles(payload);
    await fsp.mkdir(dir, { recursive: true });
    send("installer:progress", { step: "prepare", dir });
    // The app must be closed so its files can be replaced.
    const exe = path.join(dir, EXE);
    if (fs.existsSync(exe)) {
      try {
        await fsp.rename(exe, exe + ".check");
        await fsp.rename(exe + ".check", exe);
      } catch {
        throw new Error(`${APPNAME} กำลังเปิดอยู่ กรุณาปิดโปรแกรมก่อน แล้วกดติดตั้งอีกครั้ง`);
      }
    }
    try {
      await fsp.writeFile(path.join(dir, `.write-test-${process.pid}`), "");
      await fsp.rm(path.join(dir, `.write-test-${process.pid}`), { force: true });
    } catch {
      throw new Error("ไม่มีสิทธิ์เขียนโฟลเดอร์นี้ กรุณาเลือกโฟลเดอร์อื่น เช่นในโฟลเดอร์ผู้ใช้ของคุณ");
    }
    // resources\app belongs to SuperAi: replace it whole so files from older versions go away.
    await fsp.rm(path.join(dir, "resources", "app"), { recursive: true, force: true });
    let done = 0, last = 0;
    for (const file of manifest.files) {
      const to = path.join(dir, file.rel);
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.copyFile(path.join(payload, file.rel), to);
      done += file.size;
      if (Date.now() - last > 60) {
        last = Date.now();
        send("installer:progress", { step: "copy", done, total: manifest.bytes });
      }
    }
    send("installer:progress", { step: "copy", done: manifest.bytes, total: manifest.bytes });
    await fsp.writeFile(path.join(dir, MARKER), `${APPID} ${version}\n`);

    send("installer:progress", { step: "shortcuts" });
    const programs = SHORTCUT_DIR || path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs");
    await shortcut(path.join(programs, `${APPNAME}.lnk`), exe);
    const desktopLink = path.join(SHORTCUT_DIR || app.getPath("desktop"), `${APPNAME}.lnk`);
    if (opts?.desktop) await shortcut(desktopLink, exe);
    else await fsp.rm(desktopLink, { force: true });

    send("installer:progress", { step: "register" });
    if (!fs.existsSync(path.join(dir, UNINSTALLER))) throw new Error("ไม่พบตัวถอนการติดตั้งในไฟล์ติดตั้ง");
    await register(dir, Math.round(manifest.bytes / 1024));
    send("installer:progress", { step: "done", dir });
    return { dir, exe };
  } finally {
    busy = false;
  }
}

ipcMain.handle("installer:launch", async (e, exe) => {
  trusted(e);
  if (typeof exe !== "string" || path.basename(exe) !== EXE || !fs.existsSync(exe)) throw new Error("ไม่พบโปรแกรม");
  spawn(exe, [], { detached: true, stdio: "ignore", cwd: path.dirname(exe) }).unref();
  setTimeout(() => app.quit(), 400);
});
ipcMain.handle("installer:window", (e, action) => {
  trusted(e);
  if (action === "minimize") window.minimize();
  if (action === "close") {
    if (busy) return false;
    app.quit();
  }
  return true;
});

if (!app.requestSingleInstanceLock()) app.quit();
else if (process.argv.includes("--silent"))
  // Setup.exe /S: unattended install to the default (or previous) folder with a desktop shortcut.
  app.whenReady().then(async () => {
    try {
      const { dir } = await defaultDir();
      const result = await install({ dir, desktop: true });
      process.stdout.write(`installed ${result.dir}
`);
      app.exit(0);
    } catch (error) {
      process.stderr.write(`${error.message}
`);
      app.exit(1);
    }
  });
else
  app.whenReady().then(() => {
    window = new BrowserWindow({
      width: 900,
      height: 560,
      resizable: false,
      maximizable: false,
      frame: false,
      show: false,
      title: `ติดตั้ง ${APPNAME}`,
      backgroundColor: "#05090e",
      icon: path.join(here, "..", "assets", "icon.ico"),
      webPreferences: { preload: path.join(here, "installer-preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    window.once("ready-to-show", () => window.show());
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.on("close", (event) => {
      if (busy) event.preventDefault();
    });
    void window.loadFile(path.join(here, "index.html"));
  });
app.on("window-all-closed", () => app.quit());
