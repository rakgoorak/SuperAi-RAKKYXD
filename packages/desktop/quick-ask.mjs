// Quick ask: a global shortcut opens a small box over any app (like Claude Desktop's Option+Space);
// what is typed there goes to a new chat in the main window.
import { BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import path from "node:path";

/** Tried in order; the first one the system lets us register wins. Windows keeps Alt+Space for its window menu. */
export const QUICK_KEYS = process.platform === "darwin" ? ["Alt+Space", "Control+Alt+Space"] : ["Control+Alt+Space", "Alt+Shift+Space"];
/** How a key is shown to people: "⌥ Space" on a Mac, "Ctrl+Alt+Space" elsewhere. */
export const keyLabel = (key) => process.platform === "darwin"
  ? key.replace("Control+", "⌃ ").replace("Alt+", "⌥ ").replace("Shift+", "⇧ ")
  : key.replace("Control", "Ctrl");

export function createQuickAsk({ directory, labels, onSubmit }) {
  let win = null;
  let key = null;
  const build = () => {
    win = new BrowserWindow({
      width: 640, height: 128, show: false, frame: false, resizable: false, movable: true, minimizable: false, maximizable: false,
      fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, transparent: true, backgroundColor: "#00000000", hasShadow: true,
      webPreferences: { preload: path.join(directory, "quick-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setAlwaysOnTop(true, "floating");
    win.on("blur", () => hide());
    win.on("closed", () => { win = null; });
    void win.loadFile(path.join(directory, "quick.html"), { query: labels });
  };
  const open = () => {
    if (!win || win.isDestroyed()) build();
    // On the screen the pointer is on, a third of the way down.
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const [width, height] = win.getSize();
    win.setPosition(Math.round(area.x + (area.width - width) / 2), Math.round(area.y + area.height / 3 - height / 2));
    const show = () => { win.show(); win.focus(); win.webContents.send("quick:show"); };
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", show); else show();
  };
  const hide = () => { if (win && !win.isDestroyed() && win.isVisible()) win.hide(); };
  const fromBox = (event) => !!win && !win.isDestroyed() && event.sender.id === win.webContents.id;
  ipcMain.on("quick:submit", (event, text) => {
    if (!fromBox(event)) return;
    hide();
    const value = String(text || "").trim();
    if (value) onSubmit(value);
  });
  ipcMain.on("quick:close", (event) => { if (fromBox(event)) hide(); });
  return {
    open, hide,
    /** Registers the first free shortcut; returns it, or null when every one is taken. */
    register() {
      for (const candidate of QUICK_KEYS) {
        try { if (globalShortcut.register(candidate, () => (win?.isVisible() ? hide() : open()))) { key = candidate; return key; } } catch {}
      }
      return null;
    },
    unregister() { if (key) { try { globalShortcut.unregister(key); } catch {} } key = null; },
    key: () => key,
  };
}
