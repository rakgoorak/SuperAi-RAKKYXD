import { useEffect, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";
import type { Session } from "../api";

// Ids restarted after a self-update recently, so a CLI that keeps updating cannot loop forever.
const restartedAt = new Map<string, number>();

/**
 * Shown over a tab whose process has ended:
 * - the CLI updated itself and exited → reopen it automatically (once a minute at most);
 * - normal exit (code 0) → close the tab after a short countdown, unless the user keeps it;
 * - error exit → stay open so the output can be read, with reopen / close buttons.
 */
export function SessionEnded({ session, onRestart, onClose }: { session: Session; onRestart: (id: string) => void; onClose: (id: string) => void }) {
  // Only reopen when the update really went through: it said so, reported no failure and exited cleanly.
  const autoRestart = !!session.selfUpdated && !session.updateFailed && session.exitCode === 0 && Date.now() - (restartedAt.get(session.id) || 0) > 60_000;
  // A failed self-update stays open (even with exit 0) so the user can read why.
  const clean = session.exitCode === 0 && session.status === "exited" && !session.updateFailed;
  const [seconds, setSeconds] = useState(autoRestart ? 2 : clean ? 3 : 0);
  const [kept, setKept] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (kept || seconds <= 0 || (!autoRestart && !clean)) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, kept, autoRestart, clean]);

  useEffect(() => {
    if (kept || fired.current || seconds > 0) return;
    if (autoRestart) {
      fired.current = true;
      restartedAt.set(session.id, Date.now());
      onRestart(session.id);
    } else if (clean) {
      fired.current = true;
      onClose(session.id);
    }
  }, [seconds, kept, autoRestart, clean, session.id, onRestart, onClose]);

  const title = autoRestart
    ? `${session.name} อัปเดตตัวเองเสร็จแล้ว`
    : clean
      ? `${session.name} จบการทำงานแล้ว`
      : `${session.name} หยุดทำงาน${session.exitCode !== null ? ` (exit ${session.exitCode})` : ""}`;
  const detail = autoRestart && !kept
    ? `กำลังเปิดใหม่ใน ${seconds} วินาที…`
    : clean && !kept
      ? `ปิดหน้าต่างนี้ใน ${seconds} วินาที`
      : autoRestart || clean
        ? "เก็บหน้าต่างไว้แล้ว"
        : "ดูข้อความด้านบนว่าเกิดอะไรขึ้น แล้วเลือกเปิดใหม่หรือปิด";

  return (
    <div className={`session-ended ${clean || autoRestart ? "" : "failed"}`} role="status">
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <div className="session-ended-actions">
        {(autoRestart || clean) && !kept && (
          <button className="text-button" onClick={() => setKept(true)}>ยกเลิก</button>
        )}
        <button className="secondary" onClick={() => { fired.current = true; restartedAt.set(session.id, Date.now()); onRestart(session.id); }}>
          <RotateCw size={13} /> เปิดใหม่
        </button>
        <button className="secondary" onClick={() => { fired.current = true; onClose(session.id); }}>
          <X size={13} /> ปิด
        </button>
      </div>
    </div>
  );
}
