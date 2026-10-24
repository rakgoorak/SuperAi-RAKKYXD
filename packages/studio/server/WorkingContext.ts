import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cliEnv, findExecutable } from './CliCatalog.js';
const exec = promisify(execFile);

/** Read only: the caller supplies a registered workspace/session directory, never a query path. */
export async function workingContext(cwd: string) {
  const git = (args: string[]) => exec(findExecutable('git') || 'git', args, { cwd, env: { ...process.env, ...cliEnv() }, windowsHide: true, timeout: 5000, maxBuffer: 65536 });
  try {
    await git(['rev-parse', '--is-inside-work-tree']);
    try {
      const { stdout } = await git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
      return { cwd, git: 'ready', branch: stdout.trim(), commit: null };
    } catch {
      const { stdout } = await git(['rev-parse', '--short', 'HEAD']);
      return { cwd, git: 'ready', branch: null, commit: stdout.trim() };
    }
  } catch (error) {
    return { cwd, git: /not a git repository/i.test(String((error as { stderr?: string }).stderr)) ? 'none' : 'unavailable', branch: null, commit: null };
  }
}
