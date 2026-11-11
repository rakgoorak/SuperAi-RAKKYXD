import { useState } from "react";
import { Check, ExternalLink, KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { api } from "../api";
import { notifyCloudKeysChanged, useCloudKeys, type CloudKeyStatus } from "../providers";
import '../custom-provider.css';

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
        ใส่ key ของคุณเองเพื่อใช้ในทีม Agent, ถามหลาย AI และหน้าคุยในโหมด Terminal โดยไม่ต้องติดตั้ง CLI
        ผู้ให้บริการคิดเงินตามการใช้จริงจากบัญชีของคุณ ต่างจาก CLI ที่ใช้โควตาแพ็กเกจรายเดือน
      </p>
      <p className="muted">key ถูกเข้ารหัสด้วยระบบของเครื่องนี้ และส่งไปที่ endpoint ของผู้ให้บริการที่คุณเลือก</p>
      <div className="api-keys">
        {keys.map((k) => <KeyRow key={k.id} status={k} onNotice={onNotice} />)}
      </div>
      <CustomProviderForm onNotice={onNotice} />
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
        {status.keyPage && <button type="button" className="text-button" onClick={() => void (window.superai?.openExternal ? window.superai.openExternal(status.keyPage) : window.open(status.keyPage, "_blank", "noopener"))}>
          <ExternalLink size={12} /> ขอ key
        </button>}
      </header>
      <small>{status.custom ? `${status.baseURL} · ${status.models?.join(', ')}` : BLURB[status.id]}{fromEnv ? " · ใช้ key จาก environment variable ของเครื่อง" : ""}</small>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim() && !busy) void save(); }}>
        <input type="password" autoComplete="off" spellCheck={false} aria-label={`API Key ของ ${status.name}`} value={value} maxLength={500} disabled={busy}
          placeholder={status.hasKey ? "วาง key ใหม่เพื่อเปลี่ยน" : "วาง API Key ที่นี่"} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="secondary" disabled={busy || !value.trim()}>
          {busy ? <LoaderCircle size={13} className="spin" /> : null} {busy ? "กำลังบันทึก…" : status.custom ? 'บันทึก Key' : "ตรวจและบันทึก"}
        </button>
        {status.hasKey && <button type="button" className="text-button" disabled={busy} onClick={() => void run(() => api(`/api/cloud-keys/${status.id}/test`, { method: "POST" }), `${status.name} ใช้งานได้ปกติ`)}>ทดสอบ</button>}
        {status.source === "settings" && <button type="button" className="icon-button" title={`ลบ API Key ของ ${status.name}`} disabled={busy}
          onClick={() => void run(() => api(`/api/cloud-keys/${status.id}`, { method: "DELETE" }), `ลบ API Key ของ ${status.name} แล้ว`)}><Trash2 size={13} /></button>}
        {status.custom && <button type="button" className="text-button" disabled={busy} onClick={() => void run(() => api(`/api/custom-providers/${status.id}`, { method: 'DELETE' }), `ลบ ${status.name} แล้ว`)}>ลบผู้ให้บริการ</button>}
      </form>
      {problem && <small role="alert" className="api-key-problem">{problem}</small>}
    </article>
  );
}

function CustomProviderForm({ onNotice }: { onNotice: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''), [baseURL, setBaseURL] = useState(''), [key, setKey] = useState(''), [models, setModels] = useState('');
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState('');
  return <section className="api-key-row custom-provider">
    <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>เพิ่ม Custom Provider</button>
    {open && <form className="custom-provider-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setProblem('');
      try {
        await api('/api/custom-providers', { method: 'POST', body: JSON.stringify({ name, baseURL, key, models: models.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) }) });
        setKey(''); setName(''); setBaseURL(''); setModels(''); setOpen(false); notifyCloudKeysChanged(); onNotice('เพิ่ม Custom Provider แล้ว เลือกใช้ตอนเปิดห้องคุยใหม่ได้');
      } catch (error) { setProblem((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <p className="muted">รองรับ OpenAI-compatible API ระบุ Base URL ถึง /v1 โดยไม่ใส่ /chat/completions และกรอกชื่อโมเดลจากผู้ให้บริการ</p>
      <label>ชื่อผู้ให้บริการ<input required maxLength={60} aria-label="ชื่อ Custom Provider" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label>Base URL<input required type="url" aria-label="Base URL ของ Custom Provider" placeholder="https://api.example.com/v1" value={baseURL} disabled={busy} onChange={event => setBaseURL(event.target.value)} /></label>
      <label>API Key<input required type="password" autoComplete="off" maxLength={500} aria-label="API Key ของ Custom Provider" value={key} disabled={busy} onChange={event => setKey(event.target.value)} /></label>
      <label>โมเดล (คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่)<textarea required aria-label="โมเดลของ Custom Provider" value={models} disabled={busy} onChange={event => setModels(event.target.value)} /></label>
      <small className="muted">key จะถูกส่งไปยัง Base URL ที่ระบุ ตรวจ endpoint ก่อนบันทึก การทดสอบเชื่อมต่อใช้ปุ่ม “ทดสอบ” หลังเพิ่ม</small>
      {problem && <small role="alert" className="api-key-problem">{problem}</small>}
      <button type="submit" className="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก Custom Provider'}</button>
    </form>}
  </section>;
}
