import { useEffect, useState } from "react";
import { Bot, Crown, LoaderCircle, Plus, Users } from "lucide-react";
import type { Cli, Run, Seat, StepStatus } from "../api";
import { HEADLESS, firstReady, seatFor, seatSummary } from "../providers";
import { SeatPicker } from "./SeatPicker";
import { ConfigShell } from "./ConfigShell";
import { Markdown } from "./Markdown";

export interface AgentConfig { main: Seat; subagents: Seat[]; }
const MAX_SUBAGENTS = 6;

function validSeat(s: any): s is Seat {
  return s && ["name", "provider", "model", "effort"].every((k) => typeof s[k] === "string");
}
function defaultConfig(clis: Cli[]): AgentConfig {
  const mainCli = firstReady(clis) || HEADLESS[0];
  const subCli = firstReady(clis, [mainCli]) || mainCli;
  return { main: seatFor(mainCli, "Main"), subagents: [seatFor(subCli, "Sub-agent 1"), seatFor(mainCli, "Sub-agent 2")] };
}

export function AgentConfigEditor({ workspaceId, clis, ollamaModels, disabled, runCount, onChange }: {
  workspaceId: string; clis: Cli[]; ollamaModels: string[]; disabled: boolean; runCount: number; onChange: (c: AgentConfig) => void;
}) {
  const key = `superai-agent-v1:${workspaceId}`;
  const [config, setConfig] = useState<AgentConfig>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && validSeat(saved.main) && Array.isArray(saved.subagents) && saved.subagents.length && saved.subagents.every(validSeat)) return saved;
    } catch {}
    return defaultConfig(clis);
  });
  useEffect(() => {
    onChange(config);
    try { localStorage.setItem(key, JSON.stringify(config)); } catch {}
  }, [config, key, onChange]);
  const editSub = (index: number, seat: Seat) => setConfig((c) => ({ ...c, subagents: c.subagents.map((s, i) => (i === index ? seat : s)) }));
  return (
    <ConfigShell label="ตั้งค่าทีม Agent" runCount={runCount} title={<><Users size={17} /> ทีม Agent</>}
      description="Main วางแผนและแจกงาน → Sub-agent ทำพร้อมกัน → Main ตรวจและสรุปผลให้คุณ"
      summary={`Main: ${config.main.name} (${seatSummary(config.main)}) · ${config.subagents.map((s) => `${s.name} (${seatSummary(s)})`).join(" · ")}`}>
      <div className="seat-row main-seat">
        <span className="seat-badge"><Crown size={13} /> Main</span>
        <SeatPicker seat={config.main} label="Main" clis={clis} ollamaModels={ollamaModels} disabled={disabled} onChange={(main) => setConfig((c) => ({ ...c, main }))} />
      </div>
      {config.subagents.map((seat, index) => (
        <div className="seat-row" key={index}>
          <span className="seat-badge"><Bot size={13} /> Sub {index + 1}</span>
          <SeatPicker seat={seat} label={`Sub-agent ${index + 1}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled}
            onChange={(s) => editSub(index, s)}
            onRemove={config.subagents.length > 1 ? () => setConfig((c) => ({ ...c, subagents: c.subagents.filter((_, i) => i !== index) })) : undefined} />
        </div>
      ))}
      <button className="text-button add-seat" disabled={disabled || config.subagents.length >= MAX_SUBAGENTS}
        onClick={() => setConfig((c) => ({ ...c, subagents: [...c.subagents, seatFor(firstReady(clis) || HEADLESS[0], `Sub-agent ${c.subagents.length + 1}`)] }))}>
        <Plus size={13} /> เพิ่ม Sub-agent ({config.subagents.length}/{MAX_SUBAGENTS})
      </button>
    </ConfigShell>
  );
}

const STEP: Record<StepStatus, string> = { pending: "รอคิว", running: "กำลังทำ", completed: "เสร็จแล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิก", skipped: "ข้าม" };
const STAGE: Record<string, string> = { planning: "Main กำลังวางแผนและแบ่งงาน", working: "Sub-agent กำลังทำงาน", summarizing: "Main กำลังตรวจผลและสรุป", completed: "ทีมทำงานเสร็จแล้ว", failed: "จบโดยมีงานไม่สำเร็จ", cancelled: "ยกเลิกงานแล้ว" };
const tail = (text: string, lines = 6) => text.trim().split("\n").slice(-lines).join("\n");

export function AgentRunView({ run }: { run: Run }) {
  const subs = run.subagents || [];
  const tasks = run.tasks || [];
  const mainState = run.stage === "planning" || run.stage === "summarizing" ? "running" : run.status === "running" ? "waiting" : run.status;
  return (
    <section className="agent-run" aria-label="ความคืบหน้าทีม Agent">
      <ol className="mission-stages" aria-label="ขั้นตอนการทำงาน">{[["planning", "วางแผน"], ["working", "ดำเนินการ"], ["summarizing", "ตรวจและสรุป"]].map(([stage, label], index) => <li key={stage} aria-current={run.stage === stage ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol><h3 className="run-stage">{run.status === "running" && <LoaderCircle size={13} className="spin" />}{STAGE[run.stage || run.status] || ""}</h3>
      {run.main && (
        <div className="agent-cards">
          <article className={`agent-card main state-${mainState}`}>
            <header><Crown size={13} /><strong>{run.main.name}</strong><span className="chip">{mainState === "running" ? "กำลังคิด" : mainState === "waiting" ? "รอ Sub-agent" : STEP[mainState as StepStatus] || ""}</span></header>
            <small>{seatSummary(run.main)}</small>
            {run.plan && <p className="agent-plan">แนวทาง: {run.plan}</p>}
          </article>
          {subs.map((seat, index) => {
            const mine = tasks.filter((t) => t.assignee === index);
            const current = mine.find((t) => t.status === "running");
            const state: string = current ? "running" : mine.some((t) => t.status === "failed") ? "failed" : mine.length && mine.every((t) => t.status === "completed") ? "completed" : mine.some((t) => t.status === "pending") ? "pending" : run.stage === "planning" ? "pending" : mine.length ? mine[mine.length - 1].status : "idle";
            return (
              <article key={index} className={`agent-card state-${state}`}>
                <header><Bot size={13} /><strong>{seat.name}</strong><span className="chip">{state === "idle" ? "ไม่ได้รับงาน" : state === "pending" && run.stage === "planning" ? "รอแผน" : STEP[state as StepStatus]}</span></header>
                <small>{seatSummary(seat)}</small><ul className="mission-task-list">{mine.map(task => <li key={task.id}><span className={"task-signal state-" + task.status} /><span>{task.title}</span><small>{STEP[task.status]}</small></li>)}</ul>
                {current ? (
                  <>
                    <p className="agent-doing">กำลังทำ: {current.title}</p>
                    {current.output && <pre className="agent-live">{tail(current.output)}</pre>}
                  </>
                ) : mine.length > 0 && <p className="agent-doing">{mine.filter((t) => t.status === "completed").length}/{mine.length} งานเสร็จ</p>}
              </article>
            );
          })}
        </div>
      )}
      {tasks.length > 0 && (
        <ol className="task-board">
          {tasks.map((t) => (
            <li key={t.id} className={`state-${t.status}`}>
              <details>
                <summary>
                  <span className="chip">{STEP[t.status]}</span>
                  <strong>{t.title}</strong>
                  <small>→ {subs[t.assignee]?.name}{t.dependsOn.length ? ` · รอ ${t.dependsOn.map((d) => tasks.find((x) => x.id === d)?.title || d).join(", ")}` : ""}</small>
                </summary>
                <p className="task-instructions">{t.instructions}</p>
                {t.error && <div className="inline-error">{t.error}</div>}
                {t.output ? <Markdown text={t.output} /> : <p className="muted">ยังไม่มีผลลัพธ์</p>}
              </details>
            </li>
          ))}
        </ol>
      )}
      {run.activity?.length > 0 && (
        <details className="activity-log" open={run.status === "running"}>
          <summary>ไทม์ไลน์การทำงาน ({run.activity.length})</summary>
          <ul>
            {run.activity.slice(-40).map((a, i) => (
              <li key={i}><time>{new Date(a.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><strong>{a.who}</strong><span>{a.text}</span></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
