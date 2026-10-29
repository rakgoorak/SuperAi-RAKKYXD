import { Bot, BriefcaseBusiness, Users } from "lucide-react";
import type { CSSProperties } from "react";
import type { Run } from "../api";
import type { AgentConfig } from "./AgentPanel";
import { agentLocations } from "./agentWorkspaceState";

export function AgentWorkspace({ config, run, typing }: { config: AgentConfig | null; run?: Run; typing: boolean }) {
  if (!config && !run?.main) return null;
  const agents = agentLocations(config || { main: run!.main!, subagents: run!.subagents || [] }, run, typing);
  let meetingIndex = 0, deskIndex = 0;
  return (
    <section className="agent-workspace" aria-label="พื้นที่ทำงานของทีม Agent">
      <div className="agent-workspace-head"><div><span className="agent-workspace-eyebrow">SUPERAI · AGENT WORKSPACE</span><h2>พื้นที่ทำงานของทีม</h2></div><span className="agent-workspace-live"><i />{run?.status === "running" ? "กำลังทำงาน" : typing ? "รับโจทย์" : "พร้อมทำงาน"}</span></div>
      <div className="agent-office" role="img" aria-label={agents.map(a => `${a.seat.name}: ${a.label} ${a.room === "desk" ? "ที่โต๊ะทำงาน" : "ในห้องประชุม"}`).join("; ")}>
        <div className="office-room meeting-room"><div className="office-room-title"><Users size={14} /> ห้องประชุม <small>วิเคราะห์และวางแผน</small></div><div className="meeting-board"><span>IDEAS</span><span>PLAN</span><span>PROGRESS</span></div><div className="meeting-table"><span /><span /><span /></div></div>
        <div className="office-room work-room"><div className="office-room-title"><BriefcaseBusiness size={14} /> ห้องทำงาน <small>ลงมือทำงาน</small></div><div className="office-desks"><div /><div /><div /></div></div>
        {agents.map((agent, index) => {
          const pos = agent.room === "meeting" ? meetingIndex++ : deskIndex++;
          const x = agent.room === "meeting" ? 8 + (pos % 4) * 10 : 58 + (pos % 3) * 13;
          const y = agent.room === "meeting" ? 54 + Math.floor(pos / 4) * 22 : 49 + Math.floor(pos / 3) * 22;
          return <div className={`office-agent room-${agent.room}`} key={`${index}-${agent.seat.name}`} style={{ "--agent-x": `${x}%`, "--agent-y": `${y}%`, "--agent-color": ["#75dbc0", "#a99cff", "#ffbc77", "#86bfff", "#ef9bbd", "#c8d880", "#e5a584"][index % 7] } as CSSProperties}>
            <div className="office-agent-tag"><strong>{agent.seat.name}</strong><small>{agent.label}</small></div>
            <div className="office-agent-figure"><span className="office-agent-antenna" /><div className="office-agent-face"><i /><i /></div><div className="office-agent-body"><Bot size={12} /></div><span className="office-agent-foot left" /><span className="office-agent-foot right" /></div>
          </div>;
        })}
      </div>
      <p className="agent-workspace-caption">ตัวละครแสดงสถานะของทีม Agent ในงานนี้ · วางแผนที่ห้องประชุม และไปโต๊ะเมื่อได้รับงาน</p>
    </section>
  );
}
