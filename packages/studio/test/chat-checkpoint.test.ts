import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { CliChatManager } from '../server/CliChat.js';

test('an editing chat turn saves a checkpoint; Rewind files and Undo work through the manager', (t) => {
  process.env.SUPERAI_CHECKPOINTS = 'on'; t.after(() => { process.env.SUPERAI_CHECKPOINTS = 'off'; });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-chat-cp-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const proc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  try {
    fs.writeFileSync(path.join(dir, 'app.ts'), 'export const x = 1;\n');
    git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
    const manager = new CliChatManager(() => proc as any, undefined, (command, args) => ({ command, args }));
    manager.send('cp-chat', { agent: 'codex', cwd: dir, text: 'change x', permission: 'edit' } as any);
    const user = manager.snapshot('cp-chat').items.find((i: any) => i.kind === 'user') as any;
    assert.ok(user?.checkpoint?.commit, 'the turn has a checkpoint');
    assert.throws(() => manager.rewind('cp-chat', user.id), /AI/, 'no rewind while the AI is working');
    fs.writeFileSync(path.join(dir, 'app.ts'), 'export const x = 2;\n');
    fs.writeFileSync(path.join(dir, 'extra.ts'), 'new\n');
    proc.stdout.write(JSON.stringify({ type: 'turn.completed', usage: {} }) + '\n');
    proc.emit('close', 0);
    assert.deepEqual(manager.checkpointPreview('cp-chat', user.id).map((f) => f.status).sort(), ['changed', 'created']);
    assert.equal(manager.rewind('cp-chat', user.id).length, 2);
    assert.equal(fs.readFileSync(path.join(dir, 'app.ts'), 'utf8'), 'export const x = 1;\n');
    assert.ok(!fs.existsSync(path.join(dir, 'extra.ts')));
    manager.undoRewind('cp-chat');
    assert.equal(fs.readFileSync(path.join(dir, 'app.ts'), 'utf8'), 'export const x = 2;\n', 'undo puts the AI changes back');
    assert.throws(() => manager.undoRewind('cp-chat'), /ย้อนไฟล์|rewind/i, 'only one undo');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a read-only turn saves no checkpoint', () => {
  const proc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  const manager = new CliChatManager(() => proc as any, undefined, (command, args) => ({ command, args }));
  manager.send('cp-read', { agent: 'codex', cwd: process.cwd(), text: 'look only', permission: 'read' } as any);
  assert.equal((manager.snapshot('cp-read').items.find((i: any) => i.kind === 'user') as any).checkpoint, undefined);
  proc.emit('close', 0);
});

test('sendAsync creates checkpoints without blocking the event loop and skips checkpoints for /compact', async (t) => {
  process.env.SUPERAI_CHECKPOINTS = 'on'; t.after(() => { process.env.SUPERAI_CHECKPOINTS = 'off'; });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-chat-cp-async-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const makeProc = () => Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  try {
    fs.writeFileSync(path.join(dir, 'app.ts'), 'export const x = 1;\n');
    git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
    const procs: any[] = [];
    const manager = new CliChatManager(() => { const p = makeProc(); procs.push(p); return p; }, undefined, (command, args) => ({ command, args }));

    // /compact skips checkpointing even with edit permission
    await manager.sendAsync('cp-compact', { agent: 'codex', cwd: dir, text: '/compact', permission: 'edit' } as any);
    const compactUser = manager.snapshot('cp-compact').items.find((i: any) => i.kind === 'user') as any;
    assert.equal(compactUser?.checkpoint, undefined, '/compact should not create a git checkpoint');
    procs[0].emit('close', 0);

    // Editing turn via sendAsync creates checkpoint asynchronously while event loop keeps ticking
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 5);
    try {
      await manager.sendAsync('cp-async', { agent: 'codex', cwd: dir, text: 'change x', permission: 'edit' } as any);
    } finally { clearInterval(timer); }
    assert.ok(ticks > 0, 'event loop stayed responsive while creating checkpoint asynchronously');
    const user = manager.snapshot('cp-async').items.find((i: any) => i.kind === 'user') as any;
    assert.ok(user?.checkpoint?.commit, 'sendAsync saved a checkpoint');
    fs.writeFileSync(path.join(dir, 'app.ts'), 'export const x = 2;\n');
    procs[1].emit('close', 0);
    const preview = await manager.checkpointPreviewAsync('cp-async', user.id);
    assert.deepEqual(preview.map((f) => f.status), ['changed']);
    await manager.rewindAsync('cp-async', user.id);
    assert.equal(fs.readFileSync(path.join(dir, 'app.ts'), 'utf8'), 'export const x = 1;\n');
    await manager.undoRewindAsync('cp-async');
    assert.equal(fs.readFileSync(path.join(dir, 'app.ts'), 'utf8'), 'export const x = 2;\n');

    // deferCheckpoint: sendAsync returns before git finishes, attaches checkpoint before spawning CLI, and cancel() aborts cleanly
    const tStart = performance.now();
    await manager.sendAsync('cp-defer', { agent: 'codex', cwd: dir, text: 'deferred edit', permission: 'edit' } as any, { deferCheckpoint: true });
    const sendElapsed = performance.now() - tStart;
    assert.ok(sendElapsed < 150, `deferCheckpoint returned in ${Math.round(sendElapsed)}ms`);
    assert.equal(procs.length, 2, 'CLI should not spawn synchronously before async checkpoint completes');
    for (let i = 0; i < 400 && procs.length < 3; i++) await new Promise((r) => setTimeout(r, 25));
    assert.equal(procs.length, 3, 'CLI spawned once deferred checkpoint finished');
    const deferredUser = manager.snapshot('cp-defer').items.find((i: any) => i.kind === 'user') as any;
    assert.ok(deferredUser?.checkpoint?.commit, 'deferred checkpoint attached before CLI launched');
    procs[2].emit('close', 0);
    for (let i = 0; i < 100 && manager.isRunning('cp-defer'); i++) await new Promise((r) => setTimeout(r, 15));

    // cancel() while preparing stops immediately and never spawns the CLI
    await manager.sendAsync('cp-cancel', { agent: 'codex', cwd: dir, text: 'cancel me', permission: 'edit' } as any, { deferCheckpoint: true });
    assert.equal(manager.cancel('cp-cancel'), true);
    for (let i = 0; i < 100 && manager.isRunning('cp-cancel'); i++) await new Promise((r) => setTimeout(r, 15));
    assert.equal(manager.isRunning('cp-cancel'), false);
    assert.equal(procs.length, 3, 'cancelled deferred turn never spawned CLI');
    assert.ok(manager.snapshot('cp-cancel').items.some((i: any) => i.kind === 'notice' && i.text === 'หยุดแล้ว'));
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); }
});
