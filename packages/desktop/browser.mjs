import { WebContentsView, session } from "electron";
import { randomUUID } from "node:crypto";
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { tr } from './i18n.mjs';

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
    return {
      activeId: this.activeId,
      visible: this.visible,
      tabs: [...this.tabs].map(([id, t]) => ({
        id,
        url: t.view.webContents.getURL() || t.url,
        title: t.view.webContents.getTitle() || tr("แท็บใหม่"),
        loading: t.view.webContents.isLoading(),
        error: t.error,
        canBack: t.view.webContents.canGoBack(),
        canForward: t.view.webContents.canGoForward(),
      })),
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
        if (!t?.view || !t.view.webContents || t.view.webContents.isDestroyed()) continue;
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
      const id = randomUUID();
      const view = new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          partition: "persist:superai-preview",
        },
      });
      const tab = { view, url, error: "" };
      this.tabs.set(id, tab);
      this.activeId = id;
      this.window.contentView.addChildView(view);
      view.webContents.session.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      view.webContents.on("will-navigate", (e, target) => {
        try {
          normalizeBrowserUrl(target);
        } catch {
          e.preventDefault();
        }
      });
      view.webContents.on("will-redirect", (e, target) => {
        try {
          normalizeBrowserUrl(target);
        } catch {
          e.preventDefault();
        }
      });
      view.webContents.setWindowOpenHandler(({ url: target }) => {
        try {
          normalizeBrowserUrl(target);
          this.action("create", { url: target }).catch(() => {});
        } catch {}
        return { action: "deny" };
      });
      for (const event of [
        "did-start-loading",
        "did-stop-loading",
        "did-navigate",
        "did-navigate-in-page",
        "page-title-updated",
      ])
        view.webContents.on(event, () => {
          this.layout();
          this.emit();
        });
      view.webContents.on("did-navigate", () => {
        tab.error = "";
        this.layout();
        this.emit();
      });
      view.webContents.on(
        "did-fail-load",
        (_e, code, description, _url, isMainFrame) => {
          if (isMainFrame && code !== -3) {
            tab.error = tr`เปิดหน้าเว็บไม่ได้ (${code}): ${description}`;
            this.layout();
            this.emit();
          }
        },
      );
      view.webContents.on("render-process-gone", () => {
        tab.error = tr("หน้าเว็บหยุดทำงาน กรุณารีโหลด");
        this.layout();
        this.emit();
      });
      this.layout();
      view.webContents.loadURL(url).catch((err) => {
        tab.error = err.message;
        this.layout();
        this.emit();
      });
    } else if (action === "close") {
      const tab = this.tabs.get(payload.id);
      if (tab) {
        this.window.contentView.removeChildView(tab.view);
        tab.view.webContents.close();
        this.tabs.delete(payload.id);
      }
      if (this.activeId === payload.id)
        this.activeId = [...this.tabs.keys()].at(-1) || "";
    } else if (action === "select") {
      if (this.tabs.has(payload.id)) this.activeId = payload.id;
    } else if (action !== "state") {
      const tab = this.tabs.get(this.activeId);
      if (!tab) throw new Error(tr("กรุณาเปิดแท็บก่อน"));
      const wc = tab.view.webContents;
      if (action === "navigate") {
        const url = normalizeBrowserUrl(payload.url);
        tab.url = url;
        tab.error = "";
        wc.loadURL(url).catch((err) => {
          tab.error = err.message;
          this.layout();
          this.emit();
        });
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
    for (const { view } of this.tabs.values()) {
      try {
        if (this.window && !this.window.isDestroyed() && this.window.contentView) {
          this.window.contentView.removeChildView(view);
        }
        if (view?.webContents && !view.webContents.isDestroyed()) {
          view.webContents.close();
        }
      } catch {}
    }
    this.tabs.clear();
  }
}
