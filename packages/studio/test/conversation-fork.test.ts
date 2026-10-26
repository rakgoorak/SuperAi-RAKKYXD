import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliChatManager } from '../server/CliChat.js';
import { StudioServer } from '../server/StudioServer.js';

const history = [
  { id: 't1-user', kind: 'user', text: 'question before fork', at: 1 },
  { id: 't1-answer', kind: 'assistant', text: 'answer to keep', at: 2 },
  { id: 't2-user', kind: 'user', text: 'future private question', at: 3 },
];
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-fork-'));
  fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ items: history, conversationId: 'original-provider-id', turns: 2 }));
  const calls: { args: string[]; input: string; proc: any }[] = [];
  const spawn = (_command: string, args: string[]) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough(); proc.kill = () => true;
    const call = { args, input: '', proc };
    proc.stdin.on('data', (value: Buffer) => { call.input += value.toString(); });
    calls.push(call); return proc;
  };
  const create = () => new CliChatManager(spawn, dir, (id, args) => ({ command: id, args }));
  return { dir, calls, create };
}

test('fork preserves only history through the selected message, without sharing provider IDs or starting a process', () => {
  const { dir, calls, create } = fixture(); const manager = create();
  try {
    const before = manager.snapshot('source');
    manager.installFork('fork', manager.forkData('source', 't1-answer'));
    assert.equal(calls.length, 0);
    assert.deepEqual(manager.snapshot('source'), before);
    assert.deepEqual(manager.snapshot('fork').items, history.slice(0, 2));
    assert.equal(manager.snapshot('fork').conversationId, undefined);
    const resumed = create();
    resumed.send('fork', { agent: 'codex', cwd: dir, text: 'continue' });
    assert.match(calls[0].input, /question before fork/);
    assert.match(calls[0].input, /answer to keep/);
    assert.doesNotMatch(calls[0].input, /future private question/);
    assert.ok(!calls[0].args.includes('original-provider-id'));
    calls[0].proc.stdout.emit('data', JSON.stringify({ type: 'thread.started', thread_id: 'independent-id' }) + '\n');
    calls[0].proc.emit('close', 0);
    resumed.send('fork', { agent: 'codex', cwd: dir, text: 'another question' });
    assert.ok(calls[1].args.includes('independent-id'));
    assert.doesNotMatch(calls[1].input, /answer to keep/, 'the transcript is not replayed after the independent CLI conversation exists');
    calls[1].proc.emit('close', 0); resumed.stopAll();
  } finally { manager.stopAll(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('side chat inherits only the selected excerpt, and rejects missing or excessive context', () => {
  const { dir, calls, create } = fixture(); const manager = create();
  try {
    const side = manager.forkData('source', 't1-answer', 'selected excerpt');
    manager.installFork('side', side);
    manager.send('side', { agent: 'claude-code', cwd: dir, text: 'explain' });
    assert.match(calls[0].input, /selected excerpt/);
    assert.doesNotMatch(calls[0].input, /question before fork|future private question|answer to keep/);
    assert.throws(() => manager.forkData('source', 'missing'), /ไม่พบ/);
    assert.throws(() => manager.forkData('source', 't1-answer', 'x'.repeat(13000)), /ยาวเกิน/);
    assert.throws(() => manager.forkData('side', 't1-answer'), /ไม่พบ/);
    calls[0].proc.emit('close', 0);
  } finally { manager.stopAll(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP fork creates a persisted dormant chat in the same project and never resumes the original provider conversation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-fork-http-'));
  const server = new StudioServer({ port: 0, customWorkspacePath: path.join(dir, 'workspaces.json') });
  await server.start();
  try {
    const internals = server as any;
    internals.terminalManager.addDormant({ id: 'source', options: { agentType: 'codex', cwd: dir, wsId: 'project', name: 'Original', model: 'model-a' } });
    internals.views.set('source', 'chat');
    internals.chats.installFork('source', { items: history, turns: 2, seed: 'initial history' });
    internals.chats.setConversation('source', 'original-provider-id');
    const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/terminals/source/chat/fork`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: 't1-answer' }) });
    assert.equal(response.status, 200);
    const fork = await response.json();
    assert.notEqual(fork.id, 'source'); assert.equal(fork.dormant, true); assert.equal(fork.wsId, 'project'); assert.equal(fork.view, 'chat');
    assert.equal(internals.chats.snapshot(fork.id).conversationId, undefined);
    assert.equal(internals.chats.snapshot('source').conversationId, 'original-provider-id');
    assert.equal(internals.terminalManager.listSessions().length, 2);
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
