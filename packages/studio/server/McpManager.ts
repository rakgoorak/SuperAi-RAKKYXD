import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface McpServerRecord {
  id: string; // e.g. "claude:roblox-studio" or "codex:blender"
  name: string;
  provider: "claude" | "codex";
  scope: "global" | "project";
  type: "stdio" | "http" | "sse" | "websocket";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  sourceFile: string;
}

export interface AddMcpServerInput {
  provider: "claude" | "codex";
  scope?: "global" | "project";
  name: string;
  type?: "stdio" | "http" | "sse" | "websocket";
  command?: string;
  args?: string[] | string;
  env?: Record<string, string>;
  url?: string;
}

export interface McpPaths {
  home: string;
  codexHome: string;
}

export const defaultMcpPaths = (): McpPaths => ({
  home: os.homedir(),
  codexHome: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
});

function writeAtomic(file: string, text: string) {
  const temp = `${file}.superai-${process.pid}-${Date.now()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, text, "utf8");
  try {
    fs.renameSync(temp, file);
  } catch {
    fs.writeFileSync(file, text, "utf8");
    fs.rmSync(temp, { force: true });
  }
}

const TOML_KEY = String.raw`(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))`;
const MCP_HEADER = new RegExp(String.raw`^\s*\[\s*mcp_servers\s*\.\s*${TOML_KEY}\s*\]\s*(?:#.*)?$`);
const MCP_SUB_HEADER = new RegExp(String.raw`^\s*\[\s*mcp_servers\s*\.\s*${TOML_KEY}\s*\.\s*([A-Za-z0-9_-]+)\s*\]\s*(?:#.*)?$`);
const ANY_HEADER = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/;

const unescapeBasic = (s: string) =>
  s.replace(/\\(["\\])/g, "$1").replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));

export function parseCodexMcpHeader(line: string): { name: string; sub?: string } | null {
  const sub = MCP_SUB_HEADER.exec(line);
  if (sub) {
    const name = sub[1] ?? (sub[2] !== undefined ? unescapeBasic(sub[2]) : sub[3]);
    return { name, sub: sub[4] };
  }
  const m = MCP_HEADER.exec(line);
  if (!m) return null;
  const name = m[1] ?? (m[2] !== undefined ? unescapeBasic(m[2]) : m[3]);
  return { name };
}

/** Parse an array literal from TOML, e.g. ["/c", 'hello', "world"] */
function parseTomlArray(val: string): string[] {
  const inner = val.trim().replace(/^\[\s*|\s*\]$/g, "");
  if (!inner) return [];
  const result: string[] = [];
  const re = /(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner)) !== null) {
    const item = match[1] ?? (match[2] !== undefined ? unescapeBasic(match[2]) : match[3]);
    if (item !== undefined && item !== ",") result.push(item);
  }
  return result;
}

/** Parse a string literal from TOML, e.g. 'hello' or "world" */
function parseTomlString(val: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return unescapeBasic(trimmed.slice(1, -1));
  return trimmed;
}

/** Reads all MCP servers configured for Claude Code */
export function getClaudeMcpServers(paths: McpPaths = defaultMcpPaths(), cwd?: string): McpServerRecord[] {
  const records: McpServerRecord[] = [];
  const targets: { file: string; scope: "global" | "project" }[] = [
    { file: path.join(paths.home, ".claude.json"), scope: "global" },
  ];
  if (cwd) {
    targets.push({ file: path.join(cwd, ".mcp.json"), scope: "project" });
  }

  for (const { file, scope } of targets) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      const mcp = data.mcpServers || {};
      for (const [name, entry] of Object.entries<any>(mcp)) {
        if (!entry || typeof entry !== "object") continue;
        const type = entry.type || (entry.url ? "http" : "stdio");
        records.push({
          id: `claude:${name}`,
          name,
          provider: "claude",
          scope,
          type,
          command: typeof entry.command === "string" ? entry.command : undefined,
          args: Array.isArray(entry.args) ? entry.args.map(String) : undefined,
          env: entry.env && typeof entry.env === "object" ? entry.env : undefined,
          url: typeof entry.url === "string" ? entry.url : undefined,
          enabled: entry.disabled !== true,
          sourceFile: file,
        });
      }
    } catch {}
  }

  return records;
}

/** Reads all MCP servers configured for Codex CLI in config.toml */
export function getCodexMcpServers(paths: McpPaths = defaultMcpPaths(), cwd?: string): McpServerRecord[] {
  const records: McpServerRecord[] = [];
  const targets: { file: string; scope: "global" | "project" }[] = [
    { file: path.join(paths.codexHome, "config.toml"), scope: "global" },
  ];
  if (cwd) {
    targets.push({ file: path.join(cwd, ".codex", "config.toml"), scope: "project" });
  }

  for (const { file, scope } of targets) {
    if (!fs.existsSync(file)) continue;
    try {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      let currentServer: Partial<McpServerRecord> | null = null;
      let currentSub: string | undefined;

      const flush = () => {
        if (currentServer && currentServer.name) {
          records.push({
            id: `codex:${currentServer.name}`,
            name: currentServer.name,
            provider: "codex",
            scope,
            type: currentServer.type || (currentServer.url ? "http" : "stdio"),
            command: currentServer.command,
            args: currentServer.args,
            env: currentServer.env,
            url: currentServer.url,
            enabled: currentServer.enabled !== false,
            sourceFile: file,
          });
        }
        currentServer = null;
        currentSub = undefined;
      };

      for (const line of lines) {
        const anyHdr = ANY_HEADER.exec(line);
        if (anyHdr) {
          const mcpHdr = parseCodexMcpHeader(line);
          if (mcpHdr) {
            if (mcpHdr.sub) {
              // sub-table like [mcp_servers.<name>.env]
              currentSub = mcpHdr.sub;
            } else {
              flush();
              currentServer = { name: mcpHdr.name, env: {} };
            }
            continue;
          } else {
            // some other table header e.g. [projects]
            flush();
            continue;
          }
        }

        if (!currentServer) continue;

        const kvMatch = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*(?:#.*)?$/.exec(line);
        if (!kvMatch) continue;
        const [, key, rawVal] = kvMatch;

        if (currentSub === "env") {
          currentServer.env = currentServer.env || {};
          currentServer.env[key] = parseTomlString(rawVal);
          continue;
        }

        if (key === "command") currentServer.command = parseTomlString(rawVal);
        else if (key === "url") currentServer.url = parseTomlString(rawVal);
        else if (key === "type") currentServer.type = parseTomlString(rawVal) as any;
        else if (key === "args") currentServer.args = parseTomlArray(rawVal);
        else if (key === "disabled") currentServer.enabled = rawVal.trim().toLowerCase() !== "true";
      }
      flush();
    } catch {}
  }

  return records;
}

/** Lists all configured MCP servers across Claude and Codex */
export function listMcpServers(cwd?: string, paths: McpPaths = defaultMcpPaths()): McpServerRecord[] {
  const claude = getClaudeMcpServers(paths, cwd);
  const codex = getCodexMcpServers(paths, cwd);
  return [...claude, ...codex];
}

/** Adds or updates an MCP server configuration */
export function saveMcpServer(input: AddMcpServerInput, cwd?: string, paths: McpPaths = defaultMcpPaths()): McpServerRecord {
  const name = input.name.trim();
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error("ชื่อ MCP Server ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข ขีดลบ หรือขีดล่างเท่านั้น");
  }

  const args = Array.isArray(input.args)
    ? input.args
    : typeof input.args === "string"
      ? input.args.split(/\s+/).filter(Boolean)
      : [];

  const type = input.type || (input.url ? "http" : "stdio");

  if (type === "stdio" && !input.command) {
    throw new Error("กรุณาระบุ Command สำหรับ stdio server");
  }
  if ((type === "http" || type === "sse") && !input.url) {
    throw new Error("กรุณาระบุ URL สำหรับ HTTP/SSE server");
  }

  if (input.provider === "claude") {
    const targetFile = input.scope === "project" && cwd
      ? path.join(cwd, ".mcp.json")
      : path.join(paths.home, ".claude.json");

    let data: any = {};
    try {
      if (fs.existsSync(targetFile)) data = JSON.parse(fs.readFileSync(targetFile, "utf8"));
    } catch {}

    data.mcpServers = data.mcpServers || {};
    const entry: any = { type };
    if (input.command) entry.command = input.command;
    if (args.length) entry.args = args;
    if (input.url) entry.url = input.url;
    if (input.env && Object.keys(input.env).length) entry.env = input.env;

    data.mcpServers[name] = entry;
    writeAtomic(targetFile, JSON.stringify(data, null, 2));

    return {
      id: `claude:${name}`,
      name,
      provider: "claude",
      scope: input.scope || "global",
      type,
      command: input.command,
      args,
      env: input.env,
      url: input.url,
      enabled: true,
      sourceFile: targetFile,
    };
  }

  if (input.provider === "codex") {
    const targetFile = input.scope === "project" && cwd
      ? path.join(cwd, ".codex", "config.toml")
      : path.join(paths.codexHome, "config.toml");

    let content = "";
    try {
      if (fs.existsSync(targetFile)) content = fs.readFileSync(targetFile, "utf8");
    } catch {}

    // First remove existing section for this name if any
    content = removeCodexServerFromToml(content, name);

    // Build TOML block
    const lines = [`[mcp_servers.${name}]`];
    if (input.command) lines.push(`command = ${JSON.stringify(input.command)}`);
    if (args.length) lines.push(`args = [${args.map((a) => JSON.stringify(a)).join(", ")}]`);
    if (input.url) lines.push(`url = ${JSON.stringify(input.url)}`);

    if (input.env && Object.keys(input.env).length) {
      lines.push("");
      lines.push(`[mcp_servers.${name}.env]`);
      for (const [k, v] of Object.entries(input.env)) {
        lines.push(`${k} = ${JSON.stringify(v)}`);
      }
    }

    const updated = (content.trimEnd() + "\n\n" + lines.join("\n") + "\n").trimStart();
    writeAtomic(targetFile, updated);

    return {
      id: `codex:${name}`,
      name,
      provider: "codex",
      scope: input.scope || "global",
      type,
      command: input.command,
      args,
      env: input.env,
      url: input.url,
      enabled: true,
      sourceFile: targetFile,
    };
  }

  throw new Error(`ไม่รองรับ provider: ${input.provider}`);
}

/** Removes an MCP server from configuration */
export function removeMcpServer(provider: "claude" | "codex", name: string, cwd?: string, paths: McpPaths = defaultMcpPaths()): boolean {
  if (provider === "claude") {
    const targets = [
      path.join(paths.home, ".claude.json"),
      ...(cwd ? [path.join(cwd, ".mcp.json")] : []),
    ];
    let removed = false;
    for (const file of targets) {
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data.mcpServers && data.mcpServers[name]) {
          delete data.mcpServers[name];
          writeAtomic(file, JSON.stringify(data, null, 2));
          removed = true;
        }
      } catch {}
    }
    return removed;
  }

  if (provider === "codex") {
    const targets = [
      path.join(paths.codexHome, "config.toml"),
      ...(cwd ? [path.join(cwd, ".codex", "config.toml")] : []),
    ];
    let removed = false;
    for (const file of targets) {
      if (!fs.existsSync(file)) continue;
      try {
        const content = fs.readFileSync(file, "utf8");
        const next = removeCodexServerFromToml(content, name);
        if (next !== content) {
          writeAtomic(file, next);
          removed = true;
        }
      } catch {}
    }
    return removed;
  }

  return false;
}

/** Enables or disables an MCP server */
export function toggleMcpServer(provider: "claude" | "codex", name: string, enabled: boolean, cwd?: string, paths: McpPaths = defaultMcpPaths()): boolean {
  if (provider === "claude") {
    const targets = [
      path.join(paths.home, ".claude.json"),
      ...(cwd ? [path.join(cwd, ".mcp.json")] : []),
    ];
    let updated = false;
    for (const file of targets) {
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data.mcpServers && data.mcpServers[name]) {
          data.mcpServers[name].disabled = !enabled;
          writeAtomic(file, JSON.stringify(data, null, 2));
          updated = true;
        }
      } catch {}
    }
    return updated;
  }

  if (provider === "codex") {
    const targets = [
      path.join(paths.codexHome, "config.toml"),
      ...(cwd ? [path.join(cwd, ".codex", "config.toml")] : []),
    ];
    let updated = false;
    for (const file of targets) {
      if (!fs.existsSync(file)) continue;
      try {
        const content = fs.readFileSync(file, "utf8");
        const next = setCodexServerDisabled(content, name, !enabled);
        if (next !== content) {
          writeAtomic(file, next);
          updated = true;
        }
      } catch {}
    }
    return updated;
  }

  return false;
}

function removeCodexServerFromToml(text: string, name: string): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const anyHdr = ANY_HEADER.exec(line);
    if (anyHdr) {
      const mcpHdr = parseCodexMcpHeader(line);
      if (mcpHdr && mcpHdr.name.toLowerCase() === name.toLowerCase()) {
        skipping = true;
        continue;
      } else {
        skipping = false;
      }
    }
    if (!skipping) result.push(line);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

function setCodexServerDisabled(text: string, name: string, disabled: boolean): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let inTargetSection = false;
  let hasSet = false;

  for (const line of lines) {
    const anyHdr = ANY_HEADER.exec(line);
    if (anyHdr) {
      const mcpHdr = parseCodexMcpHeader(line);
      if (mcpHdr && mcpHdr.name.toLowerCase() === name.toLowerCase() && !mcpHdr.sub) {
        inTargetSection = true;
        result.push(line);
        continue;
      } else {
        if (inTargetSection && !hasSet && disabled) {
          result.push("disabled = true");
          hasSet = true;
        }
        inTargetSection = false;
      }
    }

    if (inTargetSection) {
      if (/^\s*disabled\s*=/.test(line)) {
        if (disabled) {
          result.push("disabled = true");
          hasSet = true;
        }
        continue; // drop or replace existing disabled key
      }
    }

    result.push(line);
  }

  if (inTargetSection && !hasSet && disabled) {
    result.push("disabled = true");
  }

  return result.join("\n");
}
