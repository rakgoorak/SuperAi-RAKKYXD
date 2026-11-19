import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
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

let cachedGit: string | undefined;
const gitBin = () => {
  if (cachedGit) return cachedGit;
  const found = findExecutable('git');
  if (found) cachedGit = found;
  return found || 'git';
};

const run = (cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) =>
  execFileSync(gitBin(), ['--no-pager', ...args], { cwd, env: { ...process.env, ...cliEnv(), ...env }, encoding: 'utf8', timeout: 8000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const runAsync = (cwd: string, args: string[], env: NodeJS.ProcessEnv = {}, signal?: AbortSignal): Promise<string> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('aborted'));
    execFile(gitBin(), ['--no-pager', ...args], { cwd, env: { ...process.env, ...cliEnv(), ...env }, encoding: 'utf8', timeout: 8000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, ...(signal ? { signal } : {}) }, (err, stdout) => {
      if (err) reject(err);
      else resolve((stdout || '').trim());
    });
  });

const runAsyncBuffer = (cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    execFile(gitBin(), ['--no-pager', ...args], { cwd, env: { ...process.env, ...cliEnv(), ...env }, encoding: 'buffer', timeout: 8000, maxBuffer: 256 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout || ''));
    });
  });

/** The project's current files as a git tree (and the repository root), without touching its index. */
function snapshotTree(cwd: string): { tree: string; root: string } {
  const root = run(cwd, ['rev-parse', '--show-toplevel']);
  const index = path.resolve(root, run(root, ['rev-parse', '--git-path', 'index']));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-checkpoint-'));
  try {
    const temp = path.join(dir, 'index');
    // Starting from the real index, git only re-reads files that changed: fast on big projects.
    // Preserve the original index timestamps so Git's racy-git check still catches same-second edits.
    if (fs.existsSync(index)) {
      const st = fs.statSync(index);
      fs.copyFileSync(index, temp);
      fs.utimesSync(temp, st.atime, st.mtime);
    }
    // Bytes as they are on disk: no line-ending conversion, so a rewind gives back exactly the same file.
    run(root, ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', 'add', '-A', '--', '.'], { GIT_INDEX_FILE: temp });
    return { tree: run(root, ['write-tree'], { GIT_INDEX_FILE: temp }), root };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Non-blocking version of snapshotTree so the Electron main thread & cursor never freeze. */
async function snapshotTreeAsync(cwd: string, includeHead = false, signal?: AbortSignal): Promise<{ tree: string; root: string; head: string }> {
  const info = (await runAsync(cwd, ['rev-parse', '--show-toplevel', '--git-path', 'index'], {}, signal)).split(/\r?\n/);
  const root = info[0];
  const index = path.resolve(cwd, info[1]);
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'superai-checkpoint-'));
  try {
    const temp = path.join(dir, 'index');
    try {
      const st = await fsp.stat(index);
      await fsp.copyFile(index, temp);
      await fsp.utimes(temp, st.atime, st.mtime);
    } catch { /* no existing index yet */ }
    const [, head] = await Promise.all([
      runAsync(root, ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', 'add', '-A', '--', '.'], { GIT_INDEX_FILE: temp }, signal),
      includeHead ? runAsync(root, ['rev-parse', '--verify', '-q', 'HEAD'], {}, signal).catch(() => '') : Promise.resolve(''),
    ]);
    return { tree: await runAsync(root, ['write-tree'], { GIT_INDEX_FILE: temp }, signal), root, head };
  } finally { await fsp.rm(dir, { recursive: true, force: true }).catch(() => {}); }
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

/** Async version of createCheckpoint: never blocks the Electron main process UI thread. */
export async function createCheckpointAsync(cwd: string, label = 'SuperAi checkpoint', signal?: AbortSignal): Promise<Checkpoint | undefined> {
  try {
    const { tree, root, head } = await snapshotTreeAsync(cwd, true, signal);
    const commit = await runAsync(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-m', label],
      { GIT_AUTHOR_NAME: 'SuperAi', GIT_AUTHOR_EMAIL: 'checkpoint@superai.local', GIT_COMMITTER_NAME: 'SuperAi', GIT_COMMITTER_EMAIL: 'checkpoint@superai.local' }, signal);
    await runAsync(root, ['update-ref', `refs/superai/checkpoints/${commit}`, commit], {}, signal);
    return { commit, root };
  } catch { return undefined; }
}

function parseDiffTree(out: string): CheckpointFile[] {
  const parts = out.split('\0').filter(Boolean);
  const files: CheckpointFile[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i];
    files.push({ path: parts[i + 1], status: status === 'A' ? 'created' : status === 'D' ? 'deleted' : 'changed' });
  }
  return files;
}

/** What rewinding to `checkpoint` would do to the files that are there now. */
export function checkpointChanges(checkpoint: Checkpoint): CheckpointFile[] {
  const { tree } = snapshotTree(checkpoint.root);
  const out = run(checkpoint.root, ['diff-tree', '-r', '-z', '--no-renames', '--name-status', `${checkpoint.commit}^{tree}`, tree]);
  return parseDiffTree(out);
}

/** Async version of checkpointChanges. */
export async function checkpointChangesAsync(checkpoint: Checkpoint): Promise<CheckpointFile[]> {
  const { tree } = await snapshotTreeAsync(checkpoint.root);
  const out = await runAsync(checkpoint.root, ['diff-tree', '-r', '-z', '--no-renames', '--name-status', `${checkpoint.commit}^{tree}`, tree]);
  return parseDiffTree(out);
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
    const bytes = execFileSync(gitBin(), ['cat-file', 'blob', `${checkpoint.commit}:${file.path}`],
      { cwd: checkpoint.root, env: { ...process.env, ...cliEnv() }, timeout: 8000, maxBuffer: 256 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return { files, undo };
}

/** Async version of restoreCheckpoint. */
export async function restoreCheckpointAsync(checkpoint: Checkpoint): Promise<{ files: CheckpointFile[]; undo?: Checkpoint }> {
  const files = await checkpointChangesAsync(checkpoint);
  if (!files.length) return { files };
  const undo = await createCheckpointAsync(checkpoint.root, 'SuperAi checkpoint (before rewind)');
  for (const file of files) {
    const target = path.resolve(checkpoint.root, file.path);
    const inside = path.relative(checkpoint.root, target);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) continue;
    if (file.status === 'created') { await fsp.rm(target, { force: true }); continue; }
    const bytes = await runAsyncBuffer(checkpoint.root, ['cat-file', 'blob', `${checkpoint.commit}:${file.path}`]);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, bytes);
  }
  return { files, undo };
}
