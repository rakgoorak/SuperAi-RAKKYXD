import { WebContentsView, session } from "electron";
import { randomUUID } from "node:crypto";
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { tr } from './i18n.mjs';

const PREVIEW_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  partition: "persist:superai-preview",
};

export class BrowserController {
  tabs = new Map();
  activeId = "";
  bounds = { x: 0, y: 0, width: 0, height: 0 };
  visible = false;
  forgetting = false;
  constructor(window) {
    this.window = window;
    window.on("closed", () => this.destroy());
  }
  state() {
    const tabs = [];
    for (const [id, tab] of this.tabs) {
      const wc = tab?.view?.webContents;
      if (!wc || wc.isDestroyed()) continue;
      try {
        tabs.push({
          id,
          url: wc.getURL() || tab.url,
          title: wc.getTitle() || tr("แท็บใหม่"),
          loading: wc.isLoading(),
          error: tab.error,
          canBack: wc.canGoBack(),
          canForward: wc.canGoForward(),
        });
      } catch {
        continue;
      }
    }
    return {
      activeId: tabs.find(tab => tab.id === this.activeId)?.id ?? tabs.at(-1)?.id ?? "",
      visible: this.visible,
      tabs,
    };
  }
  emit() {
    if (!this.window.isDestroyed())
      this.window.webContents.send("browser:state", this.state());
  }
  layout() {
    if (!this.window || this.window.isDestroyed() || this.forgetting) return;
    try {
      const [width, height] = this.window.getContentSize();
      for (const [id, t] of this.tabs) {
        if (!t?.view?.webContents || t.view.webContents.isDestroyed()) continue;
        const b = this.bounds;
        t.view.setBounds({
          x: Math.max(0, Math.round(b.x)),
          y: Math.max(0, Math.round(b.y)),
          width: Math.max(0, Math.min(width - b.x, Math.round(b.width))),
          height: Math.max(0, Math.min(height - b.y, Math.round(b.height))),
        });
        t.view.setVisible(
          this.visible &&
            id === this.activeId &&
            b.width > 0 &&
            b.height > 0 &&
            !t.error,
        );
      }
    } catch {}
  }
  createTab(url, options = {}, openerId = "") {
    const id = randomUUID();
    const view = new WebContentsView(
      options.webContents ? { webContents: options.webContents } : { webPreferences: PREVIEW_WEB_PREFERENCES },
    );
    const tab = { id, view, url, openerId, error: "", logs: [] };
    const wc = view.webContents;
    this.tabs.set(id, tab);
    this.activeId = id;
    if (!this.window.isDestroyed()) this.window.contentView.addChildView(view);
    const pushLog = (entry) => {
      tab.logs.push(entry);
      if (tab.logs.length > 100) tab.logs.splice(0, tab.logs.length - 100);
    };
    wc.on("console-message", (_event, level, message, line, sourceId) => {
      // Electron level: 0=verbose, 1=info, 2=warning, 3=error
      if (level >= 2) pushLog(`[${level === 3 ? "console.error" : "console.warn"}] ${String(message).slice(0, 400)}${sourceId ? ` (${sourceId}:${line})` : ""}`);
    });
    wc.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    wc.on("will-navigate", (e, target) => {
      if (target === "about:blank") return;
      try {
        normalizeBrowserUrl(target);
      } catch {
        e.preventDefault();
      }
    });
    wc.on("will-redirect", (e, target) => {
      if (target === "about:blank") return;
      try {
        normalizeBrowserUrl(target);
      } catch {
        e.preventDefault();
      }
    });
    wc.once("destroyed", () => {
      if (this.removeTab(id)) {
        this.layout();
        this.emit();
      }
    });
    wc.setWindowOpenHandler(({ url: target }) => {
      if (this.forgetting || this.tabs.size >= 8) return { action: "deny" };
      try {
        if (target && target !== "about:blank") normalizeBrowserUrl(target);
      } catch { return { action: "deny" }; }
      // Adopt Chromium's popup so redirects, POST data and window.opener remain intact.
      return {
        action: "allow",
        overrideBrowserWindowOptions: { webPreferences: PREVIEW_WEB_PREFERENCES },
        createWindow: (opts) => this.createTab(target || "about:blank", opts, id).view.webContents,
      };
    });
    for (const event of [
      "did-start-loading",
      "did-stop-loading",
      "did-navigate-in-page",
      "page-title-updated",
    ])
      wc.on(event, () => {
        this.layout();
        this.emit();
      });
    wc.on("did-navigate", () => {
      tab.error = "";
      this.layout();
      this.emit();
    });
    wc.on(
      "did-fail-load",
      (_e, code, description, failedUrl, isMainFrame) => {
        if (code !== -3) pushLog(`[load-failed] ${code} ${description} (${failedUrl || ""})`);
        if (isMainFrame && code !== -3) {
          tab.error = tr`เปิดหน้าเว็บไม่ได้ (${code}): ${description}`;
          this.layout();
          this.emit();
        }
      },
    );
    wc.on("render-process-gone", () => {
      tab.error = tr("หน้าเว็บหยุดทำงาน กรุณารีโหลด");
      this.layout();
      this.emit();
    });
    this.layout();
    this.emit();
    return tab;
  }
  loadTab(tab, url) {
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    tab.url = url;
    tab.error = "";
    wc.loadURL(url).catch((error) => {
      if (!this.tabs.has(tab.id) || error.code === "ERR_ABORTED") return;
      tab.error = error.message;
      this.layout();
      this.emit();
    });
  }
  removeTab(id, close = false) {
    const tab = this.tabs.get(id);
    if (!tab) return false;
    this.tabs.delete(id);
    if (this.activeId === id) {
      this.activeId = this.tabs.has(tab.openerId) ? tab.openerId : [...this.tabs.keys()].at(-1) || "";
    }
    try {
      if (!this.window.isDestroyed()) this.window.contentView.removeChildView(tab.view);
    } catch {}
    const wc = tab.view?.webContents;
    if (close && wc && !wc.isDestroyed()) wc.close();
    return true;
  }
  async action(action, payload = {}) {
    if (this.forgetting) throw new Error(tr("กำลังล้างข้อมูล browser กรุณารอให้เสร็จ"));
    if (action === "bounds") {
      this.bounds = {
        x: Number(payload.x) || 0,
        y: Number(payload.y) || 0,
        width: Number(payload.width) || 0,
        height: Number(payload.height) || 0,
      };
      this.visible = !!payload.visible;
      this.layout();
      return this.state();
    }
    if (action === "create") {
      if (this.tabs.size >= 8) throw new Error(tr("เปิด browser ได้สูงสุด 8 แท็บ"));
      const url = normalizeBrowserUrl(payload.url || "https://www.google.com");
      const tab = this.createTab(url);
      this.loadTab(tab, url);
    } else if (action === "close") {
      this.removeTab(payload.id, true);
    } else if (action === "select") {
      if (this.tabs.has(payload.id)) this.activeId = payload.id;
    } else if (action !== "state") {
      const tab = this.tabs.get(this.activeId);
      const wc = tab?.view.webContents;
      if (!wc || wc.isDestroyed()) throw new Error(tr("กรุณาเปิดแท็บก่อน"));
      if (action === "navigate") {
        const url = normalizeBrowserUrl(payload.url);
        this.loadTab(tab, url);
      } else if (action === "back" && wc.canGoBack()) {
        tab.error = "";
        wc.goBack();
      } else if (action === "forward" && wc.canGoForward()) {
        tab.error = "";
        wc.goForward();
      } else if (action === "reload") {
        tab.error = "";
        wc.reload();
      } else if (action === "stop") wc.stop();
    }
    this.layout();
    this.emit();
    return this.state();
  }
  async forgetSession() {
    if (this.forgetting) throw new Error(tr("กำลังล้างข้อมูล browser"));
    this.forgetting = true;
    try {
      this.destroy();
      const preview = session.fromPartition("persist:superai-preview");
      await preview.closeAllConnections();
      await preview.clearStorageData();
      await preview.clearCache();
      preview.flushStorageData();
      this.activeId = "";
      this.emit();
    } finally {
      this.forgetting = false;
    }
  }
  destroy() {
    for (const id of [...this.tabs.keys()]) this.removeTab(id, true);
    this.activeId = "";
  }
}
