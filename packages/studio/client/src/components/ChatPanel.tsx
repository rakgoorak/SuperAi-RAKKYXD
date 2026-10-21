import { useEffect, useState } from "react";
import { LoaderCircle, MessagesSquare, Plus, Sparkles } from "lucide-react";
import type { Cli, Run, Seat, StepStatus } from "../api";
import { HEADLESS, firstReady, seatFor, seatSummary } from "../providers";
import { SeatPicker } from "./SeatPicker";
import { ConfigShell } from "./ConfigShell";
import { Markdown } from "./Markdown";

export interface ChatConfig { panel: Seat[]; summarizer: Seat | null; style: "merge" | "best"; }
const MAX_PANEL = 5;

function validSeat(s: any): s is Seat {
  return s && ["name", "provider", "model", "effort"].every((k) => typeof s[k] === "string");
}
function defaultConfig(clis: Cli[]): ChatConfig {
  const ready = HEADLESS.filter((id) => clis.some((c) => c.id === id && c.available));
  const ids = ready.length ? ready.slice(0, 3) : [HEADLESS[0]];
  return { panel: ids.map((id, i) => seatFor(id, `Main ${i + 1}`)), summarizer: seatFor(ids[0], "ผู้สรุป"), style: "merge" };
}

export function ChatConfigEditor({ workspaceId, clis, ollamaModels, disabled, runCount, onChange }: {
  workspaceId: string; clis: Cli[]; ollamaModels: string[]; disabled: boolean; runCount: number; onChange: (c: ChatConfig) => void;
}) {
  const key = `superai-chat-v1:${workspaceId}`;
  const [config, setConfig] = useState<ChatConfig>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && Array.isArray(saved.panel) && saved.panel.length && saved.panel.every(validSeat) && (saved.summarizer === null || validSeat(saved.summarizer))) return { ...saved, style: saved.style === "best" ? "best" : "merge" };
    } catch {}
    return defaultConfig(clis);
  });
  useEffect(() => {
    onChange(config);
    try { localStorage.setItem(key, JSON.stringify(config)); } catch {}
  }, [config, key, onChange]);
  const edit = (index: number, seat: Seat) => setConfig((c) => ({ ...c, panel: c.panel.map((s, i) => (i === index ? seat : s)) }));
  return (
    <ConfigShell label="ตั้งค่า Chat" runCount={runCount} title={<><MessagesSquare size={17} /> ถามหลาย AI พร้อมกัน</>}
      description="พิมพ์ครั้งเดียว ส่งให้ทุก Main ที่เลือก แต่ละตัวตอบแยกกัน แล้วให้ผู้สรุปรวมผลพร้อมบอกว่าใครเสนออะไร"
      summary={`${config.panel.map((s) => `${s.name} (${seatSummary(s)})`).join(" · ")}${config.summarizer ? ` → สรุปโดย ${config.summarizer.name} (${seatSummary(config.summarizer)})` : ""}`}>
      {config.panel.map((seat, index) => (
        <div className="seat-row" key={index}>
          <span className="seat-badge">Main {index + 1}</span>
          <SeatPicker seat={seat} label={`Main ${index + 1}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled}
            onChange={(s) => edit(index, s)}
            onRemove={config.panel.length > 1 ? () => setConfig((c) => ({ ...c, panel: c.panel.filter((_, i) => i !== index) })) : undefined} />
        </div>
      ))}
      <button className="text-button add-seat" disabled={disabled || config.panel.length >= MAX_PANEL}
        onClick={() => setConfig((c) => ({ ...c, panel: [...c.panel, seatFor(firstReady(clis, c.panel.map((s) => s.provider.slice(4))) || HEADLESS[0], `Main ${c.panel.length + 1}`)] }))}>
        <Plus size={13} /> เพิ่ม Main ({config.panel.length}/{MAX_PANEL})
      </button>
      <div className="summarizer-row">
        <label className="tool-permission">
          <input type="checkbox" checked={!!config.summarizer} disabled={disabled}
            onChange={(e) => setConfig((c) => ({ ...c, summarizer: e.target.checked ? seatFor(c.panel[0]?.provider.slice(4) || HEADLESS[0], "ผู้สรุป") : null }))} />
          ให้ AI สรุปผลรวม
        </label>
        {config.summarizer && (
          <select aria-label="วิธีสรุป" value={config.style} disabled={disabled} onChange={(e) => setConfig((c) => ({ ...c, style: e.target.value as ChatConfig["style"] }))}>
            <option value="merge">รวมทุกความเห็น</option>
            <option value="best">คัดส่วนที่ดี ตัดส่วนที่อ่อนออก</option>
          </select>
        )}
      </div>
      {config.summarizer && (
        <div className="seat-row">
          <span className="seat-badge"><Sparkles size={13} /> ผู้สรุป</span>
          <SeatPicker seat={config.summarizer} label="ผู้สรุป" clis={clis} ollamaModels={ollamaModels} disabled={disabled}
            onChange={(summarizer) => setConfig((c) => ({ ...c, summarizer }))} />
        </div>
      )}
    </ConfigShell>
  );
}

const STEP: Record<StepStatus, string> = { pending: "รอ", running: "กำลังคิด", completed: "ตอบแล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิก", skipped: "ข้าม" };

export function ChatRunView({ run }: { run: Run }) {
  const panel = run.panel || [];
  return (
    <section className="chat-run" aria-label="คำตอบจาก AI แต่ละตัว">
      <div className={`answer-grid count-${Math.min(panel.length, 3)}`}>
        {panel.map((answer, index) => (
          <article key={index} className={`answer-card state-${answer.status}`}>
            <header>
              <strong>{answer.seat.name}</strong>
              <span className="chip">{answer.status === "running" && <LoaderCircle size={11} className="spin" />}{STEP[answer.status]}</span>
            </header>
            <small>{seatSummary(answer.seat)}</small>
            {answer.output ? <Markdown text={answer.output} /> : answer.status === "running" ? <p className="muted">กำลังคิด…</p> : null}
            {answer.error && <div className="inline-error">{answer.error}</div>}
          </article>
        ))}
      </div>
      {run.summarizer && (
        <article className={`summary-card state-${run.summaryStatus || "pending"}`}>
          <header>
            <Sparkles size={14} />
            <strong>สรุปโดย {run.summarizer.name}</strong>
            <small>{seatSummary(run.summarizer)} · {run.summaryStyle === "best" ? "คัดส่วนที่ดี" : "รวมทุกความเห็น"}</small>
            <span className="chip">{run.summaryStatus === "running" && <LoaderCircle size={11} className="spin" />}{run.summaryStatus === "pending" ? "รอคำตอบครบ" : run.summaryStatus === "completed" ? "สรุปแล้ว" : STEP[run.summaryStatus || "pending"]}</span>
          </header>
          {run.output ? <Markdown text={run.output} /> : null}
        </article>
      )}
    </section>
  );
}
