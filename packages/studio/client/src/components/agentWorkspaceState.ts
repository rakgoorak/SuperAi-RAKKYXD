import type { Run, Seat } from "../api";

type Team = { main: Seat; subagents: Seat[] };
export type WorkspaceAgent = { seat: Seat; room: "meeting" | "desk"; label: string };

export function agentLocations(config: Team, run?: Run, typing = false): WorkspaceAgent[] {
  const team = run?.main ? { main: run.main, subagents: run.subagents || [] } : config;
  const working = run?.status === "running" && run.stage === "working";
  const mainLabel = typing && !working ? "รับโจทย์" : run?.status === "running" ? (run.stage === "working" ? "ประสานงาน" : run.stage === "asking" ? "รอคำตอบ" : "วิเคราะห์งาน") : "พร้อมประชุม";
  return [
    { seat: team.main, room: "meeting", label: mainLabel },
    ...team.subagents.map((seat, index): WorkspaceAgent => {
      const task = working && run?.tasks?.find(t => t.assignee === index && t.status === "running");
      return { seat, room: task ? "desk" : "meeting", label: task ? "กำลังทำงาน" : run?.status === "running" ? "รอร่วมงาน" : "พร้อมประชุม" };
    }),
  ];
}
