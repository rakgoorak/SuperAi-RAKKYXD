import { accounts } from "./Accounts.js";
import { openCodePermissionEnv } from "./OpenCodePermissions.js";
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from "node:child_process";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LLMProvider, LLMMessage, LLMResponse } from "@superai-rakkyxd/core";
import { cliLaunch, cliEnv } from "./CliCatalog.js";
import { modelEffortArgs } from "./Providers.js";
import { cliAuth, isAuthFailure } from "./CliAuth.js";
import { createCliRunStream, type TokenUsage } from './CliRunStream.js';

// Windows limits a command line to 32,767 characters; agy only takes the prompt as an argument.
const INLINE_PROMPT_LIMIT = 24000;

export function promptArguments(
  id: string,
  allowTools: boolean,
  inputFile?: string,
  modelOverride = "",
  allowReadTools = false,
  attachments: string[] = [],
  extra: { effort?: string; prompt?: string } = {},
): string[] {
  const effort = extra.effort || "";
  if (id === "claude-code")
    return [
      "-p",
      "--output-format",
      "stream-json", "--verbose",
      ...modelEffortArgs(id, modelOverride, effort),
      // Attached images/PDFs are read with the Read tool, so keep it even in read-only chat.
      ...(allowTools
        ? ["--permission-mode", "acceptEdits", "--allowedTools", "Bash,WebSearch,WebFetch"]
        : ["--permission-mode", "plan", "--tools", allowReadTools ? "Read,Grep,Glob" : attachments.length ? "Read" : ""]),
    ];
  if (id === "antigravity") {
    if (!extra.prompt) throw new Error("ไม่พบคำขอ");
    return [
      ...modelEffortArgs(id, modelOverride, effort),
      // Headless agy cannot ask for permission, so commands need an explicit opt-in.
      ...(allowTools ? ["--mode", "accept-edits", "--sandbox", "--dangerously-skip-permissions"] : ["--mode", "plan"]),
      "--output-format",
      "text",
      `--print=${extra.prompt}`,
    ];
  }
  if (id === "codex")
    return [
      "exec",
      "--json",
      ...modelEffortArgs(id, modelOverride, effort),
      "--skip-git-repo-check",
      "--sandbox",
      allowTools ? "workspace-write" : "read-only",
      "--color",
      "never",
      ...attachments.map((file) => `--image=${file}`),
      "-",
    ];
  if (id === "opencode") {
    if (!inputFile) throw new Error("ไม่พบไฟล์คำขอ");
    return [
      "run",
      "--agent",
      allowTools ? "build" : "plan",
      ...modelEffortArgs(id, modelOverride, effort),
      "--file",
      inputFile,
      ...attachments.flatMap((file) => ["--file", file]),
      "--",
      "อ่านคำขอและบริบททั้งหมดจากไฟล์แนบ แล้วตอบเป็นภาษาไทย",
    ];
  }
  throw new Error("CLI นี้รองรับเฉพาะ terminal กรุณาใช้โหมดโค้ด");
}
/** Short, actionable failure text: prefer the provider's own JSON error message over raw logs. */
export function cliFailure(provider: string, model: string, errors: string, output: string, code: number | null, accountId = "system") {
  const raw = (errors || output).replace(/\x1b\[[0-9;]*m/g, "");
  const id = provider.replace(/^cli:/, "");
  const authText = `${errors}\n${output}`.replace(/\x1b\[[0-9;]*m/g, "");
  cliAuth.failure(id, authText, accountId);
  if (isAuthFailure(authText)) return `${provider}: บัญชียังไม่พร้อมหรือหมดอายุ กรุณากดเข้าสู่ระบบในหน้าแชต หรือเปิด Terminal ของผู้ให้บริการแล้วเข้าสู่ระบบ จากนั้นกดตรวจอีกครั้ง`;

  if (/Individual quota reached|quota reached|RESOURCE_EXHAUSTED/i.test(raw)) {
    const resetMatch = raw.match(/Resets in ([0-9a-zA-Z\s]+?)(?:\.|$|,)/i);
    const resetInfo = resetMatch ? ` (รีเซ็ตใน ${resetMatch[1].trim()})` : "";
    return `${provider}: โควตาการใช้งานเต็มแล้ว${resetInfo} กรุณารอหรือสลับไปใช้โมเดลอื่น`;
  }
  if (/Unexpected server error/i.test(raw)) {
    return `${provider}: เซิร์ฟเวอร์ของผู้ให้บริการมีปัญหาชั่วคราว (Unexpected server error) กรุณาลองใหม่อีกครั้งหรือสลับโมเดล`;
  }

  const message = [...raw.matchAll(/"message"\s*:\s*"([^"]{3,400})"/g)].at(-1)?.[1];
  const modelProblem = /model.*(not supported|not found|does not exist|unknown)|Model not found/i.test(message || raw);
  const detail = message || raw.trim().split("\n").slice(-6).join("\n") || `exit ${code}`;
  const hint = modelProblem
    ? ` — รุ่น ${model || "ค่าเริ่มต้นของ CLI"} ใช้กับบัญชีนี้ไม่ได้ ลองเลือก model อื่นในช่อง Model`
    : "";
  return `${provider}: ${detail}${hint}`;
}

/** Thai reason why a chat provider cannot take these attachments, or "" when it can. */
export function attachmentProblem(provider: string, attachments: string[]): string {
  if (!attachments.length) return "";
  const id = provider.replace(/^cli:/, "");
  if (!provider.startsWith("cli:"))
    return "รุ่น Ollama บนเครื่องและ API นอกอ่านรูปหรือ PDF ที่แนบไม่ได้ กรุณาเลือก Claude Code, Codex หรือ OpenCode ในการตั้งค่า หรือส่งไฟล์ในโหมดโค้ด";
  if (!["claude-code", "codex", "opencode", "antigravity"].includes(id))
    return "CLI นี้รับไฟล์แนบในโหมดสนทนาไม่ได้ กรุณาใช้โหมดโค้ดแล้วแนบไฟล์ใน session";
  if (id === "codex" && attachments.some((file) => !/\.(png|jpe?g|gif|webp)$/i.test(file)))
    return "Codex ในโหมดสนทนารับได้เฉพาะรูป ไม่รับ PDF กรุณาใช้ Claude Code หรือ OpenCode สำหรับ PDF";
  return "";
}

export class CliProvider implements LLMProvider {
  name = "cli";
  constructor(
    public model: string,
    private cwd: string,
    private signal: AbortSignal,
    private allowTools = false,
    private modelOverride = "",
    private allowReadTools = false,
    private attachments: string[] = [],
    private effort = "",
    private onUsage?: (usage: TokenUsage) => void,
    private dependencies: { launch: typeof cliLaunch; spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcessWithoutNullStreams } = { launch: cliLaunch, spawn: (command, args, options) => spawn(command, args, options) as ChildProcessWithoutNullStreams },
    private accountId = "system",
  ) {}
  async generate(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.stream(messages, () => {});
  }
  async stream(
    messages: LLMMessage[],
    onChunk: (text: string) => void,
  ): Promise<LLMResponse> {
    if (this.signal.aborted) throw new Error("ยกเลิกงานแล้ว");
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const id = this.model.replace(/^cli:/, "");
    const longInline = id === "antigravity" && prompt.length > INLINE_PROMPT_LIMIT;
    const temporary =
      id === "opencode" || longInline
        ? await fs.mkdtemp(path.join(os.tmpdir(), "superai-prompt-"))
        : null;
    const inputFile = temporary
      ? path.join(temporary, "request.txt")
      : undefined;
    try {
      if (inputFile) await fs.writeFile(inputFile, prompt, "utf8");
      if (this.signal.aborted) throw new Error("ยกเลิกงานแล้ว");
      try { await cliAuth.requireReady(id, this.accountId); }
      catch (error) { if (this.signal.aborted) throw new Error("ยกเลิกงานแล้ว"); throw error; }
      if (this.signal.aborted) throw new Error("ยกเลิกงานแล้ว");
      const inline = longInline && inputFile
        ? `Read the full request from the file "${inputFile}" and follow it. Answer in Thai.`
        : prompt;
      const launch = this.dependencies.launch(
        id,
        [
          ...(longInline && temporary ? ["--add-dir", temporary] : []),
          ...promptArguments(id, this.allowTools, inputFile, this.modelOverride, this.allowReadTools, this.attachments, { effort: this.effort, prompt: inline }),
        ],
      );
      return await new Promise<LLMResponse>((resolve, reject) => {
        const proc = this.dependencies.spawn(launch.command, launch.args, {
          cwd: this.cwd,
          detached: process.platform !== 'win32',
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: (() => {
            const env: NodeJS.ProcessEnv = { ...accounts.environment(id, this.accountId), ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0" };
            // Same as chat: let OpenCode read the temp folder instead of ending the answer on a refused request.
            return id === "opencode" ? { ...env, ...openCodePermissionEnv(env.OPENCODE_CONFIG_CONTENT) } : env;
          })(),
        });
        proc.stdin.on("error", () => {});
        proc.stdin.end(id === "opencode" || id === "antigravity" ? undefined : prompt, "utf8");
        proc.stdout.setEncoding("utf8");
        proc.stderr.setEncoding("utf8");
        let output = "",
          errors = "";
        const structured = id === 'codex' || id === 'claude-code';
        const parser = structured ? createCliRunStream(id, onChunk) : undefined;
        let pending = '';
        const kill = () => {
          if (process.platform === "win32" && proc.pid)
            execFile(
              "taskkill",
              ["/pid", String(proc.pid), "/t", "/f"],
              { windowsHide: true },
              () => {},
            );
          else if(proc.pid) {try{process.kill(-proc.pid,'SIGKILL');}catch{proc.kill();}}
        };
        const timeout = setTimeout(kill, 600000);
        this.signal.addEventListener("abort", kill, { once: true });
        if (this.signal.aborted) kill();
        proc.stdout.on("data", (chunk) => {
          if (this.signal.aborted) return;
          const text = chunk.toString("utf8");
          if (parser) {
            pending += text;
            const lines = pending.split(/\r?\n/);
            pending = lines.pop() || '';
            lines.forEach(line => parser.line(line));
          } else { output += text; onChunk(text); }
        });
        proc.stderr.on(
          "data",
          (chunk) => (errors = (errors + chunk.toString("utf8")).slice(-4000)),
        );
        const finish = () => {
          clearTimeout(timeout);
          this.signal.removeEventListener("abort", kill);
        };
        proc.on("error", (err) => {
          finish();
          reject(err);
        });
        proc.on("close", (code) => {
          finish();
          if (this.signal.aborted) return reject(new Error("ยกเลิกงานแล้ว"));
          if (parser && pending.trim()) parser.line(pending);
          const parsed = parser?.result();
          if (parsed?.usage) this.onUsage?.(parsed.usage);
          if (parsed?.error) return reject(new Error(cliFailure(this.model, this.modelOverride, parsed.error, '', code, this.accountId)));
          if (code !== 0)
            return reject(
              new Error(cliFailure(this.model, this.modelOverride, errors, output, code, this.accountId)),
            );
          if (parsed && !parsed.finished) return reject(new Error(`${this.model}: CLI ไม่ส่งผลลัพธ์ที่สมบูรณ์`));
          resolve({ text: (parsed?.text ?? output).replace(/\x1b\[[0-9;]*m/g, "").trim() });
        });
      });
    } finally {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    }
  }
}
