import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliChatManager } from '../server/CliChat.js';

function fixture(startup = 90, turn = 100) {
  let kills = 0;
  const proc = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: () => { kills++; return true; },
  });
  const manager = new CliChatManager(() => proc as any, undefined, (command, args) => ({ command, args }), { startup, turn });
  manager.send('timeout-fixture', { agent: 'codex', cwd: process.cwd(), text: 'งานที่ใช้เวลานาน' });
  return { manager, proc, kills: () => kills, snapshot: () => manager.snapshot('timeout-fixture'), event: (value: object) => proc.stdout.write(JSON.stringify(value) + '\n') };
}

test('an active CLI is not killed merely because the total turn exceeds ten minutes', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  try {
    f.event({ type: 'thread.started', thread_id: 'active-work' });
    for (let i = 0; i < 10; i++) {
      t.mock.timers.tick(30);
      f.event({ type: 'item.completed', item: { id: `step-${i}`, type: 'agent_message', text: `กำลังทำขั้นตอน ${i}` } });
    }
    assert.equal(f.kills(), 0, 'activity must extend the inactivity deadline instead of a fixed total-turn timer');
    assert.equal(f.manager.isRunning('timeout-fixture'), true);
  } finally { f.proc.emit('close', 0); }
});

test('valid hidden/protocol activity and partial JSON prevent a false startup timeout', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(40, 100);
  try {
    f.proc.stdout.write('{"type":"turn.started"');
    t.mock.timers.tick(35);
    f.proc.stdout.write('}\n');
    t.mock.timers.tick(35);
    f.event({ type: 'item.completed', item: { id: 'reasoning', type: 'reasoning', text: 'hidden' } });
    t.mock.timers.tick(35);
    assert.equal(f.kills(), 0, 'startup is about missing process output, not only visible chat items');
    assert.equal(f.snapshot().items.filter(item => item.kind === 'assistant').length, 0, 'reasoning must remain hidden');
  } finally { f.proc.emit('close', 0); }
});

test('silence after progress still times out, keeps turn ownership until close and marks unfinished tools failed', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.event({ type: 'item.started', item: { id: 'work', type: 'command_execution', command: 'run-task', status: 'in_progress' } });
  t.mock.timers.tick(101);
  assert.equal(f.kills(), 1);
  assert.equal(f.manager.isRunning('timeout-fixture'), true);
  f.proc.emit('close', 1);
  assert.equal(f.manager.isRunning('timeout-fixture'), false);
  const error = f.snapshot().items.find(item => item.kind === 'error');
  assert.ok(error && 'text' in error && /ไม่มีข้อมูลใหม่/.test(error.text), 'an idle timeout must explain stalled progress instead of suggesting every failure is login');
  assert.equal(f.snapshot().items.find(item => item.kind === 'tool')?.status, 'failed');
});

test('a completely silent startup is still terminated once and reports account/Terminal guidance', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(30, 100);
  t.mock.timers.tick(150);
  assert.equal(f.kills(), 1);
  assert.equal(f.manager.isRunning('timeout-fixture'), true);
  f.proc.emit('close', 1);
  const error = f.snapshot().items.find(item => item.kind === 'error');
  assert.ok(error && 'text' in error && /บัญชี.*Terminal/.test(error.text));
});

test('stderr progress extends the idle deadline and a user cancellation does not trigger a timeout error', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(40, 100);
  for (let i = 0; i < 8; i++) {
    f.proc.stderr.write('CLI progress\n');
    t.mock.timers.tick(35);
  }
  assert.equal(f.kills(), 0);
  assert.equal(f.manager.cancel('timeout-fixture'), true);
  const killsAfterCancel = f.kills();
  t.mock.timers.tick(200);
  assert.equal(f.kills(), killsAfterCancel, 'cancelled processes are not killed again by the watchdog');
  f.proc.emit('close', 1);
  assert.equal(f.snapshot().items.at(-1)?.kind, 'notice');
  assert.equal(f.snapshot().items.some(item => item.kind === 'error'), false);
});
