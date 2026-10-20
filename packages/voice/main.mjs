import { app, Tray, Menu, nativeImage } from "electron";
import { createVoiceCompanion } from "./window.mjs";
import path from "node:path";
import fs from "node:fs";
import { prepareDesktopPath } from "../desktop/platform-env.mjs";
prepareDesktopPath();
app.setName("SuperAi Voice & RAKKYXD");
const dataDirectory =
  process.env.SUPERAI_VOICE_DATA_DIR ||
  path.join(app.getPath("appData"), "SuperAiVoice-RAKKYXD");
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath("userData", dataDirectory);
let companion, tray;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => companion?.show());
  app.whenReady().then(async () => {
    companion = createVoiceCompanion(async (text) => {
      const configured = process.env.SUPERAI_STUDIO_URL;
      const bases = configured && /^http:\/\/127\.0\.0\.1:\d+$/.test(configured)
        ? [configured] : Array.from({length:12}, (_, i) => `http://127.0.0.1:${3888 + i}`);
      for (const base of bases)
        try {
          const health = await fetch(base + "/api/health", {
            signal: AbortSignal.timeout(500),
          }).then((r) => r.json());
          if (health.product !== "SuperAi & RAKKYXD") continue;
          const result = await fetch(base + "/api/dictation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (result.ok) return;
        } catch {}
      throw new Error(
        "ยังไม่ได้เปิด SuperAi & RAKKYXD เปิดโปรแกรมหลักก่อน หรือเลือกคัดลอกข้อความ",
      );
    });
    const pixels = Buffer.alloc(16 * 16 * 4);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const index = (y * 16 + x) * 4;
        const mic =
          (x >= 6 && x <= 9 && y >= 3 && y <= 9) ||
          (y === 11 && x >= 4 && x <= 11) ||
          (x === 7 && y >= 11 && y <= 13);
        pixels[index] = mic ? 30 : 255;
        pixels[index + 1] = mic ? 40 : 216;
        pixels[index + 2] = mic ? 50 : 158;
        pixels[index + 3] = 255;
      }
    const icon = nativeImage.createFromBitmap(pixels, {
      width: 16,
      height: 16,
    });
    tray = new Tray(icon);
    tray.setToolTip("SuperAi Voice & RAKKYXD");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "เปิด SuperAi Voice", click: () => companion.show() },
        { label: "ออกจากโปรแกรม", click: () => app.quit() },
      ]),
    );
    tray.on("click", () => companion.show());
    await companion.show();
  });
  app.on("window-all-closed", () => {});
  app.on("before-quit", () => {
    app.isQuitting = true;
    companion?.dispose();
    tray?.destroy();
  });
}
