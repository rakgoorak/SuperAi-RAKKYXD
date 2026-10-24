import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { listWorktrees, createWorktree, mergeWorktree, removeWorktree } from '../GitWorktrees.js';

const exec = promisify(execFile);

async function runGit(cwd: string, args: string[]) {
  return (await exec('git', ['--no-pager', ...args], { cwd, windowsHide: true })).stdout.trim();
}

test('GitWorktrees: lifecycle of list, create, merge, and cleanup', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-worktree-test-'));
  try {
    // 1. Initialize temporary git repository
    await runGit(tempDir, ['init', '-b', 'main']);
    await runGit(tempDir, ['config', 'user.name', 'SuperAi Tester']);
    await runGit(tempDir, ['config', 'user.email', 'test@superai.local']);
    await runGit(tempDir, ['config', 'commit.gpgsign', 'false']);

    // Create initial commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Main Repo\nInitial content\n', 'utf8');
    await runGit(tempDir, ['add', 'README.md']);
    await runGit(tempDir, ['commit', '-m', 'Initial commit']);

    // 2. listWorktrees should show main worktree
    const initialList = await listWorktrees(tempDir);
    assert.equal(initialList.length, 1);
    assert.equal(initialList[0].isMain, true);
    assert.equal(initialList[0].branch, 'main');
    assert.equal(initialList[0].isCurrent, true);

    // 3. createWorktree should create .worktrees/feature-alpha and add .worktrees to .gitignore
    const created = await createWorktree(tempDir, 'feature-alpha');
    assert.equal(created.branch, 'feature-alpha');
    assert.equal(created.isMain, false);
    assert.match(created.path, /\.worktrees[\\\/]feature-alpha$/);

    // Verify .gitignore was updated
    const gitignoreContent = await fs.readFile(path.join(tempDir, '.gitignore'), 'utf8');
    assert.match(gitignoreContent, /\.worktrees/);

    // Verify listWorktrees now shows 2 worktrees
    const twoWorktrees = await listWorktrees(tempDir);
    assert.equal(twoWorktrees.length, 2);
    const featureWt = twoWorktrees.find(w => w.branch === 'feature-alpha');
    assert.ok(featureWt);

    // 4. Make a commit inside the feature worktree
    const featureFile = path.join(created.path, 'feature.txt');
    await fs.writeFile(featureFile, 'New Feature Content\n', 'utf8');
    await runGit(created.path, ['add', 'feature.txt']);
    await runGit(created.path, ['commit', '-m', 'Add new feature']);

    // 5. mergeWorktree into main with deleteAfter = true
    const mergeResult = await mergeWorktree(tempDir, 'feature-alpha', 'main', true);
    assert.equal(mergeResult.success, true);
    assert.equal(mergeResult.deleted, true);

    // Verify feature.txt now exists in main
    const mergedFeatureFile = await fs.readFile(path.join(tempDir, 'feature.txt'), 'utf8');
    assert.equal(mergedFeatureFile.trim(), 'New Feature Content');

    // Verify worktree list is back to 1
    const postMergeList = await listWorktrees(tempDir);
    assert.equal(postMergeList.length, 1);
    assert.equal(postMergeList[0].branch, 'main');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('GitWorktrees: detects merge conflict and aborts safely without corrupting main', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-worktree-conflict-'));
  try {
    await runGit(tempDir, ['init', '-b', 'main']);
    await runGit(tempDir, ['config', 'user.name', 'SuperAi Tester']);
    await runGit(tempDir, ['config', 'user.email', 'test@superai.local']);
    await runGit(tempDir, ['config', 'commit.gpgsign', 'false']);

    await fs.writeFile(path.join(tempDir, 'shared.txt'), 'Original Line\n', 'utf8');
    await runGit(tempDir, ['add', 'shared.txt']);
    await runGit(tempDir, ['commit', '-m', 'Base commit']);

    // Create worktree
    const wt = await createWorktree(tempDir, 'conflict-branch');

    // Edit shared.txt on main
    await fs.writeFile(path.join(tempDir, 'shared.txt'), 'Main Modified Line\n', 'utf8');
    await runGit(tempDir, ['add', 'shared.txt']);
    await runGit(tempDir, ['commit', '-m', 'Main edit']);

    // Edit shared.txt differently on conflict-branch
    await fs.writeFile(path.join(wt.path, 'shared.txt'), 'Branch Conflicting Line\n', 'utf8');
    await runGit(wt.path, ['add', 'shared.txt']);
    await runGit(wt.path, ['commit', '-m', 'Branch edit']);

    // Attempt merge
    const result = await mergeWorktree(tempDir, 'conflict-branch', 'main', false);
    assert.equal(result.success, false);
    assert.equal(result.conflict, true);
    assert.ok(result.conflictingFiles && result.conflictingFiles.length > 0);

    // Verify main working tree is still clean and on main
    const status = await runGit(tempDir, ['status', '--porcelain']);
    assert.equal(status, '', 'Working tree should remain clean after conflict abort');

    // Clean up worktree explicitly with removeWorktree
    await removeWorktree(tempDir, wt.path, true);
    const list = await listWorktrees(tempDir);
    assert.equal(list.length, 1);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('GitWorktrees: rejects invalid branch names and prevents directory traversal', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-worktree-sec-'));
  try {
    await runGit(tempDir, ['init', '-b', 'main']);
    await runGit(tempDir, ['config', 'user.name', 'SuperAi Tester']);
    await runGit(tempDir, ['config', 'user.email', 'test@superai.local']);
    await runGit(tempDir, ['config', 'commit.gpgsign', 'false']);
    await fs.writeFile(path.join(tempDir, 'init.txt'), 'init', 'utf8');
    await runGit(tempDir, ['add', 'init.txt']);
    await runGit(tempDir, ['commit', '-m', 'init']);

    await assert.rejects(() => createWorktree(tempDir, '../traversal'), /ชื่อ Branch ไม่ถูกต้อง/);
    await assert.rejects(() => createWorktree(tempDir, 'invalid;cmd'), /ชื่อ Branch ไม่ถูกต้อง/);
    await assert.rejects(() => createWorktree(tempDir, '   '), /ชื่อ Branch ไม่ถูกต้อง/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
