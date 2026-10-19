import { ChildProcess } from 'node:child_process';

export interface TerminalSession {
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd: string;
  process?: ChildProcess;
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
}
