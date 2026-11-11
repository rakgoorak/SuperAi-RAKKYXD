import os from "node:os";
import path from "node:path";

/**
 * `opencode run` cannot ask before acting, so it rejects every permission request, and one
 * rejected request ends the whole turn with no answer. The most common one is reading the
 * temp folder: skills and tools write their output there (for example a guide a skill tells
 * the model to read next). Allow that folder only; anything else outside the project is
 * still refused, and the chat says so (see `openCodeNoAnswer`).
 *
 * Returns the OPENCODE_CONFIG_CONTENT to start OpenCode with, merged with one the user set.
 * The user's own choice for outside folders wins.
 */
export function openCodePermissionEnv(existing?: string, tmp = os.tmpdir()): Record<string, string> {
  let config: Record<string, any> = {};
  if (existing?.trim()) {
    try { config = JSON.parse(existing); } catch { return {}; }
    if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  }
  const permission = config.permission && typeof config.permission === "object" && !Array.isArray(config.permission) ? config.permission : {};
  const outside = permission.external_directory;
  // A single word ("allow", "ask", "deny") is the user's rule for every folder: keep it.
  if (typeof outside === "string") return existing ? { OPENCODE_CONFIG_CONTENT: existing } : {};
  const rules = outside && typeof outside === "object" && !Array.isArray(outside) ? outside : {};
  const pattern = path.join(tmp, "*");
  const merged = { ...config, permission: { ...permission, external_directory: { [pattern]: "allow", ...rules } } };
  return { OPENCODE_CONFIG_CONTENT: JSON.stringify(merged) };
}

/** What OpenCode asked for when it refused itself, from its stderr ("permission requested: X (Y); auto-rejecting"). */
export function rejectedPermissions(stderr: string): string[] {
  const found = [...stderr.replace(/\x1b\[[0-9;]*m/g, "").matchAll(/permission requested:\s*([\w-]+)\s*\(([^)\r\n]*)\)\s*;\s*auto-rejecting/gi)]
    .map((m) => (m[1] === "external_directory" ? `เข้าถึงโฟลเดอร์นอกโปรเจกต์ ${m[2]}` : `${m[1]} ${m[2]}`.trim()));
  return [...new Set(found)];
}

/** Why an OpenCode turn ended without an answer, so the chat never just goes quiet. */
export function openCodeNoAnswer(stderr: string, toolRejected: boolean): string {
  const asked = rejectedPermissions(stderr);
  if (asked.length || toolRejected)
    return `OpenCode หยุดก่อนตอบ เพราะขอสิทธิ์ที่โหมดแชตตอบให้ไม่ได้${asked.length ? `: ${asked.join(", ")}` : ""} `
      + "เลือกสิทธิ์ \"Ask for approval\" เพื่อให้มีปุ่มอนุมัติในแชต หรือ \"อนุมัติทั้งหมด\" แล้วส่งใหม่";
  return "OpenCode จบงานโดยไม่ส่งคำตอบกลับมา ลองส่งใหม่ หรือเปลี่ยนรุ่นในช่อง Model";
}
