import { useCallback, useEffect, useState } from "react";
import { Check, Download, ExternalLink, LoaderCircle, RefreshCw, RotateCw, X } from "lucide-react";
import type { UpdateState } from "../desktop";
import { Markdown } from "./Markdown";
import { t } from "../i18n";
import { tr } from '../i18n';

/** Live update state from the desktop shell; null in the browser UI (no updater there). */
export function useUpdateState() {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const desktop = window.superai;
    if (!desktop?.update) return;
    void desktop.update("state").then(setState).catch(() => {});
    return desktop.onUpdate(setState);
  }, []);
  return state;
}

type Action = "check" | "apply" | "force" | "cancel";

function useUpdateAction(onError: (m: string) => void) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: Action) => {
    setBusy(true);
    try {
      await window.superai!.update(action);
    } catch (e) {
      onError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setBusy(false);
    }
  }, [onError]);
  return { busy, run };
}

const mb = (bytes?: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : "");
/** A newer version exists and can be installed from here. */
const pending = (s?: UpdateState["status"]) => ["available", "downloading", "extracting", "ready", "waiting", "installing"].includes(s || "");

function statusLine(state: UpdateState) {
  const s = state.status;
  if (s === "downloading") return tr`กำลังดาวน์โหลด ${state.progress || 0}%`;
  if (s === "extracting") return tr("ตรวจไฟล์ผ่านแล้ว กำลังแตกไฟล์…");
  if (s === "ready") return tr("ดาวน์โหลดเสร็จแล้ว พร้อมติดตั้ง");
  if (s === "waiting") return tr`รอให้ ${(state.waitingFor || []).join(", ")} ทำงานเสร็จก่อน แล้วจะติดตั้งให้เอง`;
  if (s === "installing") return tr("กำลังติดตั้ง โปรแกรมจะปิดแล้วเปิดกลับมาที่เดิม…");
  return tr`ขนาด ${mb(state.asset?.size) || tr("ไม่ทราบ")}`;
}

export function UpdatePanel({ state, onError }: { state: UpdateState | null; onError: (m: string) => void }) {
  const { busy, run } = useUpdateAction(onError);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/rakgoorak/SuperAi-RAKKYXD-releases/releases?per_page=100")
      .then(res => res.ok ? res.json() : [])
      .then((list: Array<{ assets?: Array<{ name?: string; download_count?: number }> }>) => {
        if (!Array.isArray(list)) return;
        let count = 0;
        for (const rel of list) {
          for (const asset of (rel.assets || [])) {
            if (asset.name && !asset.name.endsWith('.sha256')) count += (asset.download_count || 0);
          }
        }
        if (count > 0) setDownloadCount(count);
      })
      .catch(() => {});
  }, []);

  if (!state) return <p className="muted">{tr("ปุ่มอัปเดตใช้ได้ในแอป Desktop เท่านั้น")}</p>;
  const s = state.status;
  return (
    <div className="update-panel">
      <div className="update-versions">
        <div><small>{t("updates.current_version", "เวอร์ชันที่ใช้อยู่")}</small><strong>v{state.currentVersion}</strong></div>
        {state.latestVersion && <div><small>{t("updates.latest_version", "เวอร์ชันล่าสุด")}</small><strong>v{state.latestVersion}</strong></div>}
        {downloadCount !== null && (
          <div><small>{t("updates.community_downloads", "ยอดดาวน์โหลดคอมมูนิตี้")}</small><strong style={{ color: "var(--brand-blue, #38bdf8)" }}>{downloadCount.toLocaleString()} {tr("ครั้ง")}</strong></div>
        )}
        {pending(s) && <span className={`update-kind ${state.mandatory ? "hard" : ""}`}>{state.mandatory ? tr("ต้องอัปเดต") : tr("อัปเดตหรือไม่ก็ได้")}</span>}
      </div>
      {!state.packaged && <p className="muted">{tr("กำลังรันจาก source code: อัปเดตด้วย")} <code>git pull</code> {tr("แล้ว")} <code>npm run build</code> {tr("ปุ่มนี้ตรวจได้อย่างเดียว")}</p>}
      <p className={`update-status ${s === "error" ? "danger-text" : pending(s) ? "success-text" : ""}`} role="status">
        {s === "idle" && tr("ยังไม่ได้ตรวจ")}
        {s === "checking" && <><LoaderCircle size={14} className="spin" /> {tr("กำลังตรวจ…")}</>}
        {s === "latest" && <><Check size={14} /> {tr("ใช้เวอร์ชันล่าสุดอยู่แล้ว")}</>}
        {s === "none" && tr("ยังไม่มี release ให้ดาวน์โหลด")}
        {s === "unsupported" && state.error}
        {s === "error" && state.error}
        {pending(s) && <>{["downloading", "extracting", "waiting", "installing"].includes(s) && <LoaderCircle size={14} className="spin" />} {tr("มีเวอร์ชันใหม่ v")}{state.latestVersion} · {statusLine(state)}</>}
      </p>
      {s === "downloading" && <progress max={100} value={state.progress || 0} aria-label={tr("ความคืบหน้าการดาวน์โหลด")} />}
      {state.notes && pending(s) && (
        <details className="update-notes" open>
          <summary>{tr("มีอะไรใหม่ใน v")}{state.latestVersion}</summary>
          <Markdown text={state.notes} />
        </details>
      )}
      <div className="update-actions">
        {["idle", "latest", "none", "error", "unsupported"].includes(s) && (
          <button className="secondary" disabled={busy} onClick={() => void run("check")}><RefreshCw size={14} /> {tr("ตรวจอัปเดต")}</button>
        )}
        {(["available", "downloading", "extracting", "ready"].includes(s) || (s === "error" && state.asset)) && state.packaged && (
          <button className="primary" disabled={busy} onClick={() => void run("apply")}><Download size={14} /> {tr("อัปเดตตอนนี้")}</button>
        )}
        {s === "waiting" && <>
          <button className="primary" onClick={() => void run("force")}><RotateCw size={14} /> {tr("ติดตั้งเลยไม่ต้องรอ")}</button>
          <button className="secondary" onClick={() => void run("cancel")}><X size={14} /> {tr("ยกเลิก")}</button>
        </>}
        {state.releaseUrl && (
          <button className="text-button" onClick={() => void window.superai?.openExternal(state.releaseUrl!)}><ExternalLink size={13} /> {tr("ดูหน้า release")}</button>
        )}
      </div>
      <p className="muted">{tr("ระบบตรวจอัปเดตเองทุกครั้งที่เปิดโปรแกรมและทุก 30 นาที แล้วดาวน์โหลดไว้เบื้องหลัง · ตอนติดตั้งจะรอให้ CLI ที่กำลังตอบทำงานเสร็จก่อน แล้วเปิดแท็บเดิมกลับมาคุยต่อจากเดิม โปรเจกต์ ประวัติ และการตั้งค่าอยู่ครบ")}</p>
    </div>
  );
}

/**
 * Shown by itself as soon as a newer version is found:
 * - soft update: a small card with "update now" / "later"; the app keeps working;
 * - hard update: covers the app until it is updated (installs by itself once nothing is running).
 */
export function UpdatePrompt({ state, onError, onDetails }: { state: UpdateState | null; onError: (m: string) => void; onDetails: () => void }) {
  const { busy, run } = useUpdateAction(onError);
  const [later, setLater] = useState("");
  const hard = !!state?.mandatory && !!state.packaged;
  const show = !!state && pending(state.status) && state.packaged;

  // A hard update starts by itself: download, wait for running work, install, reopen.
  useEffect(() => {
    if (hard && state && ["available", "ready"].includes(state.status)) void run("apply");
  }, [hard, state?.status, run]);

  if (!show && !(hard && state?.status === "error")) return null;
  if (!hard && later === state!.latestVersion && !["waiting", "installing"].includes(state!.status)) return null;
  const s = state!.status;
  const actions = (
    <div className="update-actions">
      {s === "waiting" ? (
        <>
          <button className="primary" disabled={busy} onClick={() => void run("force")}><RotateCw size={14} /> {hard ? tr("หยุดงานแล้วอัปเดตเลย") : tr("ติดตั้งเลยไม่ต้องรอ")}</button>
          {!hard && <button className="secondary" disabled={busy} onClick={() => void run("cancel")}><X size={14} /> {tr("ยกเลิก")}</button>}
        </>
      ) : s === "installing" ? null : (
        <>
          <button className="primary" disabled={busy || (hard && s !== "error")} onClick={() => void run("apply")}>
            {s === "error" ? <><RefreshCw size={14} /> {tr("ลองอีกครั้ง")}</> : <><Download size={14} /> {tr("อัปเดตตอนนี้")}</>}
          </button>
          {!hard && <button className="secondary" onClick={() => setLater(state!.latestVersion || "")}>{tr("ไว้ทีหลัง")}</button>}
        </>
      )}
      <button className="text-button" onClick={onDetails}>{tr("มีอะไรใหม่")}</button>
    </div>
  );

  if (hard)
    return (
      <div className="update-gate" role="alertdialog" aria-modal="true" aria-labelledby="update-gate-title">
        <section>
          <span className="update-kind hard">{tr("ต้องอัปเดต")}</span>
          <h2 id="update-gate-title">{tr("อัปเดตเป็น v")}{state!.latestVersion} {tr("ก่อนใช้งานต่อ")}</h2>
          <p>{tr("เวอร์ชันนี้แก้ปัญหาสำคัญ จึงต้องอัปเดตก่อน โปรแกรมจะติดตั้งให้เองแล้วเปิดกลับมาที่เดิม แท็บที่เปิดอยู่จะคุยต่อจากเดิม")}</p>
          <p className={`update-status ${s === "error" ? "danger-text" : ""}`} role="status">
            {s !== "error" && <LoaderCircle size={14} className="spin" />} {s === "error" ? state!.error : statusLine(state!)}
          </p>
          {s === "downloading" && <progress max={100} value={state!.progress || 0} aria-label={tr("ความคืบหน้าการดาวน์โหลด")} />}
          {actions}
        </section>
      </div>
    );

  return (
    <aside className="update-toast" role="status" aria-live="polite">
      <strong>{tr("มีเวอร์ชันใหม่ v")}{state!.latestVersion}</strong>
      <small>{s === "available" || s === "ready" ? tr("อัปเดตแล้วโปรแกรมจะเปิดกลับมาที่เดิม งานไม่หาย") : statusLine(state!)}</small>
      {actions}
    </aside>
  );
}
