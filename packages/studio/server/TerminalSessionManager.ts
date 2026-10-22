import { modelEffortArgs } from "./Providers.js";

// How to submit typed commands to each TUI (see submitInput).
const SUBMIT_PLAN: Record<string, { bracketed: boolean; enterAfterMs: number }> = {
  codex: { bracketed: true, enterAfterMs: 250 },
  freebuff: { bracketed: false, enterAfterMs: 1500 },
  default: { bracketed: false, enterAfterMs: 150 },
};

// What CLIs print when they update themselves on launch (Claude Code, Codex, Freebuff, OpenCode...).
const SELF_UPDATE = /update available|updating to|auto-?updat|successfully updated|updated to (version )?v?\d|downloading\.\.\.|installing update|new version installed/i;
// ...and what they print when that update did not work (then the tab must not be reopened as "updated").
export const UPDATE_FAILED = /(update|upgrade|download|install)\w*[^\n]{0,40}\b(fail|failed|error)\b|\b(fail(ed)?|errors?)\b[^\n]{0,40}\b(update|upgrade|download|install)|\b(failed to|unable to|could not|couldn't|cannot) (update|upgrade|download|install)/i;
import { cliPath, cliEnv } from "./CliCatalog.js";
import { spawn, ChildProcess, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { TerminalSession, SpawnSessionOptions, PtyProcess, RestoredSession } from "./types.js";
import { resumeArgs, claudeTranscriptExists, findCodexSession } from "./SessionRestore.js";
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
    const original = options;
    let cliSessionId: string | undefined;
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
      if (!options.command) {
        // Claude Code takes the conversation id up front, so the exact tab can be resumed later.
        let resume = resumeArgs(options.agentType, options.resume);
        if (options.agentType === "claude-code") {
          cliSessionId = options.resume && options.resume !== "last" ? options.resume : options.resume ? undefined : randomUUID();
          if (!options.resume) resume = ["--session-id", cliSessionId!];
        }
        options = {
          ...options,
          ...cliLaunch(options.agentType, [
            ...resume,
            ...modelEffortArgs(
              options.agentType,
              options.model || (options.agentType === "opencode" ? options.openCodeModel : "") || "",
              options.effort || "",
              true,
            ),
          ]),
        };
      }
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
      cliSessionId,
      resumedFrom: original.resume,
    };

    const handleData = (chunk: Buffer | string) => {
      const text = chunk.toString();
      session.lastOutputAt = Date.now();
      const visible = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
      if (!session.selfUpdated && SELF_UPDATE.test(visible)) session.selfUpdated = true;
      if (!session.updateFailed && UPDATE_FAILED.test(visible)) session.updateFailed = true;
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
      if (session.sleeping) {
        session.sleeping = false;
        session.dormant = true;
        session.status = "exited";
        session.exitCode = null;
        session.ptyProcess = undefined;
        session.process = undefined;
        return;
      }
      if (session.status === "exited") return;
      if (session.status !== "error")
        session.status =
          session.closeRequested && !session.terminationConfirmed
            ? "stopping"
            : "exited";
      session.exitCode = code;
      handleData(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
      // Closed by the user: confirmed by taskkill, or taskkill failed but the CLI is gone now anyway.
      if (session.closeRequested && (session.terminationConfirmed || session.status === "error"))
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

    // The options as the caller gave them (CLI launch resolved again on restart), without the resume.
    session.restart = { ...original, cwd, id: undefined, cols: undefined, rows: undefined, resume: undefined };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Start an ended or dormant session again with the same command, folder and name, keeping its
   * id (a new createdAt makes the client reconnect). `resume` picks the conversation; by default
   * the one it last had.
   */
  public restartSession(id: string, resume?: string): TerminalSession {
    const session = this.sessions.get(id);
    if (!session?.restart) throw new Error("ไม่พบ session");
    if (session.status === "running" || session.status === "stopping") throw new Error("session ยังทำงานอยู่");
    this.sessions.delete(id);
    try {
      return this.spawnSession({ ...session.restart, name: session.name, id, resume: resume || this.resumeFor(session, new Set()) });
    } catch (error) {
      this.sessions.set(id, session); // e.g. the session limit: keep the saved session
      throw error;
    }
  }

  /** A saved session brought back without starting its CLI; restartSession opens it on demand. */
  public addDormant(entry: { id: string; options: SpawnSessionOptions; createdAt?: number; resume?: string }): TerminalSession {
    const existing = this.sessions.get(entry.id);
    if (existing) return existing;
    const options = entry.options;
    const session: TerminalSession = {
      agentType: options.agentType || "terminal",
      wsId: options.wsId,
      threadId: options.threadId,
      id: entry.id,
      name: options.name || options.agentType || "session",
      command: options.command || "",
      args: options.args,
      cwd: options.cwd || process.cwd(),
      mode: ptyModule && !options.forcePipe ? "pty" : "pipe",
      status: "exited",
      exitCode: null,
      createdAt: entry.createdAt || Date.now(),
      bufferedOutput: "",
      subscribers: new Set(),
      cliSessionId: options.agentType === "claude-code" && entry.resume !== "last" ? entry.resume : undefined,
      resumedFrom: entry.resume,
      restart: { ...options, id: undefined, cols: undefined, rows: undefined, resume: undefined },
      dormant: true,
    };
    this.sessions.set(entry.id, session);
    return session;
  }

  /** Stop the CLI but keep the session (its chat goes on without a terminal). */
  public sleepSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.status !== "running") {
      session.dormant = true;
      return true;
    }
    session.sleeping = true;
    this.terminate(session);
    return true;
  }

  /** The conversation a session's CLI is on (or was on), for resuming it elsewhere. */
  public conversationOf(id: string): string | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const resume = this.resumeFor(session, new Set());
    return resume === "last" ? undefined : resume;
  }

  /** How to pick the tab's conversation up again, or undefined to start fresh. */
  private resumeFor(session: TerminalSession, taken: Set<string>, newestOfKind = true): string | undefined {
    const agent = session.agentType || "";
    if (agent === "claude-code") {
      const id = session.cliSessionId;
      if (id && claudeTranscriptExists(id)) return id;
      return session.resumedFrom === "last" ? "last" : undefined;
    }
    if (agent === "codex") {
      const id = session.resumedFrom && session.resumedFrom !== "last" ? session.resumedFrom : findCodexSession(session.cwd, session.createdAt, taken);
      if (id) taken.add(id);
      return id || undefined;
    }
    // A known conversation (e.g. from the chat view) is resumed exactly.
    if (session.resumedFrom && session.resumedFrom !== "last") return session.resumedFrom;
    // The others only resume "the latest conversation in this folder": give it to one tab only.
    if (["opencode", "antigravity", "freebuff"].includes(agent)) return newestOfKind ? "last" : undefined;
    return undefined;
  }

  /** Open tabs, in order, with what is needed to reopen each one on the same conversation. */
  public snapshot(): RestoredSession[] {
    const open = [...this.sessions.values()].filter((s) => s.status === "running" && s.restart);
    const taken = new Set<string>();
    const newest = new Map<string, string>();
    for (const s of open) {
      const key = `${s.agentType}|${s.cwd.toLowerCase()}`;
      const other = newest.get(key) && this.sessions.get(newest.get(key)!);
      if (!other || other.createdAt < s.createdAt) newest.set(key, s.id);
    }
    return open
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => ({
        id: s.id,
        options: { ...s.restart!, name: s.name },
        resume: this.resumeFor(s, taken, newest.get(`${s.agentType}|${s.cwd.toLowerCase()}`) === s.id),
      }));
  }

  /**
   * Every AI session the user still has (running or dormant), oldest first, with what is needed
   * to bring it back after the app restarts. Ended tabs and plain shells are not kept.
   */
  public records(): (RestoredSession & { createdAt: number })[] {
    const taken = new Set<string>();
    return [...this.sessions.values()]
      .filter((s) => s.restart && s.agentType !== "terminal" && !s.closeRequested && (s.status === "running" || s.dormant))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => ({ id: s.id, options: { ...s.restart!, name: s.name }, createdAt: s.createdAt, resume: this.resumeFor(s, taken, false) }));
  }

  /** Reopen tabs saved by snapshot(), keeping their ids so the UI layout still matches. */
  public restore(saved: RestoredSession[]): TerminalSession[] {
    const started: TerminalSession[] = [];
    for (const entry of saved) {
      const existing = this.sessions.get(entry.id);
      try {
        // Already brought back as a saved session: just start it (it was running before the update).
        if (existing?.dormant) started.push(this.restartSession(entry.id, entry.resume));
        if (existing) continue;
        started.push(this.spawnSession({ ...entry.options, id: entry.id, resume: entry.resume }));
      } catch {
        // e.g. the CLI was uninstalled meanwhile: skip that tab
      }
    }
    return started;
  }

  /** Tabs that printed something in the last few seconds, i.e. a CLI that is still answering. */
  public activeSessions(withinMs = 8000): string[] {
    const now = Date.now();
    return [...this.sessions.values()]
      .filter((s) => s.status === "running" && s.agentType !== "terminal" && now - (s.lastOutputAt || 0) < withinMs)
      .map((s) => s.name);
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
      selfUpdated: !!s.selfUpdated,
      updateFailed: !!s.updateFailed,
      createdAt: s.createdAt,
      dormant: !!s.dormant,
      bufferedOutput: s.bufferedOutput.slice(-1000),
    }));
  }

  /**
   * Type a command and press Enter. Text and Enter arriving together look like a paste to
   * TUIs such as Codex and Freebuff, which then insert a newline instead of submitting.
   * Verified against the real CLIs:
   * - Codex: send the text as a bracketed paste, then Enter;
   * - Freebuff: send the text, then Enter after a longer pause;
   * - others (Claude Code, Antigravity, OpenCode, shells): text, then Enter shortly after.
   */
  public submitInput(id: string, data: string): boolean {
    if (data.length < 2 || !data.endsWith("\r")) return this.writeInput(id, data);
    const session = this.sessions.get(id);
    if (!session || session.status !== "running" || !session.ptyProcess) return this.writeInput(id, data);
    const text = data.slice(0, -1);
    const plan = SUBMIT_PLAN[session.agentType || ""] || SUBMIT_PLAN.default;
    if (!this.writeInput(id, plan.bracketed ? `\x1b[200~${text}\x1b[201~` : text)) return false;
    setTimeout(() => this.writeInput(id, "\r"), plan.enterAfterMs);
    return true;
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
          // taskkill also fails when the CLI has already exited (nothing left to find): that is closed.
          if (error && !session.exitObserved) {
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
