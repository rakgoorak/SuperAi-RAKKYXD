import { spawn, execFile, type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cliLaunch, cliEnv } from "./CliCatalog.js";
import { modelEffortArgs } from "./Providers.js";
import { cliFailure } from "./CliProvider.js";
import { cliAuth } from "./CliAuth.js";
import { skillPrompt } from "./ChatSkills.js";

// Chat view for Code sessions: each message runs the CLI headless with its JSON event stream and
// resumes the same conversation, so the client can draw messages and tool calls instead of a TUI.
// Freebuff has no headless mode, so it stays terminal-only.
export const CHAT_CLIS = ["claude-code", "codex", "antigravity", "opencode"];
const NAMES: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", antigravity: "Antigravity", opencode: "OpenCode" };
// History kept per chat (on screen and on disk); the CLI keeps the full conversation itself.
const MAX_ITEMS = 400;
// Windows limits a command line to 32,767 characters; agy only takes the prompt as an argument.
const MAX_PROMPT = 20000;
const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

export type ToolKind = "command" | "read" | "edit" | "search" | "web" | "plan" | "other";
export type ChatItem =
  | { id: string; kind: "user"; text: string; attachments?: string[]; request?: { text: string; model?: string; effort?: string; skillId?: string; attachments?: string[] }; at: number }
  | { id: string; kind: "assistant"; text: string; at: number }
  | { id: string; kind: "tool"; tool: ToolKind; title: string; output?: string; status: "running" | "done" | "failed"; at: number }
  | { id: string; kind: "error" | "notice"; text: string; at: number };
type NewItem = ChatItem extends infer T ? (T extends ChatItem ? Omit<T, "at"> : never) : never;

/** What one line of a CLI's JSON stream changes. */
export interface ChatUpdate { items?: NewItem[]; conversationId?: string; error?: string; done?: boolean }
export interface ChatSnapshot { items: ChatItem[]; running: boolean; conversationId?: string }
export type ChatMessage = { type: "snapshot"; chat: ChatSnapshot } | { type: "item"; item: ChatItem } | { type: "state"; running: boolean };

/** `"...\powershell.exe" -Command 'echo hi'` → `echo hi`: the shell wrapper Codex adds is noise. */
export function shellCommand(command: string): string {
  const m = /^(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/.exec(command.trim());
  if (!m || !/(?:^|[\\/])(?:powershell|pwsh|bash|sh|zsh|cmd)(?:\.exe)?$/i.test(m[1] || m[2])) return command.trim();
  const body = /^(?:-NoProfile\s+)?(?:-Command|-lc|-c|\/c)\s+([\s\S]+)$/i.exec(m[3].trim());
  if (!body) return command.trim();
  const inner = body[1].trim();
  if (/^'[\s\S]*'$/.test(inner)) return inner.slice(1, -1).replace(/''/g, "'");
  if (/^"[\s\S]*"$/.test(inner)) return inner.slice(1, -1);
  return inner;
}

function toolKind(name: string): ToolKind {
  if (/command|shell|terminal|bash|powershell/i.test(name)) return "command";
  if (/write|edit|replace|create|delete|move|patch/i.test(name)) return "edit";
  if (/read|view|open/i.test(name)) return "read";
  if (/grep|find|search|list_dir|glob/i.test(name)) return "search";
  if (/browser|web|url|fetch/i.test(name)) return "web";
  if (/plan|task|todo/i.test(name)) return "plan";
  return "other";
}

const TITLE_KEYS = ["CommandLine", "Command", "command", "AbsolutePath", "TargetFile", "Path", "path", "file_path", "filePath", "File", "Query", "query", "pattern", "SearchPath", "DirectoryPath", "Url", "url", "description"];
function toolTitle(name: string, parameters: unknown): string {
  const p = parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>) : {};
  const value = TITLE_KEYS.map((k) => p[k]).find((v) => typeof v === "string" && v.trim())
    ?? Object.values(p).find((v) => typeof v === "string" && v.trim());
  return typeof value === "string" ? value.trim().slice(0, 400) : name;
}

function codexItem(item: any, prefix: string): NewItem | null {
  const id = `${prefix}-${item?.id}`;
  const status = item?.status === "in_progress" ? "running" : item?.status === "failed" ? "failed" : "done";
  switch (item?.type) {
    case "agent_message":
      return typeof item.text === "string" && item.text.trim() ? { id, kind: "assistant", text: item.text } : null;
    case "command_execution":
      return { id, kind: "tool", tool: "command", title: shellCommand(String(item.command || "")), output: item.aggregated_output || undefined,
        status: status === "done" && item.exit_code != null && item.exit_code !== 0 ? "failed" : status };
    case "file_change": {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      return { id, kind: "tool", tool: "edit", title: changes.map((c: any) => path.basename(String(c?.path || ""))).filter(Boolean).join(", ") || "แก้ไฟล์",
        output: changes.map((c: any) => `${c?.kind || "update"} ${c?.path || ""}`).join("\n") || undefined, status };
    }
    case "mcp_tool_call":
      return { id, kind: "tool", tool: "other", title: [item.server, item.tool].filter(Boolean).join(": ") || "MCP", status };
    case "web_search":
      return { id, kind: "tool", tool: "web", title: String(item.query || "ค้นเว็บ"), status };
    case "todo_list": {
      const todos = Array.isArray(item.items) ? item.items : [];
      return { id, kind: "tool", tool: "plan", title: "แผนงาน", output: todos.map((t: any) => `${t?.completed ? "☑" : "☐"} ${t?.text || ""}`).join("\n"), status };
    }
    case "error":
      return { id, kind: "error", text: String(item.message || "เกิดข้อผิดพลาด") };
    default:
      return null; // reasoning and anything newer are not shown
  }
}

/** Reads one CLI's JSON lines for one turn. `prefix` keeps item ids unique across turns. */
export function chatParser(agent: string, prefix: string): (line: string) => ChatUpdate {
  const texts = new Map<string, string>();
  const tools = new Map<string, NewItem>();
  let answered = false;
  return (line: string) => {
    let event: any;
    try { event = JSON.parse(line); } catch { return {}; }
    if (agent === "claude-code") {
      // Sub-agent traffic (parent_tool_use_id) would bury the main conversation.
      if (event?.parent_tool_use_id) return {};
      const content: any[] = Array.isArray(event?.message?.content) ? event.message.content : [];
      switch (event?.type) {
        case "system": return event.subtype === "init" && event.session_id ? { conversationId: String(event.session_id) } : {};
        case "assistant": {
          const items: NewItem[] = [];
          content.forEach((block, i) => {
            if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
              answered = true;
              items.push({ id: `${prefix}-${event.message.id}-${i}`, kind: "assistant", text: block.text });
            } else if (block?.type === "tool_use") {
              const name = String(block.name || "tool");
              const item: NewItem = { id: `${prefix}-${block.id}`, kind: "tool", tool: toolKind(name), title: toolTitle(name, block.input), status: "running" };
              tools.set(String(block.id), item);
              items.push(item);
            }
          });
          return { items };
        }
        case "user": {
          const items: NewItem[] = [];
          for (const block of content) {
            const tool = block?.type === "tool_result" ? tools.get(String(block.tool_use_id)) : undefined;
            if (tool?.kind !== "tool") continue;
            const output = typeof block.content === "string" ? block.content
              : Array.isArray(block.content) ? block.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("\n") : "";
            const done: NewItem = { ...tool, output: output || undefined, status: block.is_error ? "failed" : "done" };
            tools.set(String(block.tool_use_id), done);
            items.push(done);
          }
          return { items };
        }
        case "result":
          if (event.is_error || event.subtype !== "success") return { error: String(event.result || event.subtype || "Claude Code ทำงานไม่สำเร็จ") };
          return { done: true, items: !answered && typeof event.result === "string" && event.result.trim() ? [{ id: `${prefix}-result`, kind: "assistant", text: event.result }] : undefined };
        default: return {};
      }
    }
    if (agent === "opencode") {
      // `opencode run --format json`: finished parts, each with the session id.
      const part = event?.part || {};
      const conversation = event?.sessionID ? { conversationId: String(event.sessionID) } : {};
      switch (event?.type) {
        case "text":
          if (typeof part.text !== "string" || !part.text.trim()) return conversation;
          answered = true;
          return { ...conversation, items: [{ id: `${prefix}-${part.id || "text"}`, kind: "assistant", text: part.text }] };
        case "tool_use": {
          const name = String(part.tool || "tool");
          const state = part.state || {};
          const output = typeof state.output === "string" && state.output ? state.output : state.error ? String(state.error) : undefined;
          return { ...conversation, items: [{ id: `${prefix}-${part.id || part.callID}`, kind: "tool", tool: toolKind(name),
            title: typeof state.title === "string" && state.title ? state.title : toolTitle(name, state.input), output,
            status: state.status === "error" ? "failed" : state.status === "completed" ? "done" : "running" }] };
        }
        case "error":
          return { ...conversation, error: String(event.error?.data?.message || event.error?.message || event.error?.name || "OpenCode ทำงานไม่สำเร็จ") };
        default: return conversation;
      }
    }
    if (agent === "codex") {
      switch (event?.type) {
        case "thread.started": return { conversationId: String(event.thread_id || "") || undefined };
        case "item.started": case "item.updated": case "item.completed": {
          const item = codexItem(event.item, prefix);
          return item ? { items: [item] } : {};
        }
        case "turn.failed": return { error: String(event.error?.message || "Codex ทำงานไม่สำเร็จ") };
        case "error": return { error: String(event.message || "Codex ทำงานไม่สำเร็จ") };
        case "turn.completed": return { done: true };
        default: return {};
      }
    }
    switch (event?.event) {
      case "init": return { conversationId: String(event.conversation_id || "") || undefined };
      case "step_update": {
        const step = event.step_update || {};
        const id = `${prefix}-s${step.step_index}`;
        if (step.step_type === "agent_response" && typeof step.text_delta === "string") {
          const text = (texts.get(id) || "") + step.text_delta;
          texts.set(id, text);
          if (!text.trim()) return {};
          answered = true;
          return { items: [{ id, kind: "assistant", text }] };
        }
        if (step.step_type === "tool") {
          const name = String(step.tool_name || step.tool_info?.name || "tool");
          const output = step.tool_info?.output;
          return { items: [{ id, kind: "tool", tool: toolKind(name), title: toolTitle(name, step.tool_info?.parameters),
            output: typeof output === "string" && output ? output : undefined,
            status: step.state === "ACTIVE" ? "running" : /ERROR|FAIL|CANCEL/i.test(String(step.state)) ? "failed" : "done" }] };
        }
        return {};
      }
      case "result": {
        const result = event.result || {};
        if (result.status !== "SUCCESS")
          return { error: String(result.error?.message || result.error || `Antigravity หยุดทำงาน (${result.status || "ไม่ทราบสาเหตุ"})`) };
        const response = typeof result.response === "string" ? result.response.trim() : "";
        return { done: true, items: !answered && response ? [{ id: `${prefix}-result`, kind: "assistant", text: response }] : undefined };
      }
      default: return {};
    }
  };
}

/**
 * Arguments for one headless turn. Edits stay inside the project; commands cannot prompt, so they are pre-approved.
 * `files` are attached natively (Codex: images, OpenCode: any file); others get paths in the prompt.
 */
export function chatArguments(agent: string, o: { prompt: string; conversationId?: string; model?: string; effort?: string; files?: string[] }): string[] {
  if (agent === "claude-code")
    return [
      "-p",
      "--output-format", "stream-json", "--verbose",
      ...(o.conversationId ? ["--resume", o.conversationId] : []),
      ...modelEffortArgs(agent, o.model, o.effort),
      "--permission-mode", "acceptEdits", "--allowedTools", "Bash",
    ];
  if (agent === "opencode")
    return [
      "run",
      "--format", "json",
      ...(o.conversationId ? ["--session", o.conversationId] : []),
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.files || []).flatMap((file) => ["--file", file]),
      "--",
      o.prompt,
    ];
  if (agent === "codex")
    return [
      "exec",
      ...(o.conversationId ? ["resume", o.conversationId] : []),
      "--json",
      "--skip-git-repo-check",
      "-c", 'sandbox_mode="workspace-write"',
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.files || []).map((file) => `--image=${file}`),
      "-",
    ];
  if (agent === "antigravity")
    return [
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.conversationId ? ["--conversation", o.conversationId] : []),
      "--mode", "accept-edits", "--sandbox", "--dangerously-skip-permissions",
      "--output-format", "stream-json",
      `--print=${o.prompt}`,
    ];
  throw new Error("CLI นี้ยังไม่รองรับมุมมองแชต กรุณาใช้ terminal");
}

type Spawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
interface Chat extends ChatSnapshot { turns: number; proc?: ChildProcess; cancelled?: boolean; listeners: Set<(m: ChatMessage) => void>; saveTimer?: NodeJS.Timeout }
export interface ChatRequest { agent: string; cwd: string; text: string; model?: string; effort?: string; attachments?: string[]; skillId?: string }

export class CliChatManager {
  private chats = new Map<string, Chat>();
  /** Called when a chat's conversation id or running state changes, e.g. to save the session list. */
  onChange?: (id: string) => void;
  /** `dir` keeps each chat as <id>.json so it survives an app restart. */
  constructor(private spawner: Spawner = spawn, private dir?: string, private launcher: typeof cliLaunch = cliLaunch,
    private timeouts = { startup: 90000, turn: 600000 }) {}

  private file(id: string): string | undefined {
    return this.dir && /^[\w-]+$/.test(id) ? path.join(this.dir, `${id}.json`) : undefined;
  }
  private chat(id: string): Chat {
    let chat = this.chats.get(id);
    if (chat) return chat;
    chat = { items: [], running: false, turns: 0, listeners: new Set() };
    const file = this.file(id);
    try {
      if (file && fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        // A turn cut off by quitting the app: its unfinished tools did not complete.
        if (Array.isArray(saved.items)) chat.items = saved.items.map((i: ChatItem) => (i.kind === "tool" && i.status === "running" ? { ...i, status: "failed" } : i));
        if (typeof saved.conversationId === "string" && saved.conversationId) chat.conversationId = saved.conversationId;
        chat.turns = Number(saved.turns) || 0;
      }
    } catch {
      // an unreadable file starts an empty chat
    }
    this.chats.set(id, chat);
    return chat;
  }
  private save(id: string, chat: Chat, now = false) {
    const file = this.file(id);
    if (!file) return;
    clearTimeout(chat.saveTimer);
    const write = () => {
      try {
        fs.mkdirSync(this.dir!, { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ conversationId: chat.conversationId, turns: chat.turns, items: chat.items }));
      } catch {
        // a full disk must not break the chat on screen
      }
    };
    if (now) write();
    else chat.saveTimer = setTimeout(write, 1000);
  }
  private emit(chat: Chat, message: ChatMessage) {
    for (const listener of chat.listeners) listener(message);
  }
  private put(id: string, chat: Chat, item: NewItem) {
    const index = chat.items.findIndex((i) => i.id === item.id);
    const full = { ...item, at: index >= 0 ? chat.items[index].at : Date.now() } as ChatItem;
    if (index >= 0) chat.items[index] = full;
    else chat.items.push(full);
    if (chat.items.length > MAX_ITEMS) chat.items.splice(0, chat.items.length - MAX_ITEMS);
    this.emit(chat, { type: "item", item: full });
    this.save(id, chat);
  }

  snapshot(id: string): ChatSnapshot {
    const { items, running, conversationId } = this.chat(id);
    return { items, running, conversationId };
  }
  subscribe(id: string, listener: (m: ChatMessage) => void): () => void {
    const chat = this.chat(id);
    chat.listeners.add(listener);
    listener({ type: "snapshot", chat: this.snapshot(id) });
    return () => chat.listeners.delete(listener);
  }
  /** Session ids with a turn in progress. */
  running(): string[] {
    return [...this.chats].filter(([, c]) => c.running).map(([id]) => id);
  }
  isRunning(id: string): boolean {
    return !!this.chats.get(id)?.running;
  }
  conversationId(id: string): string | undefined {
    return this.chat(id).conversationId;
  }
  /** Continue another conversation from now on, e.g. the one the terminal was using. */
  setConversation(id: string, conversationId: string) {
    const chat = this.chat(id);
    if (chat.conversationId === conversationId) return;
    if (chat.running) throw new Error("แชตยังตอบข้อความก่อนหน้าอยู่ กรุณารอให้เสร็จก่อนเปลี่ยนบทสนทนา");
    chat.conversationId = conversationId;
    this.save(id, chat, true);
  }

  send(id: string, request: ChatRequest) {
    const { agent } = request;
    if (!CHAT_CLIS.includes(agent)) throw new Error("CLI นี้ยังไม่รองรับมุมมองแชต กรุณาใช้ terminal");
    const text = request.text.trim();
    if (!text) throw new Error("กรุณาพิมพ์ข้อความ");
    const chat = this.chat(id);
    if (chat.running) throw new Error(`${NAMES[agent]} ยังตอบข้อความก่อนหน้าอยู่ รอให้เสร็จหรือกดหยุดก่อน`);
    if (agent === "codex" && chat.conversationId && [...this.chats.values()].some((other) => other !== chat && other.running && other.conversationId === chat.conversationId))
      throw new Error("Codex ยังตอบบทสนทนานี้อยู่ในอีกแท็บ กรุณารอให้เสร็จก่อน");
    const files = request.attachments || [];
    const attached = agent === "codex" ? files.filter((f) => IMAGE.test(f)) : agent === "opencode" ? files : [];
    const listed = files.filter((f) => !attached.includes(f));
    const selected = skillPrompt(text, request.cwd, agent, request.skillId);
    const prompt = listed.length ? `${selected}\n\nไฟล์แนบ:\n${listed.map((f) => `- ${f}`).join("\n")}` : selected;
    if (prompt.length > MAX_PROMPT) throw new Error("ข้อความยาวเกินไป กรุณาแบ่งส่งหรือใส่ไว้ในไฟล์แล้วแนบแทน");
    const args = chatArguments(agent, { prompt, conversationId: chat.conversationId, model: request.model, effort: request.effort, files: attached });

    // Resolved first: a CLI that is not installed is refused before the message joins the chat.
    const launch = this.launcher(agent, args);
    const prefix = `t${++chat.turns}`;
    this.put(id, chat, { id: `${prefix}-user`, kind: "user", text, request: { text, model: request.model, effort: request.effort, skillId: request.skillId, attachments: files }, ...(files.length ? { attachments: files.map((f) => path.basename(f)) } : {}) });
    chat.running = true;
    chat.cancelled = false;
    this.emit(chat, { type: "state", running: true });
    this.onChange?.(id);

    const parse = chatParser(agent, prefix);
    let proc: ChildProcess;
    let pending = "", errors = "", failed = false, finished = false;
    let startupTimer: NodeJS.Timeout | undefined, turnTimer: NodeJS.Timeout | undefined, timedOut = false;
    const finish = (problem?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(startupTimer); clearTimeout(turnTimer);
      chat.proc = undefined;
      for (const item of chat.items)
        if (item.kind === "tool" && item.status === "running" && item.id.startsWith(`${prefix}-`)) this.put(id, chat, { ...item, status: chat.cancelled ? "failed" : "done" });
      if (chat.cancelled) this.put(id, chat, { id: `${prefix}-stopped`, kind: "notice", text: "หยุดแล้ว" });
      else if (problem && !failed) this.put(id, chat, { id: `${prefix}-error`, kind: "error", text: problem });
      chat.running = false;
      this.emit(chat, { type: "state", running: false });
      this.save(id, chat, true);
      this.onChange?.(id);
    };
    const apply = (line: string) => {
      const update = parse(line);
      if (Object.keys(update).length) clearTimeout(startupTimer);
      if (update.conversationId && update.conversationId !== chat.conversationId) {
        chat.conversationId = update.conversationId;
        this.onChange?.(id);
      }
      for (const item of update.items || []) this.put(id, chat, item);
      if (update.error && !chat.cancelled) {
        failed = true;
        cliAuth.failure(agent, update.error);
        this.put(id, chat, { id: `${prefix}-error`, kind: "error", text: cliFailure(agent, request.model || "", update.error, "", 1) });
      }
    };
    try {
      proc = this.spawner(launch.command, launch.args, {
        cwd: request.cwd,
        detached: process.platform !== "win32",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0" },
      });
    } catch (error: any) {
      finish(`เปิด ${NAMES[agent]} ไม่สำเร็จ: ${error.message}`);
      return;
    }
    chat.proc = proc;
    const timeout = () => {
      timedOut = true;
      // Keep the turn occupied until close confirms that the child stopped.
      if (process.platform === "win32" && proc.pid) execFile("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true }, () => {});
      else if (proc.pid) { try { process.kill(-proc.pid, "SIGKILL"); } catch { proc.kill(); } }
      else proc.kill();
    };
    startupTimer = setTimeout(timeout, this.timeouts.startup); startupTimer.unref();
    turnTimer = setTimeout(timeout, this.timeouts.turn); turnTimer.unref();
    proc.stdin?.on("error", () => {});
    // Codex and Claude Code read the prompt from stdin; the others take it as an argument.
    proc.stdin?.end(agent === "codex" || agent === "claude-code" ? prompt : undefined, "utf8");
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) if (line.trim()) apply(line);
    });
    proc.stderr?.setEncoding("utf8");
    proc.stderr?.on("data", (chunk: string) => (errors = (errors + chunk).slice(-4000)));
    proc.on("error", (error) => finish(`เปิด ${NAMES[agent]} ไม่สำเร็จ: ${error.message}`));
    proc.on("close", (code) => {
      if (pending.trim()) apply(pending);
      finish(timedOut ? "CLI ไม่ตอบกลับภายในเวลาที่กำหนด ตรวจบัญชีและการเชื่อมต่อใน Terminal แล้วลองส่งใหม่" : code === 0 ? undefined : cliFailure(agent, request.model || "", errors, "", code));
    });
  }

  cancel(id: string): boolean {
    const chat = this.chats.get(id);
    const proc = chat?.proc;
    if (!chat || !proc) return false;
    chat.cancelled = true;
    if (process.platform === "win32" && proc.pid) execFile("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true }, () => {});
    else if (proc.pid) { try { process.kill(-proc.pid, "SIGKILL"); } catch { proc.kill(); } }
    return true;
  }

  /** Delete a session's chat, including its saved history. */
  drop(id: string) {
    this.cancel(id);
    clearTimeout(this.chats.get(id)?.saveTimer);
    this.chats.delete(id);
    const file = this.file(id);
    if (file) fs.rmSync(file, { force: true });
  }

  /** Stop running turns and write pending history (app quit). */
  stopAll() {
    for (const [id, chat] of this.chats) {
      this.cancel(id);
      if (chat.saveTimer) this.save(id, chat, true);
    }
  }
}
