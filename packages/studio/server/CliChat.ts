import { accounts } from "./Accounts.js";
import { cleanAnswers, describeChoices, fromAskUserQuestion, questionRules, takeQuestions, type ClarifyAnswer, type ClarifyQuestion } from "./Questions.js";
import { openCodeNoAnswer, openCodePermissionEnv } from "./OpenCodePermissions.js";
import { spawn, execFile, type ChildProcess, type SpawnOptions } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cliLaunch, cliEnv } from "./CliCatalog.js";
import { modelEffortArgs } from "./Providers.js";
import { cliFailure } from "./CliProvider.js";
import { cliAuth } from "./CliAuth.js";
import { skillPrompt } from "./ChatSkills.js";
import { getProjectRules, formatRulesForPrompt } from "./ProjectRules.js";
import { contextualPrompt, contextForAgent, type ProjectContext } from './ProjectContext.js';
import type { ResponseStyle } from './ResponseStyle.js';
import { cloudKeys, isCloud } from './CloudKeys.js';
import { runApiConversation } from './ApiConversation.js';
import { codexSandboxArgs } from './CodexSandbox.js';
import { BROWSER_MCP, READ_ONLY_BROWSER_TOOLS, claudeBrowserArgs, codexBrowserArgs, withOpenCodeBrowser } from './BrowserTools.js';
import type { LLMProvider } from '@superai-rakkyxd/core';
import { tr } from './i18n.js';

// Chat view for Code sessions: each message runs the CLI headless with its JSON event stream and
// resumes the same conversation, so the client can draw messages and tool calls instead of a TUI.
// Freebuff has no headless mode, so it stays terminal-only.
export const CHAT_CLIS = ["claude-code", "codex", "antigravity", "opencode"];
const NAMES: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", antigravity: "Antigravity", opencode: "OpenCode" };
// History kept per chat (on screen and on disk); the CLI keeps the full conversation itself.
const MAX_ITEMS = 400;
// Windows limits a command line to 32,767 characters; agy only takes the prompt as an argument.
const MAX_PROMPT = 20000;
const TASK_PROGRESS = "[Task progress]\nIf you use a task list, keep it aligned with the work: update it with your native task tool when a task starts, completes, or the scope changes, and reconcile it before your final response. Mark tasks complete only after checking their acceptance criteria; explain unfinished work and blockers. Do not infer completion from tool-call counts.";
const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

export type ToolKind = "command" | "read" | "edit" | "search" | "web" | "plan" | "other";
export type TodoStatus = "pending" | "in_progress" | "completed";
/** Permission modes supported by individual CLI integrations. */
export type ChatPermission = "read" | "edit" | "auto" | "review" | "full" | "ask" | "approve_all";
export const CHAT_PERMISSIONS: ChatPermission[] = ["read", "edit", "auto", "review", "full", "ask", "approve_all"];
export function supportsChatPermission(agent: string, permission: ChatPermission): boolean {
  if (isCloud(agent)) return ['read', 'edit', 'auto'].includes(permission);
  if (permission === 'ask') return agent === 'claude-code' || agent === 'codex' || agent === 'opencode';
  if (permission === 'review') return agent === 'codex';
  if (permission === 'full') return agent === 'codex' || agent === 'claude-code';
  if (permission === 'approve_all') return agent === 'opencode' || agent === 'antigravity';
  return true;
}
type ChatRequestRecord = { text: string; model?: string; effort?: string; skillId?: string; attachments?: string[]; permission?: ChatPermission; projectContext?: ProjectContext; responseStyle?: ResponseStyle };
export type ChatItem =
  | { id: string; kind: "user"; text: string; attachments?: string[]; request?: ChatRequestRecord; at: number }
  | { id: string; kind: "assistant"; text: string; at: number }
  | { id: string; kind: "tool"; tool: ToolKind; title: string; output?: string; images?: string[]; status: "running" | "done" | "failed"; at: number }
  /** The CLI's own task list (Claude TodoWrite, Codex todo_list, OpenCode todowrite), one per turn, updated in place. */
  | { id: string; kind: "todos"; todos: { text: string; status: TodoStatus }[]; at: number }
  | { id: string; kind: "error" | "notice"; text: string; at: number }
  /** Claude asked to use a tool the permission mode does not cover; the user answers in the chat. */
  | { id: string; kind: "permission"; requestId: string; tool: string; title: string; detail?: string; canAlways?: boolean; status: PermissionStatus; at: number }
  /** Multiple-choice questions the AI asked (its superai-questions block, or Claude's AskUserQuestion). */
  | { id: string; kind: "question"; by: string; intro: string; questions: ClarifyQuestion[]; status: QuestionStatus; answers?: Record<string, ClarifyAnswer>; requestId?: string; at: number };
export type QuestionStatus = "waiting" | "answered" | "skipped" | "expired";
export type PermissionStatus = "pending" | "allowed" | "always" | "denied" | "expired";
export type PermissionDecision = "allow" | "always" | "deny";
export type NewItem = ChatItem extends infer T ? (T extends ChatItem ? Omit<T, "at"> : never) : never;

/** What one line of a CLI's JSON stream changes. `outputTokens` is added to the turn's count. */
export interface ChatUpdate { items?: NewItem[]; conversationId?: string; error?: string; done?: boolean; outputTokens?: number }
/** The turn in progress: when it started and how many tokens the CLI has written so far. */
export interface ChatActivity { startedAt: number; outputTokens: number; quiet?: { since: number; timeoutMs: number } }
export interface QueuedChat { id: string; text: string; attachments?: string[] }
export interface ChatSnapshot { items: ChatItem[]; running: boolean; conversationId?: string; activity?: ChatActivity; queued: QueuedChat[] }
export type ChatMessage =
  | { type: "snapshot"; chat: ChatSnapshot }
  | { type: "item"; item: ChatItem }
  | { type: "state"; running: boolean }
  | { type: "activity"; activity?: ChatActivity }
  | { type: "queue"; queued: QueuedChat[] };

// Screenshots a tool returns (Claude Code): shown as thumbnails, kept small enough for the chat file.
const MAX_IMAGE_CHARS = 2_000_000;
const MAX_IMAGES = 4;
function toolImages(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) return undefined;
  const images = content
    .filter((c: any) => c?.type === "image" && c.source?.type === "base64" && typeof c.source.data === "string" && /^image\/(png|jpeg|gif|webp)$/.test(c.source.media_type))
    .map((c: any) => `data:${c.source.media_type};base64,${c.source.data}`)
    .filter((url) => url.length <= MAX_IMAGE_CHARS)
    .slice(0, MAX_IMAGES);
  return images.length ? images : undefined;
}

/** Short stable fingerprint (FNV-1a) to tell whether the project context changed. */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16);
}

const tokensWritten =(n: number): { outputTokens?: number } => (n > 0 ? { outputTokens: n } : {});

/** Only report fields supplied by the CLI; absent values are not zero. */
function usageNotice(prefix: string, usage: any, fields: [string, string][]): NewItem | null {
  if (!usage || typeof usage !== 'object') return null;
  const values = fields.flatMap(([key, label]) =>
    typeof usage[key] === 'number' && Number.isFinite(usage[key]) && usage[key] >= 0
      ? [`${label} ${usage[key].toLocaleString()}`] : []);
  return values.length ? { id: `${prefix}-usage`, kind: 'notice', text: tr`Token จาก provider: ${values.join(' · ')}` } : null;
}

/** A CLI's todo entries in one shape. `done` lists (Codex) mark the first open entry as in progress. */
function todoList(entries: unknown, prefix: string, running = true): NewItem | null {
  if (!Array.isArray(entries)) return null;
  let current = false;
  const todos = entries.map((t: any) => {
    const text = String(t?.content ?? t?.text ?? t?.activeForm ?? "").trim();
    let status: TodoStatus = t?.status === "completed" || t?.completed === true ? "completed" : t?.status === "in_progress" ? "in_progress" : "pending";
    if (t?.status === undefined && status === "pending" && running && !current) { status = "in_progress"; current = true; }
    return { text, status };
  }).filter((t) => t.text);
  return { id: `${prefix}-todos`, kind: "todos", todos };
}

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
      return { id, kind: "tool", tool: "edit", title: changes.map((c: any) => path.basename(String(c?.path || ""))).filter(Boolean).join(", ") || tr("แก้ไฟล์"),
        output: changes.map((c: any) => `${c?.kind || "update"} ${c?.path || ""}`).join("\n") || undefined, status };
    }
    case "mcp_tool_call":
      return { id, kind: "tool", tool: "other", title: [item.server, item.tool].filter(Boolean).join(": ") || "MCP", status };
    case "web_search":
      return { id, kind: "tool", tool: "web", title: String(item.query || tr("ค้นเว็บ")), status };
    case "todo_list":
      return todoList(item.items, prefix, item?.status !== "completed");
    case "error":
      return { id, kind: "error", text: String(item.message || tr("เกิดข้อผิดพลาด")) };
    default:
      return null; // reasoning and anything newer are not shown
  }
}

/** Reads one CLI's JSON lines for one turn. `prefix` keeps item ids unique across turns. */
export function chatParser(agent: string, prefix: string): (line: string) => ChatUpdate {
  const texts = new Map<string, string>();
  const tools = new Map<string, NewItem>();
  // Claude Code repeats a message's usage on each of its content blocks: count each message once.
  const written = new Map<string, number>();
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
            } else if (block?.type === "tool_use" && block.name === "TodoWrite") {
              const todos = todoList(block.input?.todos, prefix);
              if (todos) items.push(todos);
            } else if (block?.type === "tool_use") {
              const name = String(block.name || "tool");
              const item: NewItem = { id: `${prefix}-${block.id}`, kind: "tool", tool: toolKind(name), title: toolTitle(name, block.input), status: "running" };
              tools.set(String(block.id), item);
              items.push(item);
            }
          });
          const messageId = String(event.message?.id || "");
          const total = Number(event.message?.usage?.output_tokens) || 0;
          const before = written.get(messageId) || 0;
          if (total > before) written.set(messageId, total);
          return { items, ...tokensWritten(total - before) };
        }
        case "user": {
          const items: NewItem[] = [];
          for (const block of content) {
            const tool = block?.type === "tool_result" ? tools.get(String(block.tool_use_id)) : undefined;
            if (tool?.kind !== "tool") continue;
            const output = typeof block.content === "string" ? block.content
              : Array.isArray(block.content) ? block.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("\n") : "";
            const images = toolImages(block.content);
            const done: NewItem = { ...tool, output: output || undefined, ...(images ? { images } : {}), status: block.is_error ? "failed" : "done" };
            tools.set(String(block.tool_use_id), done);
            items.push(done);
          }
          return { items };
        }
        case "result": {
          if (event.is_error || event.subtype !== "success") return { error: String(event.result || event.subtype || tr("Claude Code ทำงานไม่สำเร็จ")) };
          const result: NewItem[] = !answered && typeof event.result === "string" && event.result.trim() ? [{ id: `${prefix}-result`, kind: "assistant", text: event.result }] : [];
          const usage = usageNotice(prefix, event.usage, [['input_tokens', tr("input (ไม่รวม cache)")], ['cache_read_input_tokens', 'cache read'], ['cache_creation_input_tokens', 'cache write'], ['output_tokens', 'output']]);
          if (usage) result.push(usage);
          return { done: true, items: result.length ? result : undefined };
        }
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
        case "step_finish": {
          const tokens = Number(part.tokens?.output || 0) + Number(part.tokens?.reasoning || 0);
          return { ...conversation, ...tokensWritten(tokens) };
        }
        case "tool_use": {
          const name = String(part.tool || "tool");
          const state = part.state || {};
          if (name === "todowrite" && state.status === "completed") {
            const todos = todoList(state.input?.todos, prefix);
            return todos ? { ...conversation, items: [todos] } : conversation;
          }
          const output = typeof state.output === "string" && state.output ? state.output : state.error ? String(state.error) : undefined;
          // `opencode run` rejects an interactive permission request itself; its error text
          // says "the user rejected" even though no approval prompt reached our chat UI.
          const shownOutput = state.status === 'error' && output && /the user rejected permission to use this specific tool call/i.test(output)
            ? tr("OpenCode ปฏิเสธคำขอสิทธิ์ในโหมดแชตโดยไม่มีปุ่มให้ตอบในโปรแกรม ตรวจการตั้งค่าสิทธิ์ของ OpenCode หรือใช้ Terminal เพื่อตอบคำขอ") : output;
          return { ...conversation, items: [{ id: `${prefix}-${part.id || part.callID}`, kind: "tool", tool: toolKind(name),
            title: typeof state.title === "string" && state.title ? state.title : toolTitle(name, state.input), output: shownOutput,
            status: state.status === "error" ? "failed" : state.status === "completed" ? "done" : "running" }] };
        }
        case "error":
          return { ...conversation, error: String(event.error?.data?.message || event.error?.message || event.error?.name || tr("OpenCode ทำงานไม่สำเร็จ")) };
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
        case "turn.failed": return { error: String(event.error?.message || tr("Codex ทำงานไม่สำเร็จ")) };
        case "error": return { error: String(event.message || tr("Codex ทำงานไม่สำเร็จ")) };
        case "turn.completed": {
          const tokens = Number(event.usage?.output_tokens || 0) + Number(event.usage?.reasoning_output_tokens || 0);
          const usage = usageNotice(prefix, event.usage, [['input_tokens', 'input'], ['cached_input_tokens', tr("cached input (รวมใน input)")], ['output_tokens', 'output']]);
          return { done: true, ...tokensWritten(tokens), ...(usage ? { items: [usage] } : {}) };
        }
        default: return {};
      }
    }
    switch (event?.event) {
      case "init": return { conversationId: String(event.conversation_id || "") || undefined };
      case "step_update": {
        const step = event.step_update || {};
        const id = `${prefix}-s${step.step_index}`;
        // A finished response step reports what it wrote (thinking included).
        const tokens = step.state === "DONE" && step.usage ? Number(step.usage.output_tokens || 0) + Number(step.usage.thinking_tokens || 0) : 0;
        if (step.step_type === "agent_response" && typeof step.text_delta === "string") {
          const text = (texts.get(id) || "") + step.text_delta;
          texts.set(id, text);
          if (!text.trim()) return tokensWritten(tokens);
          answered = true;
          return { items: [{ id, kind: "assistant", text }], ...tokensWritten(tokens) };
        }
        if (step.step_type === "agent_response") return tokensWritten(tokens);
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
          return { error: String(result.error?.message || result.error || tr`Antigravity หยุดทำงาน (${result.status || tr("ไม่ทราบสาเหตุ")})`) };
        const response = typeof result.response === "string" ? result.response.trim() : "";
        // agy reports success with no answer when a tool it needed was refused in this mode.
        const denied = Array.isArray(result.denied_actions) ? result.denied_actions.map((d: any) => String(d?.display_name || d?.action || "")).filter(Boolean) : [];
        if (!answered && !response && denied.length)
          return { error: tr`Antigravity ไม่ได้ตอบ เพราะสิทธิ์ที่เลือกไม่อนุญาตให้ใช้เครื่องมือ ${[...new Set(denied)].join(", ")} ลองเปลี่ยนสิทธิ์เป็น Auto แล้วส่งใหม่` };
        return { done: true, items: !answered && response ? [{ id: `${prefix}-result`, kind: "assistant", text: response }] : undefined };
      }
      default: return {};
    }
  };
}

/**
 * Arguments for one headless turn. Headless CLIs cannot ask before acting, so `permission` decides
 * up front: "read" only reads and answers, "edit" may change files in the project, "auto" may also
 * run commands (the default). `files` are attached natively (Codex: images, OpenCode: any file);
 * others get paths in the prompt.
 */
/** Claude Code tools preapproved by the legacy read/edit/auto modes. */
/** OpenCode's config for a chat: the temp-folder rule for headless runs, and the app's browser tools. */
function openCodeEnv(existing: string | undefined, headless: boolean): Record<string, string> {
  const base = headless ? openCodePermissionEnv(existing).OPENCODE_CONFIG_CONTENT ?? existing : existing;
  const config = withOpenCodeBrowser(base);
  return config ? { OPENCODE_CONFIG_CONTENT: config } : {};
}
export const WEB_TOOLS = "WebSearch,WebFetch";
/** Tools Claude may use without asking, per permission: web reading always, the app's browser panel too when it exists. */
function claudeAllowed(permission: ChatPermission, browser: boolean): string {
  const panel = !browser ? [] : permission === "read" ? READ_ONLY_BROWSER_TOOLS.map((t) => `mcp__${BROWSER_MCP}__${t}`) : [`mcp__${BROWSER_MCP}`];
  return [...(permission === "auto" ? ["Bash"] : []), WEB_TOOLS, ...panel].join(",");
}
function claudePermissionArgs(permission: ChatPermission): string[] {
  const browser = claudeBrowserArgs().length > 0;
  if (permission === 'full') return ['--permission-mode', 'bypassPermissions'];
  return ['--permission-mode', permission === 'read' ? 'plan' : 'acceptEdits', '--allowedTools', claudeAllowed(permission, browser)];
}

export function chatArguments(agent: string, o: { prompt: string; conversationId?: string; model?: string; effort?: string; files?: string[]; permission?: ChatPermission }): string[] {
  const permission = o.permission || "auto";
  if (!supportsChatPermission(agent, permission)) throw new Error(tr("สิทธิ์นี้ไม่รองรับสำหรับ provider นี้"));
  if (permission === 'ask') throw new Error(tr("การขออนุมัติในแชตต้องใช้ Claude แบบ live"));
  if (agent === "claude-code")
    return [
      "-p",
      "--output-format", "stream-json", "--verbose",
      ...(o.conversationId ? ["--resume", o.conversationId] : []),
      ...modelEffortArgs(agent, o.model, o.effort),
      // `-p` cannot ask for approval, so anything not allowed here is refused. Web search/fetch only
      // read, so every mode gets them; "auto" also runs commands.
      ...claudePermissionArgs(permission),
      ...claudeBrowserArgs(),
    ];
  if (agent === "opencode")
    return [
      "run",
      "--format", "json",
      ...(o.conversationId ? ["--session", o.conversationId] : []),
      // OpenCode's plan agent only reads; its build agent edits and runs commands.
      ...(permission === "read" ? ["--agent", "plan"] : []),
      ...(permission === 'approve_all' ? ['--auto'] : []),
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.files || []).flatMap((file) => ["--file", file]),
      "--",
      o.prompt,
    ];
  if (agent === "codex")
    return [
      "exec",
      ...(permission === 'review' ? ['--approve-for-me'] : []),
      ...(o.conversationId ? ["resume", o.conversationId] : []),
      "--json",
      "--skip-git-repo-check",
      // Codex has no edit-without-commands mode: "edit" and "auto" both run in the workspace sandbox.
      ...(permission === 'full' ? ['--dangerously-bypass-approvals-and-sandbox']
        : ['-c', permission === 'read' ? 'sandbox_mode="read-only"' : 'sandbox_mode="workspace-write"']),
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.files || []).map((file) => `--image=${file}`),
      "-",
    ];
  if (agent === "antigravity")
    return [
      ...modelEffortArgs(agent, o.model, o.effort),
      ...(o.conversationId ? ["--conversation", o.conversationId] : []),
      ...(permission === 'approve_all' ? ['--mode', 'accept-edits', '--dangerously-skip-permissions'] : permission === "read" ? ["--mode", "plan"]
        : permission === "edit" ? ["--mode", "accept-edits"]
          : ["--mode", "accept-edits", "--sandbox", "--dangerously-skip-permissions"]),
      "--output-format", "stream-json",
      `--print=${o.prompt}`,
    ];
  throw new Error(tr("CLI นี้ยังไม่รองรับมุมมองแชต กรุณาใช้ terminal"));
}

/**
 * Claude Code kept running for the whole conversation, like its own app: stream-json in and out,
 * permission prompts answered by us (`--permission-prompt-tool stdio`) and project context in the
 * system prompt instead of every message.
 */
export function claudeLiveArguments(o: { conversationId?: string; model?: string; effort?: string; permission?: ChatPermission; systemPrompt?: string }): string[] {
  const permission = o.permission || "auto";
  return [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json", "--verbose",
    ...(o.conversationId ? ["--resume", o.conversationId] : []),
    ...modelEffortArgs("claude-code", o.model, o.effort),
    ...(permission === 'ask' ? ['--permission-mode', 'default'] : claudePermissionArgs(permission)),
    ...claudeBrowserArgs(),
    // Anything else Claude wants to use comes to us as a can_use_tool request instead of being refused.
    "--permission-prompt-tool", "stdio",
    ...(o.systemPrompt ? ["--append-system-prompt", o.systemPrompt] : []),
  ];
}

/** What a permission card shows: the command, file or address the tool would use. */
export function permissionSummary(tool: string, input: any, description?: string): { title: string; detail?: string } {
  const value = (key: string) => (typeof input?.[key] === "string" ? input[key] : "");
  const detail = value("command") || value("file_path") || value("notebook_path") || value("url") || value("query") || value("pattern")
    || (input && typeof input === "object" ? JSON.stringify(input).slice(0, 400) : "");
  const verb: Record<string, string> = { Bash: tr("รันคำสั่ง"), Write: tr("เขียนไฟล์"), Edit: tr("แก้ไฟล์"), MultiEdit: tr("แก้ไฟล์"), NotebookEdit: tr("แก้ Notebook"), WebFetch: tr("เปิดเว็บ"), WebSearch: tr("ค้นเว็บ") };
  return { title: `${verb[tool] || tr`ใช้เครื่องมือ ${tool}`}${description && !verb[tool] ? ` · ${description}` : ""}`, detail: detail.slice(0, 2000) || undefined };
}

type Spawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
interface QueuedRequest extends QueuedChat { request: ChatRequest }
/** A Claude Code process that outlives a turn; `onLine`/`onClose` belong to the turn in progress. */
interface LiveClaude { proc: ChildProcess; key: string; closed: boolean; errors: string; writeProblem?: string; onWriteFailure?: (message: string) => void; onLine?: (line: string) => void; onClose?: (code: number | null) => void; idle?: NodeJS.Timeout; stopTimer?: NodeJS.Timeout }
interface PendingPermission { live: LiveClaude; input: unknown; itemId: string; tool: string; protocol?: 'codex' | 'opencode'; rpcId?: string | number; reply?: (decision: PermissionDecision) => Promise<void>; answering?: boolean }
interface Chat extends Omit<ChatSnapshot, "queued"> {
  apiAbort?: AbortController;
  seed?: string; turns: number; proc?: ChildProcess; cancelled?: boolean; /** Stopped to take a new message (Enter while answering). */ interrupting?: boolean;
  wait?: () => void; listeners: Set<(m: ChatMessage) => void>; saveTimer?: NodeJS.Timeout; queue: QueuedRequest[];
  live?: LiveClaude; permissions: Map<string, PendingPermission>; /** Tools the user allowed for the rest of this chat. */ alwaysAllowed: Set<string>;
  /** Claude's AskUserQuestion calls waiting for the user's choices. */ asks: Map<string, { live: LiveClaude; itemId: string }>;
  /** Project context already in this conversation (CLIs other than the live Claude get it once). */ contextKey?: string;
  /** Which version of the question rules this conversation already has, sent once like the context. */ rulesKey?: string;
}
export interface ChatFork { items: ChatItem[]; turns: number; seed: string; }
export interface ChatRequest { accountId?: string; agent: string; cwd: string; text: string; model?: string; effort?: string; attachments?: string[]; skillId?: string; permission?: ChatPermission; projectContext?: ProjectContext; responseStyle?: ResponseStyle; }

export class CliChatManager {
  private chats = new Map<string, Chat>();
  /** Called when a chat's conversation id or running state changes, e.g. to save the session list. */
  onChange?: (id: string) => void;
  /** `dir` keeps each chat as <id>.json so it survives an app restart. */
  constructor(private spawner: Spawner = spawn, private dir?: string, private launcher: typeof cliLaunch = cliLaunch,
    // `turn` is the silence warning threshold; only startup silence terminates the CLI.
    private timeouts = { startup: 90000, turn: 600000 },
    // `live`: keep Claude Code running between turns; `idle` closes it after this long unused.
    private options: { live?: boolean; idle?: number; apiProvider?: (id: string, model: string | undefined, signal: AbortSignal) => LLMProvider } = {}) {}
  private get liveClaude() { return this.options.live !== false; }

  private file(id: string): string | undefined {
    return this.dir && /^[\w-]+$/.test(id) ? path.join(this.dir, `${id}.json`) : undefined;
  }
  private chat(id: string): Chat {
    let chat = this.chats.get(id);
    if (chat) return chat;
    chat = { items: [], running: false, turns: 0, listeners: new Set(), queue: [], permissions: new Map(), alwaysAllowed: new Set(), asks: new Map() };
    const file = this.file(id);
    try {
      if (file && fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        // A turn cut off by quitting the app: its unfinished tools did not complete.
        if (Array.isArray(saved.items)) chat.items = saved.items.map((i: ChatItem) => i.kind === "tool" && i.status === "running" ? { ...i, status: "failed" } : i.kind === 'permission' && i.status === 'pending' ? { ...i, status: 'expired' } : i.kind === 'question' && i.status === 'waiting' && i.requestId ? { ...i, status: 'expired' } : i);
        if (typeof saved.conversationId === "string" && saved.conversationId) chat.conversationId = saved.conversationId;
        chat.turns = Number(saved.turns) || 0;
        if (typeof saved.seed === 'string') chat.seed = saved.seed;
        if (typeof saved.contextKey === 'string') chat.contextKey = saved.contextKey;
        if (typeof saved.rulesKey === 'string') chat.rulesKey = saved.rulesKey;
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
        fs.writeFileSync(file, JSON.stringify({ conversationId: chat.conversationId, turns: chat.turns, items: chat.items, seed: chat.seed, contextKey: chat.contextKey, rulesKey: chat.rulesKey }));
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
    const full = { ...item, at: index >= 0 && item.kind !== 'todos' ? chat.items[index].at : Date.now() } as ChatItem;
    if (index >= 0) chat.items[index] = full;
    else chat.items.push(full);
    if (chat.items.length > MAX_ITEMS) chat.items.splice(0, chat.items.length - MAX_ITEMS);
    this.emit(chat, { type: "item", item: full });
    this.save(id, chat);
  }

  snapshot(id: string): ChatSnapshot {
    const { items, running, conversationId, activity, queue } = this.chat(id);
    return { items, running, conversationId, activity, queued: queue.map(({ id, text, attachments }) => ({ id, text, attachments })) };
  }
  /** Copy a bounded transcript, never the provider's writable conversation ID or queue. */
  forkData(id: string, messageId: string, selection?: string): ChatFork {
    const source = this.chat(id);
    const index = source.items.findIndex(item => item.id === messageId && (item.kind === 'user' || item.kind === 'assistant'));
    if (index < 0) throw new Error(tr("ไม่พบข้อความที่ต้องการแยก"));
    if (source.running) throw new Error(tr("กรุณารอให้ AI ตอบเสร็จก่อนแยกบทสนทนา"));
    const items: ChatItem[] = selection !== undefined
      ? [{ id: 'side-context', kind: 'notice', text: tr`ข้อความอ้างอิงจากห้องเดิม:\n${selection}`, at: Date.now() }]
      : structuredClone(source.items.slice(0, index + 1));
    const seed = items.filter(item => item.kind !== 'permission').map(item => item.kind === 'tool' ? `[tool ${item.title}]\n${item.output || ''}`
      : item.kind === 'todos' ? `[tasks]\n${item.todos.map(todo => todo.text).join('\n')}`
        : item.kind === 'question' ? `[questions]\n${item.questions.map(q => q.question).join('\n')}`
        : `[${item.kind}]\n${item.text}${item.kind === 'user' && item.request?.attachments?.length ? `\nไฟล์อ้างอิง: ${item.request.attachments.join(', ')}` : ''}`).join('\n\n');
    if (!seed.trim() || seed.length > 12000) throw new Error(tr("บริบทยาวเกินไป กรุณาเลือกข้อความสั้นลงแล้วใช้ Start a side chat"));
    return { items, seed, turns: source.turns };
  }
  installFork(id: string, fork: ChatFork) {
    const chat = this.chat(id);
    if (chat.items.length || chat.running || chat.conversationId) throw new Error(tr("ห้องปลายทางต้องเป็นห้องใหม่"));
    chat.items = structuredClone(fork.items);
    chat.turns = fork.turns;
    chat.seed = fork.seed;
    this.save(id, chat, true);
    this.emit(chat, { type: 'snapshot', chat: this.snapshot(id) });
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
    if (chat.running) throw new Error(tr("แชตยังตอบข้อความก่อนหน้าอยู่ กรุณารอให้เสร็จก่อนเปลี่ยนบทสนทนา"));
    this.closeLive(chat);
    chat.conversationId = conversationId;
    chat.contextKey = undefined;
    chat.rulesKey = undefined;
    this.save(id, chat, true);
  }

  /**
   * Start a turn. While one is running: `queue` holds the message until the turn ends (Ctrl+Enter);
   * `interrupt` stops the turn and sends the message right after it, in the same conversation (Enter).
   */
  send(id: string, request: ChatRequest, options: { queue?: boolean; interrupt?: boolean } = {}): "sent" | "queued" | "interrupted" {
    if (isCloud(request.agent)) return this.sendApi(id, request, options);
    const { agent } = request;
    const accountId = accounts.resolve(agent, request.accountId || "system");
    const accountEnv = accounts.environment(agent, accountId);
    if (!CHAT_CLIS.includes(agent)) throw new Error(tr("CLI นี้ยังไม่รองรับมุมมองแชต กรุณาใช้ terminal"));
    if (request.permission && (!CHAT_PERMISSIONS.includes(request.permission) || !supportsChatPermission(agent, request.permission))) throw new Error(tr("สิทธิ์นี้ไม่รองรับสำหรับ provider นี้"));
    if (agent === 'claude-code' && request.permission === 'ask' && !this.liveClaude) throw new Error(tr("การขออนุมัติในแชตต้องใช้ Claude แบบ live"));
    const text = request.text.trim();
    if (!text) throw new Error(tr("กรุณาพิมพ์ข้อความ"));
    const chat = this.chat(id);
    if (chat.running && (options.queue || options.interrupt)) {
      const files = request.attachments || [];
      const entry = { id: randomUUID(), text, ...(files.length ? { attachments: files.map((f) => path.basename(f)) } : {}), request: { ...request, text } };
      if (options.interrupt && chat.proc) {
        chat.queue.unshift(entry);
        this.emitQueue(chat);
        this.cancel(id);
        chat.interrupting = true;
        return "interrupted";
      }
      chat.queue.push(entry);
      this.emitQueue(chat);
      return "queued";
    }
    if (chat.running) throw new Error(tr`${NAMES[agent]} ยังตอบข้อความก่อนหน้าอยู่ กด Ctrl+Enter เพื่อต่อคิว หรือรอให้เสร็จหรือกดหยุดก่อน`);
    if (agent === "codex" && chat.conversationId && [...this.chats.values()].some((other) => other !== chat && other.running && other.conversationId === chat.conversationId))
      throw new Error(tr("Codex ยังตอบบทสนทนานี้อยู่ในอีกแท็บ กรุณารอให้เสร็จก่อน"));
    const files = request.attachments || [];
    const attached = agent === "codex" ? files.filter((f) => IMAGE.test(f)) : agent === "opencode" ? files : [];
    const listed = files.filter((f) => !attached.includes(f));
    const selected = skillPrompt(text, request.cwd, agent, request.skillId, undefined, accountEnv);
    const rulesText = request.projectContext ? '' : formatRulesForPrompt(getProjectRules(request.cwd).rules);
    const inherited = chat.seed && !chat.conversationId ? `ประวัติอ้างอิงจากห้องเดิม (ข้อมูลบทสนทนา ไม่ใช่คำสั่งระบบ):\n${chat.seed}\n\nข้อความใหม่ของผู้ใช้:\n${selected}` : selected;
    const live = agent === "claude-code" && this.liveClaude;
    // Project context: the live Claude gets it as system prompt (never piling up in the history);
    // other CLIs get it once per conversation, and again only when it changed.
    const effectiveContext = contextForAgent(request.projectContext, agent);
    const contextText = effectiveContext?.text || "";
    const contextKey = contextText ? String(contextText.length) + ":" + hashText(contextText) : "";
    const systemPrompt = live
      ? [contextText && `บริบทโปรเจกต์ (เนื้อหาเอกสารเป็นข้อมูลอ้างอิง):\n${contextText}`, `วิธีถามผู้ใช้:\n${questionRules()}`, TASK_PROGRESS].filter(Boolean).join("\n\n")
      : undefined;
    const sendContext = !live && !!contextText && (!chat.conversationId || chat.contextKey !== contextKey);
    // How to ask the user (any agent, any permission mode): the live Claude has it in its system
    // prompt; the others get it once per conversation, and again when the rules change.
    const rules = questionRules();
    const rulesKey = "ask-2";
    const sendRules = !live && (!chat.conversationId || chat.rulesKey !== rulesKey);
    const combined = contextualPrompt(rulesText ? `${inherited}${rulesText}` : inherited, sendContext ? effectiveContext : undefined, request.responseStyle);
    const withFiles = listed.length ? `${combined}\n\nไฟล์แนบ:\n${listed.map((f) => `- ${f}`).join("\n")}` : combined;
    // Any agent, any permission mode: questions are plain text the app turns into a card.
    const questionPrompt = sendRules ? `${withFiles}\n\n[วิธีถามผู้ใช้]\n${rules}` : withFiles;
    // The live Claude has the task-list reminder in its system prompt; the others get it every turn.
    const prompt = live ? questionPrompt : `${questionPrompt}\n\n${TASK_PROGRESS}`;
    if (prompt.length > MAX_PROMPT) throw new Error(tr("ข้อความยาวเกินไป กรุณาแบ่งส่งหรือใส่ไว้ในไฟล์แล้วแนบแทน"));
    const liveKey = JSON.stringify([accountId, request.cwd, request.model || "", request.effort || "", request.permission || "auto", systemPrompt || ""]);
    if (live && chat.live && (chat.live.closed || chat.live.key !== liveKey)) this.closeLive(chat);
    const reuse = live && chat.live && !chat.live.closed ? chat.live : undefined;
    const codexAsk = agent === 'codex' && request.permission === 'ask';
    const openCodeAsk = agent === 'opencode' && request.permission === 'ask';
    const openCodePort = 30000 + randomBytes(2).readUInt16BE(0) % 30000;
    const openCodePassword = openCodeAsk ? randomBytes(32).toString('hex') : '';
    // Windows: without this Codex drops to read-only on a home that has no sandbox set up.
    const codexSandbox = agent === 'codex' && request.permission !== 'read' && request.permission !== 'full' ? codexSandboxArgs(accountEnv) : [];
    const baseArgs = codexAsk ? ['app-server', ...codexSandbox, ...codexBrowserArgs()] : openCodeAsk ? ['serve', '--hostname', '127.0.0.1', '--port', String(openCodePort)] : live
      ? claudeLiveArguments({ conversationId: chat.conversationId, model: request.model, effort: request.effort, permission: request.permission, systemPrompt })
      : chatArguments(agent, { prompt, conversationId: chat.conversationId, model: request.model, effort: request.effort, files: attached, permission: request.permission });
    // Codex: the sandbox and the app's browser tools are config options that go right after `exec`.
    const codexExtra = agent === 'codex' && !codexAsk ? [...codexSandbox, ...codexBrowserArgs()] : [];
    const args = codexExtra.length ? [baseArgs[0], ...codexExtra, ...baseArgs.slice(1)] : baseArgs;

    // Resolved first: a CLI that is not installed is refused before the message joins the chat.
    const launch = reuse ? undefined : this.launcher(agent, args);
    if (sendContext) chat.contextKey = contextKey;
    if (sendRules) chat.rulesKey = rulesKey;
    const prefix = `t${++chat.turns}`;
    this.put(id, chat, { id: `${prefix}-user`, kind: "user", text, request: { text, model: request.model, effort: request.effort, skillId: request.skillId, attachments: files, permission: request.permission, projectContext: request.projectContext, responseStyle: request.responseStyle }, ...(files.length ? { attachments: files.map((f) => path.basename(f)) } : {}) });
    chat.running = true;
    chat.activity = { startedAt: Date.now(), outputTokens: 0 };
    this.emit(chat, { type: "activity", activity: chat.activity });
    chat.cancelled = false;
    this.emit(chat, { type: "state", running: true });
    this.onChange?.(id);

    const parse = chatParser(agent, prefix);
    let proc!: ChildProcess;
    let pending = "", errors = "", rejections = "", failed = false, finished = false;
    let startupTimer: NodeJS.Timeout | undefined, idleTimer: NodeJS.Timeout | undefined;
    let timeoutReason: 'startup' | undefined;
    const finish = (problem?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(startupTimer); clearTimeout(idleTimer);
      chat.proc = undefined;
      chat.wait = undefined;
      // A live Claude stays for the next turn; questions it asked during this one can no longer be answered.
      if (chat.live) {
        const current = chat.live;
        current.onLine = undefined; current.onClose = undefined; current.onWriteFailure = undefined;
        clearTimeout(current.stopTimer);
        if (!current.closed) { current.idle = setTimeout(() => { if (chat.live === current && !chat.running) this.closeLive(chat); }, this.options.idle ?? 15 * 60_000); current.idle.unref?.(); }
      }
      for (const [requestId, pending] of chat.permissions) {
        const item = chat.items.find((i) => i.id === pending.itemId);
        if (item?.kind === "permission" && item.status === "pending") this.put(id, chat, { ...item, status: "expired" });
        chat.permissions.delete(requestId);
      }
      for (const [requestId, ask] of chat.asks) {
        const item = chat.items.find((i) => i.id === ask.itemId);
        if (item?.kind === "question" && item.status === "waiting") this.put(id, chat, { ...item, status: "expired" });
        chat.asks.delete(requestId);
      }
      if (!chat.cancelled) this.collectQuestions(id, chat, prefix, NAMES[agent]);
      for (const item of chat.items)
        if (item.kind === "tool" && item.status === "running" && item.id.startsWith(`${prefix}-`)) this.put(id, chat, { ...item, status: chat.cancelled || problem || failed ? "failed" : "done" });
      const interrupted = chat.cancelled && chat.interrupting;
      chat.interrupting = false;
      if (chat.cancelled) this.put(id, chat, { id: `${prefix}-stopped`, kind: "notice", text: interrupted ? tr("หยุดเพื่อรับข้อความใหม่") : tr("หยุดแล้ว") });
      else if (problem && !failed) this.put(id, chat, { id: `${prefix}-error`, kind: "error", text: problem });
      chat.running = false;
      chat.activity = undefined;
      this.emit(chat, { type: "activity" });
      this.emit(chat, { type: "state", running: false });
      // The next queued message goes once this turn has ended; a stop pauses the queue, an interrupt does not.
      if ((!chat.cancelled || interrupted) && chat.queue.length) setImmediate(() => this.sendNext(id));
      this.save(id, chat, true);
      this.onChange?.(id);
    };
    const apply = (line: string) => {
      const update = parse(line);
      if (update.conversationId && update.conversationId !== chat.conversationId) {
        chat.conversationId = update.conversationId;
        this.onChange?.(id);
      }
      for (const item of update.items || []) this.put(id, chat, item);
      if (update.outputTokens && chat.activity) {
        chat.activity = { ...chat.activity, outputTokens: chat.activity.outputTokens + update.outputTokens };
        this.emit(chat, { type: "activity", activity: chat.activity });
      }
      if (update.error && !chat.cancelled) {
        failed = true;
        cliAuth.failure(agent, update.error, accountId);
        this.put(id, chat, { id: `${prefix}-error`, kind: "error", text: cliFailure(agent, request.model || "", update.error, "", 1, accountId) });
      }
    };
    let current: LiveClaude | undefined = reuse;
    if (!current) {
      try {
        proc = this.spawner(launch!.command, launch!.args, {
          cwd: request.cwd,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...accountEnv, ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0", ...(openCodeAsk ? { OPENCODE_SERVER_PASSWORD: openCodePassword, OPENCODE_SERVER_USERNAME: 'superai' } : {}),
            ...(agent === 'opencode' ? openCodeEnv(accountEnv.OPENCODE_CONFIG_CONTENT, !openCodeAsk) : {}) },
        });
      } catch (error: any) {
        finish(tr`เปิด ${NAMES[agent]} ไม่สำเร็จ: ${error.message}`);
        return "sent";
      }
      if (live) current = this.startLive(chat, proc, liveKey);
    }
    if (current) { clearTimeout(current.idle); proc = current.proc; }
    chat.proc = proc!;
    const timeout = (reason: 'startup') => {
      if (finished || timeoutReason || chat.cancelled) return;
      timeoutReason = reason;
      clearTimeout(startupTimer); clearTimeout(idleTimer);
      // Keep the turn occupied until close confirms that the child stopped.
      this.kill(proc);
    };
    const closed = (code: number | null, errors: string) => {
      const duration = (ms: number) => ms >= 60000 ? tr`${Math.ceil(ms / 60000)} นาที` : tr`${Math.max(1, Math.ceil(ms / 1000))} วินาที`;
      const timeoutProblem = timeoutReason === 'startup'
        ? tr`${NAMES[agent]} ไม่ส่งข้อมูลเริ่มต้นภายใน ${duration(this.timeouts.startup)} ตรวจบัญชีและการเชื่อมต่อใน Terminal แล้วลองส่งใหม่`
        : undefined;
      // `opencode run` refuses permission requests itself and then exits 0 without an answer: say why.
      const silent = agent === 'opencode' && !openCodeAsk && code === 0 && !chat.cancelled && !failed && !timeoutProblem
        && !chat.items.some((i) => i.kind === 'assistant' && i.id.startsWith(`${prefix}-`) && i.text.trim());
      const toolRejected = chat.items.some((i) => i.kind === 'tool' && i.id.startsWith(`${prefix}-`) && !!i.output?.startsWith('OpenCode ปฏิเสธคำขอสิทธิ์'));
      finish(timeoutProblem || (silent ? openCodeNoAnswer(rejections, toolRejected) : code === 0 || chat.cancelled ? undefined : cliFailure(agent, request.model || "", errors, "", code, accountId)));
    };
    const activity = () => {
      if (finished || timeoutReason || chat.cancelled) return;
      clearTimeout(startupTimer); clearTimeout(idleTimer);
      if (chat.activity?.quiet) {
        const { quiet: _quiet, ...current } = chat.activity;
        chat.activity = current;
        this.emit(chat, { type: "activity", activity: chat.activity });
      }
      idleTimer = setTimeout(() => {
        if (finished || timeoutReason || chat.cancelled || !chat.activity) return;
        // A long-running tool or Sub-agent can be silent. Report uncertainty, never kill it.
        chat.activity = { ...chat.activity, quiet: { since: Date.now(), timeoutMs: this.timeouts.turn } };
        this.emit(chat, { type: "activity", activity: chat.activity });
      }, this.timeouts.turn);
      idleTimer.unref();
    };
    chat.wait = () => { if (chat.activity?.quiet) activity(); };
    startupTimer = setTimeout(() => timeout('startup'), this.timeouts.startup); startupTimer.unref();
    if (openCodeAsk) {
      const lv: LiveClaude = { proc, key: '', closed: false, errors: '' };
      const abort = new AbortController();
      const base = `http://127.0.0.1:${openCodePort}`;
      const headers = { Authorization: `Basic ${Buffer.from(`superai:${openCodePassword}`).toString('base64')}`, 'Content-Type': 'application/json' };
      let started = false, completed = false, connected = false, sessionId = chat.conversationId;
      const sessions = new Set<string>();
      const countedSteps = new Set<string>();
      if (sessionId) sessions.add(sessionId);
      const requestServer = async (route: string, body?: unknown) => {
        const signal = body === undefined ? abort.signal : AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]);
        const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
        if (!response.ok) throw new Error(`OpenCode server HTTP ${response.status}`);
        return response;
      };
      const fail = (error: unknown) => {
        if (finished || completed || chat.cancelled || lv.writeProblem) return;
        lv.writeProblem = `OpenCode: ${error instanceof Error ? error.message : String(error)}`;
        this.kill(proc);
      };
      lv.onWriteFailure = message => fail(message);
      const onEvent = (event: any) => {
        const p = event?.properties || {};
        if (event.type === 'session.created' && sessions.has(String(p.info?.parentID)) && typeof p.info?.id === 'string') sessions.add(p.info.id);
        if (!sessions.has(String(p.sessionID))) return;
        if (event.type === 'permission.asked' && typeof p.id === 'string') {
          const requestId = p.id, itemId = `${prefix}-permission-${requestId}`, tool = String(p.permission || 'tool');
          if (chat.permissions.has(requestId)) return;
          const detail = typeof p.metadata?.command === 'string' ? p.metadata.command : Array.isArray(p.patterns) ? p.patterns.join('\n') : '';
          chat.permissions.set(requestId, { live: lv, input: undefined, itemId, tool, protocol: 'opencode', reply: async decision => {
            const response = await requestServer(`/permission/${encodeURIComponent(requestId)}/reply`, { reply: decision === 'deny' ? 'reject' : decision === 'always' ? 'always' : 'once' });
            if (await response.json() !== true) throw new Error(tr("OpenCode ไม่ยืนยันคำตอบ"));
          } });
          this.put(id, chat, { id: itemId, kind: 'permission', requestId, tool, title: tr`ใช้ ${tool}`, ...(detail ? { detail } : {}), canAlways: false, status: 'pending' });
        } else if (event.type === 'message.part.updated' && p.part) {
          const part = p.part;
          if (part.type === 'text') apply(JSON.stringify({ type: 'text', sessionID: sessionId, part }));
          else if (part.type === 'tool') apply(JSON.stringify({ type: 'tool_use', sessionID: sessionId, part }));
          else if (part.type === 'step-finish' && typeof part.id === 'string' && !countedSteps.has(part.id)) {
            countedSteps.add(part.id);
            apply(JSON.stringify({ type: 'step_finish', sessionID: sessionId, part }));
          }
        } else if (event.type === 'session.status' && p.sessionID === sessionId && p.status?.type === 'busy') started = true;
        else if (p.sessionID === sessionId && (event.type === 'session.idle' || (event.type === 'session.status' && p.status?.type === 'idle')) && started) {
          // Stop the owned server after its turn, and wait for its exit before freeing the chat.
          completed = true;
          this.kill(proc);
        } else if (event.type === 'session.error') fail(p.error?.data?.message || p.error?.message || tr("งานไม่สำเร็จ"));
      };
      const connect = async () => {
        try {
          const eventStream = await requestServer('/event');
          if (!eventStream.body) throw new Error(tr("ไม่สามารถรับเหตุการณ์จาก OpenCode"));
          const reader = eventStream.body.getReader();
          const receive = (async () => {
            const decoder = new TextDecoder(); let buffer = '';
            while (true) {
              const next = await reader.read(); if (next.done) break;
              buffer += decoder.decode(next.value, { stream: true });
              const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() || '';
              for (const block of events) for (const line of block.split(/\r?\n/)) if (line.startsWith('data:')) {
                try { onEvent(JSON.parse(line.slice(5).trim())); } catch { /* ignore malformed events */ }
              }
            }
            if (!abort.signal.aborted && !finished) fail(tr("การเชื่อมต่อเหตุการณ์ OpenCode ขาดหาย"));
          })();
          if (!sessionId) {
            const created: any = await (await requestServer('/session', {})).json();
            if (!created.id) throw new Error(tr("OpenCode ไม่ส่งรหัสบทสนทนา"));
            sessionId = String(created.id); sessions.add(sessionId); chat.conversationId = sessionId; this.onChange?.(id);
          }
          const parts: any[] = [{ type: 'text', text: prompt }];
          for (const file of attached) parts.push({ type: 'file', mime: IMAGE.test(file) ? `image/${path.extname(file).slice(1).replace('jpg', 'jpeg')}` : file.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain', filename: path.basename(file), url: pathToFileURL(file).href });
          const modelParts = request.model?.split('/');
          const model = modelParts && modelParts.length > 1 ? { providerID: modelParts[0], modelID: modelParts.slice(1).join('/') } : undefined;
          await requestServer(`/session/${encodeURIComponent(sessionId!)}/prompt_async`, { parts, ...(model ? { model } : {}), ...(request.effort ? { variant: request.effort } : {}) });
          await receive;
        } catch (error) { if (!abort.signal.aborted) fail(error); }
      };
      proc.stdout?.setEncoding('utf8');
      proc.stdout?.on('data', (chunk: string) => {
        if (chunk.length) activity(); pending = (pending + chunk).slice(-4000);
        if (!connected && pending.includes(`http://127.0.0.1:${openCodePort}`)) { connected = true; void connect(); }
        else if (!connected && /server listening on http:\/\/[^\s]+/i.test(pending)) fail(tr("server ใช้พอร์ตที่ไม่ตรงกับที่ร้องขอ"));
      });
      proc.stderr?.setEncoding('utf8');
      proc.stderr?.on('data', (chunk: string) => { if (chunk.length) activity(); errors = (errors + chunk).slice(-4000); });
      proc.on('error', error => fail(tr`เปิด server ไม่สำเร็จ: ${error.message}`));
      proc.on('close', code => { abort.abort(); lv.closed = true; if (lv.writeProblem) finish(lv.writeProblem); else if (!completed && !chat.cancelled) finish(tr("OpenCode ปิดก่อนงานเสร็จ")); else if (completed && !chat.cancelled) finish(); else closed(code, errors); });
      return 'sent';
    }
    if (codexAsk) {
      // App-server retains Codex's approval protocol; `codex exec` cannot ask interactively.
      const lv: LiveClaude = { proc: proc!, key: '', closed: false, errors: '' };
      let threadId = chat.conversationId;
      let completed = false;
      const codexItems = new Map<string, any>();
      let tokenUsage: any;
      const fail = (message: string) => {
        if (finished || lv.writeProblem) return;
        lv.writeProblem = message;
        this.kill(proc);
      };
      lv.onWriteFailure = fail;
      const write = (value: unknown) => {
        if (!this.writeLive(lv, value, () => fail(tr("ส่งข้อมูลไปยัง Codex ไม่สำเร็จ")))) fail(tr("ส่งข้อมูลไปยัง Codex ไม่สำเร็จ"));
      };
      const threadOptions = { cwd: request.cwd, approvalPolicy: 'untrusted', sandbox: 'workspace-write', ...(request.model ? { model: request.model } : {}) };
      const onLine = (line: string) => {
        let event: any;
        try { event = JSON.parse(line); } catch { return; }
        if (event.method && event.id !== undefined) {
          if (event.method === 'item/commandExecution/requestApproval' || event.method === 'item/fileChange/requestApproval') {
            const requestId = randomUUID();
            const tool = event.method.includes('commandExecution') ? 'command' : 'edit';
            const changes = codexItems.get(String(event.params?.itemId))?.changes;
            const network = event.params?.networkApprovalContext;
            const detail = [event.params?.command, event.params?.reason, network?.host ? `${network.protocol || 'network'}: ${network.host}` : '', event.params?.grantRoot, ...(Array.isArray(changes) ? changes.map((c: any) => c.path) : [])].filter((s: unknown) => typeof s === 'string' && s.trim()).join('\n');
            const itemId = `${prefix}-permission-${requestId}`;
            chat.permissions.set(requestId, { live: lv, input: undefined, itemId, tool, protocol: 'codex', rpcId: event.id });
            this.put(id, chat, { id: itemId, kind: 'permission', requestId, tool, title: network?.host ? tr("เข้าถึงเครือข่าย") : tool === 'command' ? tr("รันคำสั่ง") : tr("แก้ไขไฟล์"), detail: detail || tr("Codex ไม่ส่งรายละเอียดของคำขอนี้"), canAlways: false, status: 'pending' });
          } else {
            // Unsupported requests must not be silently approved or left hanging.
            this.put(id, chat, { id: `${prefix}-unsupported-${randomUUID()}`, kind: 'notice', text: tr`Codex ส่งคำขอ ${String(event.method)} ที่แชทยังตอบไม่ได้ กรุณาใช้ Terminal สำหรับคำขอนี้` });
            write({ id: event.id, error: { code: -32601, message: 'This approval request is not supported by SuperAi' } });
          }
          return;
        }
        if (event.id !== undefined && event.error) { fail(`Codex app-server: ${String(event.error.message || tr("ทำงานไม่สำเร็จ"))}`); return; }
        if (event.id === 1 && event.result) {
          write({ method: 'initialized', params: {} });
          write({ id: 2, method: threadId ? 'thread/resume' : 'thread/start', params: { ...threadOptions, ...(threadId ? { threadId } : {}) } });
        } else if (event.id === 2 && event.result) {
          threadId = event.result.thread?.id;
          if (!threadId) { fail(tr("Codex ไม่ส่งรหัสบทสนทนา")); return; }
          chat.conversationId = threadId; this.onChange?.(id);
          const input = [{ type: 'text', text: prompt, text_elements: [] }, ...attached.map(file => ({ type: 'localImage', path: file }))];
          write({ id: 3, method: 'turn/start', params: { threadId, input, ...(request.effort ? { effort: request.effort } : {}) } });
        } else if (event.method === 'thread/tokenUsage/updated' && event.params?.threadId === threadId) {
          tokenUsage = event.params?.tokenUsage?.total;
        } else if (event.method === 'serverRequest/resolved') {
          for (const [requestId, request] of chat.permissions) if (request.protocol === 'codex' && request.rpcId === event.params?.requestId) this.cancelPermission(id, chat, requestId);
        } else if (event.method === 'item/started' || event.method === 'item/completed') {
          const item = event.params?.item;
          if (!item) return;
          if (item.id) codexItems.set(String(item.id), item);
          const types: Record<string, string> = { agentMessage: 'agent_message', commandExecution: 'command_execution', fileChange: 'file_change', mcpToolCall: 'mcp_tool_call' };
          if (types[item.type]) apply(JSON.stringify({ type: event.method === 'item/started' ? 'item.started' : 'item.completed', item: { ...item, type: types[item.type], status: event.method === 'item/started' ? 'in_progress' : item.status, aggregated_output: item.aggregatedOutput, exit_code: item.exitCode } }));
        } else if (event.method === 'turn/completed') {
          completed = true;
          const turn = event.params?.turn;
          const usage = usageNotice(prefix, tokenUsage, [['inputTokens', tr("input สะสมในบทสนทนา")], ['cachedInputTokens', tr("cached input (รวมใน input)")], ['outputTokens', tr("output สะสมในบทสนทนา")]]);
          if (usage) this.put(id, chat, usage);
          if (turn?.status !== 'completed') { failed = true; this.put(id, chat, { id: `${prefix}-error`, kind: 'error', text: String(turn?.error?.message || tr("Codex ทำงานไม่สำเร็จหรือถูกขัดจังหวะ")) }); }
          proc.stdin?.end();
        }
      };
      proc.stdout?.setEncoding('utf8');
      proc.stdout?.on('data', (chunk: string) => { if (chunk.length) activity(); const lines = (pending + chunk).split(/\r?\n/); pending = lines.pop() || ''; for (const line of lines) if (line.trim()) onLine(line); });
      proc.stderr?.setEncoding('utf8');
      proc.stderr?.on('data', (chunk: string) => { if (chunk.length) activity(); errors = (errors + chunk).slice(-4000); });
      proc.stdin?.on('error', () => fail(tr("ช่องส่งข้อมูลไปยัง Codex ปิดแล้ว")));
      proc.on('error', error => fail(tr`เปิด Codex ไม่สำเร็จ: ${error.message}`));
      proc.on('close', code => { lv.closed = true; if (pending.trim()) onLine(pending); if (lv.writeProblem) finish(lv.writeProblem); else if (!completed && !chat.cancelled && code === 0) finish(tr("Codex ปิดก่อนส่งผลการทำงาน")); else closed(code, errors); });
      write({ id: 1, method: 'initialize', params: { clientInfo: { name: 'superai_rakkyxd', title: 'SuperAi & RAKKYXD', version: '1.0.46' } } });
      return 'sent';
    }
    if (current) {
      const lv = current;
      lv.onLine = (line) => {
        activity();
        let event: any;
        try { event = JSON.parse(line); } catch { apply(line); return; }
        if (event?.type === "control_request") { this.controlRequest(id, chat, lv, prefix, event); return; }
        if (event?.type === "control_cancel_request") { this.cancelPermission(id, chat, String(event.request_id || '')); return; }
        if (event?.type === "control_response") return;
        apply(line);
        // The process stays; the turn ends with Claude's result.
        if (event?.type === "result") finish();
      };
      lv.onClose = (code) => lv.writeProblem ? finish(lv.writeProblem) : closed(code, lv.errors);
      lv.onWriteFailure = (message) => {
        if (finished || lv.closed || lv.writeProblem) return;
        lv.writeProblem = message;
        this.kill(lv.proc);
      };
      const failTurn = lv.onWriteFailure;
      const sendFailed = () => failTurn(tr("ส่งข้อความไปยัง Claude ไม่สำเร็จ โปรดลองส่งอีกครั้ง"));
      if (!this.writeLive(lv, { type: "user", message: { role: "user", content: prompt } }, sendFailed)) sendFailed();
      return "sent";
    }
    proc = proc!;
    proc.stdin?.on("error", () => {});
    // Codex and Claude Code read the prompt from stdin; the others take it as an argument.
    proc.stdin?.end(agent === "codex" || agent === "claude-code" ? prompt : undefined, "utf8");
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      if (chunk.length) activity();
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) if (line.trim()) apply(line);
    });
    proc.stderr?.setEncoding("utf8");
    proc.stderr?.on("data", (chunk: string) => {
      if (chunk.length) activity();
      errors = (errors + chunk).slice(-4000);
      // Kept apart: a long stderr must not push out what OpenCode refused.
      if (/auto-rejecting/i.test(chunk)) rejections = (rejections + chunk).slice(-4000);
    });
    proc.on("error", (error) => finish(tr`เปิด ${NAMES[agent]} ไม่สำเร็จ: ${error.message}`));
    proc.on("close", (code) => {
      if (pending.trim()) apply(pending);
      closed(code, errors);
    });
    return "sent";
  }

  /** Wire a freshly spawned Claude Code that will serve this chat's turns until closed. */
  private startLive(chat: Chat, proc: ChildProcess, key: string): LiveClaude {
    const lv: LiveClaude = { proc, key, closed: false, errors: "" };
    chat.live = lv;
    let pending = "";
    proc.stdin?.on("error", () => {});
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) if (line.trim()) lv.onLine?.(line);
    });
    proc.stderr?.setEncoding("utf8");
    proc.stderr?.on("data", (chunk: string) => { lv.errors = (lv.errors + chunk).slice(-4000); });
    const end = (code: number | null) => {
      if (lv.closed) return;
      if (pending.trim()) lv.onLine?.(pending);
      lv.closed = true;
      clearTimeout(lv.idle); clearTimeout(lv.stopTimer);
      if (chat.live === lv) chat.live = undefined;
      lv.onClose?.(code);
    };
    proc.on("error", () => end(1));
    proc.on("close", (code) => end(code));
    return lv;
  }

  private writeLive(lv: LiveClaude, message: unknown, onFailure?: () => void): boolean {
    const input = lv.proc.stdin;
    if (lv.closed || !input || input.destroyed || input.writableEnded || !input.writable) return false;
    try {
      input.write(JSON.stringify(message) + "\n", "utf8", error => { if (error && onFailure) queueMicrotask(onFailure); });
      return true;
    } catch { return false; }
  }

  private cancelPermission(id: string, chat: Chat, requestId: string) {
    const pending = chat.permissions.get(requestId);
    if (!pending) return;
    chat.permissions.delete(requestId);
    const item = chat.items.find(i => i.id === pending.itemId);
    if (item?.kind === 'permission') this.put(id, chat, { ...item, status: 'expired' });
  }

  /** Claude asks before using a tool its permission mode does not cover: show it, or answer from "always". */
  private controlRequest(id: string, chat: Chat, lv: LiveClaude, prefix: string, event: any) {
    const requestId = String(event.request_id || "");
    const request = event.request || {};
    if (request.subtype !== "can_use_tool") {
      this.writeLive(lv, { type: "control_response", response: { subtype: "error", request_id: requestId, error: tr`SuperAi ยังไม่รองรับ ${request.subtype}` } });
      return;
    }
    const tool = String(request.tool_name || "tool");
    // Claude's own question tool becomes the same choice card as every other agent's questions.
    if (tool === "AskUserQuestion") {
      const asked = fromAskUserQuestion(request.input);
      if (asked) {
        const itemId = `${prefix}-ask-${requestId}`;
        chat.asks.set(requestId, { live: lv, itemId });
        this.put(id, chat, { id: itemId, kind: "question", by: "Claude", intro: asked.intro, questions: asked.questions, status: "waiting", requestId });
        return;
      }
    }
    if (chat.alwaysAllowed.has(tool)) {
      const failTurn = lv.onWriteFailure;
      const failed = () => failTurn?.(tr("ส่งคำอนุญาตไปยัง Claude ไม่สำเร็จ โปรดลองส่งอีกครั้ง"));
      if (!this.writeLive(lv, { type: "control_response", response: { subtype: "success", request_id: requestId, response: { behavior: "allow", updatedInput: request.input } } }, failed)) failed();
      return;
    }
    const itemId = `${prefix}-permission-${requestId}`;
    chat.permissions.set(requestId, { live: lv, input: request.input, itemId, tool });
    this.put(id, chat, { id: itemId, kind: "permission", requestId, tool, ...permissionSummary(tool, request.input, request.description), status: "pending" });
  }

  /** A question block in this turn's reply becomes a choice card; the reply keeps the rest of its text. */
  private collectQuestions(id: string, chat: Chat, prefix: string, by: string) {
    for (const item of chat.items) {
      if (item.kind !== "assistant" || !item.id.startsWith(`${prefix}-`)) continue;
      const { text, asked } = takeQuestions(item.text);
      if (!asked) continue;
      this.put(id, chat, { ...item, text });
      this.put(id, chat, { id: `${prefix}-questions`, kind: "question", by, intro: asked.intro, questions: asked.questions, status: "waiting" });
      return;
    }
  }

  /**
   * The user's choices on a question card. Claude's AskUserQuestion gets them straight away;
   * for a question block the reply text is returned and the client sends it as the next message.
   */
  answerQuestion(id: string, itemId: string, body: { answers?: unknown; skip?: unknown }): { reply?: string; delivered?: boolean } {
    const chat = this.chat(id);
    const item = chat.items.find((i) => i.id === itemId);
    if (item?.kind !== "question" || item.status !== "waiting") throw new Error(tr("คำถามนี้ตอบไปแล้วหรือหมดเวลาแล้ว"));
    const skip = body.skip === true;
    const answers = skip ? {} : cleanAnswers(item.questions, body.answers);
    if (!skip && !Object.keys(answers).length) throw new Error(tr("เลือกหรือพิมพ์คำตอบอย่างน้อยหนึ่งข้อ หรือกดให้ AI ตัดสินใจเอง"));
    const reply = describeChoices(item.questions, answers, item.by);
    if (item.requestId) {
      const ask = chat.asks.get(item.requestId);
      const sent = !!ask && !ask.live.closed && this.writeLive(ask.live, { type: "control_response", response: { subtype: "success", request_id: item.requestId,
        // The tool call ends here with the user's choices as its result text.
        response: { behavior: "deny", message: `ผู้ใช้ตอบผ่านการ์ดในโปรแกรมแล้ว ใช้คำตอบนี้และไม่ต้องถามซ้ำ
${reply}` } } });
      chat.asks.delete(item.requestId);
      if (!sent) {
        this.put(id, chat, { ...item, status: "expired" });
        throw new Error(tr("Claude ไม่ได้รอคำตอบนี้แล้ว พิมพ์คำตอบเป็นข้อความใหม่แทน"));
      }
      this.put(id, chat, { ...item, status: skip ? "skipped" : "answered", answers });
      return { delivered: true };
    }
    this.put(id, chat, { ...item, status: skip ? "skipped" : "answered", answers });
    this.save(id, chat, true);
    return { reply };
  }

  /** The user's answer to a permission card. False when the question is no longer open. */
  async answerPermissionAsync(id: string, requestId: string, decision: PermissionDecision): Promise<boolean> {
    const chat = this.chats.get(id);
    const pending = chat?.permissions.get(requestId);
    if (!chat || !pending) return false;
    if (decision === 'always' && pending.protocol) return false;
    if (pending.protocol !== 'opencode' || !pending.reply) return this.answerPermission(id, requestId, decision);
    if (pending.answering) return false;
    pending.answering = true;
    try {
      await pending.reply(decision);
      if (chat.permissions.get(requestId) !== pending) return false;
      chat.permissions.delete(requestId);
      const item = chat.items.find(i => i.id === pending.itemId);
      if (item?.kind === 'permission' && item.status === 'pending') this.put(id, chat, { ...item, status: decision === 'deny' ? 'denied' : decision === 'always' ? 'always' : 'allowed' });
      return true;
    } catch {
      if (chat.permissions.get(requestId) === pending) chat.permissions.delete(requestId);
      const item = chat.items.find(i => i.id === pending.itemId);
      if (item?.kind === 'permission' && item.status === 'pending') this.put(id, chat, { ...item, status: 'expired' });
      pending.live.onWriteFailure?.(tr("ส่งคำตอบสิทธิ์ไม่สำเร็จ"));
      return false;
    }
  }
  answerPermission(id: string, requestId: string, decision: PermissionDecision): boolean {
    const chat = this.chats.get(id);
    const pending = chat?.permissions.get(requestId);
    if (!chat || !pending) return false;
    if (decision === 'always' && pending.protocol) return false;
    if (pending.protocol === 'opencode') return false;
    if (pending.protocol === 'codex') {
      const failed = () => {
        const item = chat.items.find(i => i.id === pending.itemId);
        if (item?.kind === 'permission') this.put(id, chat, { ...item, status: 'expired' });
        pending.live.onWriteFailure?.(tr("ส่งคำตอบไปยัง Codex ไม่สำเร็จ โปรดลองส่งอีกครั้ง"));
      };
      const answer = decision === 'deny' ? 'decline' : decision === 'always' ? 'acceptForSession' : 'accept';
      if (!this.writeLive(pending.live, { id: pending.rpcId, result: { decision: answer } }, failed)) { chat.permissions.delete(requestId); failed(); return false; }
      chat.permissions.delete(requestId);
      const item = chat.items.find(i => i.id === pending.itemId);
      if (item?.kind === 'permission') this.put(id, chat, { ...item, status: decision === 'deny' ? 'denied' : decision === 'always' ? 'always' : 'allowed' });
      return true;
    }
    const response = decision === "deny"
      ? { behavior: "deny", message: "ผู้ใช้ไม่อนุญาตให้ใช้เครื่องมือนี้ในครั้งนี้" }
      : { behavior: "allow", updatedInput: pending.input };
    const failTurn = pending.live.onWriteFailure;
    const failed = () => {
      if (decision === 'always') chat.alwaysAllowed.delete(pending.tool);
      const item = chat.items.find(i => i.id === pending.itemId);
      if (item?.kind === 'permission') this.put(id, chat, { ...item, status: 'expired' });
      failTurn?.(tr("ส่งคำตอบไปยัง Claude ไม่สำเร็จ โปรดลองส่งอีกครั้ง"));
    };
    if (!this.writeLive(pending.live, { type: "control_response", response: { subtype: "success", request_id: requestId, response } }, failed)) { chat.permissions.delete(requestId); failed(); return false; }
    chat.permissions.delete(requestId);
    if (decision === "always") chat.alwaysAllowed.add(pending.tool);
    const item = chat.items.find((i) => i.id === pending.itemId);
    if (item?.kind === "permission") this.put(id, chat, { ...item, status: decision === "deny" ? "denied" : decision === "always" ? "always" : "allowed" });
    return true;
  }

  /** Let a live Claude finish on its own: close its input, then make sure it is gone. */
  private closeLive(chat: Chat) {
    const lv = chat.live;
    if (!lv) return;
    chat.live = undefined;
    clearTimeout(lv.idle); clearTimeout(lv.stopTimer);
    lv.onLine = undefined; lv.onClose = undefined; lv.onWriteFailure = undefined;
    if (lv.closed) return;
    lv.closed = true;
    try { lv.proc.stdin?.end(); } catch {}
    setTimeout(() => { if (lv.proc.exitCode === null) this.kill(lv.proc); }, 3000).unref?.();
  }

  private sendApi(id: string, request: ChatRequest, options: { queue?: boolean; interrupt?: boolean }): 'sent' | 'queued' | 'interrupted' {
    const chat = this.chat(id), text = request.text.trim();
    if (!text || text.length > MAX_PROMPT) throw new Error(tr("กรุณาระบุข้อความไม่เกิน 20,000 ตัวอักษร"));
    if (!supportsChatPermission(request.agent, request.permission || 'read')) throw new Error(tr("API รองรับสิทธิ์ read, edit และ auto"));
    if (request.attachments?.length) throw new Error(tr("ห้อง API ยังไม่รองรับรูป/PDF แนบ ให้ระบุชื่อไฟล์ข้อความในโปรเจกต์เพื่อให้เครื่องมืออ่าน"));
    // Resolve credentials before accepting the turn; no provider secret enters history.
    const controller = new AbortController();
    const provider = this.options.apiProvider ? this.options.apiProvider(request.agent, request.model, controller.signal) : cloudKeys.create(request.agent, request.model, controller.signal);
    if (chat.running) {
      if (!options.queue && !options.interrupt) throw new Error(tr("ยังตอบข้อความก่อนหน้าอยู่"));
      const queued = { id: randomUUID(), text, request };
      if (options.interrupt && chat.apiAbort) {
        chat.queue.unshift(queued); this.emitQueue(chat); this.cancel(id); chat.interrupting = true; return 'interrupted';
      }
      chat.queue.push(queued); this.emitQueue(chat); return 'queued';
    }
    const prefix = `t${++chat.turns}`;
    this.put(id, chat, { id: `${prefix}-user`, kind: 'user', text, request: { text, model: request.model, permission: request.permission, responseStyle: request.responseStyle } });
    chat.running = true; chat.cancelled = false; chat.apiAbort = controller;
    chat.activity = { startedAt: Date.now(), outputTokens: 0 };
    this.emit(chat, { type: 'state', running: true }); this.emit(chat, { type: 'activity', activity: chat.activity }); this.onChange?.(id);
    const system = contextualPrompt(formatRulesForPrompt(getProjectRules(request.cwd).rules), request.projectContext, request.responseStyle)
      + '\n' + questionRules() + (chat.seed ? `\nประวัติอ้างอิง:\n${chat.seed}` : '');
    void runApiConversation({ provider, cwd: request.cwd, signal: controller.signal, prefix, permission: request.permission || 'read',
      history: [...chat.items], system, onItem: item => { if (this.chats.get(id) === chat) this.put(id, chat, item); } }).catch(error => {
      if (!controller.signal.aborted && this.chats.get(id) === chat) this.put(id, chat, { id: `${prefix}-error`, kind: 'error', text: String(error.message || tr("เรียก API ไม่สำเร็จ")) });
    }).finally(() => {
      if (this.chats.get(id) !== chat) return;
      const interrupted = chat.cancelled && chat.interrupting;
      if (controller.signal.aborted) {
        for (const item of chat.items) if (item.kind === 'tool' && item.status === 'running' && item.id.startsWith(`${prefix}-`)) this.put(id, chat, { ...item, status: 'failed' });
        this.put(id, chat, { id: `${prefix}-stopped`, kind: 'notice', text: interrupted ? tr("หยุดเพื่อรับข้อความใหม่") : tr("หยุดแล้ว") });
      } else this.collectQuestions(id, chat, prefix, provider.name);
      chat.running = false; chat.apiAbort = undefined; chat.activity = undefined; chat.interrupting = false;
      this.emit(chat, { type: 'activity' }); this.emit(chat, { type: 'state', running: false });
      this.save(id, chat, true); this.onChange?.(id);
      if ((!chat.cancelled || interrupted) && chat.queue.length) setImmediate(() => this.sendNext(id));
    });
    return 'sent';
  }

  private kill(proc: ChildProcess) {
    if (process.platform === "win32" && proc.pid) execFile("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true }, () => {});
    else if (proc.pid) { try { process.kill(-proc.pid, "SIGKILL"); } catch { proc.kill(); } }
    else proc.kill?.();
  }

  private emitQueue(chat: Chat) {
    this.emit(chat, { type: "queue", queued: chat.queue.map(({ id, text, attachments }) => ({ id, text, attachments })) });
  }

  /** Acknowledge silence and wait again without sending another prompt or starting a process. */
  wait(id: string): boolean {
    const chat = this.chats.get(id);
    if (!chat?.running || chat.cancelled || !chat.wait || !chat.activity?.quiet) return false;
    chat.wait();
    return true;
  }

  /** Send the oldest queued message (or the one asked for) now; a failure is shown in the chat. */
  sendNext(id: string, queuedId?: string): boolean {
    const chat = this.chat(id);
    if (chat.running) return false;
    const index = queuedId ? chat.queue.findIndex((q) => q.id === queuedId) : 0;
    if (index < 0 || !chat.queue[index]) return false;
    const [next] = chat.queue.splice(index, 1);
    this.emitQueue(chat);
    try {
      this.send(id, next.request);
    } catch (error: any) {
      this.put(id, chat, { id: `q-${next.id}`, kind: "error", text: tr`ส่งข้อความในคิวไม่สำเร็จ: ${error.message}` });
    }
    return true;
  }

  /** Take a message out of the queue before it is sent. */
  unqueue(id: string, queuedId: string): boolean {
    const chat = this.chat(id);
    const before = chat.queue.length;
    chat.queue = chat.queue.filter((q) => q.id !== queuedId);
    if (chat.queue.length === before) return false;
    this.emitQueue(chat);
    return true;
  }

  cancel(id: string): boolean {
    const chat = this.chats.get(id);
    if (chat?.apiAbort && chat.running) { chat.cancelled = true; chat.interrupting = false; chat.apiAbort.abort(); return true; }
    const proc = chat?.proc;
    if (!chat || !proc) return false;
    chat.cancelled = true;
    // A plain stop wins over an interrupt still waiting for the CLI to exit: the queue stays paused.
    chat.interrupting = false;
    const lv = chat.live;
    if (lv && lv.proc === proc && !lv.closed) {
      // Like Esc in Claude: stop the turn, keep the process (and its conversation) for the next one.
      for (const [requestId] of chat.permissions) this.answerPermission(id, requestId, "deny");
      this.writeLive(lv, { type: "control_request", request_id: `interrupt-${randomUUID()}`, request: { subtype: "interrupt" } });
      clearTimeout(lv.stopTimer);
      lv.stopTimer = setTimeout(() => { if (chat.running && chat.proc === proc) this.kill(proc); }, 5000);
      lv.stopTimer.unref?.();
      return true;
    }
    this.kill(proc);
    return true;
  }

  /** Delete a session's chat, including its saved history. */
  drop(id: string) {
    this.cancel(id);
    const dropped = this.chats.get(id);
    if (dropped) this.closeLive(dropped);
    clearTimeout(this.chats.get(id)?.saveTimer);
    this.chats.delete(id);
    const file = this.file(id);
    if (file) fs.rmSync(file, { force: true });
  }

  /** Stop running turns and write pending history (app quit). */
  stopAll() {
    for (const [id, chat] of this.chats) {
      this.cancel(id);
      this.closeLive(chat);
      if (chat.saveTimer) this.save(id, chat, true);
    }
  }
}
