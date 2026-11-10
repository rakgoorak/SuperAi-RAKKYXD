import { useCallback, useEffect, useState } from "react";
import { Check, Download, ExternalLink, LoaderCircle, RefreshCw, RotateCw, X } from "lucide-react";
import type { UpdateState } from "../desktop";
import { Markdown } from "./Markdown";
import { t } from "../i18n";

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
  if (s === "downloading") return `กำลังดาวน์โหลด ${state.progress || 0}%`;
  if (s === "extracting") return "ตรวจไฟล์ผ่านแล้ว กำลังแตกไฟล์…";
  if (s === "ready") return "ดาวน์โหลดเสร็จแล้ว พร้อมติดตั้ง";
  if (s === "waiting") return `รอให้ ${(state.waitingFor || []).join(", ")} ทำงานเสร็จก่อน แล้วจะติดตั้งให้เอง`;
  if (s === "installing") return "กำลังติดตั้ง โปรแกรมจะปิดแล้วเปิดกลับมาที่เดิม…";
  return `ขนาด ${mb(state.asset?.size) || "ไม่ทราบ"}`;
}

export function UpdatePanel({ state, onError }: { state: UpdateState | null; onError: (m: string) => void }) {
  const { busy, run } = useUpdateAction(onError);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/rakgoorak/SuperAi-RAKKYXD-releases/releases?per_page=30")
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

  if (!state) return <p className="muted">ปุ่มอัปเดตใช้ได้ในแอป Desktop เท่านั้น</p>;
  const s = state.status;
  return (
    <div className="update-panel">
      <div className="update-versions">
        <div><small>{t("updates.current_version", "เวอร์ชันที่ใช้อยู่")}</small><strong>v{state.currentVersion}</strong></div>
        {state.latestVersion && <div><small>{t("updates.latest_version", "เวอร์ชันล่าสุด")}</small><strong>v{state.latestVersion}</strong></div>}
        {downloadCount !== null && (
          <div><small>{t("updates.community_downloads", "ยอดดาวน์โหลดคอมมูนิตี้")}</small><strong style={{ color: "var(--brand-blue, #38bdf8)" }}>{downloadCount.toLocaleString()} ครั้ง</strong></div>
        )}
        {pending(s) && <span className={`update-kind ${state.mandatory ? "hard" : ""}`}>{state.mandatory ? "ต้องอัปเดต" : "อัปเดตหรือไม่ก็ได้"}</span>}
      </div>
      {!state.packaged && <p className="muted">กำลังรันจาก source code: อัปเดตด้วย <code>git pull</code> แล้ว <code>npm run build</code> ปุ่มนี้ตรวจได้อย่างเดียว</p>}
      <p className={`update-status ${s === "error" ? "danger-text" : pending(s) ? "success-text" : ""}`} role="status">
        {s === "idle" && "ยังไม่ได้ตรวจ"}
        {s === "checking" && <><LoaderCircle size={14} className="spin" /> กำลังตรวจ…</>}
        {s === "latest" && <><Check size={14} /> ใช้เวอร์ชันล่าสุดอยู่แล้ว</>}
        {s === "none" && "ยังไม่มี release ให้ดาวน์โหลด"}
        {s === "unsupported" && state.error}
        {s === "error" && state.error}
        {pending(s) && <>{["downloading", "extracting", "waiting", "installing"].includes(s) && <LoaderCircle size={14} className="spin" />} มีเวอร์ชันใหม่ v{state.latestVersion} · {statusLine(state)}</>}
      </p>
      {s === "downloading" && <progress max={100} value={state.progress || 0} aria-label="ความคืบหน้าการดาวน์โหลด" />}
      {state.notes && pending(s) && (
        <details className="update-notes" open>
          <summary>มีอะไรใหม่ใน v{state.latestVersion}</summary>
          <Markdown text={state.notes} />
        </details>
      )}
      <div className="update-actions">
        {["idle", "latest", "none", "error", "unsupported"].includes(s) && (
          <button className="secondary" disabled={busy} onClick={() => void run("check")}><RefreshCw size={14} /> ตรวจอัปเดต</button>
        )}
        {(["available", "downloading", "extracting", "ready"].includes(s) || (s === "error" && state.asset)) && state.packaged && (
          <button className="primary" disabled={busy} onClick={() => void run("apply")}><Download size={14} /> อัปเดตตอนนี้</button>
        )}
        {s === "waiting" && <>
          <button className="primary" onClick={() => void run("force")}><RotateCw size={14} /> ติดตั้งเลยไม่ต้องรอ</button>
          <button className="secondary" onClick={() => void run("cancel")}><X size={14} /> ยกเลิก</button>
        </>}
        {state.releaseUrl && (
          <button className="text-button" onClick={() => void window.superai?.openExternal(state.releaseUrl!)}><ExternalLink size={13} /> ดูหน้า release</button>
        )}
      </div>
      <p className="muted">ระบบตรวจอัปเดตเองทุกครั้งที่เปิดโปรแกรมและทุก 30 นาที แล้วดาวน์โหลดไว้เบื้องหลัง · ตอนติดตั้งจะรอให้ CLI ที่กำลังตอบทำงานเสร็จก่อน แล้วเปิดแท็บเดิมกลับมาคุยต่อจากเดิม โปรเจกต์ ประวัติ และการตั้งค่าอยู่ครบ</p>
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
          <button className="primary" disabled={busy} onClick={() => void run("force")}><RotateCw size={14} /> {hard ? "หยุดงานแล้วอัปเดตเลย" : "ติดตั้งเลยไม่ต้องรอ"}</button>
          <button className="secondary" disabled={busy} onClick={() => void run("cancel")}><X size={14} /> ยกเลิก</button>
        </>
      ) : (
        <>
          <button className="primary" disabled={busy} onClick={() => void run("apply")}><Download size={14} /> อัปเดตตอนนี้</button>
          <button className="secondary" onClick={() => setLater(state!.latestVersion || "")}>ไว้ทีหลัง</button>
        </>
      )}
      <button className="text-button" onClick={onDetails}><ExternalLink size={13} /> ดูรายละเอียด</button>
    </div>
  );

  return (
    <aside className={`update-prompt ${hard ? "hard" : "soft"}`} aria-label="แจ้งเตือนการอัปเดต">
      <div className="update-prompt-head">
        <strong>{hard ? "จำเป็นต้องอัปเดต" : `มีเวอร์ชันใหม่ v${state!.latestVersion}`}</strong>
        {!hard && <button className="icon-button" onClick={() => setLater(state!.latestVersion || "")} title="ปิด"><X size={14} /></button>}
      </div>
      <p>{statusLine(state!)}</p>
      {actions}
    </aside>
  );
}
