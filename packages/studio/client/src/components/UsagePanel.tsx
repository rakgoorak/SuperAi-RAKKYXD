import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, LoaderCircle, RefreshCw, X } from "lucide-react";
import { api } from "../api";
import { AccountPicker } from './AccountPicker';
import { orderUsageWindows, usageResetLabel, type UsageWindow } from "../usageDisplay";
import { tr } from '../i18n';

interface ProviderUsage {
  id: string; name: string; status: "ok" | "unsupported" | "not-installed" | "error";
  windows: UsageWindow[]; details?: { label: string; value: string }[]; note?: string; updatedAt: number; dataTime?: number;
}

const PROVIDERS: { id: string; label: string; cloud?: boolean }[] = [
  { id: "claude-code", label: "Claude" },
  { id: "codex", label: "ChatGPT (Codex)" },
  { id: "antigravity", label: "Antigravity" },
  { id: "opencode", label: "OpenCode" },
  { id: "freebuff", label: "Freebuff" },
  { id: "openrouter", label: "OpenRouter", cloud: true },
  { id: "deepseek", label: "DeepSeek", cloud: true },
];

const level = (pct: number) => (pct > 50 ? "good" : pct >= 20 ? "warn" : "low");

const ago = (t?: number) => {
  if (!t) return "";
  const min = Math.round((Date.now() - t) / 60_000);
  return min < 1 ? tr("เมื่อสักครู่") : min < 60 ? tr`${min} นาทีที่แล้ว` : min < 1440 ? tr`${Math.round(min / 60)} ชม.ที่แล้ว` : tr`${Math.round(min / 1440)} วันที่แล้ว`;
};

/** Toolbar button + popover listing each provider's remaining quota. */
export function UsageButton({ open, onOpenChange: setOpen }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<Record<string, ProviderUsage>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);
  const selections = useRef<Record<string, string | undefined>>({});
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async (id: string, refresh = false) => {
    const accountId = selections.current[id];
    setLoading((l) => ({ ...l, [id]: true }));
    try {
      const result = await api<ProviderUsage>(`/api/usage/${id}?refresh=${refresh ? "1" : "0"}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`);
      if (selections.current[id] === accountId) setData((d) => ({ ...d, [id]: result }));
    } catch (e) {
      if (selections.current[id] !== accountId) return;
      setData((d) => ({ ...d, [id]: { id, name: id, status: "error", windows: [], note: (e as Error).message, updatedAt: Date.now() } }));
    } finally {
      if (selections.current[id] === accountId) setLoading((l) => ({ ...l, [id]: false }));
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
  }, [open, loadAll, setOpen]);

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <div className="usage" ref={root}>
        <button className={`toolbar-button ${open ? "selected" : ""}`} aria-label="Usage" aria-expanded={open} aria-haspopup="dialog" title={tr("โควตาการใช้งานของแต่ละผู้ให้บริการ")} onClick={() => setOpen(!open)}>
        <Gauge size={14} />
        <span>Usage</span>
      </button>
      {open && (
        <section className="usage-popover" role="dialog" aria-label={tr("โควตาการใช้งาน")}>
          <header>
            <div>
              <h2>{tr("โควตาที่เหลือ")}</h2>
              <p>{tr("อ่านจาก CLI ในเครื่องด้วยบัญชีของคุณ")}</p>
            </div>
            <button className="icon-button" title={tr("ตรวจใหม่ทั้งหมด")} disabled={anyLoading} onClick={() => loadAll(true)}>
              <RefreshCw size={14} className={anyLoading ? "spin" : ""} />
            </button>
            <button className="icon-button" title={tr("ปิด")} onClick={() => setOpen(false)}><X size={14} /></button>
          </header>
          <div className="usage-list">
            {PROVIDERS.map(({ id, label, cloud }) => {
              const p = data[id];
              const busy = loading[id];
              // API providers only take a card once the user has connected one.
              if (cloud && (!p || p.status === "not-installed")) return null;
              const groups = [...new Set((p?.windows || []).map((w) => w.group || ""))];
              return (
                <article key={id} className={`usage-card status-${p?.status || "loading"}`}>
                  <header>
                    <strong>{label}</strong>
                    <small>{busy ? tr("กำลังตรวจ…") : p ? tr`ตรวจล่าสุด ${ago(p.updatedAt)}` : ""}</small>
                    <button className="icon-button" title={tr`ตรวจ ${label} ใหม่`} disabled={busy} onClick={() => void load(id, true)}>
                      {busy ? <LoaderCircle size={12} className="spin" /> : <RefreshCw size={12} />}
                    </button>
                  </header>
                  <AccountPicker provider={id} value={selectedAccounts[id]} label={tr`บัญชีโควตา ${label}`} onChange={accountId => {
                    selections.current[id] = accountId;
                    setSelectedAccounts(v => ({ ...v, [id]: accountId }));
                    setData(v => { const next = { ...v }; delete next[id]; return next; });
                    void load(id);
                  }} />
                  {!p && busy && <div className="usage-skeleton" />}
                  {groups.map((group) => (
                    <div key={group} className="usage-group">
                      {group && <span className="usage-group-name">{group}</span>}
                      {orderUsageWindows(p!.windows.filter((w) => (w.group || "") === group)).map((w) => (
                        <div key={w.label} className="usage-row">
                          <div className="usage-row-head">
                            <span>{w.label}</span>
                            <b className={w.remainingPercent === null ? "" : level(w.remainingPercent)}>
                              {w.remainingPercent === null ? w.note || "—" : tr`เหลือ ${w.remainingPercent}%`}
                            </b>
                          </div>
                          {w.remainingPercent !== null && (
                            <div className="usage-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={w.remainingPercent} aria-label={tr`${label} ${w.label} เหลือ ${w.remainingPercent}%`}>
                              <span className={level(w.remainingPercent)} style={{ width: `${w.remainingPercent}%` }} />
                            </div>
                          )}
                          {(usageResetLabel(w) || (w.note && w.remainingPercent !== null)) && <small>{[w.note && w.remainingPercent !== null ? w.note : "", usageResetLabel(w)].filter(Boolean).join(" · ")}</small>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {p?.details && p.details.length > 0 && (
                    <dl className="usage-details">
                      {p.details.map((d) => (<div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>))}
                    </dl>
                  )}
                  {/* Figures read from an older record say how old they are; the header says when we last checked. */}
                  {p?.note && <p className="usage-note">{p.note}{p.dataTime ? ` (${ago(p.dataTime)})` : ""}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
