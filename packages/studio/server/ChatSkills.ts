import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

export interface ChatSkill { id: string; name: string; description: string; source: string; path: string }
const PROVIDERS = ["claude-code", "codex", "antigravity", "opencode"];
export const CLI_PASSTHROUGH_COMMANDS = new Set([
  "compact", "cost", "doctor", "review", "pr_comments", "init", "clear", "bug", "help",
  "terminal:setup", "permissions", "memory", "export", "config", "stats", "usage",
  "summary", "context", "status", "model", "mode", "plan", "reset", "undo", "login",
  "logout", "settings", "version", "ide", "listen", "tools",
]);
/** Commands only some CLIs run in headless chat (checked against Claude Code 2.1.310, agy 1.5.5). */
const PROVIDER_COMMANDS: Record<string, string[]> = {
  "claude-code": ["goal"],
  antigravity: ["goal", "boost"],
};
/** Commands a CLI has only in its terminal UI: chat explains where to run them instead of sending text. */
const TERMINAL_ONLY_COMMANDS: Record<string, string[]> = { codex: ["goal"] };
const PROVIDER_LABEL: Record<string, string> = { "claude-code": "Claude", codex: "Codex", antigravity: "Antigravity", opencode: "OpenCode" };

/** The command name when `text` is a CLI slash command this provider runs from chat, else undefined. */
export function cliCommand(text: string, provider: string): string | undefined {
  const name = /^\/([\w.:-]+)(?:\s|$)/.exec(text.trim())?.[1]?.toLowerCase();
  if (!name) return undefined;
  return CLI_PASSTHROUGH_COMMANDS.has(name) || PROVIDER_COMMANDS[provider]?.includes(name) ? name : undefined;
}

/** Read only known skill directories. Project skills take precedence over global skills.
 * IDs distinguish duplicate names; clients never supply a file path to execute/read.
 */
export function chatSkills(root: string, provider: string, home = os.homedir()): ChatSkill[] {
  if (!PROVIDERS.includes(provider)) return [];
  const dirs: { dir: string; source: string }[] = [];
  const projectDirs = provider === "claude-code" ? [".claude/skills", ".agents/skills"]
    : provider === "opencode" ? [".opencode/skills", ".claude/skills", ".agents/skills"] : [".agents/skills"];
  // Skills inherited from project ancestors follow the same nearest-first precedence.
  for (let parent = path.resolve(root); ; parent = path.dirname(parent)) {
    for (const suffix of projectDirs) dirs.push({ dir: path.join(parent, suffix), source: parent === path.resolve(root) ? "โปรเจกต์" : "โฟลเดอร์แม่" });
    if (parent === path.dirname(parent) || parent === path.resolve(home)) break;
  }
  const globals = provider === "claude-code" ? [path.join(home, ".claude/skills")]
    : provider === "codex" ? [path.join(process.env.CODEX_HOME || path.join(home, ".codex"), "skills"), path.join(home, ".agents/skills")]
    : provider === "antigravity" ? [path.join(home, ".gemini/antigravity-cli/skills"), path.join(home, ".gemini/config/skills")]
    : [path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "opencode/skills"), path.join(home, ".claude/skills"), path.join(home, ".agents/skills")];
  globals.forEach((dir) => dirs.push({ dir, source: "ผู้ให้บริการ · ส่วนตัว" }));

  // Claude's registry lists installed versions, including externally installed plugins.
  // Scan only registered plugin roots, never every cached/removed plugin version.
  if (provider === "claude-code") {
    try {
      const registry = JSON.parse(fs.readFileSync(path.join(home, ".claude/plugins/installed_plugins.json"), "utf8"));
      const settings = [path.join(home, ".claude/settings.json"), path.join(root, ".claude/settings.json"), path.join(root, ".claude/settings.local.json")];
      const enabled: Record<string, boolean> = {};
      for (const file of settings) { try { Object.assign(enabled, JSON.parse(fs.readFileSync(file, "utf8")).enabledPlugins); } catch {} }
      for (const [key, installs] of Object.entries(registry.plugins || {})) {
        if (enabled[key] !== true) continue;
        for (const install of Array.isArray(installs) ? installs : []) {
          if (install.projectPath && path.resolve(install.projectPath) !== path.resolve(root)) continue;
          if (typeof install.installPath === "string") dirs.push({ dir: path.join(install.installPath, "skills"), source: `Plugin ${key.split("@")[0]}` });
        }
      }
    } catch {}
  }
  const result: ChatSkill[] = [], seen = new Set<string>();
  const scan = (dir: string, source: string, nested = false) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.slice(0, 500)) {
      if (result.length >= 1000) return;
      if (entry.name === ".system" && !nested) { scan(path.join(dir, entry.name), source, true); continue; }
      const file = path.join(dir, entry.name, "SKILL.md");
      try {
        const real = fs.realpathSync(file);
        if (seen.has(real) || !fs.statSync(real).isFile() || fs.statSync(real).size > 256 * 1024) continue;
        const text = fs.readFileSync(real, "utf8");
        const header = /^---\s*\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, "\n"))?.[1] || "";
        if (/^user-invocable:\s*false\s*$/m.test(header)) continue;
        const localName = (/^name:\s*([^\n]+)/m.exec(header)?.[1] || entry.name).trim().replace(/^["']|["']$/g, "");
        const name = source.startsWith("Plugin ") && !localName.includes(":") ? `${source.slice(7)}:${localName}` : localName;
        if (!/^[\w.:-]+$/.test(name)) continue;
        const description = (/^description:\s*([^\n]+)/m.exec(header)?.[1] || "").replace(/^["']|["']$/g, "").slice(0, 300);
        seen.add(real);
        result.push({ id: createHash("sha256").update(real).digest("hex").slice(0, 20), name, description, source, path: real });
      } catch {}
    }
  };
  for (const dir of dirs) scan(dir.dir, dir.source);
  return result;
}

/** Explicit manual invocation; never treat arbitrary input as a skill file path. */
export function skillPrompt(text: string, root: string, provider: string, skillId?: string, home?: string): string {
  const trimmed = text.trim();
  const command = /^\/(skill|skills)(?:\s|$)/.exec(trimmed);
  const direct = /^\/([\w.:-]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  const inline = /(?:^|\s)\/(?:skill\s+)?([\w.:-]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!skillId && !command && !direct && !inline) return text;
  const skills = chatSkills(root, provider, home);
  const parts = /^\/skill\s+(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  const skill = skillId ? skills.find((s) => s.id === skillId)
    : skills.find((s) => s.name === (parts?.[1] || (!command ? direct?.[1] : inline ? inline[1] : "")));
  if (!skill) {
    if (direct && cliCommand(trimmed, provider)) return text;
    const name = direct?.[1].toLowerCase() || "";
    if (direct && TERMINAL_ONLY_COMMANDS[provider]?.includes(name))
      throw new Error(`/${name} ของ ${PROVIDER_LABEL[provider] || provider} ใช้ได้เฉพาะในหน้า Terminal กรุณาสลับห้องนี้เป็น Terminal แล้วพิมพ์ /${name} อีกครั้ง`);
    const others = Object.keys(PROVIDER_COMMANDS).filter((id) => PROVIDER_COMMANDS[id].includes(name));
    if (direct && others.length)
      throw new Error(`${PROVIDER_LABEL[provider] || provider} ไม่มีคำสั่ง /${name} · คำสั่งนี้ใช้ได้กับ ${others.map((id) => PROVIDER_LABEL[id]).join(", ")}`);
    if (command) throw new Error("ไม่พบ skill ที่เลือก กรุณาเลือก skill จาก /skills แล้วพิมพ์ /skill ชื่อ งานที่ต้องการ");
    if (direct || skillId) throw new Error("ไม่พบ skill นี้สำหรับผู้ให้บริการ กรุณาเปิด /skills เพื่อดูรายการ · คำสั่งของ Terminal ใช้ในหน้า Terminal");
    return text;
  }
  const request = parts ? parts[2] || "" : direct && !command ? direct[2] || "" : text;
  // Paths go in as written: JSON.stringify would double every Windows backslash (C:\\Users\\...).
  return `The user explicitly selected the skill ${JSON.stringify(skill.name)}. Read and follow its SKILL.md at "${skill.path}". Resolve its relative resources from "${path.dirname(skill.path)}". Use the provider's native skill mechanism where available and honor its tool permissions. Do not execute any action outside the user's request or bypass approval requirements.\n\nUser request / skill arguments:\n${request || "ใช้ skill นี้กับโปรเจกต์ปัจจุบัน"}`;
}
