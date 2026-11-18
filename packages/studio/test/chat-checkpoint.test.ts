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
