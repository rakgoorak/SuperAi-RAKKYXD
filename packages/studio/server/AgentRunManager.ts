import { accounts } from "./Accounts.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  AgentLoop,
  createDefaultTools,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  LLMProvider,
  createProvider,
} from "@superai-rakkyxd/core";
import { CliProvider, attachmentProblem } from "./CliProvider.js";
import { CLOUD_PROVIDERS, cloudKeys, isCloud } from "./CloudKeys.js";
import { cliLaunch } from "./CliCatalog.js";
import { Seat, validateSeat } from "./Providers.js";
import { skillPrompt } from "./ChatSkills.js";
import { contextualPrompt, contextForAgent, type ProjectContext } from './ProjectContext.js';
import type { ResponseStyle } from './ResponseStyle.js';
import type { TokenUsage } from './CliRunStream.js';
import { ASK_RULES, extractJson, parseQuestions, type ClarifyAnswer, type ClarifyQuestion } from "./Questions.js";
import { tr } from './i18n.js';
export { extractJson, parseQuestions };
export type { ClarifyAnswer, ClarifyQuestion };

export function ollamaBase() {
  const value = process.env.SUPERAI_OLLAMA_URL || "http://127.0.0.1:11434";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value)) throw new Error(tr("Ollama URL ต้องเป็นบริการในเครื่อง"));
  return value;
}

export class LocalProvider implements LLMProvider {
  name = "ollama";
  constructor(
    public model: string,
    private signal: AbortSignal,
  ) {}
  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const res = await fetch(`${ollamaBase()}/v1/chat/completions`, {
      method: "POST",
      signal: this.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          tool_call_id: m.toolCallId,
          tool_calls: m.toolCalls?.map((t) => ({
            id: t.id,
            type: "function",
            function: { name: t.name, arguments: JSON.stringify(t.arguments) },
          })),
        })),
        ...(tools?.length
          ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }
          : {}),
      }),
    });
    if (!res.ok) throw new Error(tr`Ollama ตอบกลับ ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const data = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error(tr("Ollama ไม่ส่งข้อความตอบกลับ"));
    return {
      text: message.content || "",
      ...(Number.isFinite(data.usage?.prompt_tokens) && Number.isFinite(data.usage?.completion_tokens) ? { usage: { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.prompt_tokens + data.usage.completion_tokens } } : {}),
      toolCalls: message.tool_calls?.map((t: any) => ({
        id: t.id || randomUUID(),
        name: t.function.name,
        arguments: typeof t.function.arguments === "string" ? JSON.parse(t.function.arguments) : t.function.arguments,
      })),
    };
  }
  async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, tools?: ToolDefinition[]) {
    const result = await this.generate(messages, tools);
    if (result.text) onChunk(result.text);
    return result;
  }
}

export type RunStatus = "running" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";

/** One Chat participant's answer, kept separately so the user sees who said what. */
export interface PanelAnswer {
  seat: Seat;
  status: StepStatus;
  output: string;
  error?: string;
  startedAt?: number;
  firstChunkAt?: number;
  completedAt?: number;
  tokenCount?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  /** Index into run.subagents. */
  assignee: number;
  instructions: string;
  dependsOn: string[];
  status: StepStatus;
  output: string;
  error?: string;
}

export interface Activity {
  at: number;
  who: string;
  text: string;
}

export interface Clarification {
  by: string;
  intro: string;
  questions: ClarifyQuestion[];
  status: "waiting" | "answered" | "skipped" | "cancelled";
  /** Keyed by question id; a missing key means the user skipped that question. */
  answers?: Record<string, ClarifyAnswer>;
}

export interface UsageStep { stage: string; seat: string; provider: string; calls: TokenUsage[]; status: 'running' | 'completed' | 'failed'; missing: boolean; }

export interface ConversationRun {
  projectContext?: ProjectContext;
  responseStyle?: ResponseStyle;
  id: string;
  wsId: string;
  prompt: string;
  mode: "chat" | "agent";
  status: RunStatus;
  /** Chat: the summary. Agent: Main's final report. */
  output: string;
  error?: string;
  createdAt: number;
  allowTools: boolean;
  attachments?: string[];
  activity: Activity[];
  clarify?: Clarification;
  usageSteps?: UsageStep[];
  // Chat
  panel?: PanelAnswer[];
  summarizer?: Seat | null;
  summaryStyle?: "merge" | "best";
  summaryStatus?: StepStatus;
  // Agent
  main?: Seat;
  subagents?: Seat[];
  stage?: "asking" | "planning" | "working" | "summarizing" | RunStatus;
  plan?: string;
  tasks?: AgentTask[];
}

export interface ChatRequest {
  projectContext?: ProjectContext;
  responseStyle?: ResponseStyle;
  prompt: string;
  panel: unknown;
  summarizer?: unknown;
  summaryStyle?: unknown;
  attachments?: string[];
  clarify?: boolean;
}
export interface AgentRequest {
  projectContext?: ProjectContext;
  responseStyle?: ResponseStyle;
  prompt: string;
  main: unknown;
  subagents: unknown;
  allowTools?: boolean;
  attachments?: string[];
  clarify?: boolean;
}

const MAX_PANEL = 5;
const MAX_SUBAGENTS = 6;
const MAX_TASKS = 10;
const describe = (seat: Seat) => {
    const tool = seat.provider.startsWith("cli:") ? seat.provider.slice(4) : isCloud(seat.provider) ? cloudKeys.status(seat.provider).name : `ollama:${seat.provider}`;
  return [tool, seat.model, seat.effort && `effort ${seat.effort}`].filter(Boolean).join(" · ");
};

/** Turn the user's choices into text the AI can follow; skipped questions leave the call to the AI. */
export function describeAnswers(clarify: Clarification) {
  const lines = clarify.questions.map((q) => {
    const a = clarify.answers?.[q.id];
    const picked = [...(a?.selected || []), ...(a?.other ? [a.other] : [])];
    return `- ${q.question}\n  คำตอบ: ${picked.length ? picked.join(", ") : "ข้าม (ตัดสินใจเองตามที่เหมาะสม และบอกว่าเลือกอะไร)"}`;
  });
  return `คำตอบของผู้ใช้ต่อคำถามที่ ${clarify.by} ถามไว้:\n${lines.join("\n")}`;
}


/** Validate Main's plan: known assignees, unique ids, dependencies that exist and contain no cycles. */
export function parsePlan(raw: string, subagentCount: number): { note: string; tasks: AgentTask[] } {
  let data: any;
  try {
    data = extractJson(raw);
  } catch {
    throw new Error(tr("แผนของ Main ไม่ใช่ JSON ที่อ่านได้ ลองใหม่ หรือเลือกรุ่นที่เก่งขึ้นเป็น Main"));
  }
  const list = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(list) || !list.length) throw new Error(tr("Main ไม่ได้แบ่งงานให้ Sub-agent"));
  if (list.length > MAX_TASKS) throw new Error(tr`Main แบ่งงานเกิน ${MAX_TASKS} งาน`);
  const ids = list.map((item: any, index: number) => String(item?.id || `t${index + 1}`).slice(0, 40));
  if (new Set(ids).size !== ids.length) throw new Error(tr("แผนของ Main มีรหัสงานซ้ำกัน"));
  const tasks: AgentTask[] = list.map((item: any, index: number) => {
    const assignee = Number(item?.assignee ?? item?.agent ?? item?.subagent) - 1;
    if (!Number.isInteger(assignee) || assignee < 0 || assignee >= subagentCount)
      throw new Error(tr`แผนของ Main มอบงานให้ Sub-agent ที่ไม่มีอยู่ (งาน ${index + 1})`);
    if (typeof item.instructions !== "string" || !item.instructions.trim()) throw new Error(tr`งาน ${index + 1} ไม่มีคำสั่ง`);
    const dependsOn = (Array.isArray(item.dependsOn) ? item.dependsOn : []).map(String);
    if (dependsOn.some((d: string) => !ids.includes(d) || d === ids[index])) throw new Error(tr`งาน ${index + 1} อ้างงานก่อนหน้าที่ไม่มีอยู่`);
    return {
      id: ids[index],
      title: String(item.title || tr`งาน ${index + 1}`).slice(0, 200),
      assignee,
      instructions: item.instructions.slice(0, 12000),
      dependsOn,
      status: "pending" as const,
      output: "",
    };
  });
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(tr("แผนของ Main มีงานที่รอกันเป็นวง"));
    visiting.add(id);
    tasks.find((t) => t.id === id)!.dependsOn.forEach(visit);
    visiting.delete(id);
    done.add(id);
  };
  tasks.forEach((t) => visit(t.id));
  return { note: typeof data?.note === "string" ? data.note.slice(0, 2000) : "", tasks };
}

export class AgentRunManager {
  private runs = new Map<string, ConversationRun>();
  private controllers = new Map<string, AbortController>();
  /** Runs paused on clarifying questions, resumed by answer(). */
  private waiters = new Map<string, () => void>();
  constructor(private file = path.join(os.homedir(), ".opencode-multi", "superai-conversations.json")) {
    try {
      for (const r of JSON.parse(fs.readFileSync(file, "utf8"))) {
        // Runs from v1.2 (mode "assistant" with a fixed team) stay readable as plain history.
        const run = { activity: [], allowTools: false, ...r, mode: r.mode === "chat" ? "chat" : "agent" };
        if (r.mode === "assistant") delete run.tasks;
        if (run.status === "running") run.status = "cancelled";
        if (run.clarify?.status === "waiting") run.clarify.status = "cancelled";
        for (const seat of [run.main, ...(run.subagents || []), ...(run.panel || []).map((a: PanelAnswer) => a.seat), run.summarizer]) {
          if (seat?.provider?.startsWith("cli:") && !seat.accountId) seat.accountId = "system";
        }
        this.runs.set(run.id, run);
      }
    } catch {}
  }
  list(wsId: string) {
    return [...this.runs.values()].filter((r) => r.wsId === wsId);
  }
  usesAccount(accountId: string) {
    return [...this.runs.values()].some(run => [run.main, ...(run.subagents || []), ...(run.panel || []).map(a => a.seat), run.summarizer].some(seat => seat?.accountId === accountId));
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + ".tmp", JSON.stringify([...this.runs.values()].slice(-150)));
    fs.renameSync(this.file + ".tmp", this.file);
  }

  private begin(wsId: string, prompt: string, attachments: string[], seats: Seat[]) {
    if (!prompt.trim() || prompt.length > 50000) throw new Error(tr("กรุณาระบุคำสั่งไม่เกิน 50,000 ตัวอักษร"));
    if (this.list(wsId).some((r) => r.status === "running"))
      throw new Error(tr("โปรเจกต์นี้มีงานกำลังทำอยู่ กรุณารอหรือหยุดงานก่อน"));
    for (const seat of seats) {
      if (seat.provider.startsWith("cli:")) { accounts.resolve(seat.provider.slice(4), seat.accountId || undefined); cliLaunch(seat.provider.slice(4)); }
      // Without a key the provider would answer with its own "apiKey not set" text instead of failing.
      if (isCloud(seat.provider) && !cloudKeys.key(seat.provider))
        throw new Error(tr`${seat.name}: ยังไม่ได้ใส่ API Key ของ ${cloudKeys.status(seat.provider).name} เปิด การตั้งค่า > API Key เพื่อเชื่อมต่อ`);
      const problem = attachmentProblem(seat.provider, attachments);
      if (problem) throw new Error(`${seat.name}: ${problem}`);
    }
    return attachments.length
      ? `${prompt}\n\nไฟล์แนบ (อ่านจากตำแหน่งนี้ได้):\n${attachments.map((file) => `- "${file}"`).join("\n")}`
      : prompt;
  }

  private launch(run: ConversationRun, work: (controller: AbortController, note: (who: string, text: string) => void) => Promise<void>) {
    const controller = new AbortController();
    this.runs.set(run.id, run);
    this.controllers.set(run.id, controller);
    try {
      this.save();
    } catch (error) {
      this.runs.delete(run.id);
      this.controllers.delete(run.id);
      throw error;
    }
    const note = (who: string, text: string) => {
      if (controller.signal.aborted) return;
      run.activity.push({ at: Date.now(), who, text: text.slice(0, 600) });
      run.activity = run.activity.slice(-200);
    };
    void (async () => {
      try {
        await work(controller, note);
        if (controller.signal.aborted) {
          run.status = "cancelled";
          run.error = tr("ยกเลิกงานแล้ว");
        }
      } catch (err: any) {
        run.status = controller.signal.aborted ? "cancelled" : "failed";
        run.error = controller.signal.aborted ? tr("ยกเลิกงานแล้ว") : `${err.message}`;
      } finally {
        if (run.status === "running") run.status = "completed";
        if (run.mode === "agent") run.stage = run.status;
        const stop = (s: StepStatus): StepStatus => (s === "pending" || s === "running" ? "cancelled" : s);
        if (run.clarify?.status === "waiting") run.clarify.status = "cancelled";
        if (run.status !== "completed") {
          run.tasks?.forEach((t) => (t.status = stop(t.status)));
          run.panel?.forEach((a) => {
            a.status = stop(a.status);
            if (!a.completedAt && (a.status === "cancelled" || a.status === "failed")) {
              a.completedAt = Date.now();
            }
          });
          if (run.summaryStatus) run.summaryStatus = stop(run.summaryStatus);
        }
        this.controllers.delete(run.id);
        try {
          this.save();
        } catch {
          run.status = "failed";
          run.error = tr("บันทึกประวัติไม่ได้ กรุณาตรวจสิทธิ์เขียนและพื้นที่ว่าง");
        }
      }
    })();
    return run;
  }

  private provider(seat: Seat, cwd: string, signal: AbortSignal, tools: boolean, readTools: boolean, attachments: string[], onUsage?: (usage: TokenUsage) => void): LLMProvider {
    if (isCloud(seat.provider)) return cloudKeys.create(seat.provider, seat.model || undefined, signal);
    if (seat.provider.startsWith("cli:")) {
      return new CliProvider(seat.provider, cwd, signal, tools, seat.model, readTools, attachments, seat.effort, onUsage, undefined, seat.accountId || accounts.resolve(seat.provider.slice(4)));
    }
    const cloud = ["deepseek", "groq", "openrouter", "openai", "anthropic", "gemini", "openai_compatible"];
    if (cloud.includes(seat.provider)) {
      return createProvider({
        provider: seat.provider as any,
        // The key saved in Settings; other providers keep reading their own stored credentials.
        apiKey: (isCloud(seat.provider) && cloudKeys.key(seat.provider)) || undefined,
        model: seat.model || undefined,
      });
    }
    return new LocalProvider(seat.provider, signal);
  }

  /** Run one prompt on a seat. CLIs use their own tools; Ollama gets SuperAi's file tools when allowed. */
  private async ask(seat: Seat, prompt: string, cwd: string, signal: AbortSignal, opts: { tools: boolean; readTools: boolean; attachments: string[]; onChunk: (t: string) => void; projectContext?: ProjectContext; responseStyle?: ResponseStyle; run: ConversationRun; stage: string }) {
    const record: UsageStep = { stage: opts.stage, seat: seat.name, provider: seat.provider, calls: [], status: 'running', missing: false };
    (opts.run.usageSteps ||= []).push(record);
    const seatContext = contextForAgent(opts.projectContext, seat.provider);
    prompt = contextualPrompt(prompt, seatContext, opts.responseStyle);
    const provider = this.provider(seat, cwd, signal, opts.tools, opts.readTools, opts.attachments, usage => record.calls.push(usage));
    try {
    if (seat.provider.startsWith("cli:")) {
      const result = await provider.stream([{ role: "user", content: prompt }], opts.onChunk);
      record.missing = !record.calls.length || record.calls.some(call => call.input === undefined || call.output === undefined);
      record.status = 'completed';
      return result.text;
    }
    const originalStream = provider.stream.bind(provider);
    provider.stream = async (...args) => {
      const response = await originalStream(...args);
      const u = response.usage;
      if (u && Number.isFinite(u.promptTokens) && Number.isFinite(u.completionTokens)) record.calls.push({ input: u.promptTokens, output: u.completionTokens });
      else record.missing = true;
      return response;
    };
    const loop = new AgentLoop(
      { id: randomUUID(), name: seat.name, role: "assistant", systemPrompt: "ตอบเป็นภาษาไทย บอกตามจริงเมื่อไม่มีเครื่องมือเข้าถึงไฟล์", maxSteps: 15 },
      provider,
      opts.tools ? createDefaultTools() : [],
    );
    const result = await loop.run(prompt, { cwd, abortSignal: signal, onStream: opts.onChunk });
    if (!result.success) throw new Error(result.error || tr("งานไม่สำเร็จ"));
    record.status = 'completed';
    return result.output;
    } catch (error) { record.status = 'failed'; record.missing = true; throw error; }
  }


  /** Show the questions, then wait until the user answers or skips (or the run is cancelled). Returns text for the next prompt. */
  private async waitForAnswers(run: ConversationRun, by: string, asked: { intro: string; questions: ClarifyQuestion[] }, signal: AbortSignal, note: (who: string, text: string) => void) {
    run.clarify = { by, intro: asked.intro, questions: asked.questions, status: "waiting" };
    note(by, tr`ขอถามคุณ ${asked.questions.length} ข้อก่อนเริ่ม`);
    await new Promise<void>((resolve) => {
      const done = () => {
        signal.removeEventListener("abort", done);
        this.waiters.delete(run.id);
        resolve();
      };
      signal.addEventListener("abort", done, { once: true });
      this.waiters.set(run.id, done);
    });
    if (signal.aborted) return "";
    note(tr("คุณ"), run.clarify.status === "skipped" ? tr("ข้ามคำถาม ให้ AI ตัดสินใจเอง") : tr("ตอบคำถามแล้ว"));
    return describeAnswers(run.clarify);
  }

  /** The user's reply to a run's clarifying questions. Omit answers (or a question) to skip it. */
  answer(id: string, body: { answers?: unknown; skip?: unknown }) {
    const run = this.runs.get(id);
    const resume = this.waiters.get(id);
    if (!run?.clarify || run.clarify.status !== "waiting" || !resume) throw new Error(tr("งานนี้ไม่ได้รอคำตอบอยู่"));
    const given = body.skip === true || !body.answers || typeof body.answers !== "object" ? {} : (body.answers as Record<string, any>);
    const answers: Record<string, ClarifyAnswer> = {};
    for (const q of run.clarify.questions) {
      const a = given[q.id];
      if (!a || typeof a !== "object") continue;
      const labels = q.options.map((o) => o.label);
      const selected = (Array.isArray(a.selected) ? a.selected : []).map(String).filter((s: string) => labels.includes(s));
      const other = typeof a.other === "string" ? a.other.trim().slice(0, 500) : "";
      if (!q.multiSelect && selected.length + (other ? 1 : 0) > 1) throw new Error(tr`“${q.header || q.question}” เลือกได้ข้อเดียว`);
      if (selected.length || other) answers[q.id] = { selected: Array.from(new Set(selected)), other };
    }
    run.clarify.answers = answers;
    run.clarify.status = Object.keys(answers).length ? "answered" : "skipped";
    resume();
    return run;
  }

  private history(wsId: string, mode: "chat" | "agent") {
    const runs = this.list(wsId).filter((r) => r.mode === mode && r.status === "completed");
    if (!runs.length) return "";
    return runs
      .slice(-6)
      .map((r, i, arr) => {
        const isLatest = i === arr.length - 1;
        const answer = (r.output || r.panel?.find((a) => a.status === "completed")?.output || "").trim();
        const compactAnswer = isLatest
          ? answer.slice(0, 1800)
          : (answer.length > 350 ? answer.slice(0, 350) + "… [ย่อผลลัพธ์รอบก่อนเพื่อประหยัด Token]" : answer);
        const prompt = isLatest ? r.prompt : (r.prompt.length > 200 ? r.prompt.slice(0, 200) + "…" : r.prompt);
        return `ผู้ใช้: ${prompt}${r.clarify?.status === "answered" ? `\n${describeAnswers(r.clarify)}` : ""}\nคำตอบ: ${compactAnswer}`;
      })
      .join("\n\n");
  }

  /** Chat: one prompt to several AIs at once, then an optional summarizer that credits each one. */
  startChat(wsId: string, cwd: string, body: ChatRequest) {
    if (!Array.isArray(body.panel) || body.panel.length < 1 || body.panel.length > MAX_PANEL)
      throw new Error(tr`เลือก Main 1–${MAX_PANEL} ตัว`);
    const panel = body.panel.map((s, i) => validateSeat(s, `Main ${i + 1}`));
    const summarizer = body.summarizer ? validateSeat(body.summarizer, tr("ผู้สรุป")) : null;
    const style = body.summaryStyle === "best" ? "best" : "merge";
    const attachments = body.attachments || [];
    const prompt = this.begin(wsId, String(body.prompt || ""), attachments, summarizer ? [...panel, summarizer] : panel);
    const history = this.history(wsId, "chat");
    const clarify = body.clarify === true;
    const run: ConversationRun = {
      id: randomUUID(), wsId, prompt, mode: "chat", status: "running", output: "", createdAt: Date.now(), allowTools: false, attachments, activity: [], projectContext: body.projectContext, responseStyle: body.responseStyle,
      panel: panel.map((seat) => ({ seat, status: clarify ? "pending" : "running", output: "", startedAt: Date.now() })),
      summarizer, summaryStyle: style, summaryStatus: summarizer ? "pending" : undefined,
    };
    return this.launch(run, async (controller, note) => {
      let question = `${history ? `บทสนทนาก่อนหน้า:\n${history}\n\n` : ""}${prompt}`;
      if (clarify) {
        const screener = summarizer || panel[0];
        note(screener.name, tr("ตรวจว่าคำถามชัดพอหรือยัง"));
        let reply = "";
        try {
          reply = await this.ask(screener, `คุณคือผู้ช่วยตรวจคำถามก่อนส่งให้ AI หลายตัวตอบ\n${question}\n\nถ้าคำถามชัดพอจะตอบได้ดีแล้ว ให้ตอบ {"questions":[]} เท่านั้น\nถ้ายังกำกวม ให้ถามผู้ใช้กลับเป็นภาษาไทยแบบมีตัวเลือก\n${ASK_RULES}\nตอบเป็น JSON อย่างเดียว ไม่ต้องมีคำอธิบายอื่น`, cwd, controller.signal, {
            tools: false, readTools: true, attachments, projectContext: run.projectContext, responseStyle: run.responseStyle, run, stage: tr("ตรวจคำถาม"), onChunk: () => {},
          });
        } catch (err: any) {
          if (controller.signal.aborted) return;
          note(screener.name, tr`ตรวจคำถามไม่สำเร็จ ส่งคำถามเดิมให้ทุกตัว: ${err.message}`);
        }
        const asked = parseQuestions(reply);
        if (asked) question += `\n\n${await this.waitForAnswers(run, screener.name, asked, controller.signal, note)}`;
        if (controller.signal.aborted) return;
        run.panel!.forEach((a) => (a.status = "running"));
      }
      const clarifyingContext = run.clarify ? `\n\n${describeAnswers(run.clarify)}` : "";
      const basePrompt = `${prompt}${clarifyingContext}`;
      await Promise.all(
        run.panel!.map(async (answer) => {
          answer.startedAt = Date.now();
          note(answer.seat.name, tr`เริ่มคิด (${describe(answer.seat)})`);
          try {
            const selected = answer.seat.provider.startsWith("cli:") ? skillPrompt(basePrompt, cwd, answer.seat.provider.slice(4), undefined, undefined, accounts.environment(answer.seat.provider.slice(4), answer.seat.accountId || "system")) : basePrompt;
            const fullQuestion = `${history ? `บทสนทนาก่อนหน้า:\n${history}\n\n` : ""}${selected}`;
            const text = await this.ask(answer.seat, `ตอบเป็นภาษาไทย ให้เหตุผลประกอบ\n\n${fullQuestion}`, cwd, controller.signal, {
              tools: false, readTools: true, attachments, projectContext: run.projectContext, responseStyle: run.responseStyle, run, stage: tr("ตอบคำถาม"),
              onChunk: (t) => {
                if (!controller.signal.aborted) {
                  if (!answer.firstChunkAt) answer.firstChunkAt = Date.now();
                  answer.tokenCount = (answer.tokenCount || 0) + Math.max(1, Math.ceil(t.length / 4));
                  answer.output += t;
                }
              },
            });
            answer.output = text || answer.output;
            answer.status = "completed";
            answer.completedAt = Date.now();
            if (!answer.tokenCount && answer.output) {
              answer.tokenCount = Math.max(1, Math.ceil(answer.output.length / 4));
            }
            note(answer.seat.name, tr("ตอบเสร็จแล้ว"));
          } catch (err: any) {
            answer.status = controller.signal.aborted ? "cancelled" : "failed";
            answer.error = err.message;
            answer.completedAt = Date.now();
            note(answer.seat.name, tr`ตอบไม่สำเร็จ: ${err.message}`);
          }
        }),
      );
      if (controller.signal.aborted) return;
      const answered = run.panel!.filter((a) => a.status === "completed");
      if (!answered.length) throw new Error(tr("ไม่มี AI ตัวไหนตอบสำเร็จ ตรวจการเข้าสู่ระบบและโควตาของแต่ละ CLI"));
      if (!summarizer) return;
      run.summaryStatus = "running";
      note(summarizer.name, tr`เริ่มสรุป (${describe(summarizer)})`);
      const answers = run.panel!
        .map((a) => `### ${a.seat.name} (${describe(a.seat)})\n${a.status === "completed" ? a.output : tr`ตอบไม่สำเร็จ: ${a.error}`}`)
        .join("\n\n");
      const instructions = style === "best"
        ? "คัดเฉพาะความเห็นที่ถูกต้องและมีประโยชน์ที่สุด ตัดส่วนที่ผิด ซ้ำ หรืออ่อนออก และบอกสั้นๆ ว่าตัดอะไรออกเพราะอะไร"
        : "รวมความเห็นที่มีประโยชน์จากทุกตัวเข้าด้วยกันให้ครบ";
      const summaryPrompt = `คุณคือผู้สรุปความเห็นจาก AI หลายตัวให้ผู้ใช้ ตอบเป็นภาษาไทย
คำถามของผู้ใช้:
${prompt}${run.clarify ? `\n\n${describeAnswers(run.clarify)}` : ""}

คำตอบจาก AI แต่ละตัว:
${answers}

${instructions}
ระบุชื่อ AI ทุกครั้งที่อ้างความเห็น (เช่น "${answered[0].seat.name} แนะนำว่า…") ห้ามแต่งความเห็นที่ไม่มีในคำตอบ
จัดรูปแบบเป็นหัวข้อ:
## สรุปคำตอบ
## ใครเสนออะไร
## จุดที่เห็นตรงกัน / ต่างกัน
## คำแนะนำสุดท้าย`;
      try {
        const text = await this.ask(summarizer, summaryPrompt, cwd, controller.signal, {
          tools: false, readTools: false, attachments: [], projectContext: run.projectContext, responseStyle: run.responseStyle, run, stage: tr("สรุปคำตอบ"),
          onChunk: (t) => { if (!controller.signal.aborted) run.output += t; },
        });
        run.output = text || run.output;
        run.summaryStatus = "completed";
        note(summarizer.name, tr("สรุปเสร็จแล้ว"));
      } catch (err: any) {
        run.summaryStatus = "failed";
        throw new Error(tr`ผู้สรุป (${summarizer.name}) ทำงานไม่สำเร็จ: ${err.message} — คำตอบของแต่ละ AI ยังอยู่ด้านบน`);
      }
    });
  }

  /** Agent: Main plans and assigns tasks; Sub-agents work in parallel (respecting dependencies); Main reports. */
  startAgent(wsId: string, cwd: string, body: AgentRequest) {
    const main = validateSeat(body.main, "Main");
    if (!Array.isArray(body.subagents) || body.subagents.length < 1 || body.subagents.length > MAX_SUBAGENTS)
      throw new Error(tr`เลือก Sub-agent 1–${MAX_SUBAGENTS} ตัว`);
    const subagents = body.subagents.map((s, i) => validateSeat(s, `Sub-agent ${i + 1}`));
    const allowTools = body.allowTools === true;
    const attachments = body.attachments || [];
    const prompt = this.begin(wsId, String(body.prompt || ""), attachments, [main, ...subagents]);
    const history = this.history(wsId, "agent");
    const run: ConversationRun = {
      id: randomUUID(), wsId, prompt, mode: "agent", status: "running", output: "", createdAt: Date.now(), allowTools, attachments, activity: [], projectContext: body.projectContext, responseStyle: body.responseStyle,
      main, subagents, stage: "planning", tasks: [],
    };
    return this.launch(run, async (controller, note) => {
      const signal = controller.signal;
      const roster = subagents.map((s, i) => `${i + 1}. ${s.name} — ${describe(s)}`).join("\n");
      note(main.name, tr("กำลังวางแผนและแบ่งงาน"));
      const planPrompt = (answers: string, mayAsk: boolean) => {
        let text = "คุณคือ Main agent หัวหน้าทีม AI ที่ทำงานในโฟลเดอร์โปรเจกต์ของผู้ใช้\n" +
          (history ? `งานก่อนหน้าในโปรเจกต์นี้:\n${history}\n\n` : "") +
          `เป้าหมายของผู้ใช้:\n${prompt}\n` +
          (answers ? `\n${answers}\n` : "") +
          `Sub-agent ที่มี (ใช้หมายเลขเป็น assignee):\n${roster}\n\n` +
          (allowTools ? "Sub-agent แก้ไฟล์และรันคำสั่งได้" : "Sub-agent อ่านไฟล์ได้อย่างเดียว ห้ามสั่งให้แก้ไฟล์ ให้เสนอโค้ดหรือขั้นตอนแทน") +
          `\nแบ่งงานเป็น 1-${MAX_TASKS} งาน งานที่ไม่มี dependsOn จะทำพร้อมกัน ดังนั้นงานที่ทำพร้อมกันห้ามแก้ไฟล์เดียวกัน\n` +
          "ถ้างานต้องใช้ผลของงานอื่นให้ใส่ id ของงานนั้นใน dependsOn เลือก Sub-agent ให้เหมาะกับงาน\n" +
          "ตอบเป็น JSON อย่างเดียว ไม่ต้องมีคำอธิบายอื่น:\n" +
          "{\"note\":\"แนวทางโดยย่อ (ภาษาไทย)\",\"tasks\":[{\"id\":\"t1\",\"title\":\"ชื่องาน\",\"assignee\":1,\"instructions\":\"คำสั่งละเอียด\",\"dependsOn\":[]}]}";
        if (mayAsk) {
          text += `\n\nก่อนวางแผน ตรวจคำขอและไฟล์ในโปรเจกต์ก่อน ถ้าเป้าหมายยังกำกวมจนแผนอาจผิดทาง ให้ถามผู้ใช้กลับเป็นภาษาไทยแทนการส่งแผน\n${ASK_RULES}`;
        }
        return text;
      };
      const askMain = async (text: string) => {
        try {
          return await this.ask(main, text, cwd, signal, { tools: false, readTools: true, attachments, projectContext: run.projectContext, onChunk: () => {}, run, stage: tr("วางแผน") });
        } catch (err: any) {
          throw new Error(tr`Main (${main.name}) วางแผนไม่สำเร็จ: ${err.message}`);
        }
      };
      let planText = await askMain(planPrompt("", body.clarify === true));
      if (signal.aborted) return;
      const asked = body.clarify === true ? parseQuestions(planText) : null;
      if (asked) {
        run.stage = "asking";
        const answers = await this.waitForAnswers(run, main.name, asked, signal, note);
        if (signal.aborted) return;
        run.stage = "planning";
        note(main.name, tr("ได้คำตอบแล้ว กำลังวางแผนและแบ่งงาน"));
        planText = await askMain(planPrompt(answers, false));
        if (signal.aborted) return;
      }
      const plan = parsePlan(planText, subagents.length);
      const goal = run.clarify ? `${prompt}\n${describeAnswers(run.clarify)}` : prompt;
      run.plan = plan.note;
      run.tasks = plan.tasks;
      run.stage = "working";
      note(main.name, tr`แบ่งงานแล้ว ${plan.tasks.length} งาน${plan.note ? ` · ${plan.note}` : ""}`);
      for (const t of plan.tasks) note(main.name, tr`มอบ “${t.title}” ให้ ${subagents[t.assignee].name}`);

      const tasks = run.tasks;
      const resultOf = (id: string) => tasks.find((t) => t.id === id)!;
      while (!signal.aborted) {
        for (const t of tasks)
          if (t.status === "pending" && t.dependsOn.some((d) => ["failed", "skipped", "cancelled"].includes(resultOf(d).status))) {
            t.status = "skipped";
            t.error = tr("ข้ามเพราะงานที่ต้องทำก่อนไม่สำเร็จ");
            note(subagents[t.assignee].name, tr`ข้าม “${t.title}”`);
          }
        const ready = tasks.filter((t) => t.status === "pending" && t.dependsOn.every((d) => resultOf(d).status === "completed"));
        if (!ready.length) break;
        // Each Sub-agent runs one task at a time; different Sub-agents run in parallel.
        const wave = ready.filter((t, i) => ready.findIndex((o) => o.assignee === t.assignee) === i);
        await Promise.all(
          wave.map(async (t) => {
            const seat = subagents[t.assignee];
            t.status = "running";
            note(seat.name, tr`เริ่ม “${t.title}”`);
            const context = t.dependsOn.map((d) => `[ผลจาก ${resultOf(d).title} โดย ${subagents[resultOf(d).assignee].name}]\n${resultOf(d).output}`).join("\n\n");
            const taskPrompt = `คุณคือ ${seat.name} Sub-agent ในทีม ทำงานในโฟลเดอร์โปรเจกต์ของผู้ใช้ ตอบเป็นภาษาไทย
เป้าหมายรวมของผู้ใช้: ${goal}
${plan.note ? `แนวทางจาก Main: ${plan.note}\n` : ""}${context ? `\n${context}\n` : ""}
งานของคุณ (${t.title}):
${t.instructions}

${allowTools ? "แก้ไฟล์/รันคำสั่งได้เท่าที่จำเป็นกับงานนี้ ห้ามแก้ไฟล์ที่ไม่เกี่ยวข้อง" : "อ่านไฟล์ได้อย่างเดียว ห้ามแก้ไฟล์"}
จบด้วยสรุปสั้นๆ ว่าทำอะไรไปจริง ไฟล์ไหนเปลี่ยน และผลตรวจ/ทดสอบที่ทำจริง`;
            try {
              const text = await this.ask(seat, taskPrompt, cwd, signal, {
                tools: allowTools, readTools: true, attachments, projectContext: run.projectContext, run, stage: tr`งาน: ${t.title}`,
                onChunk: (c) => { if (!signal.aborted) t.output = (t.output + c).slice(-60000); },
              });
              t.output = text || t.output;
              t.status = "completed";
              note(seat.name, tr`ส่งงาน “${t.title}” แล้ว`);
            } catch (err: any) {
              t.status = signal.aborted ? "cancelled" : "failed";
              t.error = err.message;
              note(seat.name, tr`“${t.title}” ไม่สำเร็จ: ${err.message}`);
            }
          }),
        );
      }
      if (signal.aborted) return;
      run.stage = "summarizing";
      note(main.name, tr("กำลังตรวจผลและสรุปให้ผู้ใช้"));
      const report = tasks
        .map((t) => `### ${t.title} — ${subagents[t.assignee].name} (${t.status})\n${t.output || t.error || tr("ไม่มีผลลัพธ์")}`)
        .join("\n\n");
      try {
        const text = await this.ask(main, `คุณคือ Main agent ทุก Sub-agent ทำงานเสร็จแล้ว
เป้าหมายของผู้ใช้: ${goal}

ผลงานของแต่ละ Sub-agent:
${report}

ตอบเป็นภาษาไทย สรุปเฉพาะสิ่งที่เกิดขึ้นจริง: ใครทำอะไร ไฟล์ที่เปลี่ยน ผลทดสอบ งานที่ล้มเหลวหรือยังไม่ได้ทำ และขั้นตอนถัดไปที่แนะนำ ห้ามอ้างว่าสำเร็จถ้ามีงานไม่สำเร็จ`, cwd, signal, {
          tools: false, readTools: true, attachments: [], projectContext: run.projectContext, responseStyle: run.responseStyle, run, stage: tr("สรุปงาน"),
          onChunk: (c) => { if (!signal.aborted) run.output += c; },
        });
        run.output = text || run.output;
        note(main.name, tr("สรุปผลเสร็จแล้ว"));
      } catch (err: any) {
        throw new Error(tr`Main (${main.name}) สรุปผลไม่สำเร็จ: ${err.message}`);
      }
      if (!tasks.every((t) => t.status === "completed")) {
        run.status = "failed";
        run.error = tr("มีงานย่อยไม่สำเร็จ ดูรายละเอียดของแต่ละ Sub-agent ด้านบน");
      }
    });
  }

  cancel(id: string) {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    controller.abort();
    return true;
  }
  running() {
    return [...this.runs.values()].some((run) => run.status === "running");
  }
  usesCli(id: string) {
    const seat = `cli:${id}`;
    return [...this.runs.values()].some(
      (run) =>
        run.status === "running" &&
        [...(run.panel?.map((a) => a.seat) || []), run.summarizer, run.main, ...(run.subagents || [])].some((s) => s?.provider === seat),
    );
  }
  clear(wsId: string) {
    if (this.list(wsId).some((r) => r.status === "running")) throw new Error(tr("หยุดงานก่อนล้างประวัติ"));
    for (const r of this.list(wsId)) this.runs.delete(r.id);
    this.save();
  }
  stop() {
    for (const c of this.controllers.values()) c.abort();
  }
}
