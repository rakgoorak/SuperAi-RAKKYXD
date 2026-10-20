import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LLMProvider, LLMMessage, LLMResponse } from "@opencode-multi/core";
import { cliLaunch, cliPath } from "./CliCatalog.js";

export function promptArguments(
  id: string,
  allowTools: boolean,
  inputFile?: string,
  modelOverride = "",
  allowReadTools = false,
): string[] {
  if (id === "claude-code")
    return [
      "-p",
      "--output-format",
      "text",
      ...(modelOverride ? ["--model", modelOverride] : []),
      ...(allowTools ? [] : ["--permission-mode", "plan", "--tools", allowReadTools ? "Read,Grep,Glob" : ""]),
    ];
  if (id === "codex")
    return [
      "exec",
      ...(modelOverride ? ["--model", modelOverride] : []),
      "--skip-git-repo-check",
      "--sandbox",
      allowTools ? "workspace-write" : "read-only",
      "--color",
      "never",
      "-",
    ];
  if (id === "opencode") {
    if (!inputFile) throw new Error("ไม่พบไฟล์คำขอ");
    return [
      "run",
      "--agent",
      allowTools ? "build" : "plan",
      ...(modelOverride ? ["--model", modelOverride] : []),
      "--file",
      inputFile,
      "--",
      "อ่านคำขอและบริบททั้งหมดจากไฟล์แนบ แล้วตอบเป็นภาษาไทย",
    ];
  }
  throw new Error("CLI นี้รองรับเฉพาะ terminal กรุณาใช้โหมดโค้ด");
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
    const temporary =
      id === "opencode"
        ? await fs.mkdtemp(path.join(os.tmpdir(), "superai-prompt-"))
        : null;
    const inputFile = temporary
      ? path.join(temporary, "request.txt")
      : undefined;
    try {
      if (inputFile) await fs.writeFile(inputFile, prompt, "utf8");
      if (this.signal.aborted) throw new Error("ยกเลิกงานแล้ว");
      const launch = cliLaunch(
        id,
        promptArguments(id, this.allowTools, inputFile, this.modelOverride, this.allowReadTools),
      );
      return await new Promise<LLMResponse>((resolve, reject) => {
        const proc = spawn(launch.command, launch.args, {
          cwd: this.cwd,
          detached: process.platform !== 'win32',
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PATH: cliPath(), NO_COLOR: "1", FORCE_COLOR: "0" },
        });
        proc.stdin.on("error", () => {});
        proc.stdin.end(id === "opencode" ? undefined : prompt, "utf8");
        proc.stdout.setEncoding("utf8");
        proc.stderr.setEncoding("utf8");
        let output = "",
          errors = "";
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
          output += text;
          onChunk(text);
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
          if (code !== 0)
            return reject(
              new Error(`${this.model}: ${errors || output || `exit ${code}`}`),
            );
          resolve({ text: output.replace(/\x1b\[[0-9;]*m/g, "").trim() });
        });
      });
    } finally {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    }
  }
}
