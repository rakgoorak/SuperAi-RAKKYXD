import { ChildProcess } from 'node:child_process';

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
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd: string;
  /** 'pty' = real pseudo-terminal (interactive CLIs work); 'pipe' = stdio fallback. */
  mode: 'pty' | 'pipe';
  process?: ChildProcess;
  ptyProcess?: PtyProcess;
  status: 'running' | 'exited' | 'error';
  exitCode: number | null;
  createdAt: number;
  bufferedOutput: string;
  subscribers: Set<(chunk: string) => void>;
}

export interface AgentThread {
  id: string;
  title: string;
  type: 'claude-code' | 'codex' | 'antigravity' | 'opencode-multi' | 'terminal';
  status: 'idle' | 'running' | 'completed' | 'failed';
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
  id?: string;
  name?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  /** Force the stdio-pipe implementation even if a PTY is available. */
  forcePipe?: boolean;
}
