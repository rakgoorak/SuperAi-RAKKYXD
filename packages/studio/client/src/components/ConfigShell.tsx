import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, SlidersHorizontal, X } from "lucide-react";
import "../team-settings.css";

/** A focused team editor; pending changes apply only after Save. */
export function ConfigShell({ label, title, description, summary, disabled, onOpen, onSave, onCancel, children }: {
  label: string; title: ReactNode; description: string; summary: string; disabled: boolean;
  onOpen: () => void; onSave: () => void; onCancel: () => void; children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const descriptionId = useId();
  const close = () => { onCancel(); setOpen(false); setError(""); };
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    window.dispatchEvent(new CustomEvent("superai:team-overlay", { detail: true }));
    const opener = trigger.current;
    return () => {
      element?.close();
      window.dispatchEvent(new CustomEvent("superai:team-overlay", { detail: false }));
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  return <div className="team-config-entry">
    <span className="team-config-summary" title={summary}>{summary}</span>
    <button ref={trigger} className="team-config-trigger secondary" aria-label={label} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { onOpen(); setError(""); setOpen(true); }}><SlidersHorizontal size={14} /> ตั้งค่าทีม</button>
    {open && createPortal(<dialog ref={dialog} className="team-settings" aria-labelledby={heading} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); close(); }}>
      <header className="team-settings-header">
        <div><h2 id={heading}>{title}</h2><p id={descriptionId}>{description}</p></div>
        <button className="team-settings-close secondary" aria-label="ปิดการตั้งค่าทีม" onClick={close} autoFocus><X size={16} /> ปิด</button>
      </header>
      <div className="team-settings-body">
        {disabled && <p className="team-settings-locked" role="status">ทีมกำลังทำงาน ดูการตั้งค่าได้ และแก้ไขได้เมื่อจบงานนี้</p>}
        {typeof children === "function" ? children(close) : children}
      </div>
      <footer className="team-settings-footer">
        {error && <p role="alert">{error}</p>}
        <span className="team-settings-save-note">ใช้กับทีมในโปรเจกต์นี้</span>
        <div><button className="secondary" onClick={close}>ยกเลิก</button>
          <button className="primary" disabled={disabled} onClick={() => {
            try { onSave(); setOpen(false); setError(""); }
            catch { setError("บันทึกทีมไม่สำเร็จ ตรวจว่าพื้นที่จัดเก็บของแอปพร้อมใช้งาน แล้วลองอีกครั้ง"); }
          }}><Check size={15} /> บันทึกทีม</button></div>
      </footer>
    </dialog>, document.getElementById("root")!)}
  </div>;
}
