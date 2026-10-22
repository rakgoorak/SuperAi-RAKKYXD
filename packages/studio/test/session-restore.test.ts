import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resumeArgs, claudeTranscriptExists, findCodexSession } from '../server/SessionRestore.js';
import { TerminalSessionManager } from '../server/TerminalSessionManager.js';

test('sleep waits for both CLI exit and process-tree termination before releasing the session', async (t) => {
  const manager = new TerminalSessionManager();
  const session = manager.addDormant({ id: 'handoff', options: { agentType: 'codex' } });
  session.status = 'running';
  session.dormant = false;
  t.mock.method(manager as any, 'terminate', () => {});
  let resolved = false;
  const sleeping = manager.sleepSession(session.id).then(() => { resolved = true; });
  assert.equal(session.status, 'stopping');
  assert.throws(() => manager.restartSession(session.id), /ยังทำงาน/);
  session.exitObserved = true;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(resolved, false, 'the parent exiting does not prove its children stopped');
  session.terminationConfirmed = true;
  await sleeping;
  assert.equal(session.status, 'exited');
  assert.equal(session.dormant, true);
  assert.equal(session.sleeping, false);
});

test('a handoff timeout keeps the writer occupied and can complete after exit', async (t) => {
  const manager = new TerminalSessionManager();
  const session = manager.addDormant({ id: 'slow-handoff', options: { agentType: 'codex' } });
  session.status = 'running';
  t.mock.method(manager as any, 'terminate', () => {});
  await assert.rejects(manager.sleepSession(session.id, 0), /ยังปิดไม่เสร็จ/);
  assert.equal(session.status, 'stopping');
  assert.throws(() => manager.restartSession(session.id), /ยังทำงาน/);
  session.exitObserved = session.terminationConfirmed = true;
  assert.equal(await manager.sleepSession(session.id), true);
  assert.equal(session.status, 'exited');
});

test('a real pipe process closes before the terminal becomes dormant', async () => {
  const manager = new TerminalSessionManager();
  const session = manager.spawnSession({ command: process.execPath, args: ['-e', 'setTimeout(() => {}, 20000)'], forcePipe: true });
  try {
    assert.equal(await manager.sleepSession(session.id), true);
    assert.equal(session.exitObserved, true);
    assert.equal(session.terminationConfirmed, true);
    assert.equal(session.process, undefined);
    assert.equal(session.status, 'exited');
  } finally { manager.killAll(); }
});

test('closing a tab during handoff cannot release it back to chat', async (t) => {
  const manager = new TerminalSessionManager();
  const session = manager.addDormant({ id: 'closed-handoff', options: { agentType: 'codex' } });
  session.status = 'running';
  t.mock.method(manager as any, 'terminate', () => {});
  const sleeping = manager.sleepSession(session.id);
  assert.equal(manager.killSession(session.id), true);
  await assert.rejects(sleeping, /session เปลี่ยนไปแล้ว/);
  assert.equal(session.closeRequested, true);
  assert.equal(session.status, 'stopping');
});

test('each CLI is resumed with its own flags', () => {
  assert.deepEqual(resumeArgs('claude-code', 'abc'), ['--resume', 'abc']);
  assert.deepEqual(resumeArgs('codex', 'abc'), ['resume', 'abc']);
  assert.deepEqual(resumeArgs('codex', 'last'), ['resume', '--last']);
  assert.deepEqual(resumeArgs('opencode', 'last'), ['--continue']);
  assert.deepEqual(resumeArgs('antigravity', 'last'), ['--continue']);
  assert.deepEqual(resumeArgs('terminal', 'last'), []);
  assert.deepEqual(resumeArgs('codex'), []);
});

test('the conversation each tab had is found on disk', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-restore-'));
  try {
    fs.mkdirSync(path.join(home, '.claude', 'projects', 'D--Work'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'projects', 'D--Work', 'c1.jsonl'), '{}');
    assert.equal(claudeTranscriptExists('c1', home), true);
    assert.equal(claudeTranscriptExists('c2', home), false);

    const opened = Date.now() - 60_000;
    const day = new Date(opened);
    const dir = path.join(home, '.codex', 'sessions', String(day.getFullYear()), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    const rollout = (id: string, cwd: string, at: number) =>
      // Real rollouts start with a huge line (the whole system prompt follows the ids).
      fs.writeFileSync(path.join(dir, `rollout-${id}.jsonl`), JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { session_id: id, id, timestamp: new Date(at).toISOString(), cwd, base_instructions: { text: 'x'.repeat(40_000) } } }) + '\n{"more":1}\n');
    const work = path.join(home, 'work');
    rollout('old', work, opened - 3_600_000);
    rollout('other-folder', path.join(home, 'elsewhere'), opened + 1000);
    rollout('first', work, opened + 2000);
    rollout('second', work, opened + 9000);
    const taken = new Set<string>();
    assert.equal(findCodexSession(work, opened, taken, home), 'first');
    taken.add('first');
    assert.equal(findCodexSession(work, opened, taken, home), 'second');
    assert.equal(findCodexSession(path.join(home, 'none'), opened, new Set(), home), null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('open tabs are saved and reopened with the same ids; "latest conversation" goes to one tab', async () => {
  const manager = new TerminalSessionManager();
  const keepAlive = ['-e', 'setTimeout(() => {}, 20000)'];
  const a = manager.spawnSession({ name: 'OpenCode 1', agentType: 'opencode', command: process.execPath, args: keepAlive, forcePipe: true });
  await new Promise((r) => setTimeout(r, 5));
  const b = manager.spawnSession({ name: 'OpenCode 2', agentType: 'opencode', command: process.execPath, args: keepAlive, forcePipe: true });
  const shell = manager.spawnSession({ name: 'Shell', command: process.execPath, args: keepAlive, forcePipe: true });
  const saved = JSON.parse(JSON.stringify(manager.snapshot()));
  assert.deepEqual(saved.map((s: any) => s.id), [a.id, b.id, shell.id]);
  assert.equal(saved[0].resume, undefined);
  assert.equal(saved[1].resume, 'last');
  assert.equal(saved[2].resume, undefined);
  manager.killAll();

  const next = new TerminalSessionManager();
  next.restore(saved);
  const reopened = next.listSessions();
  assert.deepEqual(reopened.map((s) => s.id), [a.id, b.id, shell.id]);
  assert.deepEqual(reopened.map((s) => s.name), ['OpenCode 1', 'OpenCode 2', 'Shell']);
  assert.ok(reopened.every((s) => s.status === 'running'));
  next.restore(saved); // a second restore does not duplicate tabs
  assert.equal(next.listSessions().length, 3);
  next.killAll();
});
