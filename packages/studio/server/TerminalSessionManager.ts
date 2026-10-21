import { cliPath, cliEnv } from "./CliCatalog.js";
import { spawn, ChildProcess, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { TerminalSession, SpawnSessionOptions, PtyProcess } from "./types.js";
import { getCliDefinition, cliLaunch } from "./CliCatalog.js";

// Prebuilt node-pty (no Visual Studio / node-gyp needed). If it can't load,
// we fall back to plain stdio pipes so the app still works.
const require = createRequire(import.meta.url);
let ptyModule: {
  spawn: (file: string, args: string[], opts: any) => PtyProcess;
} | null = null;
try {
  ptyModule = require("@lydell/node-pty");
} catch {
  ptyModule = null;
}

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private maxBufferSize: number = 200 * 1024; // backlog replayed to new viewers

  public get ptyAvailable(): boolean {
    return ptyModule !== null;
  }

  public spawnSession(options: SpawnSessionOptions = {}): TerminalSession {
    if (options.agentType) {
      const definition = getCliDefinition(options.agentType);
      const count = [...this.sessions.values()].filter(
        (s) =>
          s.agentType === options.agentType &&
          (["running", "stopping"].includes(s.status) ||
            (s.closeRequested && !s.terminationConfirmed)),
      ).length;
      if (count >= definition.maxSessions)
        throw new Error(
          `${definition.name} เปิดได้สูงสุด ${definition.maxSessions} session กรุณาปิด session เดิมก่อน`,
        );
      if (!options.command)
        options = {
          ...options,
          ...cliLaunch(
            options.agentType,
            options.agentType === "opencode" && options.openCodeModel
              ? ["--model", options.openCodeModel]
              : [],
          ),
        };
    }
    if (this.sessions.size > 100)
      for (const [key, s] of this.sessions)
        if (!["running", "stopping"].includes(s.status) && !s.closeRequested)
          this.sessions.delete(key);
    const id = options.id || randomUUID();
    const isWindows = process.platform === "win32";

    const defaultShell = isWindows
      ? "powershell.exe"
      : process.env.SHELL || "bash";
    const command = options.command || defaultShell;
    const args =
      options.args ||
      (isWindows && command.toLowerCase().includes("powershell")
        ? ["-NoLogo"]
        : []);
    const cwd = options.cwd || process.cwd();

    const localBin = path.join(os.homedir(), ".local", "bin");
    const existingPath = process.env.PATH || "";
    const enhancedPath =
      isWindows && !existingPath.toLowerCase().includes(localBin.toLowerCase())
        ? `${localBin};${existingPath}`
        : existingPath;

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...cliEnv(),
      PATH: [cliPath(), enhancedPath].join(path.delimiter),
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      ...options.env,
    };

    const session: TerminalSession = {
      agentType: options.agentType || "terminal",
      wsId: options.wsId,
      threadId: options.threadId,
      id,
      name: options.name || command,
      command,
      args,
      cwd,
      mode: ptyModule && !options.forcePipe ? "pty" : "pipe",
      status: "running",
      exitCode: null,
      createdAt: Date.now(),
      bufferedOutput: "",
      subscribers: new Set(),
    };

    const handleData = (chunk: Buffer | string) => {
      const text = chunk.toString();
      session.bufferedOutput += text;
      if (session.bufferedOutput.length > this.maxBufferSize) {
        session.bufferedOutput = session.bufferedOutput.slice(
          -this.maxBufferSize,
        );
      }
      for (const subscriber of session.subscribers) {
        try {
          subscriber(text);
        } catch {
          // ignore dead subscriber
        }
      }
    };

    const handleExit = (code: number | null) => {
      session.exitObserved = true;
      if (session.status === "exited") return;
      if (session.status !== "error")
        session.status =
          session.closeRequested && !session.terminationConfirmed
            ? "stopping"
            : "exited";
      session.exitCode = code;
      handleData(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
      if (session.closeRequested && session.terminationConfirmed)
        this.sessions.delete(session.id);
    };

    try {
      if (session.mode === "pty" && ptyModule) {
        const ptyProc = ptyModule.spawn(command, args, {
          name: "xterm-256color",
          cols: options.cols || 120,
          rows: options.rows || 30,
          cwd,
          env,
        });
        session.ptyProcess = ptyProc;
        ptyProc.onData(handleData);
        ptyProc.onExit(({ exitCode }) => handleExit(exitCode));
      } else {
        const proc: ChildProcess = spawn(command, args, {
          cwd,
          env,
          shell: false,
          detached: !isWindows,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
        session.process = proc;
        proc.stdout?.setEncoding("utf8");
        proc.stderr?.setEncoding("utf8");
        proc.stdout?.on("data", handleData);
        proc.stderr?.on("data", handleData);
        proc.on("error", (err) => {
          handleData(`\r\n[Process error: ${err.message}]\r\n`);
          session.status = "error";
        });
        proc.on("close", (code) => handleExit(code));
      }
    } catch (err: any) {
      session.status = "error";
      session.exitCode = 1;
      session.bufferedOutput = `\x1b[31m[Failed to spawn "${command}": ${err.message}]\x1b[0m\r\n`;
    }

    this.sessions.set(id, session);
    return session;
  }

  public getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  public listSessions() {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      agentType: s.agentType,
      wsId: s.wsId,
      threadId: s.threadId,
      name: s.name,
      command: s.command,
      args: s.args,
      cwd: s.cwd,
      mode: s.mode,
      status: s.status,
      exitCode: s.exitCode,
      createdAt: s.createdAt,
      bufferedOutput: s.bufferedOutput.slice(-1000),
    }));
  }

  public writeInput(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status !== "running") return false;
    try {
      if (session.ptyProcess) {
        session.ptyProcess.write(data);
      } else if (session.process?.stdin) {
        // Pipes have no line discipline: translate a lone Enter (\r) to a newline.
        session.process.stdin.write(data.replace(/\r(?!\n)/g, "\r\n"));
      } else {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  public resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (!session?.ptyProcess || session.status !== "running") return false;
    if (
      !Number.isFinite(cols) ||
      !Number.isFinite(rows) ||
      cols < 2 ||
      rows < 2
    )
      return false;
    try {
      session.ptyProcess.resize(Math.floor(cols), Math.floor(rows));
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
    if (session.bufferedOutput) {
      try {
        callback(session.bufferedOutput);
      } catch {}
    }
    return () => {
      session.subscribers.delete(callback);
    };
  }

  private terminate(session: TerminalSession): void {
    const pid = session.ptyProcess?.pid || session.process?.pid;
    if (process.platform === "win32" && pid) {
      execFile(
        "taskkill",
        ["/PID", String(pid), "/T", "/F"],
        { windowsHide: true },
        (error) => {
          if (error) {
            session.status = "error";
            const message =
              "\r\n[ปิด process ลูกไม่สำเร็จ ยังไม่คืนสิทธิ์เปิด session กรุณาลองปิดอีกครั้ง]\r\n";
            session.bufferedOutput += message;
            for (const subscriber of session.subscribers)
              try {
                subscriber(message);
              } catch {}
            return;
          }
          try {
            session.ptyProcess?.kill();
          } catch {}
          session.terminationConfirmed = true;
          if (session.closeRequested && session.exitObserved)
            this.sessions.delete(session.id);
        },
      );
    } else {
      if (pid) {
        try { process.kill(-pid, "SIGKILL"); }
        catch (error: any) { if (error.code !== "ESRCH") throw error; }
      }
      session.terminationConfirmed = true;
      try { session.ptyProcess?.kill(); } catch {}
      try { session.process?.kill(); } catch {}
      if (session.closeRequested && session.exitObserved) this.sessions.delete(session.id);
    }
  }

  public killSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    try {
      if (session.status === "stopping") return true;
      if (session.closeRequested && !session.terminationConfirmed) {
        session.status = "stopping";
        this.terminate(session);
        return true;
      }
      if (session.status !== "running") {
        try {session.ptyProcess?.kill();}catch{}
        this.sessions.delete(id);
        return true;
      }
      session.closeRequested = true;
      session.status = "stopping";
      this.terminate(session);
      return true;
    } catch {
      return false;
    }
  }

  public killAll(): void {
    for (const session of this.sessions.values()) {
      if (session.status === "running" || session.status === "stopping") {
        try {
          this.terminate(session);
        } catch {}
      } else {try{session.ptyProcess?.kill();}catch{}}
    }
    this.sessions.clear();
  }
}
