import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  clipboard,
  session,
  screen,
} from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VoiceService } from "./service.mjs";

const exec = promisify(execFile);
const directory = path.dirname(fileURLToPath(import.meta.url));

export function createVoiceCompanion(onText) {
  let window = null;
  let target = "";
  let shortcutReady = false;

  const service = new VoiceService((text) => {
    if (window && !window.isDestroyed())
      window.webContents.send("voice:progress", text);
  });

  const capture = async () => {
    if (process.env.SUPERAI_TEST_MODE === "1") return "";
    if (process.platform === "darwin") {
      try {
        const { stdout } = await exec("osascript", ["-e", 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'], { timeout: 5000 });
        const identifier = stdout.trim();
        if (identifier && !identifier.startsWith("com.rakgoorak.superai")) target = identifier;
      } catch {}
      return target;
    }
    if (process.platform !== "win32") return "";
    try {
      const { stdout } = await exec(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(directory, "windows-target.ps1"),
          "-Action",
          "capture",
        ],
        { windowsHide: true },
      );
      const handle = stdout.trim();
      if (
        window &&
        !window.isDestroyed() &&
        handle === String(window.getNativeWindowHandle().readUInt32LE())
      ) {
        return target;
      }
      target = handle;
      return target;
    } catch {
      return target;
    }
  };

  const handle = (name, fn) => {
    ipcMain.handle(name, async (event, ...args) => {
      if (
        !window ||
        event.sender.id !== window.webContents.id ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        throw new Error("ไม่อนุญาต");
      }
      try {
        return { ok: true, ...(await fn(...args)) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
  };

  handle("voice:status", async () => ({
    ...(await service.status()),
    shortcut: shortcutReady,
  }));
  handle("voice:setup", () => service.setup());
  handle("voice:prepare", (model) => service.prepare(model));
  handle("voice:transcribe", (options) => service.transcribe(options));
  handle("voice:cancel", async () => {
    service.cancel();
    return {};
  });
  handle("voice:capture", async () => ({ target: await capture() }));
  handle("voice:hide", async () => {
    if (window && !window.isDestroyed()) {
      window.hide();
    }
    return {};
  });
  handle("voice:settings", async (expanded) => {
    window.setSize(540, expanded ? 354 : 96);
    reposition();
    return {};
  });
  handle("voice:copy", async (text) => {
    clipboard.writeText(String(text).slice(0, 50000));
    return {};
  });
  handle("voice:deliver", async ({ text, destination }) => {
    if (typeof text !== "string" || !text.trim() || text.length > 50000) {
      throw new Error("กรุณาระบุข้อความ");
    }

    // Always copy to clipboard for safety
    clipboard.writeText(text);

    // If destination is superai or active, send directly
    if (destination === "superai") {
      try {
        await onText(text);
        return { message: "เติมข้อความในช่องคำสั่ง SuperAi แล้ว" };
      } catch (err) {
        // Fallback to active paste if SuperAi server not found
      }
    }

    if (destination === "active" || destination === "superai") {
      // Also notify SuperAi via HTTP in background if open
      onText(text).catch(() => {});

      if (process.platform === "darwin" && target) {
        try {
          await exec("osascript", ["-e", `on run argv
set targetId to item 1 of argv
tell application "System Events"
set frontmost of first process whose bundle identifier is targetId to true
delay 0.2
keystroke "v" using command down
end tell
end run`, target], { timeout: 5000 });
          return { message: "พิมพ์ข้อความลงในช่องเป้าหมายแล้ว" };
        } catch { return { message: "คัดลอกข้อความแล้ว กด Command+V เพื่อวาง หรือตั้งค่าสิทธิ์ Accessibility ให้ SuperAi Voice" }; }
      }
      if (process.platform === "win32" && target) {
        try {
          await exec(
            "powershell.exe",
            [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              path.join(directory, "windows-target.ps1"),
              "-Action",
              "paste",
              "-Target",
              target,
            ],
            { windowsHide: true },
          );
          return { message: "พิมพ์ข้อความลงในช่องเป้าหมายแล้ว" };
        } catch {
          return { message: "คัดลอกข้อความแล้ว (กด Ctrl+V เพื่อวาง)" };
        }
      }
      return { message: "คัดลอกข้อความลงคลิปบอร์ดแล้ว" };
    }

    return { message: "คัดลอกข้อความแล้ว" };
  });

  const hudWidth = 540;
  const hudHeight = 96;
  const reposition = () => {
      try {
        const primary = screen.getPrimaryDisplay();
        const { x, y, width: screenWidth, height: screenHeight } = primary.workArea;
        window.setPosition(
          Math.round(x + (screenWidth - hudWidth) / 2),
          Math.round(y + screenHeight - window.getSize()[1] - 48),
        );
      } catch {}
    };

  const show = async () => {
    await capture();
    if (window && !window.isDestroyed()) {
      reposition();
      window.show();
      window.webContents.send("voice:start-recording");
      return;
    }

    window = new BrowserWindow({
      width: hudWidth,
      height: hudHeight,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      title: "SuperAi Voice HUD",
      autoHideMenuBar: true,
      webPreferences: {
        additionalArguments: process.env.SUPERAI_TEST_MODE === '1' ? ['--superai-test-mode'] : [],
        preload: path.join(directory, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: "persist:superai-voice",
      },
    });



    reposition();

    const ses = window.webContents.session;
    ses.setPermissionRequestHandler((wc, permission, callback) =>
      callback(wc.id === window.webContents.id && permission === "media"),
    );
    ses.setPermissionCheckHandler(
      (wc, permission) =>
        !!wc && wc.id === window.webContents.id && permission === "media",
    );
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());

    window.on("close", (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        window.hide();
      }
    });

    await window.loadFile(path.join(directory, "index.html"));
    window.webContents.send("voice:start-recording");
  };

  const accelerator = "CommandOrControl+Shift+Space";
  shortcutReady = globalShortcut.register(accelerator, async () => {
    if (!window || window.isDestroyed()) {
      await show();
    } else {
      if (window.isVisible()) {
        window.webContents.send("voice:toggle");
      } else {
        await capture();
        const primary = screen.getPrimaryDisplay();
        const { x, y, width: screenWidth, height: screenHeight } = primary.workArea;
        window.setPosition(
          Math.round(x + (screenWidth - 540) / 2),
          Math.round(y + screenHeight - 96 - 48),
        );
        window.showInactive();
        window.webContents.send("voice:toggle");
      }
    }
  });

  return {
    show,
    dispose() {
      service.cancel();
      globalShortcut.unregister(accelerator);
      for (const name of [
        "status",
        "setup",
        "prepare",
        "transcribe",
        "deliver",
        "copy",
        "cancel",
        "capture",
        "hide",
        "settings",
      ]) {
        ipcMain.removeHandler(`voice:${name}`);
      }
      if (window && !window.isDestroyed()) window.destroy();
    },
  };
}
