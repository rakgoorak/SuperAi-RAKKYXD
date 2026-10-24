import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StudioServer } from '../StudioServer.js';

const exec = promisify(execFile);

async function runGit(cwd: string, args: string[]) {
  return (await exec('git', ['--no-pager', ...args], { cwd, windowsHide: true })).stdout.trim();
}

test('StudioServer: REST endpoints for Git Worktrees and Merge', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-studio-wt-'));
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-studio-config-'));
  const regFile = path.join(configDir, 'registry.json');
  let server: StudioServer | null = null;

  try {
    // Setup git repo
    await runGit(tempDir, ['init', '-b', 'main']);
    await runGit(tempDir, ['config', 'user.name', 'Studio Tester']);
    await runGit(tempDir, ['config', 'user.email', 'tester@superai.local']);
    await runGit(tempDir, ['config', 'commit.gpgsign', 'false']);
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Studio Repo\n', 'utf8');
    await runGit(tempDir, ['add', 'README.md']);
    await runGit(tempDir, ['commit', '-m', 'Initial commit']);

    // Setup registry in configDir (outside git repo)
    const initialWs = [{ id: 'ws-test', name: 'Test WS', rootPath: tempDir, threads: [] }];
    await fs.writeFile(regFile, JSON.stringify(initialWs), 'utf8');

    server = new StudioServer({
      port: 0,
      customWorkspacePath: regFile,
    });
    const port = await server.start();
    const base = `http://127.0.0.1:${port}`;

    // 1. GET /api/workspaces/ws-test/worktrees
    const getRes = await fetch(`${base}/api/workspaces/ws-test/worktrees`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(Array.isArray(getData.worktrees));
    assert.equal(getData.worktrees.length, 1);
    assert.equal(getData.isWorktree, false);
    assert.equal(getData.current?.branch, 'main');

    // 2. POST /api/workspaces/ws-test/worktrees
    const postRes = await fetch(`${base}/api/workspaces/ws-test/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: 'feature-endpoint-test' }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.success, true);
    assert.equal(postData.worktree.branch, 'feature-endpoint-test');

    // Make a commit in the feature worktree
    const featureFile = path.join(postData.worktree.path, 'endpoint.txt');
    await fs.writeFile(featureFile, 'Endpoint Content\n', 'utf8');
    await runGit(postData.worktree.path, ['add', 'endpoint.txt']);
    await runGit(postData.worktree.path, ['commit', '-m', 'Add endpoint test']);

    // 3. POST /api/workspaces/ws-test/worktrees/merge
    const mergeRes = await fetch(`${base}/api/workspaces/ws-test/worktrees/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBranch: 'feature-endpoint-test',
        targetBranch: 'main',
        deleteAfter: true,
      }),
    });
    assert.equal(mergeRes.status, 200);
    const mergeData = await mergeRes.json();
    assert.equal(mergeData.success, true);
    assert.equal(mergeData.deleted, true);

    // Verify endpoint.txt is in main
    const mergedContent = await fs.readFile(path.join(tempDir, 'endpoint.txt'), 'utf8');
    assert.equal(mergedContent.trim(), 'Endpoint Content');

    // 4. Verify worktrees count is 1 again
    const finalGet = await fetch(`${base}/api/workspaces/ws-test/worktrees`);
    const finalData = await finalGet.json();
    assert.equal(finalData.worktrees.length, 1);
  } finally {
    if (server) await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(configDir, { recursive: true, force: true }).catch(() => {});
  }
});
