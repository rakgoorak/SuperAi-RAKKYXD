import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  AgentLoop,
  SupervisorAgent,
  createDefaultTools,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  LLMProvider,
} from "@opencode-multi/core";
import { CliProvider } from "./CliProvider.js";

export class LocalProvider implements LLMProvider {
  name = "ollama";
  constructor(
    public model: string,
    private signal: AbortSignal,
  ) {}
  async generate(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    const res = await fetch("http://127.0.0.1:11434/v1/chat/completions", {
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
          ? {
              tools: tools.map((t) => ({
                type: "function",
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
            }
          : {}),
      }),
    });
    if (!res.ok)
      throw new Error(
        `Ollama ตอบกลับ ${res.status}: ${(await res.text()).slice(0, 500)}`,
      );
    const data = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("Ollama ไม่ส่งข้อความตอบกลับ");
    return {
      text: message.content || "",
      toolCalls: message.tool_calls?.map((t: any) => ({
        id: t.id || randomUUID(),
        name: t.function.name,
        arguments:
          typeof t.function.arguments === "string"
            ? JSON.parse(t.function.arguments)
            : t.function.arguments,
      })),
    };
  }
  async stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[],
  ) {
    const result = await this.generate(messages, tools);
    if (result.text) onChunk(result.text);
    return result;
  }
}

export interface ConversationRun {
  id: string;
  wsId: string;
  prompt: string;
  mode: "chat" | "assistant";
  model: string;
  status: "running" | "completed" | "failed" | "cancelled";
  output: string;
  error?: string;
  createdAt: number;
  events: string[];
}
export class AgentRunManager {
  private runs = new Map<string, ConversationRun>();
  private controllers = new Map<string, AbortController>();
  constructor(
    private file = path.join(
      os.homedir(),
      ".opencode-multi",
      "superai-conversations.json",
    ),
  ) {
    try {
      for (const r of JSON.parse(fs.readFileSync(file, "utf8")))
        this.runs.set(r.id, {
          ...r,
          status: r.status === "running" ? "cancelled" : r.status,
        });
    } catch {}
  }
  list(wsId: string) {
    return [...this.runs.values()].filter((r) => r.wsId === wsId);
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      this.file + ".tmp",
      JSON.stringify([...this.runs.values()].slice(-150)),
    );
    fs.renameSync(this.file + ".tmp", this.file);
  }
  start(
    wsId: string,
    prompt: string,
    model: string,
    cwd: string,
    mode: "chat" | "assistant",
    allowTools = false,
    openCodeModel = "",
  ) {
    if (!prompt.trim() || prompt.length > 50000)
      throw new Error("กรุณาระบุคำสั่งไม่เกิน 50,000 ตัวอักษร");
    if (
      [...this.runs.values()].some(
        (r) => r.wsId === wsId && r.status === "running",
      )
    )
      throw new Error(
        "โปรเจกต์นี้มีงานผู้ช่วยกำลังทำอยู่ กรุณารอหรือหยุดงานก่อน",
      );
    if (!model || model.length > 150)
      throw new Error("กรุณาเลือก CLI หรือรุ่น Ollama ในการตั้งค่า");
    const run: ConversationRun = {
      id: randomUUID(),
      wsId,
      prompt,
      model,
      mode,
      status: "running",
      output: "",
      createdAt: Date.now(),
      events: [],
    };
    const controller = new AbortController();
    this.runs.set(run.id, run);
    this.controllers.set(run.id, controller);
    try {this.save();}catch(error){this.runs.delete(run.id);this.controllers.delete(run.id);throw error;}
    const provider = model.startsWith("cli:")
      ? new CliProvider(
          model,
          cwd,
          controller.signal,
          allowTools,
          openCodeModel,
        )
      : new LocalProvider(model, controller.signal);
    const note = (text: string) => {
      if (!controller.signal.aborted) {
        run.events.push(text.slice(0, 1000));
        run.events = run.events.slice(-100);
      }
    };
    const history = this.list(wsId)
      .filter(
        (r) => r.id !== run.id && r.status === "completed" && r.mode === mode,
      )
      .slice(-8)
      .map((r) => `ผู้ใช้: ${r.prompt}\nผู้ช่วย: ${r.output}`)
      .join("\n\n");
    const execute = async () => {
      try {
        if (mode === "assistant") {
          const supervisor = new SupervisorAgent(
            provider,
            allowTools ? createDefaultTools() : [],
          );
          const result = await supervisor.planAndExecute(prompt, {
            cwd,
            abortSignal: controller.signal,
            onStream: (t) => {
              if (!controller.signal.aborted) run.output += t;
            },
            onEvent: (e) =>
              note(`${e.type}: ${JSON.stringify(e.payload).slice(0, 700)}`),
          });
          if (!result.success)
            throw new Error("มีงานย่อยไม่สำเร็จ กรุณาตรวจบันทึกการทำงาน");
          run.output = result.finalSummary;
        } else {
          const loop = new AgentLoop(
            {
              id: run.id,
              name: "SuperAi",
              role: "assistant",
              systemPrompt:
                "คุณคือ SuperAi & RAKKYXD ตอบเป็นภาษาไทย ช่วยเขียนและอธิบายโค้ด บอกตามจริงเมื่อไม่มีเครื่องมือเข้าถึงไฟล์",
              maxSteps: 15,
            },
            provider,
            allowTools ? createDefaultTools() : [],
          );
          const result = await loop.run(
            `${history ? `บทสนทนาก่อนหน้า:\n${history}\n\n` : ""}${prompt}`,
            {
              cwd,
              abortSignal: controller.signal,
              onEvent: (e) => {
                if (e.type !== "chunk")
                  note(`${e.type}: ${JSON.stringify(e.payload).slice(0, 700)}`);
              },
              onStream: (t) => {
                if (!controller.signal.aborted) run.output += t;
              },
            },
          );
          if (!result.success) throw new Error(result.error || "งานไม่สำเร็จ");
          run.output = result.output || run.output;
        }
        run.status = controller.signal.aborted ? "cancelled" : "completed";
      } catch (err: any) {
        run.status = controller.signal.aborted ? "cancelled" : "failed";
        run.error = controller.signal.aborted
          ? "ยกเลิกงานแล้ว"
          : `${err.message} — ${model.startsWith("cli:") ? "ตรวจสอบการเข้าสู่ระบบและโควตาของ CLI ในโหมดโค้ด" : "ตรวจสอบว่าเปิด Ollama และดาวน์โหลด model แล้ว"}`;
      } finally {
        this.controllers.delete(run.id);
        try{this.save();}catch{run.status='failed';run.error='บันทึกประวัติไม่ได้ กรุณาตรวจสิทธิ์เขียนและพื้นที่ว่าง';}
      }
    };
    void execute();
    return run;
  }
  cancel(id: string) {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    controller.abort();
    return true;
  }
  clear(wsId: string) {
    if (this.list(wsId).some((r) => r.status === "running"))
      throw new Error("หยุดงานก่อนล้างประวัติ");
    for (const r of this.list(wsId)) this.runs.delete(r.id);
    this.save();
  }
  stop() {
    for (const c of this.controllers.values()) c.abort();
  }
}
