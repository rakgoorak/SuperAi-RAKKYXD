import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';

/**
 * Checkpoints: before a chat turn, the project's files are saved as a git commit that no branch
 * points to (refs/superai/checkpoints/…), built in a temporary index so the user's own index,
 * branches and files are never touched. "Rewind files" later makes the working tree match it
 * again: changed or deleted files come back, files created since are removed. Ignored files
 * (.gitignore) are neither saved nor touched. Projects that are not git repositories get none.
 */
export interface Checkpoint { commit: string; root: string }
export interface CheckpointFile { path: string; status: 'changed' | 'deleted' | 'created' }

const run = (cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) =>
  execFileSync(findExecutable('git') || 'git', ['--no-pager', ...args], { cwd, env: { ...process.env, ...cliEnv(), ...env }, encoding: 'utf8', timeout: 8000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** The project's current files as a git tree (and the repository root), without touching its index. */
function snapshotTree(cwd: string): { tree: string; root: string } {
  const root = run(cwd, ['rev-parse', '--show-toplevel']);
  const index = path.resolve(root, run(root, ['rev-parse', '--git-path', 'index']));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-checkpoint-'));
  try {
    const temp = path.join(dir, 'index');
    // Starting from the real index, git only re-reads files that changed: fast on big projects.
    if (fs.existsSync(index)) fs.copyFileSync(index, temp);
    // Bytes as they are on disk: no line-ending conversion, so a rewind gives back exactly the same file.
    run(root, ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', 'add', '-A', '--', '.'], { GIT_INDEX_FILE: temp });
    return { tree: run(root, ['write-tree'], { GIT_INDEX_FILE: temp }), root };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Saves the project's files now; undefined when it is not a git repository or git fails. */
export function createCheckpoint(cwd: string, label = 'SuperAi checkpoint'): Checkpoint | undefined {
  try {
    const { tree, root } = snapshotTree(cwd);
    let head = '';
    try { head = run(root, ['rev-parse', '--verify', '-q', 'HEAD']); } catch {}
    const commit = run(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-m', label],
      { GIT_AUTHOR_NAME: 'SuperAi', GIT_AUTHOR_EMAIL: 'checkpoint@superai.local', GIT_COMMITTER_NAME: 'SuperAi', GIT_COMMITTER_EMAIL: 'checkpoint@superai.local' });
    // A ref keeps the commit from being garbage-collected; it is not a branch and shows in no log.
    run(root, ['update-ref', `refs/superai/checkpoints/${commit}`, commit]);
    return { commit, root };
  } catch { return undefined; }
}

/** What rewinding to `checkpoint` would do to the files that are there now. */
export function checkpointChanges(checkpoint: Checkpoint): CheckpointFile[] {
  const { tree } = snapshotTree(checkpoint.root);
  const out = run(checkpoint.root, ['diff-tree', '-r', '-z', '--no-renames', '--name-status', `${checkpoint.commit}^{tree}`, tree]);
  const parts = out.split('\0').filter(Boolean);
  const files: CheckpointFile[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i];
    files.push({ path: parts[i + 1], status: status === 'A' ? 'created' : status === 'D' ? 'deleted' : 'changed' });
  }
  return files;
}

/**
 * Makes the files match `checkpoint`. A checkpoint of the current state is saved first, so the
 * rewind itself can be undone (returned as `undo`).
 */
export function restoreCheckpoint(checkpoint: Checkpoint): { files: CheckpointFile[]; undo?: Checkpoint } {
  const files = checkpointChanges(checkpoint);
  if (!files.length) return { files };
  const undo = createCheckpoint(checkpoint.root, 'SuperAi checkpoint (before rewind)');
  for (const file of files) {
    const target = path.resolve(checkpoint.root, file.path);
    const inside = path.relative(checkpoint.root, target);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) continue;
    if (file.status === 'created') { fs.rmSync(target, { force: true }); continue; }
    // Written straight from the saved bytes (git restore would apply this machine's line endings).
    const bytes = execFileSync(findExecutable('git') || 'git', ['cat-file', 'blob', `${checkpoint.commit}:${file.path}`],
      { cwd: checkpoint.root, env: { ...process.env, ...cliEnv() }, timeout: 8000, maxBuffer: 256 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return { files, undo };
}
