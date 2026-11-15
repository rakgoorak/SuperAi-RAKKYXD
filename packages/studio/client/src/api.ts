import { tr } from './i18n';
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
      tr("เชื่อมต่อระบบไม่ได้ กรุณาตรวจว่าโปรแกรมหลักยังเปิดอยู่ แล้วลองใหม่"),
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || tr`คำขอไม่สำเร็จ (${response.status})`);
  return body;
}
export const post = <T = any>(url: string, body: unknown = {}) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });

export interface PinnedFileItem {
  path: string;
  name: string;
  content: string;
  size: number;
}
export async function getPinnedContent(wsId: string): Promise<{ files: PinnedFileItem[] }> {
  return api(`/api/workspaces/${wsId}/pinned-content`);
}
export async function togglePinnedFile(wsId: string, filePath: string): Promise<Workspace> {
  return post(`/api/workspaces/${wsId}/pinned-files/toggle`, { filePath });
}
export async function getProjectFiles(wsId: string, query = ''): Promise<{ files: string[] }> {
  const q = query ? `?query=${encodeURIComponent(query)}` : '';
  return api(`/api/workspaces/${wsId}/files${q}`);
}
export async function saveProjectFile(wsId: string, filePath: string, content: string): Promise<{ success: boolean }> {
  return post(`/api/workspaces/${wsId}/files/save`, { filePath, content });
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  isCurrent: boolean;
  relativeDir: string;
}

export interface WorktreeListResponse {
  worktrees: WorktreeInfo[];
  current: WorktreeInfo | null;
  isWorktree: boolean;
}

export interface MergeWorktreeResponse {
  success: boolean;
  commit?: string;
  deleted?: boolean;
  conflict?: boolean;
  conflictingFiles?: string[];
  error?: string;
}

export async function getWorktrees(wsId: string): Promise<WorktreeListResponse> {
  return api(`/api/workspaces/${encodeURIComponent(wsId)}/worktrees`);
}

export async function createWorktree(wsId: string, branch: string): Promise<{ success: boolean; worktree: WorktreeInfo }> {
  return post(`/api/workspaces/${encodeURIComponent(wsId)}/worktrees`, { branch });
}

export async function mergeWorktree(
  wsId: string,
  sourceBranch: string,
  targetBranch: string = 'main',
  deleteAfter: boolean = false
): Promise<MergeWorktreeResponse> {
  return post(`/api/workspaces/${encodeURIComponent(wsId)}/worktrees/merge`, { sourceBranch, targetBranch, deleteAfter });
}

export async function deleteWorktree(
  wsId: string,
  path: string,
  deleteBranch: boolean = false
): Promise<{ success: boolean }> {
  return api(`/api/workspaces/${encodeURIComponent(wsId)}/worktrees`, {
    method: 'DELETE',
    body: JSON.stringify({ path, deleteBranch }),
  });
}

export interface Workspace {
  favorite?: boolean;
  id: string;
  name: string;
  rootPath: string;
  instructions?: string;
  pinnedFiles?: string[];
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
export interface Seat { accountId?: string; name: string; provider: string; model: string; effort: string; }
export interface ModelList { models: string[]; efforts: string[]; modelEfforts?: Record<string, string[]>; note?: string; }
export interface CliAuthStatus { id: string; status: "authenticated" | "login-required" | "unknown" | "not-installed"; note: string; checkedAt: number; loginCommand: string }
export interface ChatSkill { id: string; name: string; description: string; source: string; path: string }
export async function loginProvider(id: string, context: { sessionId?: string; wsId?: string; accountId?: string }) {
  const session = await post<{ id: string }>(`/api/clis/${id}/login`, context);
  window.dispatchEvent(new CustomEvent("superai:login-session", { detail: session.id }));
}
export type StepStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
export interface PanelAnswer { seat: Seat; status: StepStatus; output: string; error?: string; startedAt?: number; firstChunkAt?: number; completedAt?: number; tokenCount?: number; }
export interface AgentTask { id: string; title: string; assignee: number; instructions: string; dependsOn: string[]; status: StepStatus; output: string; error?: string; }
export interface Activity { at: number; who: string; text: string; }
export interface UsageStep { stage: string; seat: string; provider: string; status: 'running' | 'completed' | 'failed'; missing: boolean; calls: { input?: number; cachedInput?: number; cacheWrite?: number; output?: number; inputIncludesCache?: boolean }[]; }
export interface SkillInfo { source: string; sourceLabel: string; name: string; description: string; files: string[]; url: string; repo?: string; branch?: string; prefix?: string; installs?: number; reason?: string; }
export interface InstalledSkill { name: string; source: string; managed: boolean; targets: string[]; }
export interface Session {
  accountId?: string;
  authOnly?: boolean;
  id: string;
  name: string;
  agentType: string;
  wsId?: string;
  cwd: string;
  status: "running" | "stopping" | "exited" | "error";
  exitCode: number | null;
  mode: "pty" | "pipe";
  /** Kept without a running CLI (saved session after a restart, or a chat whose terminal is closed). */
  dormant?: boolean;
  /** Shown as a chat (Claude Code, Codex, Antigravity, OpenCode) or as the CLI's terminal. */
  view?: "chat" | "terminal";
  /** The CLI printed that it updated itself (it usually exits right after). */
  selfUpdated?: boolean;
  updateFailed?: boolean;
  createdAt?: number;
}
export interface ClarifyQuestion { id: string; header: string; question: string; multiSelect: boolean; options: { label: string; description: string; recommended: boolean }[]; }
export interface ClarifyAnswer { selected: string[]; other: string; }
export interface Clarification { by: string; intro: string; questions: ClarifyQuestion[]; status: "waiting" | "answered" | "skipped" | "cancelled"; answers?: Record<string, ClarifyAnswer>; }
export interface Run {
  responseStyle?: import('./responseStyle').ResponseStyle;
  id: string;
  wsId: string;
  prompt: string;
  mode: "chat" | "agent";
  status: "running" | "completed" | "failed" | "cancelled";
  output: string;
  error?: string;
  createdAt: number;
  allowTools: boolean;
  attachments?: string[];
  activity: Activity[];
  clarify?: Clarification;
  usageSteps?: UsageStep[];
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

export interface VerificationResult {
  passed: boolean;
  exitCode: number;
  command: string;
  output: string;
  failureSummary: string;
  durationMs: number;
}

export interface SelfHealResult {
  success: boolean;
  command: string;
  totalAttempts: number;
  attempts: Array<{
    attempt: number;
    verification: VerificationResult;
    fixPrompt?: string;
    fixedAt?: number;
  }>;
  error?: string;
}

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  file: string;
  line?: number;
  title: string;
  description: string;
  suggestedFix?: string;
}

export interface CrossReviewResult {
  reviewer: { name: string; provider: string; model: string; effort: string };
  authorProvider: string;
  verdict: 'approved' | 'changes_requested' | 'needs_discussion';
  score: number;
  summary: string;
  issues: ReviewIssue[];
  reviewedAt: number;
  diffStats: {
    filesChanged: number;
    diffSnippet: string;
  };
}

export async function verifyProject(wsId: string, command?: string): Promise<VerificationResult> {
  return post(`/api/workspaces/${wsId}/verify`, { command });
}

export async function selfHealProject(wsId: string, options: { sessionId?: string; command?: string; maxAttempts?: number }): Promise<SelfHealResult> {
  return post(`/api/workspaces/${wsId}/self-heal`, options);
}

export async function requestCrossReview(wsId: string, options?: { authorProvider?: string; reviewer?: any; targetFile?: string; customDiff?: string }): Promise<CrossReviewResult> {
  return post(`/api/workspaces/${wsId}/cross-review`, options || {});
}

export async function applyCrossReviewFixes(wsId: string, sessionId: string, review: CrossReviewResult): Promise<{ success: boolean; promptSent: boolean }> {
  return post(`/api/workspaces/${wsId}/cross-review/apply`, { sessionId, review });
}
