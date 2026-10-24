import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { projectChanges, projectFile, stageFile, unstageFile, discardFile, saveProjectFile } from '../server/ProjectChanges.js';
import { StudioServer } from '../server/StudioServer.js';
import { recoveryHint } from '../client/src/recovery.js';

test('changes include staged, unstaged, untracked and deleted files; contents stay within project', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-changes-'));
 const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-outside-'));
 const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
 try {
  git('init');
  git('config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'before\n');
  await fs.mkdir(path.join(root, 'nested'));
  await fs.writeFile(path.join(root, 'nested', 'deleted.txt'), 'gone\n');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture');

  await fs.writeFile(path.join(root, 'tracked.txt'), 'after\n');
  await fs.rm(path.join(root, 'nested'), { recursive: true });
  await fs.writeFile(path.join(root, 'new.txt'), 'new');
  await fs.writeFile(path.join(root, 'staged.txt'), 'stage');
  git('add', 'staged.txt');

  const changes = await projectChanges(root);
  assert.deepEqual(changes.files.sort(), ['nested/deleted.txt', 'new.txt', 'staged.txt', 'tracked.txt']);

  const file = await projectFile(root, 'tracked.txt');
  assert.equal(file.content.replace(/\r\n/g, '\n'), 'after\n');
  assert.equal(file.originalContent.replace(/\r\n/g, '\n'), 'before\n');
  assert.match(file.diff, /\+after/);

  const deletedFile = await projectFile(root, 'nested/deleted.txt');
  assert.equal(deletedFile.deleted, true);
  assert.equal(deletedFile.content, '');
  assert.equal(deletedFile.originalContent.replace(/\r\n/g, '\n'), 'gone\n');

  const newFile = await projectFile(root, 'new.txt');
  assert.equal(newFile.content, 'new');
  assert.equal(newFile.originalContent, '');
  assert.equal(newFile.deleted, false);

  await assert.rejects(projectFile(root, '../escape'), /โปรเจกต์/);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside');
  await fs.symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(projectFile(root, 'link/secret.txt'), /โปรเจกต์/);
  await assert.rejects(projectFile(root, 'link/deleted.txt'), /โปรเจกต์/);
  await fs.writeFile(path.join(root, 'binary'), Buffer.from([0, 1]));
  await assert.rejects(projectFile(root, 'binary'), /ไบนารี/);
  await fs.writeFile(path.join(root, 'large'), 'x'.repeat(256 * 1024 + 1));
  await assert.rejects(projectFile(root, 'large'), /256/);
 } finally {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
 }
});

test('git file manipulation helpers: stageFile, unstageFile, discardFile, saveProjectFile', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-git-ops-'));
 const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
 try {
  git('init');
  git('config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'version 1\n');
  await fs.mkdir(path.join(root, 'sub'));
  await fs.writeFile(path.join(root, 'sub', 'initial.txt'), 'initial\n');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial');

  // 1. saveProjectFile
  assert.equal(await saveProjectFile(root, 'saved.txt', 'saved content'), true);
  assert.equal(await fs.readFile(path.join(root, 'saved.txt'), 'utf8'), 'saved content');
  assert.equal(await saveProjectFile(root, 'deep/dir/nested.txt', 'deep content'), true);
  assert.equal(await fs.readFile(path.join(root, 'deep', 'dir', 'nested.txt'), 'utf8'), 'deep content');
  await assert.rejects(saveProjectFile(root, '../escape.txt', 'bad'), /โปรเจกต์/);
  await assert.rejects(saveProjectFile(root, 'bad.txt', null as any), /ข้อมูลไฟล์ไม่ถูกต้อง/);

  // 2. stageFile
  assert.equal(await stageFile(root, 'saved.txt'), true);
  let status = git('status', '--porcelain').toString();
  assert.match(status, /A  saved\.txt/);

  await fs.writeFile(path.join(root, 'tracked.txt'), 'version 2\n');
  assert.equal(await stageFile(root, 'tracked.txt'), true);
  status = git('status', '--porcelain').toString();
  assert.match(status, /M  tracked\.txt/);
  await assert.rejects(stageFile(root, '../outside.txt'), /โปรเจกต์/);

  // 3. unstageFile
  assert.equal(await unstageFile(root, 'saved.txt'), true);
  status = git('status', '--porcelain').toString();
  assert.match(status, /\?\? saved\.txt/);

  assert.equal(await unstageFile(root, 'tracked.txt'), true);
  status = git('status', '--porcelain').toString();
  assert.match(status, / M tracked\.txt/);
  await assert.rejects(unstageFile(root, '../outside.txt'), /โปรเจกต์/);

  // 4. discardFile
  // Discard modified file -> restores version 1
  assert.equal(await discardFile(root, 'tracked.txt'), true);
  assert.equal((await fs.readFile(path.join(root, 'tracked.txt'), 'utf8')).replace(/\r\n/g, '\n'), 'version 1\n');

  // Discard deleted file -> restores file from HEAD
  await fs.rm(path.join(root, 'sub', 'initial.txt'));
  assert.equal(await discardFile(root, 'sub/initial.txt'), true);
  assert.equal((await fs.readFile(path.join(root, 'sub', 'initial.txt'), 'utf8')).replace(/\r\n/g, '\n'), 'initial\n');

  // Discard untracked file -> removes from disk
  assert.equal(await discardFile(root, 'saved.txt'), true);
  await assert.rejects(fs.stat(path.join(root, 'saved.txt')), /ENOENT/);

  // Discard newly created and staged file -> unlinks and removes from stage
  await fs.writeFile(path.join(root, 'new-staged.txt'), 'staged new');
  git('add', 'new-staged.txt');
  assert.equal(await discardFile(root, 'new-staged.txt'), true);
  await assert.rejects(fs.stat(path.join(root, 'new-staged.txt')), /ENOENT/);
  assert.ok(!git('status', '--porcelain').toString().includes('new-staged.txt'));

  await assert.rejects(discardFile(root, '../outside.txt'), /โปรเจกต์/);
 } finally {
  await fs.rm(root, { recursive: true, force: true });
 }
});

test('StudioServer REST endpoints for file actions: stage, unstage, discard, save', async () => {
 const tempWorkspaceFile = path.join(os.tmpdir(), `test-files-ws-${Date.now()}.json`);
 const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-ws-repo-'));
 const server = new StudioServer({ port: 0, customWorkspacePath: tempWorkspaceFile });
 const git = (...args: string[]) => execFileSync('git', args, { cwd: repoRoot, windowsHide: true });

 await server.start();
 const port = server.getPort();

 try {
  git('init');
  git('config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(repoRoot, 'initial.txt'), 'initial\n');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init');

  // Create workspace
  const createRes = await fetch(`http://localhost:${port}/api/workspaces`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ name: 'test-project', rootPath: repoRoot })
  });
  const ws = await createRes.json();
  const wsId = ws.id;
  assert.ok(wsId);

  // 1. POST /api/workspaces/:wsId/files/save
  const saveRes = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/save`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: 'api-file.txt', content: 'hello from api' })
  });
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.equal(saveData.success, true);
  assert.equal(await fs.readFile(path.join(repoRoot, 'api-file.txt'), 'utf8'), 'hello from api');

  // 2. POST /api/workspaces/:wsId/files/stage
  const stageRes = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/stage`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: 'api-file.txt' })
  });
  assert.equal(stageRes.status, 200);
  assert.equal((await stageRes.json()).success, true);
  assert.match(git('status', '--porcelain').toString(), /A  api-file\.txt/);

  // 3. POST /api/workspaces/:wsId/files/unstage
  const unstageRes = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/unstage`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: 'api-file.txt' })
  });
  assert.equal(unstageRes.status, 200);
  assert.equal((await unstageRes.json()).success, true);
  assert.match(git('status', '--porcelain').toString(), /\?\? api-file\.txt/);

  // 4. POST /api/workspaces/:wsId/files/discard
  const discardRes = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/discard`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: 'api-file.txt' })
  });
  assert.equal(discardRes.status, 200);
  assert.equal((await discardRes.json()).success, true);
  await assert.rejects(fs.stat(path.join(repoRoot, 'api-file.txt')), /ENOENT/);

  // 5. Error handling: 404 for unknown workspace
  const notFound = await fetch(`http://localhost:${port}/api/workspaces/unknown-ws/files/stage`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: 'any.txt' })
  });
  assert.equal(notFound.status, 404);

  // 6. Error handling: 400 for empty or invalid filePath
  const badPath = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/stage`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: '' })
  });
  assert.equal(badPath.status, 400);

  // 7. Error handling: 400 for path traversal
  const traversal = await fetch(`http://localhost:${port}/api/workspaces/${wsId}/files/save`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ filePath: '../escape.txt', content: 'hack' })
  });
  assert.equal(traversal.status, 400);

 } finally {
  await server.stop();
  await fs.rm(repoRoot, { recursive: true, force: true });
  await fs.rm(tempWorkspaceFile, { force: true });
 }
});

test('recovery guidance distinguishes quota, account and network failures', () => {
 assert.match(recoveryHint('429 rate limit'), /โควตา/);
 assert.match(recoveryHint('401 login required'), /บัญชี/);
 assert.match(recoveryHint('ECONNRESET timeout'), /เชื่อมต่อ/);
});
