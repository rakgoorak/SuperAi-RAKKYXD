import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Mark a project folder as trusted in a CLI's own config, exactly as answering
 * "Yes, I trust this folder" would, so new sessions skip that prompt.
 * Only adds a missing entry; never removes or rewrites anything else. Configs that
 * don't exist yet are left alone (the CLI creates them on first run).
 */
export interface TrustPaths { home: string; codexHome: string }
const defaults = (): TrustPaths => ({ home: os.homedir(), codexHome: process.env.CODEX_HOME || path.join(os.homedir(), ".codex") });

function writeAtomic(file: string, text: string) {
  const temp = `${file}.superai-${process.pid}.tmp`;
  fs.writeFileSync(temp, text);
  try {
    fs.renameSync(temp, file);
  } catch {
    fs.writeFileSync(file, text); // e.g. the file is briefly locked by the CLI on Windows
    fs.rmSync(temp, { force: true });
  }
}

/** Claude Code: ~/.claude.json → projects["D:/Test"].hasTrustDialogAccepted */
function trustClaude(dir: string, p: TrustPaths) {
  const file = path.join(p.home, ".claude.json");
  if (!fs.existsSync(file)) return false;
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  const key = dir.replace(/\\/g, "/");
  config.projects ||= {};
  const existing = Object.keys(config.projects).find((k) => k.toLowerCase() === key.toLowerCase());
  if (existing && config.projects[existing]?.hasTrustDialogAccepted === true) return false;
  config.projects[existing || key] = { ...(config.projects[existing || key] || {}), hasTrustDialogAccepted: true };
  writeAtomic(file, JSON.stringify(config, null, 2));
  return true;
}

/** Codex: ~/.codex/config.toml → [projects.'d:\test'] trust_level = "trusted" */
function trustCodex(dir: string, p: TrustPaths) {
  const file = path.join(p.codexHome, "config.toml");
  if (!fs.existsSync(file) || dir.includes("'")) return false; // TOML literal keys cannot contain '
  const key = process.platform === "win32" ? dir.toLowerCase() : dir;
  const text = fs.readFileSync(file, "utf8");
  const header = `[projects.'${key}']`;
  if (text.split(/\r?\n/).some((line) => line.trim().toLowerCase() === header.toLowerCase())) return false;
  writeAtomic(file, `${text.replace(/\s*$/, "")}\n\n${header}\ntrust_level = "trusted"\n`);
  return true;
}

/** Antigravity: ~/.gemini/antigravity-cli/settings.json → trustedWorkspaces[] */
function trustAntigravity(dir: string, p: TrustPaths) {
  const file = path.join(p.home, ".gemini", "antigravity-cli", "settings.json");
  if (!fs.existsSync(file)) return false;
  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  const list: string[] = Array.isArray(settings.trustedWorkspaces) ? settings.trustedWorkspaces : [];
  if (list.some((w) => typeof w === "string" && path.resolve(w).toLowerCase() === dir.toLowerCase())) return false;
  settings.trustedWorkspaces = [...list, dir];
  writeAtomic(file, JSON.stringify(settings, null, 2));
  return true;
}

const HANDLERS: Record<string, (dir: string, p: TrustPaths) => boolean> = {
  "claude-code": trustClaude,
  codex: trustCodex,
  antigravity: trustAntigravity,
};

/** Returns true when an entry was added; false when already trusted or not applicable. Never throws. */
export function trustFolder(cliId: string, folder: string, paths: TrustPaths = defaults()): boolean {
  const handler = HANDLERS[cliId];
  if (!handler || !folder) return false;
  try {
    return handler(path.resolve(folder), paths);
  } catch {
    return false; // a config we cannot parse is left untouched; the CLI will simply ask
  }
}
