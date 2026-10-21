export async function api<T = any>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error(
      "เชื่อมต่อระบบไม่ได้ กรุณาตรวจว่าโปรแกรมหลักยังเปิดอยู่ แล้วลองใหม่",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || `คำขอไม่สำเร็จ (${response.status})`);
  return body;
}
export const post = <T = any>(url: string, body: unknown = {}) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });
export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  threads: any[];
}
export interface NodeStatus {
  installed: boolean;
  ready: boolean;
  version: string | null;
  major: number;
  isManaged: boolean;
  nodePath: string | null;
  npmPath: string | null;
}
export interface Cli {
  id: string;
  name: string;
  command: string;
  available: boolean;
  maxSessions: number;
  installPackage?: string;
  needsNode?: boolean;
  installerReady?: boolean;
  nodeReady?: boolean;
  nodeStatus?: NodeStatus;
  teamSupported?: boolean;
}
/** One AI seat: tool ("cli:<id>" or an Ollama model), model and effort ("" = CLI default). */
export interface Seat { name: string; provider: string; model: string; effort: string; }
export interface ModelList { models: string[]; efforts: string[]; modelEfforts?: Record<string, string[]>; note?: string; }
export type StepStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
export interface PanelAnswer { seat: Seat; status: StepStatus; output: string; error?: string; }
export interface AgentTask { id: string; title: string; assignee: number; instructions: string; dependsOn: string[]; status: StepStatus; output: string; error?: string; }
export interface Activity { at: number; who: string; text: string; }
export interface SkillInfo { source: string; sourceLabel: string; name: string; description: string; files: string[]; url: string; reason?: string; }
export interface InstalledSkill { name: string; source: string; managed: boolean; targets: string[]; }
export interface Session {
  id: string;
  name: string;
  agentType: string;
  wsId?: string;
  cwd: string;
  status: "running" | "stopping" | "exited" | "error";
  exitCode: number | null;
  mode: "pty" | "pipe";
}
export interface Run {
  id: string;
  wsId: string;
  prompt: string;
  mode: "chat" | "agent";
  status: "running" | "completed" | "failed" | "cancelled";
  output: string;
  error?: string;
  createdAt: number;
  allowTools: boolean;
  activity: Activity[];
  panel?: PanelAnswer[];
  summarizer?: Seat | null;
  summaryStyle?: "merge" | "best";
  summaryStatus?: StepStatus;
  main?: Seat;
  subagents?: Seat[];
  stage?: string;
  plan?: string;
  tasks?: AgentTask[];
}
