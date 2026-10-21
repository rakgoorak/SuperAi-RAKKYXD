import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, LoaderCircle, RefreshCw, X } from "lucide-react";
import { api } from "../api";

interface UsageWindow { label: string; group?: string; remainingPercent: number | null; resetsAt?: string; resetsText?: string; note?: string; }
interface ProviderUsage {
  id: string; name: string; status: "ok" | "unsupported" | "not-installed" | "error";
  windows: UsageWindow[]; details?: { label: string; value: string }[]; note?: string; updatedAt: number; dataTime?: number;
}

const PROVIDERS: { id: string; label: string }[] = [
  { id: "claude-code", label: "Claude" },
  { id: "codex", label: "ChatGPT (Codex)" },
  { id: "antigravity", label: "Antigravity" },
  { id: "opencode", label: "OpenCode" },
  { id: "freebuff", label: "Freebuff" },
];

const level = (pct: number) => (pct > 50 ? "good" : pct >= 20 ? "warn" : "low");

function resetLabel(w: UsageWindow) {
  if (w.resetsAt) {
    const at = new Date(w.resetsAt);
    const ms = at.getTime() - Date.now();
    if (ms <= 0) return "รีเซ็ตแล้ว";
    const h = Math.floor(ms / 3_600_000), m = Math.round((ms % 3_600_000) / 60_000);
    const relative = h >= 24 ? `${Math.floor(h / 24)} วัน ${h % 24} ชม.` : h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
    return `รีเซ็ตในอีก ${relative} · ${at.toLocaleString("th-TH", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
  }
  return w.resetsText ? `รีเซ็ต ${w.resetsText}` : "";
}

const ago = (t?: number) => {
  if (!t) return "";
  const min = Math.round((Date.now() - t) / 60_000);
  return min < 1 ? "เมื่อสักครู่" : min < 60 ? `${min} นาทีที่แล้ว` : min < 1440 ? `${Math.round(min / 60)} ชม.ที่แล้ว` : `${Math.round(min / 1440)} วันที่แล้ว`;
};

/** Toolbar button + popover listing each provider's remaining quota. */
export function UsageButton() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, ProviderUsage>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string, refresh = false) => {
    setLoading((l) => ({ ...l, [id]: true }));
    try {
      const result = await api<ProviderUsage>(`/api/usage/${id}${refresh ? "?refresh=1" : ""}`);
      setData((d) => ({ ...d, [id]: result }));
    } catch (e) {
      setData((d) => ({ ...d, [id]: { id, name: id, status: "error", windows: [], note: (e as Error).message, updatedAt: Date.now() } }));
    } finally {
      setLoading((l) => ({ ...l, [id]: false }));
    }
  }, []);
  const loadAll = useCallback((refresh = false) => PROVIDERS.forEach((p) => void load(p.id, refresh)), [load]);

  // Quotas are read only when the panel is opened: each check starts CLI processes.
  useEffect(() => {
    if (!open) return;
    loadAll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, loadAll]);

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <div className="usage" ref={root}>
      <button className={`toolbar-button ${open ? "selected" : ""}`} aria-expanded={open} aria-haspopup="dialog" title="โควตาการใช้งานของแต่ละผู้ให้บริการ" onClick={() => setOpen(!open)}>
        <Gauge size={14} />
        <span>Usage</span>
      </button>
      {open && (
        <section className="usage-popover" role="dialog" aria-label="โควตาการใช้งาน">
          <header>
            <div>
              <h2>โควตาที่เหลือ</h2>
              <p>อ่านจาก CLI ในเครื่องด้วยบัญชีของคุณ</p>
            </div>
            <button className="icon-button" title="ตรวจใหม่ทั้งหมด" disabled={anyLoading} onClick={() => loadAll(true)}>
              <RefreshCw size={14} className={anyLoading ? "spin" : ""} />
            </button>
            <button className="icon-button" title="ปิด" onClick={() => setOpen(false)}><X size={14} /></button>
          </header>
          <div className="usage-list">
            {PROVIDERS.map(({ id, label }) => {
              const p = data[id];
              const busy = loading[id];
              const groups = [...new Set((p?.windows || []).map((w) => w.group || ""))];
              return (
                <article key={id} className={`usage-card status-${p?.status || "loading"}`}>
                  <header>
                    <strong>{label}</strong>
                    <small>{busy ? "กำลังตรวจ…" : p ? ago(p.dataTime || p.updatedAt) : ""}</small>
                    <button className="icon-button" title={`ตรวจ ${label} ใหม่`} disabled={busy} onClick={() => void load(id, true)}>
                      {busy ? <LoaderCircle size={12} className="spin" /> : <RefreshCw size={12} />}
                    </button>
                  </header>
                  {!p && busy && <div className="usage-skeleton" />}
                  {groups.map((group) => (
                    <div key={group} className="usage-group">
                      {group && <span className="usage-group-name">{group}</span>}
                      {p!.windows.filter((w) => (w.group || "") === group).map((w) => (
                        <div key={w.label} className="usage-row">
                          <div className="usage-row-head">
                            <span>{w.label}</span>
                            <b className={w.remainingPercent === null ? "" : level(w.remainingPercent)}>
                              {w.remainingPercent === null ? w.note || "—" : `เหลือ ${w.remainingPercent}%`}
                            </b>
                          </div>
                          {w.remainingPercent !== null && (
                            <div className="usage-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={w.remainingPercent} aria-label={`${label} ${w.label} เหลือ ${w.remainingPercent}%`}>
                              <span className={level(w.remainingPercent)} style={{ width: `${w.remainingPercent}%` }} />
                            </div>
                          )}
                          {(resetLabel(w) || (w.note && w.remainingPercent !== null)) && <small>{[w.note && w.remainingPercent !== null ? w.note : "", resetLabel(w)].filter(Boolean).join(" · ")}</small>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {p?.details && p.details.length > 0 && (
                    <dl className="usage-details">
                      {p.details.map((d) => (<div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>))}
                    </dl>
                  )}
                  {p?.note && <p className="usage-note">{p.note}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
