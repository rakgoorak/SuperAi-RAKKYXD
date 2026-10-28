import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';

const exec = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  isCurrent: boolean;
  relativeDir: string;
}

export interface MergeWorktreeResult {
  success: boolean;
  commit?: string;
  deleted?: boolean;
  conflict?: boolean;
  conflictingFiles?: string[];
  error?: string;
}

async function git(root: string, args: string[]): Promise<string> {
  const result = await exec(findExecutable('git') || 'git', ['--no-pager', ...args], {
    cwd: root,
    env: { ...process.env, ...cliEnv() },
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}

/**
 * List all active git worktrees for the repository.
 */
export async function listWorktrees(root: string): Promise<WorktreeInfo[]> {
  const output = await git(root, ['worktree', 'list', '--porcelain']);
  const blocks = output.split(/\r?\n\r?\n/).filter(b => b.trim().length > 0);
  const currentNorm = path.resolve(root);

  const worktrees: WorktreeInfo[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split(/\r?\n/);
    let wtPath = '';
    let commit = '';
    let branch = '';

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice(9).trim();
      } else if (line.startsWith('HEAD ')) {
        commit = line.slice(5).trim();
      } else if (line.startsWith('branch refs/heads/')) {
        branch = line.slice(18).trim();
      } else if (line.startsWith('branch ')) {
        branch = line.slice(7).trim();
      } else if (line === 'detached') {
        branch = '(detached)';
      }
    }

    if (!wtPath) continue;

    const resolvedPath = path.resolve(wtPath);
    const isMain = i === 0;
    const isCurrent = resolvedPath === currentNorm;

    worktrees.push({
      path: resolvedPath,
      branch: branch || '(unknown)',
      commit: commit.slice(0, 8),
      isMain,
      isCurrent,
      relativeDir: isMain ? '.' : path.basename(resolvedPath),
    });
  }

  // If none was marked current (e.g. root was a subfolder), check if root is inside one
  if (!worktrees.some(w => w.isCurrent) && worktrees.length > 0) {
    const inside = worktrees.find(w => currentNorm.startsWith(w.path));
    if (inside) inside.isCurrent = true;
    else worktrees[0].isCurrent = true;
  }

  return worktrees;
}

/**
 * Creates an isolated git worktree under `.worktrees/<branch>`.
 * Automatically ensures `.worktrees` is in `.gitignore` of the main project.
 */
export async function createWorktree(root: string, branch: string): Promise<WorktreeInfo> {
  const cleanBranch = branch.trim();
  if (!cleanBranch || !/^[a-zA-Z0-9_\-\.\/]+$/.test(cleanBranch) || cleanBranch.includes('..') || cleanBranch.startsWith('/')) {
    throw new Error('ชื่อ Branch ไม่ถูกต้อง (ต้องเป็นตัวอักษร ตัวเลข หรือขีดกลาง)');
  }

  const worktrees = await listWorktrees(root);
  const mainWt = worktrees.find(w => w.isMain) || worktrees[0];
  const mainRoot = mainWt ? mainWt.path : root;

  // 1. Auto-gitignore guard
  const gitignorePath = path.join(mainRoot, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf8');
    if (!/(?:^|\r?\n)\.worktrees\/?(?:\r?\n|$)/.test(content)) {
      await fs.appendFile(gitignorePath, `${content.endsWith('\n') ? '' : '\n'}.worktrees\n`, 'utf8');
      await git(mainRoot, ['add', '.gitignore']).catch(() => {});
      await git(mainRoot, ['commit', '-m', 'chore: ignore .worktrees directory']).catch(() => {});
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(gitignorePath, '.worktrees\n', 'utf8');
      await git(mainRoot, ['add', '.gitignore']).catch(() => {});
      await git(mainRoot, ['commit', '-m', 'chore: ignore .worktrees directory']).catch(() => {});
    }
  }

  // 2. Setup target worktree path
  const folderName = cleanBranch.replace(/\//g, '-');
  const targetDir = path.join(mainRoot, '.worktrees', folderName);
  await fs.mkdir(path.dirname(targetDir), { recursive: true });

  // 3. Add worktree
  const branchExists = await git(mainRoot, ['show-ref', '--verify', `refs/heads/${cleanBranch}`]).then(() => true, () => false);
  if (branchExists) {
    await git(mainRoot, ['worktree', 'add', targetDir, cleanBranch]);
  } else {
    await git(mainRoot, ['worktree', 'add', targetDir, '-b', cleanBranch]);
  }

  const updatedList = await listWorktrees(mainRoot);
  const created = updatedList.find(w => path.resolve(w.path) === path.resolve(targetDir));
  if (!created) {
    throw new Error(`สร้าง Worktree สำเร็จที่ ${targetDir} แต่ไม่สามารถอ่านข้อมูลได้`);
  }
  return created;
}

/**
 * Safely merges a worktree branch into the target branch (default: main).
 * Pre-checks for conflicts and aborts cleanly without leaving unmerged index state if conflict occurs.
 */
export async function mergeWorktree(
  root: string,
  sourceBranch: string,
  targetBranch: string = 'main',
  deleteAfter: boolean = false
): Promise<MergeWorktreeResult> {
  const worktrees = await listWorktrees(root);
  const mainWt = worktrees.find(w => w.isMain) || worktrees[0];
  if (!mainWt) throw new Error('ไม่พบโฟลเดอร์หลักของโปรเจกต์');
  const mainRoot = mainWt.path;

  // Check that main working tree is clean (auto-commit .gitignore if needed)
  const statusRaw = (await git(mainRoot, ['status', '--porcelain'])).trim();
  const statusLines = statusRaw ? statusRaw.split(/\r?\n/).filter(Boolean) : [];
  if (statusLines.some(l => l.endsWith('.gitignore'))) {
    await git(mainRoot, ['add', '.gitignore']).catch(() => {});
    await git(mainRoot, ['commit', '-m', 'chore: ignore .worktrees directory']).catch(() => {});
  }
  const dirtyFiles = statusLines.filter(line => !line.endsWith('.gitignore'));
  if (dirtyFiles.length > 0) {
    throw new Error('โฟลเดอร์หลัก (main) มีไฟล์ที่ยังไม่ได้บันทึกหรือ commit กรุณาจัดเก็บก่อนรวมโค้ด');
  }

  // Ensure mainRoot is on targetBranch
  const currentBranch = (await git(mainRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  if (currentBranch !== targetBranch) {
    await git(mainRoot, ['checkout', targetBranch]);
  }

  // Attempt merge
  try {
    await git(mainRoot, [
      'merge',
      '--no-ff',
      sourceBranch,
      '-m',
      `Merge worktree branch '${sourceBranch}' into ${targetBranch}`,
    ]);
  } catch {
    // Conflict or merge failure
    const statusAfter = (await git(mainRoot, ['status', '--porcelain']).catch(() => '')).trim();
    const conflictingFiles = statusAfter
      .split(/\r?\n/)
      .filter(l => /^(UU|AA|UD|DU|DD|AU|UA)\s/.test(l))
      .map(l => l.slice(3).trim());

    // Abort cleanly
    await git(mainRoot, ['merge', '--abort']).catch(() => {});

    return {
      success: false,
      conflict: true,
      conflictingFiles: conflictingFiles.length ? conflictingFiles : ['(ตรวจพบข้อขัดแย้งในการรวมไฟล์)'],
      error: `เกิดข้อขัดแย้งในการรวมโค้ด (Merge Conflict) ในไฟล์: ${conflictingFiles.join(', ')}`,
    };
  }

  const commit = (await git(mainRoot, ['rev-parse', '--short', 'HEAD'])).trim();
  let deleted = false;

  if (deleteAfter) {
    const sourceWt = worktrees.find(w => w.branch === sourceBranch);
    if (sourceWt) {
      try {
        await removeWorktree(mainRoot, sourceWt.path, true);
        deleted = true;
      } catch (e: any) {
        console.warn(`[GitWorktree] Auto-remove failed for ${sourceWt.path}:`, e.message);
      }
    }
  }

  return {
    success: true,
    commit,
    deleted,
  };
}

/**
 * Removes a git worktree and optionally deletes its local branch.
 */
export async function removeWorktree(root: string, worktreePath: string, deleteBranch: boolean = false): Promise<boolean> {
  const worktrees = await listWorktrees(root);
  const mainWt = worktrees.find(w => w.isMain) || worktrees[0];
  const mainRoot = mainWt ? mainWt.path : root;
  const targetWt = worktrees.find(w => path.resolve(w.path) === path.resolve(worktreePath));

  await git(mainRoot, ['worktree', 'remove', worktreePath, '--force']);

  if (deleteBranch && targetWt?.branch && targetWt.branch !== 'main' && targetWt.branch !== 'master') {
    await git(mainRoot, ['branch', '-D', targetWt.branch]).catch(() => {});
  }

  return true;
}
