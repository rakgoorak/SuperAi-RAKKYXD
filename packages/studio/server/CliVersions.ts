import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { cliLaunch, cliEnv, findExecutable, getCliDefinition } from "./CliCatalog.js";

/**
 * Installed vs latest version of each AI CLI, and updating it with the CLI's own updater,
 * so an outdated CLI is updated before a session opens instead of updating itself mid-tab.
 */
export const VERSIONED_CLIS = ["claude-code", "codex", "antigravity", "opencode", "freebuff"];
const NPM_PACKAGE: Record<string, string> = {
  "claude-code": "@anthropic-ai/claude-code",
  codex: "@openai/codex",
  opencode: "opencode-ai",
  freebuff: "freebuff",
};
// Each CLI's own update command. Freebuff has none: it updates itself whenever it starts.
const UPDATE_ARGS: Record<string, string[]> = {
  "claude-code": ["update"],
  codex: ["update"],
  antigravity: ["update"],
  opencode: ["upgrade"],
  freebuff: ["--version"],
};

export function parseVersion(text: string): string | null {
  return /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/.exec(text)?.[1] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [main, pre = ""] = v.replace(/^v/i, "").split("-", 2);
    return { parts: main.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.parts.length, y.parts.length); i++) {
    const d = (x.parts[i] || 0) - (y.parts[i] || 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  return !x.pre ? 1 : !y.pre ? -1 : x.pre < y.pre ? -1 : 1;
}

export interface CliVersion {
  id: string;
  name: string;
  installed: string | null;
  latest: string | null;
  status: "latest" | "outdated" | "unknown" | "not-installed" | "error";
  note?: string;
  checkedAt: number;
}
export interface UpdateJob {
  id: string;
  cliId: string;
  status: "running" | "completed" | "failed";
  log: string;
  error?: string;
  before: string | null;
  after?: string | null;
  startedAt: number;
}

interface Deps {
  installed: (id: string) => boolean;
  run: (id: string, args: string[], timeout: number) => Promise<string>;
  latest: (pkg: string) => Promise<string | null>;
  spawnUpdate: (id: string, args: string[]) => ChildProcess;
  /** Where versions the CLI itself confirmed as latest are kept (CLIs not published on npm). */
  confirmedFile?: string;
}

// What a CLI's own updater prints when the installed version is the newest one.
export const CONFIRMED_LATEST = /already (on|using|running|at|have) (the )?(latest|newest|most recent)|(is|are|already) up[ -]to[ -]date|no (new )?updates? (available|found)|successfully (updated|upgraded|installed)|updated to (version )?v?\d/i;

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r(?!\n)/g, "\n");

const defaultDeps: Deps = {
  installed: (id) => !!findExecutable(getCliDefinition(id).command),
  run: async (id, args, timeout) => {
    const launch = cliLaunch(id, args);
    const { stdout, stderr } = await promisify(execFile)(launch.command, launch.args, {
      windowsHide: true, timeout, maxBuffer: 1024 * 1024, cwd: os.tmpdir(),
      env: { ...process.env, ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    return stripAnsi(`${stdout}\n${stderr}`);
  },
  latest: async (pkg) => {
    const res = await fetch(`https://registry.npmjs.org/${pkg.replace("/", "%2F")}/latest`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  },
  spawnUpdate: (id, args) => {
    const launch = cliLaunch(id, args);
    return spawn(launch.command, launch.args, {
      windowsHide: true, cwd: os.tmpdir(), stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0", CI: "1" },
    });
  },
  confirmedFile: path.join(os.homedir(), ".opencode-multi", "superai-cli-latest.json"),
};

export class CliVersionManager {
  private cache = new Map<string, CliVersion>();
  private latestCache = new Map<string, { at: number; value: string | null }>();
  private jobs: UpdateJob[] = [];
  /** Versions a CLI's own updater said are the latest, for CLIs whose latest we cannot look up. */
  private confirmed: Record<string, string> = {};
  constructor(private deps: Deps = defaultDeps) {
    try {
      if (deps.confirmedFile) this.confirmed = JSON.parse(fs.readFileSync(deps.confirmedFile, "utf8")) || {};
    } catch {
      this.confirmed = {};
    }
  }

  private confirm(id: string, version: string) {
    this.confirmed[id] = version;
    if (!this.deps.confirmedFile) return;
    try {
      fs.mkdirSync(path.dirname(this.deps.confirmedFile), { recursive: true });
      fs.writeFileSync(this.deps.confirmedFile, JSON.stringify(this.confirmed));
    } catch {
      // only a convenience: the status falls back to "unknown"
    }
  }

  private async latest(id: string) {
    const pkg = NPM_PACKAGE[id];
    if (!pkg) return null;
    const hit = this.latestCache.get(pkg);
    if (hit && Date.now() - hit.at < 30 * 60_000) return hit.value;
    const value = await this.deps.latest(pkg).catch(() => null);
    this.latestCache.set(pkg, { at: Date.now(), value });
    return value;
  }

  async check(id: string, refresh = false): Promise<CliVersion> {
    const cached = this.cache.get(id);
    if (!refresh && cached && Date.now() - cached.checkedAt < 10 * 60_000) return cached;
    const name = getCliDefinition(id).name;
    let result: CliVersion;
    if (!this.deps.installed(id)) result = { id, name, installed: null, latest: null, status: "not-installed", checkedAt: Date.now() };
    else {
      const [installedText, latest] = await Promise.all([
        this.deps.run(id, ["--version"], 90_000).catch((e) => `ERROR ${e?.message || e}`),
        this.latest(id),
      ]);
      const installed = installedText.startsWith("ERROR") ? null : parseVersion(installedText);
      // No registry to ask (Antigravity): trust the CLI's own updater for the version it confirmed.
      if (!latest && installed && this.confirmed[id] === installed) {
        result = { id, name, installed, latest: installed, status: "latest", checkedAt: Date.now(), note: "CLI ยืนยันเองว่าเป็นเวอร์ชันล่าสุด (ตอนกดอัปเดตครั้งล่าสุด)" };
        this.cache.set(id, result);
        return result;
      }
      const status: CliVersion["status"] = !installed ? "error" : !latest ? "unknown" : compareVersions(installed, latest) < 0 ? "outdated" : "latest";
      result = {
        id, name, installed, latest, status, checkedAt: Date.now(),
        note: !installed ? "อ่านเวอร์ชันไม่ได้" : !latest ? (NPM_PACKAGE[id] ? "ตรวจเวอร์ชันล่าสุดไม่ได้ (ต้องมีอินเทอร์เน็ต)" : "CLI นี้ไม่บอกเวอร์ชันล่าสุด กดอัปเดตเพื่อให้ CLI ตรวจเอง") : undefined,
      };
    }
    this.cache.set(id, result);
    return result;
  }

  all(refresh = false) {
    return Promise.all(VERSIONED_CLIS.map((id) => this.check(id, refresh)));
  }

  list() {
    return this.jobs.slice(-20);
  }

  /** Run the CLI's own updater. `inUse` refuses while a tab or Agent/Chat run uses the CLI. */
  startUpdate(id: string, inUse: (id: string) => boolean): UpdateJob {
    if (!VERSIONED_CLIS.includes(id)) throw new Error("ไม่รู้จัก CLI นี้");
    if (!this.deps.installed(id)) throw new Error("ยังไม่ได้ติดตั้ง CLI นี้");
    if (this.jobs.some((j) => j.cliId === id && j.status === "running")) throw new Error("กำลังอัปเดตอยู่");
    if (inUse(id)) throw new Error("CLI นี้กำลังเปิดใช้งานอยู่ กรุณาปิดแท็บและหยุดงาน Agent/Chat ที่ใช้ตัวนี้ก่อนอัปเดต");
    const job: UpdateJob = { id: randomUUID(), cliId: id, status: "running", log: "", before: this.cache.get(id)?.installed ?? null, startedAt: Date.now() };
    this.jobs.push(job);
    let proc: ChildProcess;
    try {
      proc = this.deps.spawnUpdate(id, UPDATE_ARGS[id]);
    } catch (err: any) {
      job.status = "failed";
      job.error = err.message;
      return job;
    }
    const append = (chunk: Buffer | string) => {
      job.log = (job.log + stripAnsi(chunk.toString())).slice(-8000);
    };
    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);
    const timer = setTimeout(() => proc.kill(), 10 * 60_000);
    const done = async (code: number | null, error?: string) => {
      clearTimeout(timer);
      if (job.status !== "running") return;
      if (code === 0 && !error && !NPM_PACKAGE[id] && CONFIRMED_LATEST.test(job.log)) {
        const now = parseVersion((await this.deps.run(id, ["--version"], 90_000).catch(() => "")) || "");
        if (now) this.confirm(id, now);
      }
      const after = await this.check(id, true).catch(() => null);
      job.after = after?.installed ?? null;
      job.status = code === 0 && !error ? "completed" : "failed";
      if (job.status === "failed") job.error = error || `อัปเดตไม่สำเร็จ (exit ${code}) ดูรายละเอียดด้านล่าง`;
    };
    proc.on("error", (err) => void done(null, err.message));
    proc.on("close", (code) => void done(code));
    return job;
  }
}
