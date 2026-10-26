import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cliLaunch, cliEnv, findExecutable, getCliDefinition } from "./CliCatalog.js";

/** One quota window, normalised to "percent remaining" so every provider reads the same way. */
export interface UsageWindow {
  label: string;
  group?: string;
  remainingPercent: number | null; // null = no limit / disabled
  resetsAt?: string; // ISO time when known
  resetsText?: string; // the CLI's own wording when it gives no machine-readable time
  note?: string;
}
export interface ProviderUsage {
  id: string;
  name: string;
  status: "ok" | "unsupported" | "not-installed" | "error";
  windows: UsageWindow[];
  details?: { label: string; value: string }[];
  note?: string;
  source: string;
  updatedAt: number;
  dataTime?: number; // when the provider produced the figures (Codex logs can be older)
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** `claude -p /usage`: "Current session: 53% used · resets Oct 21, 5:59pm (Asia/Bangkok)". */
export function parseClaudeUsage(text: string): UsageWindow[] {
  const windows: UsageWindow[] = [];
  for (const m of text.matchAll(/^\s*(Current [^:\n]+):\s*(\d+(?:\.\d+)?)%\s*used(?:\s*[·•-]\s*resets\s+(.+?))?\s*$/gim)) {
    const raw = m[1].trim();
    const label = /session/i.test(raw) ? "5 ชั่วโมง" : /week/i.test(raw) ? `รายสัปดาห์${/\(([^)]+)\)/.exec(raw)?.[1] ? ` (${/\(([^)]+)\)/.exec(raw)![1].replace(/all models/i, "ทุกรุ่น")})` : ""}` : raw;
    windows.push({ label, remainingPercent: clamp(100 - Number(m[2])), resetsText: m[3]?.trim() });
  }
  return windows;
}

/** Codex writes rate limits into its session logs (token_count events) or rate limit error events. */
export function parseCodexRateLimits(lines: string[]): { windows: UsageWindow[]; at?: number } | null {
  let rateLimitEvent: any = null;
  let usageErrorEvent: { ev: any; message: string } | null = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!rateLimitEvent && line.includes('"rate_limits"')) {
      try {
        const ev = JSON.parse(line);
        const lim = ev?.payload?.rate_limits ?? ev?.payload?.info?.rate_limits ?? ev?.rate_limits;
        if (lim) rateLimitEvent = ev;
      } catch {}
    }
    if (!usageErrorEvent && (line.includes('usage_limit_exceeded') || line.includes('usage limit'))) {
      try {
        const ev = JSON.parse(line);
        const errMsg = ev?.payload?.error?.message || ev?.error?.message;
        if (errMsg && /usage limit/i.test(errMsg)) {
          usageErrorEvent = { ev, message: errMsg };
        }
      } catch {}
    }
    if (rateLimitEvent && usageErrorEvent) break;
  }

  const rateLimitTime = rateLimitEvent?.timestamp ? Date.parse(rateLimitEvent.timestamp) : 0;
  const errorTime = usageErrorEvent?.ev?.timestamp ? Date.parse(usageErrorEvent.ev.timestamp) : 0;

  // If a recent turn failed due to quota limit exceeded after the last token_count:
  if (usageErrorEvent && errorTime > rateLimitTime) {
    const match = /try again at ([^.]+)/i.exec(usageErrorEvent.message);
    let resetsAt: string | undefined = undefined;
    if (match) {
      const clean = match[1].replace(/(?:st|nd|rd|th),/i, ',');
      const d = new Date(clean);
      if (!Number.isNaN(d.getTime())) resetsAt = d.toISOString();
    }
    const windows: UsageWindow[] = [
      {
        label: '5 ชั่วโมง',
        remainingPercent: 0,
        resetsAt,
        note: 'โควตาเต็ม รอรอบรีเซ็ต',
      },
    ];
    const limits = rateLimitEvent?.payload?.rate_limits ?? rateLimitEvent?.payload?.info?.rate_limits ?? rateLimitEvent?.rate_limits;
    if (limits?.secondary && typeof limits.secondary.used_percent === 'number') {
      const w = limits.secondary;
      const secResetsAt = typeof w.resets_at === 'number' ? new Date(w.resets_at * 1000).toISOString() : undefined;
      const reset = secResetsAt && Date.parse(secResetsAt) <= Date.now();
      windows.push({
        label: 'รายสัปดาห์',
        remainingPercent: reset ? 100 : clamp(100 - w.used_percent),
        resetsAt: reset ? undefined : secResetsAt,
        note: reset ? 'รีเซ็ตแล้ว' : undefined,
      });
    }
    return { windows, at: Number.isFinite(errorTime) ? errorTime : undefined };
  }

  if (rateLimitEvent) {
    const limits = rateLimitEvent?.payload?.rate_limits ?? rateLimitEvent?.payload?.info?.rate_limits ?? rateLimitEvent?.rate_limits;
    if (limits) {
      const windows: UsageWindow[] = [];
      for (const key of ['primary', 'secondary']) {
        const w = limits[key];
        if (!w || typeof w.used_percent !== 'number') continue;
        const minutes = Number(w.window_minutes) || 0;
        const label = minutes === 300 ? '5 ชั่วโมง' : minutes === 10080 ? 'รายสัปดาห์' : minutes >= 1440 ? `${Math.round(minutes / 1440)} วัน` : `${Math.round(minutes / 60)} ชั่วโมง`;
        const resetsAt = typeof w.resets_at === 'number' ? new Date(w.resets_at * 1000).toISOString() : undefined;
        // A window that has already reset is back to full, whatever the old log says.
        const reset = resetsAt && Date.parse(resetsAt) <= Date.now();
        windows.push({ label, remainingPercent: reset ? 100 : clamp(100 - w.used_percent), resetsAt: reset ? undefined : resetsAt, note: reset ? 'รีเซ็ตแล้ว' : undefined });
      }
      const at = Date.parse(rateLimitEvent.timestamp || '');
      return windows.length ? { windows, at: Number.isFinite(at) ? at : undefined } : null;
    }
  }

  return null;
}

/** `agy --print=/usage`: tab-separated "group, label, remaining, reset" rows. */
export function parseAntigravityUsage(text: string): UsageWindow[] {
  const windows: UsageWindow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split("\t").map((c) => c.trim());
    if (cells.length < 3 || !/limit/i.test(cells[1])) continue;
    const [group, rawLabel, value, reset] = cells;
    const label = /five hour/i.test(rawLabel) ? "5 ชั่วโมง" : /week/i.test(rawLabel) ? "รายสัปดาห์" : rawLabel;
    const pct = /^(\d+(?:\.\d+)?)%$/.exec(value);
    windows.push({
      group,
      label,
      remainingPercent: pct ? clamp(Number(pct[1])) : null,
      resetsAt: reset && !Number.isNaN(Date.parse(reset)) ? new Date(reset).toISOString() : undefined,
      note: pct ? undefined : value === "disabled" ? "ไม่ได้เปิดใช้" : value,
    });
  }
  return windows;
}

/** `opencode stats --days 7`: box-drawn table rows like "│Total Cost   $0.00 │". */
export function parseOpenCodeStats(text: string): { label: string; value: string }[] {
  const wanted: Record<string, string> = { "Total Cost": "ค่าใช้จ่าย 7 วัน", Sessions: "Session 7 วัน", Input: "Token ขาเข้า", Output: "Token ขาออก" };
  const out: { label: string; value: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /│\s*([A-Za-z][A-Za-z /]+?)\s{2,}(\S.*?)\s*│/.exec(line);
    if (m && wanted[m[1]] && !out.some((d) => d.label === wanted[m[1]])) out.push({ label: wanted[m[1]], value: m[2] });
  }
  return out;
}

async function runCli(id: string, args: string[], timeout = 60000) {
  const launch = cliLaunch(id, args);
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await promisify(execFile)(launch.command, launch.args, {
        windowsHide: true,
        timeout,
        maxBuffer: 2 * 1024 * 1024,
        cwd: os.tmpdir(),
        env: { ...process.env, ...cliEnv(), NO_COLOR: "1", FORCE_COLOR: "0" },
      });
      return stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    } catch (err: any) {
      if (attempt < 2 && /database is locked|SQLITE_BUSY/i.test(String(err?.message || err))) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function newestCodexLog(): Promise<string | null> {
  const root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
  // sessions/YYYY/MM/DD/rollout-*.jsonl: walk newest folders first.
  const newestDir = async (dir: string) => (await fsp.readdir(dir).catch(() => [] as string[])).filter((n) => /^\d+$/.test(n)).sort().reverse();
  for (const y of await newestDir(root))
    for (const m of await newestDir(path.join(root, y)))
      for (const d of await newestDir(path.join(root, y, m))) {
        const dir = path.join(root, y, m, d);
        const files = (await fsp.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
        const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fsp.stat(path.join(dir, f))).mtimeMs })));
        stats.sort((a, b) => b.t - a.t);
        for (const { f } of stats) {
          const file = path.join(dir, f);
          const size = (await fsp.stat(file)).size;
          const fd = await fsp.open(file, "r");
          try {
            const length = Math.min(size, 512 * 1024);
            const buffer = Buffer.alloc(length);
            await fd.read(buffer, 0, length, size - length);
            const text = buffer.toString("utf8");
            if (text.includes('"rate_limits"') || text.includes('usage_limit_exceeded') || text.includes('usage limit')) return text;
          } finally {
            await fd.close();
          }
        }
      }
  return null;
}

type Probe = () => Promise<Omit<ProviderUsage, "id" | "name" | "updatedAt">>;

const PROBES: Record<string, Probe> = {
  "claude-code": async () => {
    const windows = parseClaudeUsage(await runCli("claude-code", ["-p", "/usage"]));
    if (!windows.length) return { status: "error", windows, source: "claude /usage", note: "อ่านผล /usage ไม่ได้ ตรวจว่าเข้าสู่ระบบด้วยบัญชี Claude (Pro/Max) แล้ว" };
    return { status: "ok", windows, source: "claude /usage" };
  },
  codex: async () => {
    const log = await newestCodexLog();
    const parsed = log && parseCodexRateLimits(log.split(/\r?\n/));
    if (!parsed) return { status: "error", windows: [], source: "Codex session log", note: "ยังไม่มีข้อมูล ใช้ Codex สักครั้ง (ในโหมด Code หรือ Agent/Chat) แล้วกดรีเฟรช" };
    return { status: "ok", windows: parsed.windows, source: "Codex session log", dataTime: parsed.at, note: "ตัวเลขจากการใช้ Codex ครั้งล่าสุด" };
  },
  antigravity: async () => {
    const windows = parseAntigravityUsage(await runCli("antigravity", ["--print=/usage"]));
    if (!windows.length) return { status: "error", windows, source: "agy /usage", note: "อ่านผล /usage ไม่ได้ ตรวจว่าเข้าสู่ระบบ Antigravity แล้ว" };
    return { status: "ok", windows, source: "agy /usage" };
  },
  opencode: async () => {
    const details = parseOpenCodeStats(await runCli("opencode", ["stats", "--days", "7"]));
    return { status: "unsupported", windows: [], details, source: "opencode stats", note: "OpenCode ไม่มีโควตารวม ขีดจำกัดขึ้นกับผู้ให้บริการรุ่นที่เลือก แสดงการใช้งาน 7 วันแทน" };
  },
  freebuff: async () => ({ status: "unsupported", windows: [], source: "-", note: "Freebuff ยังไม่มีคำสั่งให้ดูโควตา" }),
};

export const USAGE_PROVIDERS = ["claude-code", "codex", "antigravity", "opencode", "freebuff"];

export class UsageManager {
  private cache = new Map<string, ProviderUsage>();
  private pending = new Map<string, Promise<ProviderUsage>>();
  constructor(private probes: Record<string, Probe> = PROBES, private installed = (id: string) => !!findExecutable(getCliDefinition(id).command)) {}

  async get(id: string, refresh = false): Promise<ProviderUsage> {
    const cached = this.cache.get(id);
    if (!refresh && cached && Date.now() - cached.updatedAt < 120_000) return cached;
    const running = this.pending.get(id);
    if (running) return running;
    const task = (async () => {
      const name = getCliDefinition(id).name;
      let result: ProviderUsage;
      if (!this.installed(id)) result = { id, name, status: "not-installed", windows: [], source: "-", note: "ยังไม่ได้ติดตั้ง", updatedAt: Date.now() };
      else
        try {
          result = { id, name, ...(await this.probes[id]()), updatedAt: Date.now() };
        } catch (err: any) {
          const message = String(err?.message || err).split("\n").slice(-3).join(" ").slice(0, 300);
          result = { id, name, status: "error", windows: [], source: "-", note: /timed? ?out|ETIMEDOUT|killed/i.test(message) ? "CLI ตอบช้าเกินไป ลองรีเฟรชอีกครั้ง" : `ตรวจไม่สำเร็จ: ${message}`, updatedAt: Date.now() };
        }
      this.cache.set(id, result);
      return result;
    })().finally(() => this.pending.delete(id));
    this.pending.set(id, task);
    return task;
  }

  all(refresh = false) {
    return Promise.all(USAGE_PROVIDERS.map((id) => this.get(id, refresh)));
  }
}

