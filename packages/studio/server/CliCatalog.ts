import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { managedNodeDir, managedNodeBin, installNode22 } from "./NodeInstaller.js";
import { managedGitCmd, bashForGit } from "./GitInstaller.js";

export { managedNodeDir, managedNodeBin, installNode22 };

export const CLI_DEFINITIONS = [
  {
    id: "terminal",
    name: "Terminal",
    command: process.platform === "win32" ? "powershell.exe" : process.platform === "darwin" ? "zsh" : "bash",
    maxSessions: 12,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude",
    maxSessions: 12,
  },
  { id: "codex", name: "Codex", command: "codex", maxSessions: 12 },
  // Gemini CLI was retired in June 2026; Google replaced it with Antigravity CLI (agy).
  { id: "antigravity", name: "Antigravity CLI", command: "agy", maxSessions: 12 },
  { id: "opencode", name: "OpenCode", command: "opencode", maxSessions: 12 },
  { id: "freebuff", name: "Freebuff", command: "freebuff", maxSessions: 1 },
];
export const INSTALL_PACKAGES: Record<string, string> = {
  'claude-code':'@anthropic-ai/claude-code', codex:'@openai/codex', opencode:'opencode-ai', freebuff:'freebuff',
};
// Not on npm (the npm names "agy"/"antigravity" are unrelated placeholders): Google's
// own installer downloads a SHA-512-verified binary. Fixed URLs only.
export const INSTALL_SCRIPTS: Record<string, { win32: string; posix: string }> = {
  antigravity: { win32: 'https://antigravity.google/cli/install.ps1', posix: 'https://antigravity.google/cli/install.sh' },
};
export const antigravityBin = () =>
  process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'agy', 'bin') : path.join(os.homedir(), '.local', 'bin');
export const managedCliPrefix = () => path.join(os.homedir(), '.opencode-multi', 'cli-tools');
export const managedCliBin = () => process.platform === 'win32' ? managedCliPrefix() : path.join(managedCliPrefix(), 'bin');
export const cliPath = () => [
  ...new Set([
    managedCliBin(),
    managedNodeBin(),
    ...(process.platform === 'win32' ? [managedGitCmd(), antigravityBin()] : []),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.claude', 'local'),
    path.join(os.homedir(), '.config', 'manicode'),
    path.join(os.homedir(), '.opencode', 'bin'),
    ...(process.env.PATH || '').split(path.delimiter),
    ...(process.platform === 'darwin'
      ? [
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin',
          '/Applications/ChatGPT.app/Contents/Resources/codex-cli/codex-path',
          '/Applications/Codex.app/Contents/Resources/codex-cli/bin',
        ]
      : []),
  ]),
].filter(Boolean).join(path.delimiter);

/**
 * Only for installing or updating the CLIs themselves (global installs). npm 12 blocks install
 * scripts by default, and Claude Code's postinstall copies its native claude.exe over a
 * placeholder, so a blocked script leaves a CLI that cannot start. Never put this in a session's
 * environment: npm 12 refuses every project install (`npm ci`) while it is set (EALLOWSCRIPTS).
 */
export const cliInstallEnv = (): Record<string, string> => ({
  npm_config_allow_scripts: Object.values(INSTALL_PACKAGES).join(","),
  // Our own update (`claude update`) must run even though sessions turn auto-updates off.
  DISABLE_AUTOUPDATER: "0",
});

// Environment for spawned CLIs: managed PATH plus Git Bash for Claude Code on Windows.
export function cliEnv(): Record<string, string> {
  const env: Record<string, string> = {
    PATH: cliPath(),
    // Claude Code updating itself inside a session moves claude.exe aside and reinstalls with
    // npm, which (npm 12, no allowed install scripts here) never puts the binary back. The app
    // updates CLIs itself with cliInstallEnv, so sessions leave it to that.
    DISABLE_AUTOUPDATER: "1",
  };
  if (process.platform === 'win32' && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
    const git = findExecutable('git');
    const bash = git && bashForGit(git);
    if (bash) env.CLAUDE_CODE_GIT_BASH_PATH = bash;
  }
  return env;
}

export interface NodeStatus {
  installed: boolean;
  ready: boolean;
  version: string | null;
  major: number;
  isManaged: boolean;
  nodePath: string | null;
  npmPath: string | null;
}

export function getNodeStatus(
  customFind = findExecutable,
  customVersion?: (node: string) => string,
): NodeStatus {
  const node = customFind('node');
  const npm = customFind('npm');
  if (!node || !npm) {
    return {
      installed: false,
      ready: false,
      version: null,
      major: 0,
      isManaged: false,
      nodePath: node || null,
      npmPath: npm || null,
    };
  }

  let ver = '';
  try {
    if (customVersion) {
      ver = customVersion(node);
    } else {
      ver = execFileSync(node, ['-p', 'process.versions.node'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      }).trim();
    }
  } catch {
    ver = '';
  }

  const major = parseInt(ver.split('.')[0] || '0', 10);
  const isManaged = path.resolve(node).toLowerCase().startsWith(path.resolve(managedNodeDir()).toLowerCase());
  return {
    installed: true,
    ready: major >= 22,
    version: ver || null,
    major: isNaN(major) ? 0 : major,
    isManaged,
    nodePath: node,
    npmPath: npm,
  };
}

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

/**
 * Claude Code installed from npm whose postinstall never ran (or whose update stopped half way)
 * has a tiny placeholder or no bin/claude.exe at all: the command exists but cannot start.
 */
export function incompleteInstall(id: string, executable: string | null, platform: NodeJS.Platform = process.platform): boolean {
  // claude.exe is the Windows npm payload. macOS/Linux installs use a different
  // entry point; the absence of this Windows file says nothing about their health.
  if (platform !== "win32" || id !== "claude-code" || !executable) return false;
  const dir = path.dirname(executable);
  for (const root of [path.join(dir, "node_modules"), path.join(dir, "..", "lib", "node_modules")]) {
    const pkg = path.join(root, "@anthropic-ai", "claude-code");
    if (!fs.existsSync(path.join(pkg, "package.json"))) continue;
    try {
      return fs.statSync(path.join(pkg, "bin", "claude.exe")).size < 1_000_000;
    } catch {
      return true;
    }
  }
  return false;
}

export function listClis() {
  const nodeStatus = getNodeStatus();
  return CLI_DEFINITIONS.map((c) => ({
    ...c,
    // An incomplete install shows as missing, so the app offers to install it again.
    available: !!findExecutable(c.command) && !incompleteInstall(c.id, findExecutable(c.command)),
    installPackage: INSTALL_PACKAGES[c.id] || (INSTALL_SCRIPTS[c.id] ? 'antigravity.google' : undefined),
    needsNode: !!INSTALL_PACKAGES[c.id],
    installerReady: true,
    nodeReady: nodeStatus.ready,
    nodeStatus,
    teamSupported: ['claude-code','codex','opencode','antigravity'].includes(c.id),
  }));
}

export async function listOpenCodeModels(): Promise<string[]> {
  const launch = cliLaunch("opencode", ["models"]);
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await promisify(execFile)(launch.command, launch.args, {
        windowsHide: true,
        timeout: 20000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, ...cliEnv() },
      });
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[\w.-]+\/[\w./:-]+$/.test(line));
    } catch (err: any) {
      if (attempt < 2 && /database is locked|SQLITE_BUSY/i.test(String(err?.message || err))) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
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
