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
export interface TeamSeat { name:string; provider:string; model:string; }
export type TeamRole = 'coder'|'tester'|'reviewer';
export interface AgentTeam { leader:TeamSeat; members:(TeamSeat & {role:TeamRole})[]; }
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
  mode: "chat" | "assistant";
  model: string;
  status: string;
  output: string;
  error?: string;
  events: string[];
  createdAt: number;
  team?:AgentTeam;
  stage?:string;
  tasks?:{id:string;title:string;assignedAgent:TeamRole;status:string;result?:string}[];
}
