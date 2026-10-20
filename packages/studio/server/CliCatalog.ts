import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const CLI_DEFINITIONS = [
  {
    id: "terminal",
    name: "Terminal",
    command: process.platform === "win32" ? "powershell.exe" : "bash",
    maxSessions: 12,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude",
    maxSessions: 12,
  },
  { id: "codex", name: "Codex", command: "codex", maxSessions: 12 },
  { id: "gemini", name: "Gemini CLI", command: "gemini", maxSessions: 12 },
  { id: "opencode", name: "OpenCode", command: "opencode", maxSessions: 12 },
  { id: "freebuff", name: "Freebuff", command: "freebuff", maxSessions: 1 },
];
export const INSTALL_PACKAGES: Record<string, string> = {
  'claude-code':'@anthropic-ai/claude-code', codex:'@openai/codex', gemini:'@google/gemini-cli', opencode:'opencode-ai', freebuff:'freebuff',
};
export const managedCliPrefix = () => path.join(os.homedir(), '.opencode-multi', 'cli-tools');
export const managedCliBin = () => process.platform === 'win32' ? managedCliPrefix() : path.join(managedCliPrefix(), 'bin');
export const cliPath = () => [...new Set([managedCliBin(), path.join(os.homedir(), '.local','bin'), ...(process.env.PATH || '').split(path.delimiter)])].join(path.delimiter);

export function getCliDefinition(id: string) {
  const definition = CLI_DEFINITIONS.find((c) => c.id === id);
  if (!definition) throw new Error(`ไม่รู้จัก CLI: ${id}`);
  return definition;
}

export function findExecutable(command: string): string | null {
  const extra = path.join(os.homedir(), ".local", "bin");
  const envPath = [cliPath(), extra].join(path.delimiter);
  const extensions =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of envPath.split(path.delimiter)) {
    for (const ext of extensions) {
      const candidate = path.join(
        dir.replace(/^"|"$/g, ""),
        command.endsWith(ext) && ext ? command : command + ext,
      );
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {}
    }
  }
  return null;
}

export function listClis() {
  return CLI_DEFINITIONS.map((c) => ({
    ...c,
    available: !!findExecutable(c.command),
    installPackage: INSTALL_PACKAGES[c.id],
    installerReady: !!findExecutable('node') && !!findExecutable('npm'),
    teamSupported: ['claude-code','codex','opencode'].includes(c.id),
  }));
}

export async function listOpenCodeModels(): Promise<string[]> {
  const launch = cliLaunch("opencode", ["models"]);
  const { stdout } = await promisify(execFile)(launch.command, launch.args, {
    windowsHide: true,
    timeout: 20000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\w.-]+\/[\w./:-]+$/.test(line));
}

export function cliLaunch(
  id: string,
  extraArgs: string[] = [],
): { command: string; args: string[] } {
  const cli = getCliDefinition(id);
  const executable = findExecutable(cli.command);
  if (!executable)
    throw new Error(
      `ยังไม่ได้ติดตั้ง ${cli.name} หรือไม่พบคำสั่งใน PATH กรุณาติดตั้งแล้วตรวจสอบอีกครั้ง`,
    );
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
    const packages: Record<string, string> = {
      codex: "@openai/codex",
      opencode: "opencode-ai",
      freebuff: "freebuff",
      gemini: "@google/gemini-cli",
      "claude-code": "@anthropic-ai/claude-code",
    };
    const packageName = packages[id];
    if (packageName)
      try {
        const root = path.join(
          path.dirname(executable),
          "node_modules",
          packageName,
        );
        const metadata = JSON.parse(
          fs.readFileSync(path.join(root, "package.json"), "utf8"),
        );
        const entry =
          typeof metadata.bin === "string"
            ? metadata.bin
            : metadata.bin?.[cli.command];
        const target = entry && path.resolve(root, entry);
        if (target && fs.existsSync(target)) {
          if (/\.exe$/i.test(target))
            return { command: target, args: extraArgs };
          const node = findExecutable("node");
          if (node) return { command: node, args: [target, ...extraArgs] };
        }
      } catch {}
  }
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
    return {
      command: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `& '${executable.replace(/'/g, "''")}' ${extraArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(" ")}`,
      ],
    };
  }
  return {
    command: executable,
    args: [
      ...(id === "terminal" && process.platform === "win32"
        ? ["-NoLogo", "-NoProfile"]
        : []),
      ...extraArgs,
    ],
  };
}
