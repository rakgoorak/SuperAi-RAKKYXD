import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Finder launches do not inherit the PATH from an interactive Terminal.
export function prepareDesktopPath() {
  if (process.platform !== 'darwin') return;
  let login = '';
  try { login = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', 'printf "%s" "$PATH"'], { encoding: 'utf8', timeout: 5000, maxBuffer: 32768 }).trim(); } catch {}
  const common = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin'), path.join(os.homedir(), '.bun/bin'), path.join(os.homedir(), '.npm-global/bin')];
  process.env.PATH = [...new Set([...login.split(':'), ...common, ...(process.env.PATH || '').split(':')].filter(Boolean))].join(':');
}
