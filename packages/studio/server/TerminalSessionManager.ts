import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { TerminalSession, SpawnSessionOptions } from './types.js';

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private maxBufferSize: number = 100 * 1024; // 100KB backlog per session

  public spawnSession(options: SpawnSessionOptions = {}): TerminalSession {
    const id = options.id || randomUUID();
    const isWindows = process.platform === 'win32';
    
    // Choose sensible default shell
    const defaultShell = isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
    const command = options.command || defaultShell;
    const args = options.args || (isWindows && command.toLowerCase().includes('powershell') ? ['-NoLogo'] : []);
    const cwd = options.cwd || process.cwd();

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      ...options.env
    };

    let proc: ChildProcess;
    try {
      proc = spawn(command, args, {
        cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err: any) {
      const failedSession: TerminalSession = {
        id,
        name: options.name || command,
        command,
        args,
        cwd,
        status: 'error',
        exitCode: 1,
        createdAt: Date.now(),
        bufferedOutput: `[Failed to spawn process: ${err.message}]\r\n`,
        subscribers: new Set()
      };
      this.sessions.set(id, failedSession);
      return failedSession;
    }

    const session: TerminalSession = {
      id,
      name: options.name || command,
      command,
      args,
      cwd,
      process: proc,
      status: 'running',
      exitCode: null,
      createdAt: Date.now(),
      bufferedOutput: '',
      subscribers: new Set()
    };

    const handleData = (chunk: Buffer | string) => {
      const text = chunk.toString();
      session.bufferedOutput += text;
      if (session.bufferedOutput.length > this.maxBufferSize) {
        session.bufferedOutput = session.bufferedOutput.slice(-this.maxBufferSize);
      }
      for (const subscriber of session.subscribers) {
        try {
          subscriber(text);
        } catch {
          // ignore dead subscriber
        }
      }
    };

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', handleData);

    proc.on('error', (err) => {
      handleData(`\r\n[Process error: ${err.message}]\r\n`);
      session.status = 'error';
    });

    proc.on('close', (code) => {
      session.status = 'exited';
      session.exitCode = code;
      handleData(`\r\n[Process terminated with exit code ${code}]\r\n`);
    });

    this.sessions.set(id, session);
    return session;
  }

  public getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  public listSessions(): Array<Omit<TerminalSession, 'process' | 'subscribers'>> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      command: s.command,
      args: s.args,
      cwd: s.cwd,
      status: s.status,
      exitCode: s.exitCode,
      createdAt: s.createdAt,
      bufferedOutput: s.bufferedOutput.slice(-1000) // snippet
    }));
  }

  public writeInput(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session || !session.process || session.status !== 'running') {
      return false;
    }
    try {
      session.process.stdin?.write(data);
      return true;
    } catch {
      return false;
    }
  }

  public subscribe(id: string, callback: (chunk: string) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }
    session.subscribers.add(callback);
    // Send existing backlog immediately
    if (session.bufferedOutput) {
      try {
        callback(session.bufferedOutput);
      } catch {}
    }
    return () => {
      session.subscribers.delete(callback);
    };
  }

  public killSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || !session.process) {
      return false;
    }
    try {
      session.process.kill();
      session.status = 'exited';
      return true;
    } catch {
      return false;
    }
  }

  public killAll(): void {
    for (const session of this.sessions.values()) {
      if (session.process && session.status === 'running') {
        try {
          session.process.kill();
        } catch {}
      }
    }
    this.sessions.clear();
  }
}
