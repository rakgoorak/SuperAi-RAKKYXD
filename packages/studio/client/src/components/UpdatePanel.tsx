import { useCallback, useEffect, useState } from "react";
import { Check, Download, ExternalLink, LoaderCircle, RefreshCw, RotateCw, X } from "lucide-react";
import type { UpdateState } from "../desktop";
import { Markdown } from "./Markdown";

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

const mb = (bytes?: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : "");

export function UpdatePanel({ state, onError }: { state: UpdateState | null; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: "check" | "download" | "cancel" | "install") => {
    setBusy(true);
    try {
      await window.superai!.update(action);
    } catch (e) {
      onError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setBusy(false);
    }
  }, [onError]);
  if (!state) return <p className="muted">ปุ่มอัปเดตใช้ได้ในแอป Desktop เท่านั้น</p>;
  const s = state.status;
  return (
    <div className="update-panel">
      <div className="update-versions">
        <div><small>เวอร์ชันที่ใช้อยู่</small><strong>v{state.currentVersion}</strong></div>
        {state.latestVersion && <div><small>เวอร์ชันล่าสุด</small><strong>v{state.latestVersion}</strong></div>}
      </div>
      {!state.packaged && <p className="muted">กำลังรันจาก source code: อัปเดตด้วย <code>git pull</code> แล้ว <code>npm run build</code> ปุ่มนี้ตรวจได้อย่างเดียว</p>}
      <p className={`update-status ${s === "error" ? "danger-text" : s === "available" || s === "ready" ? "success-text" : ""}`} role="status">
        {s === "idle" && "ยังไม่ได้ตรวจ"}
        {s === "checking" && <><LoaderCircle size={14} className="spin" /> กำลังตรวจ…</>}
        {s === "latest" && <><Check size={14} /> ใช้เวอร์ชันล่าสุดอยู่แล้ว</>}
        {s === "none" && "ยังไม่มี release ให้ดาวน์โหลด"}
        {s === "available" && `มีเวอร์ชันใหม่ v${state.latestVersion} ${mb(state.asset?.size) && `(${mb(state.asset?.size)})`}`}
        {s === "unsupported" && state.error}
        {s === "downloading" && <><LoaderCircle size={14} className="spin" /> กำลังดาวน์โหลด {state.progress || 0}%</>}
        {s === "extracting" && <><LoaderCircle size={14} className="spin" /> ตรวจ SHA-256 ผ่านแล้ว กำลังแตกไฟล์…</>}
        {s === "ready" && "ดาวน์โหลดและตรวจไฟล์เรียบร้อย พร้อมติดตั้ง"}
        {s === "installing" && <><LoaderCircle size={14} className="spin" /> กำลังปิดโปรแกรมเพื่อติดตั้ง แล้วจะเปิดขึ้นมาใหม่เอง…</>}
        {s === "error" && state.error}
      </p>
      {s === "downloading" && <progress max={100} value={state.progress || 0} aria-label="ความคืบหน้าการดาวน์โหลด" />}
      {state.notes && ["available", "downloading", "extracting", "ready"].includes(s) && (
        <details className="update-notes" open>
          <summary>มีอะไรใหม่ใน v{state.latestVersion}</summary>
          <Markdown text={state.notes} />
        </details>
      )}
      <div className="update-actions">
        {["idle", "latest", "none", "error", "unsupported"].includes(s) && (
          <button className="secondary" disabled={busy} onClick={() => void run("check")}><RefreshCw size={14} /> ตรวจอัปเดต</button>
        )}
        {(s === "available" || (s === "error" && state.asset)) && state.packaged && (
          <button className="primary" disabled={busy} onClick={() => void run("download")}><Download size={14} /> ดาวน์โหลดอัปเดต</button>
        )}
        {s === "downloading" && <button className="secondary" onClick={() => void run("cancel")}><X size={14} /> ยกเลิก</button>}
        {s === "ready" && <button className="primary" disabled={busy} onClick={() => void run("install")}><RotateCw size={14} /> ติดตั้งและเปิดใหม่</button>}
        {state.releaseUrl && (
          <button className="text-button" onClick={() => void window.superai?.openExternal(state.releaseUrl!)}><ExternalLink size={13} /> ดูหน้า release</button>
        )}
      </div>
      <p className="muted">อัปเดตเขียนทับไฟล์โปรแกรมในโฟลเดอร์เดิม โปรเจกต์ ประวัติ และการตั้งค่าของคุณอยู่ครบ ไม่ต้องลบแล้วติดตั้งใหม่ · บันทึกงานใน terminal ก่อนกดติดตั้ง เพราะโปรแกรมจะปิดและเปิดใหม่</p>
    </div>
  );
}
