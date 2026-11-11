import { accounts } from "./Accounts.js";
import fs from "node:fs";
import { cloudKeys, isCloud } from "./CloudKeys.js";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cliLaunch, listOpenCodeModels } from "./CliCatalog.js";

/** One AI seat: which tool runs it, which model and how hard it should think. */
export interface Seat {
  accountId?: string;
  name: string;
  provider: string; // "cli:<id>" or an Ollama model name
  model: string; // "" = the CLI's own default
  effort: string; // "" = the CLI's own default
}

/** CLIs that can answer a prompt without a terminal (used by Agent and Chat). */
export const HEADLESS_CLIS = ["claude-code", "codex", "antigravity", "opencode"];

export interface ProviderProfile {
  id: string;
  efforts: string[];
  /** Models we can offer before asking the CLI; users may type any other name. */
  suggestedModels: string[];
  effortNote?: string;
}

export const PROVIDER_PROFILES: Record<string, ProviderProfile> = {
  "claude-code": {
    id: "claude-code",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    suggestedModels: ["opus", "sonnet", "haiku", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
  },
  codex: {
    id: "codex",
    efforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
    suggestedModels: [],
  },
  antigravity: {
    id: "antigravity",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    suggestedModels: [],
  },
  opencode: {
    id: "opencode",
    efforts: ["minimal", "low", "medium", "high", "max"],
    suggestedModels: [],
    effortNote: "OpenCode ส่ง effort เป็น --variant ซึ่งแต่ละผู้ให้บริการรองรับต่างกัน",
  },
  freebuff: { id: "freebuff", efforts: [], suggestedModels: [] },
  deepseek: {
    id: "deepseek",
    efforts: [],
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  groq: {
    id: "groq",
    efforts: [],
    suggestedModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b"],
  },
  openrouter: {
    id: "openrouter",
    efforts: [],
    suggestedModels: ["deepseek/deepseek-r1", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-flash"],
  },
};

const SAFE = /^[\w.:/@+-]*$/;
export function validateSeat(value: unknown, label = "ผู้ช่วย"): Seat {
  const s = value as any;
  if (!s || typeof s.provider !== "string" || !s.provider.trim() || s.provider.length > 150)
    throw new Error(`${label}: กรุณาเลือกผู้ให้บริการ`);
  const name = typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 60) : label;
  const model = typeof s.model === "string" ? s.model.trim() : "";
  const effort = typeof s.effort === "string" ? s.effort.trim() : "";
  if (model.length > 200 || !SAFE.test(model) || model.startsWith("-")) throw new Error(`${label}: ชื่อรุ่นไม่ถูกต้อง`);
  const provider = s.provider.trim();
  if (provider.startsWith("cli:")) {
    const id = provider.slice(4);
    if (!HEADLESS_CLIS.includes(id))
      throw new Error(`${label}: CLI นี้ใช้ได้เฉพาะโหมด Code (ไม่มีโหมดสั่งงานเบื้องหลัง)`);
    if (effort && !PROVIDER_PROFILES[id].efforts.includes(effort)) throw new Error(`${label}: ระดับ effort ไม่ถูกต้อง`);
  } else if (!SAFE.test(provider) || provider.startsWith("-")) throw new Error(`${label}: ชื่อรุ่น Ollama ไม่ถูกต้อง`);
  return { name, provider, model, effort: provider.startsWith("cli:") ? effort : "", ...(provider.startsWith("cli:") ? { accountId: accounts.resolve(provider.slice(4), s.accountId) } : {}) };
}

/** Efforts agy accepts today; its model names end in the level they run at (`gemini-4-argon-high`). */
export const ANTIGRAVITY_EFFORTS = ["low", "medium", "high"];
const AGY_LEVEL = /-(low|medium|high|xhigh|max)$/;

/** Flags that select model and effort, shared by headless runs and terminal sessions. */
export function modelEffortArgs(id: string, model = "", effort = "", interactive = false): string[] {
  const args: string[] = [];
  if (id === "antigravity") {
    // agy refuses a model whose name already carries a level together with another --effort, and
    // no model goes above "high": either mistake fails the turn before it starts.
    if (model) args.push("--model", model);
    if (effort && !AGY_LEVEL.test(model)) args.push("--effort", ANTIGRAVITY_EFFORTS.includes(effort) ? effort : "high");
  } else if (id === "claude-code") {
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);
  } else if (id === "codex") {
    if (model) args.push("--model", model);
    if (effort) args.push("-c", `model_reasoning_effort="${effort}"`);
  } else if (id === "opencode") {
    if (model) args.push("--model", model);
    // The OpenCode TUI has no --variant flag; only `opencode run` accepts it.
    if (effort && !interactive) args.push("--variant", effort);
  }
  return args;
}

function codexCachedModels(env: NodeJS.ProcessEnv = process.env): { models: string[]; efforts: Record<string, string[]> } {
  const home = env.CODEX_HOME || path.join(os.homedir(), ".codex");
  try {
    const data = JSON.parse(fs.readFileSync(path.join(home, "models_cache.json"), "utf8"));
    const efforts: Record<string, string[]> = {};
    const models: string[] = [];
    for (const m of Array.isArray(data.models) ? data.models : []) {
      const slug = m?.slug;
      if (typeof slug !== "string" || !slug || !SAFE.test(slug) || m.visibility === 'hide' || models.includes(slug)) continue;
      models.push(slug);
      const levels = (m.supported_reasoning_levels || []).map((e: any) => e?.effort || e).filter((e: any) => typeof e === "string");
      if (levels.length) efforts[slug] = levels;
    }
    return { models, efforts };
  } catch {
    return { models: [], efforts: {} };
  }
}

async function antigravityModels(): Promise<string[]> {
  const launch = cliLaunch("antigravity", ["models"]);
  const { stdout } = await promisify(execFile)(launch.command, launch.args, { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  return stdout.split(/\r?\n/).map((line) => line.split("\t")[0].trim()).filter((m) => /^[\w.-]+$/.test(m) && m.includes("-"));
}

export interface ModelList { models: string[]; efforts: string[]; modelEfforts?: Record<string, string[]>; note?: string }

/** Models a provider offers right now. Failures fall back to suggestions plus free typing. */
export async function listModels(id: string, accountId = "system"): Promise<ModelList> {
  if (isCloud(id)) return { models: await cloudKeys.models(id), efforts: [] };
  const env = accounts.environment(id, accountId);
  const profile = PROVIDER_PROFILES[id];
  if (!profile) throw new Error("ไม่รู้จักผู้ให้บริการนี้");
  const base = { efforts: profile.efforts, note: profile.effortNote };
  try {
    if (id === "codex") {
      const cached = codexCachedModels(env);
      return { ...base, models: cached.models, modelEfforts: cached.efforts, note: cached.models.length ? "รายชื่อมาจาก Codex บางรุ่นอาจใช้กับแพ็กเกจ ChatGPT ของคุณไม่ได้" : "ยังไม่พบรายชื่อรุ่น เปิด Codex ในโหมด Code หนึ่งครั้งเพื่อให้ CLI ดึงรายชื่อ หรือพิมพ์ชื่อรุ่นเอง" };
    }
    if (id === "antigravity") {
      const models = await antigravityModels();
      // A model named with its level leaves nothing to choose, so the effort box is hidden for it.
      const modelEfforts = Object.fromEntries(models.filter((m) => AGY_LEVEL.test(m)).map((m) => [m, []]));
      return { ...base, efforts: ANTIGRAVITY_EFFORTS, models, modelEfforts, note: "ชื่อรุ่นของ Antigravity บอกระดับ effort อยู่แล้ว (-low / -medium / -high) จึงไม่ต้องเลือก effort ซ้ำ" };
    }
    if (id === "opencode") return { ...base, models: await listOpenCodeModels(env) };
    if (isCloud(id)) {
      const models = await cloudKeys.models(id);
      return models.length ? { ...base, models } : { ...base, models: profile.suggestedModels, note: "ใส่ API Key ที่ การตั้งค่า > API Key เพื่อดูรายชื่อรุ่นทั้งหมด" };
    }
  } catch {
    return { ...base, ...(id === "antigravity" ? { efforts: ANTIGRAVITY_EFFORTS } : {}), models: profile.suggestedModels, note: "ดึงรายชื่อรุ่นจาก CLI ไม่สำเร็จ ตรวจการติดตั้ง/เข้าสู่ระบบ หรือพิมพ์ชื่อรุ่นเอง" };
  }
  return { ...base, models: profile.suggestedModels };
}
