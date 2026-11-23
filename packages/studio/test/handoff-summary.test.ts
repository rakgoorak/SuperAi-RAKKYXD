import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffBlock, handoffSummary } from '../server/Handoff.js';
import { findHandoffSources } from '../client/src/handoffUtils.js';
import type { ChatItem } from '../server/CliChat.js';

const at = 0;
const items: ChatItem[] = [
  { id: 't1-user', kind: 'user', text: 'add a login page', at },
  { id: 't1-a', kind: 'assistant', text: 'Looking at the router first.', at },
  { id: 't1-edit', kind: 'tool', tool: 'edit', title: 'Login.tsx, routes.ts', output: 'huge diff', status: 'done', at },
  { id: 't1-b', kind: 'assistant', text: 'Login page added; tests still missing.', at },
  { id: 't1-todos', kind: 'todos', todos: [{ text: 'Login page', status: 'completed' }, { text: 'Write tests', status: 'pending' }], at },
];

test('handoff summary keeps the request, the final answer, edited files and open tasks', () => {
  const text = handoffSummary({ name: 'Codex · gpt-6.2', agent: 'codex', cwd: 'D:/Agent', running: false, items });
  assert.match(text, /Room: "Codex · gpt-6\.2" \(Codex\) · folder: D:\/Agent/);
  assert.match(text, /\[user\]\nadd a login page/);
  assert.match(text, /\[Codex\]\nLogin page added; tests still missing\./);
  assert.doesNotMatch(text, /Looking at the router first/, 'only the last answer of a turn is kept');
  assert.doesNotMatch(text, /huge diff/, 'tool output is left out');
  assert.match(text, /Files edited there: Login\.tsx, routes\.ts/);
  assert.match(text, /- \[x\] Login page\n- \[ \] Write tests/);
});

test('handoff summary drops the oldest turns to stay within its budget', () => {
  const long: ChatItem[] = Array.from({ length: 40 }, (_, i) => [
    { id: `u${i}`, kind: 'user' as const, text: `request ${i}`, at },
    { id: `a${i}`, kind: 'assistant' as const, text: `answer ${i} ${'x'.repeat(400)}`, at },
  ]).flat();
  const text = handoffSummary({ name: 'Claude', agent: 'claude-code', cwd: '/p', running: true, items: long }, 3000);
  assert.ok(text.length <= 3000, `summary is ${text.length} characters`);
  assert.match(text, /request 39/);
  assert.doesNotMatch(text, /request 0\n/);
  assert.match(text, /earlier messages left out/);
  assert.match(text, /still answering/);
});

test('handoff block of a room with no chat history says so', () => {
  const text = handoffBlock([{ name: 'Shell', agent: 'opencode', cwd: '/p', running: false, items: [] }]);
  assert.match(text, /No chat history was recorded/);
  assert.equal(handoffBlock([]), '');
});

test('findHandoffSources reads @room names, preferring the picked room and this folder', () => {
  const sessions = [
    { id: 'a', name: 'Codex · gpt-6.2', wsId: 'w1' },
    { id: 'b', name: 'Codex · gpt-6.2', wsId: 'w2' },
    { id: 'c', name: 'Codex', wsId: 'w1' },
    { id: 'me', name: 'Claude', wsId: 'w1' },
  ];
  assert.deepEqual(findHandoffSources('continue from @Codex · gpt-6.2 please', sessions, { targetId: 'me', workspaceId: 'w2' }), ['b']);
  assert.deepEqual(findHandoffSources('continue from @Codex · gpt-6.2', sessions, { targetId: 'me', workspaceId: 'w2', picked: new Map([['Codex · gpt-6.2', 'a']]) }), ['a']);
  assert.deepEqual(findHandoffSources('compare @Codex and @Codex · gpt-6.2', sessions, { targetId: 'me', workspaceId: 'w1' }), ['a', 'c']);
  assert.deepEqual(findHandoffSources('ask @Claude', sessions, { targetId: 'me' }), [], 'a room never hands off to itself');
  assert.deepEqual(findHandoffSources('fix @src/app.ts', sessions, { targetId: 'me' }), []);
});

test('a handed-off summary reaches the CLI prompt but not the chat bubble', async () => {
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { CliChatManager } = await import('../server/CliChat.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-handoff-'));
  fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ items, turns: 1 }));
  const inputs: { input: string; proc: any }[] = [];
  const spawn = () => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough(); proc.kill = () => true;
    const call = { input: '', proc };
    proc.stdin.on('data', (value: Buffer) => { call.input += value.toString(); });
    inputs.push(call); return proc;
  };
  const manager = new CliChatManager(spawn as any, dir, (id: string, args: string[]) => ({ command: id, args }));
  try {
    const handoff = handoffBlock([{ name: 'Codex · gpt-6.2', agent: 'codex', cwd: dir, ...manager.handoffItems('source') }]);
    manager.send('target', { agent: 'claude-code', cwd: dir, text: 'continue from @Codex · gpt-6.2', handoff });
    assert.match(inputs[0].input, /Login page added; tests still missing/);
    assert.match(inputs[0].input, /The user's message:\\ncontinue from @Codex/);
    const bubble = manager.snapshot('target').items.find(item => item.kind === 'user');
    assert.equal(bubble?.kind === 'user' && bubble.text, 'continue from @Codex · gpt-6.2');
    inputs[0].proc.emit('close', 0);
  } finally { manager.stopAll(); fs.rmSync(dir, { recursive: true, force: true }); }
});
