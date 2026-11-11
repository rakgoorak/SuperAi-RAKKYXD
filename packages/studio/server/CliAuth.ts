import { execFile } from "node:child_process";
import { accounts, AccountRegistry } from "./Accounts.js";
import { loadStoredAuth } from "@superai-rakkyxd/core";
import { cliEnv, cliLaunch, findExecutable, getCliDefinition, incompleteInstall } from "./CliCatalog.js";

export type AuthState = "authenticated" | "login-required" | "unknown" | "not-installed";
export interface CliAuthStatus { id: string; status: AuthState; note: string; checkedAt: number; loginCommand: string }
export const LOGIN_ARGS: Record<string, string[]> = {
  "claude-code": ["auth", "login"], codex: ["login"], opencode: ["auth", "login"], antigravity: [], freebuff: [],
};

export const CLOUD_BYOK_KEYS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

// Match authentication failures, not quota, network, model-access, or generic HTTP 403 failures.
export function isAuthFailure(text: string): boolean {
  return /not (?:logged|signed) in|please (?:log|sign) in|authentication (?:required|failed)|unauthenticated|invalid (?:api[ _-]?key|credential|authentication)|(?:access|refresh|oauth|auth|authentication)[ _-]?token[^\n]{0,35}(?:expired|invalid|revoked)|(?:expired|invalid)[^\n]{0,20}(?:access|refresh|oauth)[ _-]?token|login required|run [`'"]?(?:claude auth login|codex login|opencode auth login)|no (?:stored )?credentials|missing (?:api[ _-]?key|authentication|credentials)/i.test(text);
}

interface Probe { code: number | string | null; stdout: string; stderr: string }
type Runner = (id: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<Probe>;
const run: Runner = async (id, args, env) => {
  const launch = cliLaunch(id, args);
  return new Promise((resolve) => execFile(launch.command, launch.args, {
    env: { ...env, ...cliEnv(), NO_COLOR: "1" }, windowsHide: true,
    timeout: 8000, maxBuffer: 128 * 1024,
  }, (error, stdout, stderr) => resolve({ code: error ? error.code ?? null : 0, stdout, stderr })));
};

export class CliAuthManager {
  private cache = new Map<string, CliAuthStatus>();
  private pending = new Map<string, Promise<CliAuthStatus>>();
  constructor(private runner: Runner = run, private installed = (id: string) => {
    const executable = findExecutable(getCliDefinition(id).command);
    return !!executable && !incompleteInstall(id, executable);
  }, private registry: AccountRegistry = accounts) {}

  private result(id: string, status: AuthState, note: string): CliAuthStatus {
    if (id in CLOUD_BYOK_KEYS) {
      return { id, status, note, checkedAt: Date.now(), loginCommand: "การตั้งค่า > API Key" };
    }
    const definition = getCliDefinition(id);
    return { id, status, note, checkedAt: Date.now(), loginCommand: [definition.command, ...(LOGIN_ARGS[id] || [])].join(" ") };
  }
  async get(id: string, refresh = false, accountId = "system"): Promise<CliAuthStatus> {
    this.registry.resolve(id, accountId);
    const key = `${id}:${accountId}`;
    if (!(id in LOGIN_ARGS) && !(id in CLOUD_BYOK_KEYS)) throw new Error("ไม่รู้จักผู้ให้บริการนี้");
    const cached = this.cache.get(key);
    if (!refresh && cached && Date.now() - cached.checkedAt < 15000) return cached;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.probe(id, accountId).then((status) => { this.cache.set(key, status); return status; }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  private async probe(id: string, accountId: string): Promise<CliAuthStatus> {
    if (id in CLOUD_BYOK_KEYS) {
      const keyName = CLOUD_BYOK_KEYS[id];
      const hasEnv = !!process.env[keyName];
      let hasStored = false;
      try {
        const stored = loadStoredAuth(id);
        hasStored = !!stored[id];
      } catch {}
      if (hasEnv || hasStored) {
        return this.result(id, "authenticated", "พร้อมใช้งาน (มี API Key แล้ว)");
      }
      return this.result(id, "login-required", "ยังไม่ได้ใส่ API Key เปิด การตั้งค่า > API Key เพื่อเชื่อมต่อ");
    }

    if (!this.installed(id)) return this.result(id, "not-installed", "ยังไม่พบ CLI กรุณาติดตั้งก่อนเข้าสู่ระบบ");
    if (id === "antigravity" || id === "freebuff")
      return this.result(id, "unknown", "ตรวจบัญชีอัตโนมัติไม่ได้ เปิด Terminal เพื่อเข้าสู่ระบบหรือตรวจบัญชีของ CLI");
    try {
      const r = await this.runner(id, id === "codex" ? ["login", "status"] : id === "claude-code" ? ["auth", "status"] : ["auth", "list"], this.registry.environment(id, accountId));
      if (id === "claude-code") {
        try {
          const data = JSON.parse(r.stdout);
          if (data.loggedIn === true && r.code === 0) return this.result(id, "authenticated", "เข้าสู่ระบบแล้ว");
          if (data.loggedIn === false || data.authMethod === "none") return this.result(id, "login-required", "ยังไม่ได้เข้าสู่ระบบ กรุณาเปิดขั้นตอนเข้าสู่ระบบก่อนส่งข้อความ");
        } catch {}
      }
      if (id === "codex" && r.code === 0 && /logged in/i.test(r.stdout + r.stderr))
        return this.result(id, "authenticated", "เข้าสู่ระบบแล้ว");
      // OpenCode can use free models and environment-based credentials. An empty auth
      // list is not evidence that the selected model needs an account.
      if (id !== "opencode" && isAuthFailure(r.stdout + "\n" + r.stderr))
        return this.result(id, "login-required", "บัญชียังไม่พร้อมหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      return this.result(id, "unknown", id === "opencode"
        ? "บัญชีขึ้นกับ model ที่เลือก รุ่นฟรีบางรุ่นใช้ได้โดยไม่ล็อกอิน · ตั้งค่าผู้ให้บริการได้ใน Terminal"
        : "ยังยืนยันสถานะบัญชีไม่ได้ เปิด Terminal เพื่อตรวจบัญชี แล้วกดตรวจอีกครั้ง");
    } catch {
      return this.result(id, "unknown", "ตรวจสถานะบัญชีไม่สำเร็จ ลองใหม่หรือเปิด Terminal เพื่อตรวจสอบ");
    }
  }
  /** Drop the cached status after the user changes a key. */
  forget(id: string, accountId = "system") { this.cache.delete(`${id}:${accountId}`); }
  failure(id: string, text: string, accountId = "system") {
    if (id in CLOUD_BYOK_KEYS && isAuthFailure(text)) {
      this.cache.set(`${id}:${accountId}`, this.result(id, "login-required", "API Key ไม่ถูกต้องหรือหมดอายุ เปิด การตั้งค่า > API Key เพื่อใส่ใหม่"));
      return;
    }
    if (id in LOGIN_ARGS && isAuthFailure(text)) this.cache.set(`${id}:${accountId}`, this.result(id, "login-required", "บัญชียังไม่พร้อมหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองส่งอีกครั้ง"));
  }
  async requireReady(id: string, accountId = "system") {
    // OpenCode never needs an account to start (free models, keys in its own config), so its
    // account check could not block anything: skip `opencode auth list`, about 2 s per message.
    if (id === "opencode") {
      this.registry.resolve(id, accountId);
      if (this.installed(id)) return;
      const missing = this.result(id, "not-installed", "ยังไม่พบ CLI กรุณาติดตั้งก่อนเข้าสู่ระบบ");
      throw new Error(`${getCliDefinition(id).name}: ${missing.note} (${missing.loginCommand})`);
    }
    const auth = await this.get(id, false, accountId);
    if (id in CLOUD_BYOK_KEYS) {
      if (auth.status === "login-required") {
        throw new Error(`${id}: ${auth.note}`);
      }
      return;
    }
    if (auth.status === "not-installed" || (auth.status === "login-required" && id !== "opencode"))
      throw new Error(`${getCliDefinition(id).name}: ${auth.note} (${auth.loginCommand})`);
  }
}
export const cliAuth = new CliAuthManager();
