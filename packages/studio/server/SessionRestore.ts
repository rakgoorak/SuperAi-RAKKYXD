// Reopening CLI tabs where they were after the app restarts (an in-app update):
// each CLI is started again in "resume" mode on the same conversation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Extra CLI arguments to resume a conversation: `resume` is a conversation id or "last". */
export function resumeArgs(agentType: string, resume?: string): string[] {
  if (!resume) return [];
  const last = resume === "last";
  switch (agentType) {
    case "claude-code": return last ? ["--continue"] : ["--resume", resume];
    case "codex": return last ? ["resume", "--last"] : ["resume", resume];
    case "opencode": return last ? ["--continue"] : ["--session", resume];
    case "antigravity": return last ? ["--continue"] : ["--conversation", resume];
    case "freebuff": return last ? ["--continue"] : ["--continue", resume];
    default: return [];
  }
}

/** True when Claude Code saved a transcript for this session id (a tab nobody typed in has none). */
export function claudeTranscriptExists(id: string, home = os.homedir()): boolean {
  const root = path.join(home, ".claude", "projects");
  try {
    return fs.readdirSync(root).some((dir) => fs.existsSync(path.join(root, dir, `${id}.jsonl`)));
  } catch {
    return false;
  }
}

const samePath = (a: string, b: string) =>
  process.platform === "win32" ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);

/**
 * The Codex conversation a tab started: the first rollout in that folder that began after the
 * tab opened and is not already taken by another tab. Codex writes one rollout per conversation
 * under ~/.codex/sessions/YYYY/MM/DD with its id, folder and start time on the first line.
 */
export function findCodexSession(cwd: string, since: number, taken: Set<string>, home = os.homedir()): string | null {
  const root = path.join(home, ".codex", "sessions");
  const found: { id: string; at: number }[] = [];
  for (let day = new Date(since - 86_400_000); day.getTime() <= Date.now() + 86_400_000; day = new Date(day.getTime() + 86_400_000)) {
    const dir = path.join(root, String(day.getFullYear()), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0"));
    let files: string[] = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const file of files) {
      try {
        const fd = fs.openSync(path.join(dir, file), "r");
        const buf = Buffer.alloc(16_384);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const first = buf.subarray(0, n).toString("utf8").split("\n")[0];
        const meta = JSON.parse(first)?.payload;
        const at = Date.parse(meta?.timestamp);
        if (meta?.id && meta.cwd && samePath(meta.cwd, cwd) && at >= since - 10_000 && !taken.has(meta.id)) found.push({ id: meta.id, at });
      } catch {
        // a partial or unreadable rollout: skip it
      }
    }
  }
  found.sort((a, b) => a.at - b.at);
  return found[0]?.id || null;
}
