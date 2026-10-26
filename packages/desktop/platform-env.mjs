import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Finder launches do not inherit the PATH from an interactive Terminal.
export function prepareDesktopPath() {
  if (process.platform !== 'darwin') return;
  let login = '';
  try { login = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', 'printf "%s" "$PATH"'], { encoding: 'utf8', timeout: 5000, maxBuffer: 32768 }).trim(); } catch {}
  const home = os.homedir();
  let nvmBins = [];
  try {
    const nvmDir = path.join(home, '.nvm', 'versions', 'node');
    nvmBins = fs.readdirSync(nvmDir)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => path.join(nvmDir, v, 'bin'));
  } catch {}
  const common = [
    ...nvmBins,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.local/bin'),
    path.join(home, '.claude/local'),
    path.join(home, '.config/manicode'),
    path.join(home, '.opencode/bin'),
    path.join(home, '.bun/bin'),
    path.join(home, '.npm-global/bin'),
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin',
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/codex-path',
    '/Applications/Codex.app/Contents/Resources/codex-cli/bin',
  ];
  process.env.PATH = [...new Set([...login.split(':'), ...common, ...(process.env.PATH || '').split(':')].filter(Boolean))].join(':');
}
