import { agentCardState } from "../agentCardState";
import { useEffect, useRef, useState } from "react";
import { Bot, Crown, LoaderCircle, Plus, Users } from "lucide-react";
import type { Cli, Run, Seat, StepStatus } from "../api";
import { HEADLESS, firstReady, seatFor, seatSummary } from "../providers";
import { SeatPicker } from "./SeatPicker";
import { ConfigShell } from "./ConfigShell";
import { ProviderAccess } from "./ProviderAccess";
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

export function AgentConfigEditor({ workspaceId, clis, ollamaModels, disabled, runCount, onChange, onFixTools }: {
  workspaceId: string; clis: Cli[]; ollamaModels: string[]; disabled: boolean; runCount: number; onChange: (c: AgentConfig) => void; onFixTools: () => void;
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
    <>
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
    <div className="team-access" aria-label="ความพร้อมของทีม">{Array.from(new Set([config.main, ...config.subagents].map(s => s.provider).filter(p => p.startsWith("cli:")).map(p => p.slice(4)))).map(provider => <ProviderAccess key={provider} provider={provider} wsId={workspaceId} compact onInstall={onFixTools} />)}</div>
    </>
  );
}

const STEP: Record<StepStatus, string> = { pending: "รอคิว", running: "กำลังทำ", completed: "เสร็จแล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิก", skipped: "ข้าม" };
const STAGE: Record<string, string> = { planning: "Main กำลังวางแผนและแบ่งงาน", working: "Sub-agent กำลังทำงาน", summarizing: "Main กำลังตรวจผลและสรุป", completed: "ทีมทำงานเสร็จแล้ว", failed: "จบโดยมีงานไม่สำเร็จ", cancelled: "ยกเลิกงานแล้ว" };
export function AgentRunView({ run, onFixTools }: { run: Run; onFixTools: () => void }) {
  const [view, setView] = useState("overview");
  const [selected, setSelected] = useState<number | null>(null);
  const inspector = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (selected !== null) inspector.current?.focus(); }, [selected]);
  const close = () => { setSelected(null); trigger.current?.focus(); };
  const subs = run.subagents || [];
  const tasks = run.tasks || [];
  const seat = selected === -1 ? run.main : selected === null ? null : subs[selected];
  const assigned = selected === -1 ? tasks : tasks.filter(t => t.assignee === selected);
  const mainState = run.status !== "running" ? run.status : run.stage === "planning" || run.stage === "summarizing" ? "running" : "waiting";
  return <section className="agent-run" aria-label="ความคืบหน้าทีม Agent">
    <div className="mission-view-switch" role="group" aria-label="มุมมองงาน">
      <button aria-pressed={view === "overview"} onClick={() => setView("overview")}>ภาพรวมงาน</button>
      <button aria-pressed={view === "conversation"} onClick={() => { setView("conversation"); setSelected(null); }}>บทสนทนา</button>
      <span className="mission-count">{tasks.filter(t => t.status === "completed").length}/{tasks.length} งานเสร็จ</span>
    </div>
    <h3 className="run-stage">{run.status === "running" && <LoaderCircle size={13} className="spin" />}{STAGE[run.stage || run.status] || ""}</h3>
    <div hidden={view !== "overview"}>
      <ol className="mission-stages" aria-label="ขั้นตอนการทำงาน">{[["planning", "วางแผน"], ["working", "ดำเนินการ"], ["summarizing", "ตรวจและสรุป"]].map(([stage, label], index) => <li key={stage} aria-current={run.stage === stage ? "step" : undefined} className={run.status === "completed" ? "stage-complete" : ""}><span>{run.status === "completed" ? "✓" : index + 1}</span>{label}</li>)}</ol>
      <div className={"mission-workspace" + (selected !== null ? " has-inspector" : "")}>
        <div className="agent-cards">
          {[...(run.main ? [run.main] : []), ...subs].map((member, i) => {
            const index = run.main ? i - 1 : i;
            const mine = index === -1 ? tasks : tasks.filter(t => t.assignee === index);
            const current = mine.find(t => t.status === "running");
            const state = index === -1 ? mainState : agentCardState(mine);
            return <article key={index} className={"agent-card state-" + state + (index === -1 ? " main" : "")}>
              <header>{index === -1 ? <Crown size={16} /> : <Bot size={16} />}<strong>{member.name}</strong><span className="chip">{state === "waiting" ? "รอทีม" : state === "idle" ? "ไม่ได้รับงาน" : STEP[state as StepStatus] || "รอแผน"}</span></header>
              <small>{seatSummary(member)}</small>
              {index === -1 && run.plan && <p className="agent-plan">{run.plan}</p>}
              <ul className="mission-task-list">{mine.slice(0, 4).map(task => <li key={task.id}><span className={"task-signal state-" + task.status} /><span>{task.title}</span><small>{STEP[task.status]}</small></li>)}</ul>
              {mine.length > 4 && <small>อีก {mine.length - 4} งานในรายละเอียด</small>}
              {current && <p className="agent-doing">กำลังทำ: {current.title}</p>}
              <button className="secondary inspect-agent" aria-expanded={selected === index} onClick={event => { trigger.current = event.currentTarget; setSelected(index); }}>ดูรายละเอียด {member.name}</button>
            </article>;
          })}
        </div>
        {seat && <aside className="mission-inspector" ref={inspector} tabIndex={-1} aria-label={"รายละเอียด " + seat.name} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
          <header><h3>{seat.name}</h3><button className="secondary" onClick={close}>ปิดรายละเอียด</button></header>
          <p className="muted">{seatSummary(seat)}</p>
          {selected === -1 && run.plan && <p>{run.plan}</p>}
          {assigned.map(task => <section key={task.id}><h4>{task.title}</h4><span className="chip">{STEP[task.status]}</span><p>{task.instructions}</p>{task.dependsOn.length > 0 && <small>รอ: {task.dependsOn.map(id => tasks.find(t => t.id === id)?.title || id).join(", ")}</small>}{task.error && <div role="alert" className="inline-error">{task.error}<button className="secondary" onClick={onFixTools}>ตรวจเครื่องมือและบัญชี</button></div>}{task.output ? <Markdown text={task.output} /> : <p className="muted">ยังไม่มีผลลัพธ์</p>}</section>)}
          {!assigned.length && <p className="muted">ยังไม่มีงานที่ได้รับมอบหมาย</p>}
          {selected === -1 && run.output && <Markdown text={run.output} />}
        </aside>}
      </div>
      {view === "overview" && run.output && <details className="mission-result" open><summary>ผลลัพธ์ล่าสุดจาก Main</summary><Markdown text={run.output} /></details>}
    </div>
    <div hidden={view !== "conversation"} className="mission-conversation">
      <h4>คำสั่งของคุณ</h4><p>{run.prompt}</p>
      <ol className="task-board">{tasks.map(t => <li key={t.id} className={"state-" + t.status}><details><summary><span className="chip">{STEP[t.status]}</span><strong>{t.title}</strong><small>{subs[t.assignee]?.name}</small></summary><p>{t.instructions}</p>{t.error && <div className="inline-error">{t.error}</div>}{t.output ? <Markdown text={t.output} /> : <p className="muted">ยังไม่มีผลลัพธ์</p>}</details></li>)}</ol>
      {view === "conversation" && (run.output ? <Markdown text={run.output} /> : <p className="muted">รอ Main สรุปผล…</p>)}
      {!!run.activity?.length && <details className="activity-log"><summary>ไทม์ไลน์การทำงาน ({run.activity.length})</summary><ul>{run.activity.slice(-40).map((a, i) => <li key={i}><time>{new Date(a.at).toLocaleTimeString("th-TH")}</time><strong>{a.who}</strong><span>{a.text}</span></li>)}</ul></details>}
    </div>
  </section>;
}
