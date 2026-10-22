import { ChildProcess } from "node:child_process";

/** Minimal surface of a node-pty process that we rely on. */
export interface PtyProcess {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void;
}

export interface TerminalSession {
  agentType?: string;
  wsId?: string;
  threadId?: string;
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd: string;
  /** 'pty' = real pseudo-terminal (interactive CLIs work); 'pipe' = stdio fallback. */
  mode: "pty" | "pipe";
  process?: ChildProcess;
  ptyProcess?: PtyProcess;
  status: "running" | "stopping" | "exited" | "error";
  closeRequested?: boolean;
  terminationConfirmed?: boolean;
  exitObserved?: boolean;
  exitCode: number | null;
  createdAt: number;
  bufferedOutput: string;
  subscribers: Set<(chunk: string) => void>;
  /** The CLI printed that it was updating itself (it usually exits afterwards). */
  selfUpdated?: boolean;
  /** ...but also reported that the update failed, so it must not be reopened as "updated". */
  updateFailed?: boolean;
  /** Options to start the same session again (restart after a self-update or an exit). */
  restart?: SpawnSessionOptions;
  /** When the process last printed anything (a CLI still answering is not interrupted by an update). */
  lastOutputAt?: number;
  /** Claude Code conversation id given with --session-id (or the one resumed). */
  cliSessionId?: string;
  /** The `resume` this tab was opened with. */
  resumedFrom?: string;
  /** Kept without a process: a saved session after an app restart, or a chat whose terminal is closed. */
  dormant?: boolean;
  /** The process is being stopped to make the session dormant, not to close it. */
  sleeping?: boolean;
}

/** A tab saved before an update, reopened on the same conversation after the restart. */
export interface RestoredSession {
  id: string;
  options: SpawnSessionOptions;
  resume?: string;
}

export interface AgentThread {
  id: string;
  title: string;
  type:
    | "claude-code"
    | "codex"
    | "antigravity"
    | "opencode"
    | "freebuff"
    | "antigravity"
    | "opencode-multi"
    | "terminal";
  status: "idle" | "running" | "completed" | "failed";
  unreadCount: number;
  sessionId?: string;
  createdAt: number;
  lastActiveAt: number;
  thoughts?: Array<{
    id: string;
    duration: string;
    tokens: number;
    preview: string;
    fullText?: string;
  }>;
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  threads: AgentThread[];
  activeThreadId?: string;
}

export interface SpawnSessionOptions {
  /** One-off authentication terminal; never restored as a conversation. */
  authOnly?: boolean;
  openCodeModel?: string;
  /** Model and effort for CLI sessions opened from Code mode ("" = CLI default). */
  model?: string;
  effort?: string;
  agentType?: string;
  wsId?: string;
  threadId?: string;
  id?: string;
  name?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  /** Resume a CLI conversation: its id, or "last" for the latest one in the folder. */
  resume?: string;
  /** Force the stdio-pipe implementation even if a PTY is available. */
  forcePipe?: boolean;
}
