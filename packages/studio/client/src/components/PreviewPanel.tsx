import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Plus,
  X,
  Search,
  PanelRightClose,
  LoaderCircle,
  AlertTriangle,
} from "lucide-react";
import type { BrowserState } from "../desktop";
interface Props {
  embedded?: boolean;
  onClose: () => void;
  suspended: boolean;
  onError: (text: string) => void;
}
export function PreviewPanel({ onClose, suspended, onError, embedded = false }: Props) {
  const [state, setState] = useState<BrowserState>({ activeId: "", tabs: [] });
  const [url, setUrl] = useState("http://localhost:3000");
  const [width, setWidth] = useState(440);
  const [webUrl, setWebUrl] = useState("");
  const [revision, setRevision] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const native = window.superai;
  const tab = state.tabs.find((t) => t.id === state.activeId);
  const action = useCallback(
    async (name: string, payload?: Record<string, unknown>) => {
      try {
        if (native) setState(await native.browser(name, payload));
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [native, onError],
  );
  useEffect(() => {
    if (!native) return;
    native
      .browser("state")
      .then(setState)
      .catch((e) => onError(e.message));
    return native.onBrowser(setState);
  }, [native, onError]);
  useEffect(() => {
    if (tab?.url) setUrl(tab.url);
  }, [tab?.url, tab?.id]);
  useEffect(() => {
    if (!native || !area.current) return;
    const update = () => {
      const r = area.current?.getBoundingClientRect();
      if (r)
        void native
          .browser("bounds", {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            visible: !suspended && !!tab && !tab.error,
          })
          .catch(() => {});
    };
    const observer = new ResizeObserver(update);
    observer.observe(area.current);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      void native.browser("bounds", { visible: false }).catch(() => {});
    };
  }, [native, suspended, tab?.id, tab?.error, width]);
  const navigate = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (native) void action(tab ? "navigate" : "create", { url });
    else {
      try {
        let value = url.trim();
        if (!/^https?:\/\//i.test(value))
          value = /^(localhost|127\.0\.0\.1)(:|\/|$)/.test(value)
            ? "http://" + value
            : "https://" + value;
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol))
          throw new Error("ใช้ได้เฉพาะ http/https");
        setWebUrl(parsed.href);
        setUrl(parsed.href);
        setRevision((v) => v + 1);
      } catch {
        onError("URL ไม่ถูกต้อง กรุณาระบุ http:// หรือ https://");
      }
    }
  };
  const external = () => {
    const target = tab?.url || webUrl || url;
    if (native)
      void native.openExternal(target).catch((e) => onError(e.message));
    else window.open(target, "_blank", "noopener,noreferrer");
  };
  const resize = (event: React.PointerEvent) => {
    event.preventDefault();
    const start = event.clientX;
    const initial = width;
    const move = (e: PointerEvent) =>
      setWidth(
        Math.max(
          320,
          Math.min(window.innerWidth * 0.55, initial + start - e.clientX),
        ),
      );
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };
  return (
    <aside
      className={`preview-panel ${embedded ? 'embedded-preview' : ''}`}
      style={{ width }}
      aria-label="Browser Preview"
    >
      <div
        className="resize-handle"
        onPointerDown={resize}
        role="separator"
        aria-label="ปรับขนาด Preview"
        aria-orientation="vertical"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWidth((v) => Math.min(v + 24, 700));
          if (e.key === "ArrowRight") setWidth((v) => Math.max(v - 24, 320));
        }}
      />
      <div className="panel-heading">
        <span>
          <Globe size={15} /> เว็บ Preview
        </span>
        <div className="inline">
          <span className="subtle-tag">{native ? "Chromium" : "เว็บ"}</span>
          <button className="icon-button" title="ปิด Preview" onClick={onClose}>
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>
      <div className="browser-tabs">
        {state.tabs.map((t) => (
          <div
            key={t.id}
            className={`browser-tab ${t.id === state.activeId ? "active" : ""}`}
          >
            <button
              onClick={() => action("select", { id: t.id })}
              title={t.url}
            >
              {t.loading ? (
                <LoaderCircle className="spin" size={12} />
              ) : (
                <Globe size={12} />
              )}
              <span>{t.title}</span>
            </button>
            <button
              title="ปิดแท็บ"
              onClick={() => action("close", { id: t.id })}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {native && (
          <button
            className="icon-button"
            title="เพิ่มแท็บเว็บ"
            onClick={() => action("create", { url: "https://www.google.com" })}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <form className="address-bar" onSubmit={navigate}>
        <button
          type="button"
          className="icon-button"
          title="ย้อนกลับ"
          disabled={!tab?.canBack}
          onClick={() => action("back")}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="ถัดไป"
          disabled={!tab?.canForward}
          onClick={() => action("forward")}
        >
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="รีโหลดเว็บ"
          disabled={!tab && !webUrl}
          onClick={() =>
            native ? action("reload") : setRevision((v) => v + 1)
          }
        >
          <RotateCw size={14} className={tab?.loading ? "spin" : ""} />
        </button>
        <input
          aria-label="URL เว็บไซต์"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="localhost:3000 หรือเว็บไซต์"
        />
        <button type="submit" className="icon-button" title="เปิด URL">
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="เปิดใน browser ภายนอก"
          onClick={external}
        >
          <ExternalLink size={14} />
        </button>
      </form>
      {!native && (
        <div className="browser-note">
          โหมดเว็บใช้ iframe บางเว็บไซต์อาจไม่อนุญาตให้แสดง กดเปิดภายนอกได้
        </div>
      )}
      <div className="browser-canvas" ref={area}>
        {native ? (
          tab?.error ? (
            <div className="preview-empty">
              <AlertTriangle size={30} />
              <h3>เปิดหน้าเว็บไม่ได้</h3>
              <p>{tab.error}</p>
              <button className="secondary" onClick={() => action("reload")}>
                ลองใหม่
              </button>
              <button className="text-button" onClick={external}>
                เปิดใน browser ภายนอก
              </button>
            </div>
          ) : !tab ? (
            <div className="preview-empty">
              <div className="empty-orbit">
                <Globe size={35} />
              </div>
              <h3>ดูผลงานได้ในหน้าต่างนี้</h3>
              <p>
                เริ่มเว็บของคุณจาก terminal แล้วกรอก URL
                <br />
                หรือเปิดเว็บไซต์เพื่อค้นหาข้อมูล
              </p>
              <button className="secondary" onClick={() => navigate()}>
                เปิด localhost:3000 <ArrowRight size={14} />
              </button>
              <button
                className="text-button"
                onClick={() =>
                  action("create", { url: "https://www.google.com" })
                }
              >
                <Search size={14} /> ค้นหาบนเว็บ
              </button>
            </div>
          ) : null
        ) : webUrl ? (
          <iframe
            key={revision}
            title="เว็บไซต์ Preview"
            src={webUrl}
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
          />
        ) : (
          <div className="preview-empty">
            <Globe size={32} />
            <h3>เปิดหน้าเว็บของคุณ</h3>
            <p>กรอก URL แล้วกด Enter เพื่อเริ่ม Preview</p>
          </div>
        )}
      </div>
      <div className="preview-footer">
        <span className={`status-dot ${tab?.loading ? "pending" : ""}`} />
        {tab?.loading
          ? "กำลังโหลดเว็บไซต์…"
          : tab
            ? "Browser ภายในพร้อมใช้งาน"
            : "พร้อมเปิดเว็บไซต์"}
        <span className="push">{state.tabs.length} แท็บ</span>
      </div>
    </aside>
  );
}
