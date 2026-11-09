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

// A TOML key as Codex may write it: 'literal', "basic \"escaped\"" or bare.
const TOML_KEY = String.raw`(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))`;
const PROJECT_HEADER = new RegExp(String.raw`^\s*\[\s*projects\s*\.\s*${TOML_KEY}\s*\]\s*(?:#.*)?$`);
const unescapeBasic = (s: string) => s.replace(/\\(["\\])/g, "$1").replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));

/** The project key of a `[projects.<key>]` header line, or null. */
export function codexProjectHeader(line: string): string | null {
  const m = PROJECT_HEADER.exec(line);
  if (!m) return null;
  return m[1] ?? (m[2] !== undefined ? unescapeBasic(m[2]) : m[3]);
}

/**
 * Undo duplicate `[projects.<key>]` tables that SuperAi 1.0.2 appended when Codex had
 * already written the same folder with other quoting (e.g. "..." on macOS), which makes
 * Codex fail with "duplicate key". Only removes the exact two-line block SuperAi writes.
 */
export function repairCodexConfig(text: string): string {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const drop = new Set<number>();
  lines.forEach((line, i) => {
    const key = codexProjectHeader(line);
    if (key === null) return;
    const ours = /^\s*\[projects\.'[^']*'\]\s*$/.test(line) && /^\s*trust_level\s*=\s*"trusted"\s*$/.test(lines[i + 1] || "") && !(lines[i + 2] || "").trim().match(/^[A-Za-z_"']/);
    if (seen.has(key) && ours) {
      drop.add(i);
      drop.add(i + 1);
      if (i > 0 && !lines[i - 1].trim()) drop.add(i - 1); // the blank line SuperAi put before it
    }
    seen.add(key);
  });
  return drop.size ? lines.filter((_l, i) => !drop.has(i)).join("\n") : text;
}

/** Codex: ~/.codex/config.toml → [projects.<folder>] trust_level = "trusted" */
function trustCodex(dir: string, p: TrustPaths) {
  const file = path.join(p.codexHome, "config.toml");
  if (!fs.existsSync(file)) return false;
  const original = fs.readFileSync(file, "utf8");
  const text = repairCodexConfig(original);
  // Codex writes lower-case 'd:\path' keys on Windows and "/Users/..." keys elsewhere.
  const key = process.platform === "win32" ? dir.toLowerCase() : dir;
  const same = (k: string) => (process.platform === "win32" || process.platform === "darwin" ? k.toLowerCase() === key.toLowerCase() : k === key);
  const known = text.split(/\r?\n/).some((line) => {
    const k = codexProjectHeader(line);
    return k !== null && same(k);
  });
  // Also skip when the folder appears in any other form (inline tables, dotted keys...).
  const mentioned = text.includes(key) || text.includes(key.replace(/\\/g, "\\\\"));
  if (known || mentioned) {
    if (text !== original) writeAtomic(file, text);
    return false;
  }
  const header = process.platform === "win32" && !key.includes("'")
    ? `[projects.'${key}']`
    : `[projects."${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
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

/** Fix a config.toml damaged by SuperAi 1.0.2 (run once at start-up). Never throws. */
export function repairCodexConfigFile(paths: TrustPaths = defaults()): boolean {
  try {
    const file = path.join(paths.codexHome, "config.toml");
    if (!fs.existsSync(file)) return false;
    const text = fs.readFileSync(file, "utf8");
    const fixed = repairCodexConfig(text);
    if (fixed === text) return false;
    writeAtomic(file, fixed);
    return true;
  } catch {
    return false;
  }
}

/** Returns true when an entry was added; false when already trusted or not applicable. Never throws. */
export function trustFolder(cliId: string, folder: string, paths: TrustPaths = defaults()): boolean {
  const handler = HANDLERS[cliId];
  if (!handler || !folder || typeof folder !== "string" || /[\u0000-\u001f]/.test(folder)) return false;
  try {
    return handler(path.resolve(folder), paths);
  } catch {
    return false; // a config we cannot parse is left untouched; the CLI will simply ask
  }
}
