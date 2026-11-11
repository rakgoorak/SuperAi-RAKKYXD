import { useState } from "react";
import { Check, ExternalLink, KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { api } from "../api";
import { notifyCloudKeysChanged, useCloudKeys, type CloudKeyStatus } from "../providers";

const BLURB: Record<string, string> = {
  openrouter: "key เดียวใช้ได้หลายร้อยรุ่นจากหลายค่าย (Claude, GPT, Gemini, DeepSeek และรุ่นฟรี)",
  deepseek: "รุ่น deepseek-chat และ deepseek-reasoner ราคาถูก",
  groq: "รุ่นโอเพนซอร์สที่ตอบเร็วมาก มีโควตาฟรีรายวัน",
};

/** Settings > API Key: connect OpenRouter, DeepSeek or Groq with the user's own key. */
export function ApiKeysPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const keys = useCloudKeys();
  return (
    <>
      <div className="settings-section-title"><h3>API Key ของผู้ให้บริการภายนอก</h3></div>
      <p className="muted">
        ใส่ key ของคุณเองเพื่อใช้รุ่นจากผู้ให้บริการเหล่านี้ในโหมด Agent และ Chat โดยไม่ต้องติดตั้ง CLI
        ผู้ให้บริการคิดเงินตามการใช้จริงจากบัญชีของคุณ ต่างจาก CLI ที่ใช้โควตาแพ็กเกจรายเดือน
      </p>
      <p className="muted">key ถูกเข้ารหัสด้วยระบบของเครื่องนี้ และส่งไปที่ผู้ให้บริการเจ้าของ key เท่านั้น โหมด Code ใช้ CLI จึงไม่ใช้ key เหล่านี้</p>
      <div className="api-keys">
        {keys.map((k) => <KeyRow key={k.id} status={k} onNotice={onNotice} />)}
      </div>
    </>
  );
}

function KeyRow({ status, onNotice }: { status: CloudKeyStatus; onNotice: (message: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true); setProblem("");
    try { await work(); setValue(""); notifyCloudKeysChanged(); onNotice(done); }
    catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };
  const save = () => run(() => api(`/api/cloud-keys/${status.id}`, { method: "PUT", body: JSON.stringify({ key: value.trim() }) }), `เชื่อมต่อ ${status.name} แล้ว`);
  const fromEnv = status.source === "env";
  return (
    <article className={`api-key-row ${status.hasKey ? "connected" : ""}`}>
      <header>
        <strong>{status.name}</strong>
        <span className={`byok-badge ${status.hasKey ? "authenticated" : "pending"}`}>
          {status.hasKey ? <><Check size={12} /> เชื่อมต่อแล้ว {status.hint}</> : <><KeyRound size={12} /> ยังไม่ได้เชื่อมต่อ</>}
        </span>
        <button type="button" className="text-button" onClick={() => void (window.superai?.openExternal ? window.superai.openExternal(status.keyPage) : window.open(status.keyPage, "_blank", "noopener"))}>
          <ExternalLink size={12} /> ขอ key
        </button>
      </header>
      <small>{BLURB[status.id]}{fromEnv ? " · ใช้ key จาก environment variable ของเครื่อง" : ""}</small>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim() && !busy) void save(); }}>
        <input type="password" autoComplete="off" spellCheck={false} aria-label={`API Key ของ ${status.name}`} value={value} maxLength={500} disabled={busy}
          placeholder={status.hasKey ? "วาง key ใหม่เพื่อเปลี่ยน" : "วาง API Key ที่นี่"} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="secondary" disabled={busy || !value.trim()}>
          {busy ? <LoaderCircle size={13} className="spin" /> : null} {busy ? "กำลังตรวจ…" : "ตรวจและบันทึก"}
        </button>
        {status.hasKey && <button type="button" className="text-button" disabled={busy} onClick={() => void run(() => api(`/api/cloud-keys/${status.id}/test`, { method: "POST" }), `${status.name} ใช้งานได้ปกติ`)}>ทดสอบ</button>}
        {status.source === "settings" && <button type="button" className="icon-button" title={`ลบ API Key ของ ${status.name}`} disabled={busy}
          onClick={() => void run(() => api(`/api/cloud-keys/${status.id}`, { method: "DELETE" }), `ลบ API Key ของ ${status.name} แล้ว`)}><Trash2 size={13} /></button>}
      </form>
      {problem && <small role="alert" className="api-key-problem">{problem}</small>}
    </article>
  );
}
