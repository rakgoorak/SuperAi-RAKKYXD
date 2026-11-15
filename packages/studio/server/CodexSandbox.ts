import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * On Windows, Codex silently runs read-only unless its config names a Windows sandbox, so "auto"
 * could not edit files on a Codex home that never went through Codex's own setup (every extra
 * account, and anyone without the Codex desktop app). When the home has no choice of its own we
 * ask for the sandbox that needs no administrator setup; a configured home keeps what it chose.
 */
export function codexSandboxArgs(env: Record<string, string | undefined> = {}, platform = process.platform, home = os.homedir()): string[] {
  if (platform !== "win32") return [];
  let config = "";
  try { config = fs.readFileSync(path.join(env.CODEX_HOME || process.env.CODEX_HOME || path.join(home, ".codex"), "config.toml"), "utf8"); } catch {}
  const section = /^\[windows\][^\n]*\n((?:(?!\[)[^\n]*\n?)*)/m.exec(config)?.[1] || "";
  if (/^\s*sandbox\s*=/m.test(section) || /^\s*windows\.sandbox\s*=/m.test(config)) return [];
  return ["-c", 'windows.sandbox="unelevated"'];
}
