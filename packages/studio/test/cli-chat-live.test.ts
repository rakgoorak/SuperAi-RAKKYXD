import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliChatManager, claudeLiveArguments, permissionSummary } from '../server/CliChat.js';
import { buildProjectContext } from '../server/ProjectContext.js';
import { nativeRuleFiles } from '../server/ProjectRules.js';

const launch = (id: string, args: string[]) => ({ command: id, args });

// A CLI that keeps running: the test writes its stdout line by line and reads what we wrote to stdin.
function liveSpawner() {
  const calls: { args: string[]; stdin: string; proc: any; say: (event: unknown) => void; lines: () => any[] }[] = [];
  const spawner = (_command: string, args: string[]) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough();
    proc.exitCode = null; proc.killed = false;
    proc.kill = () => { proc.killed = true; return true; };
    const call = {
      args, stdin: '', proc,
      say: (event: unknown) => proc.stdout.write(JSON.stringify(event) + '\n'),
      lines: () => call.stdin.split('\n').filter(Boolean).map((l) => JSON.parse(l)),
    };
    proc.stdin.on('data', (d: Buffer) => (call.stdin += d.toString()));
    calls.push(call);
    return proc;
  };
  return { calls, spawner };
}
const tick = () => new Promise((r) => setTimeout(r, 15));
const until = async (check: () => boolean) => { for (let i = 0; i < 300 && !check(); i++) await tick(); assert.ok(check(), 'condition reached'); };
const result = { type: 'result', subtype: 'success', is_error: false, result: '' };
const claude = (text: string, extra: object = {}) => ({ agent: 'claude-code', cwd: process.cwd(), text, ...extra });

test('Claude stays running between turns: one process, one stream-json message per turn', async () => {
  const fake = liveSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  chats.send('a', claude('สวัสดี'));
  const cli = fake.calls[0];
  assert.ok(cli.args.includes('--input-format') && cli.args.includes('stream-json'));
  assert.equal(cli.args[cli.args.indexOf('--permission-prompt-tool') + 1], 'stdio');
  cli.say({ type: 'system', subtype: 'init', session_id: 'sess-1' });
  cli.say({ type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'หวัดดี' }] } });
  cli.say(result);
  await until(() => !chats.isRunning('a'));
  assert.equal(chats.conversationId('a'), 'sess-1');
  chats.send('a', claude('ต่อเลย'));
  assert.equal(fake.calls.length, 1, 'the next turn reuses the running Claude');
  assert.deepEqual(cli.lines().map((m) => m.message.content), ['สวัสดี', 'ต่อเลย']);
  cli.say(result);
  await until(() => !chats.isRunning('a'));
  // A different model needs a new process, which resumes the same conversation.
  chats.send('a', claude('ใช้รุ่นอื่น', { model: 'haiku' }));
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[1].args[fake.calls[1].args.indexOf('--resume') + 1], 'sess-1');
  assert.equal(cli.proc.stdin.writableEnded, true, 'the old process is closed');
  fake.calls[1].say(result);
  await until(() => !chats.isRunning('a'));
  chats.stopAll();
});

test('a tool Claude may not use on its own becomes a card; allow, always and deny answer Claude', async () => {
  const fake = liveSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  chats.send('p', claude('เขียนไฟล์', { permission: 'edit' }));
  const cli = fake.calls[0];
  const ask = (id: string, tool: string, input: object) => cli.say({ type: 'control_request', request_id: id, request: { subtype: 'can_use_tool', tool_name: tool, input } });
  ask('r1', 'Bash', { command: 'npm test' });
  await until(() => chats.snapshot('p').items.some((i) => i.kind === 'permission'));
  const card = chats.snapshot('p').items.find((i) => i.kind === 'permission') as any;
  assert.equal(card.status, 'pending');
  assert.equal(card.detail, 'npm test');
  assert.equal(chats.answerPermission('p', 'r1', 'allow'), true);
  assert.equal(chats.answerPermission('p', 'r1', 'allow'), false, 'answered once');
  const allowed = cli.lines().find((m) => m.type === 'control_response');
  assert.deepEqual(allowed.response, { subtype: 'success', request_id: 'r1', response: { behavior: 'allow', updatedInput: { command: 'npm test' } } });
  ask('r2', 'WebFetch', { url: 'https://example.com' });
  await until(() => chats.snapshot('p').items.filter((i) => i.kind === 'permission').length === 2);
  chats.answerPermission('p', 'r2', 'always');
  ask('r3', 'WebFetch', { url: 'https://example.org' });
  await until(() => cli.lines().filter((m) => m.type === 'control_response').length === 3);
  assert.equal(chats.snapshot('p').items.filter((i) => i.kind === 'permission').length, 2, '"always" answers later requests without asking');
  ask('r4', 'Write', { file_path: 'a.txt', content: 'x' });
  await until(() => chats.snapshot('p').items.filter((i) => i.kind === 'permission').length === 3);
  chats.answerPermission('p', 'r4', 'deny');
  assert.equal(cli.lines().at(-1).response.response.behavior, 'deny');
  assert.equal((chats.snapshot('p').items.at(-1) as any).status, 'denied');
  // A question still open when the turn ends can no longer be answered.
  ask('r5', 'Bash', { command: 'rm -rf x' });
  await until(() => chats.snapshot('p').items.filter((i) => i.kind === 'permission').length === 4);
  cli.say(result);
  await until(() => !chats.isRunning('p'));
  assert.equal((chats.snapshot('p').items.find((i) => (i as any).requestId === 'r5') as any).status, 'expired');
  chats.stopAll();
});

test('stop interrupts the turn but keeps Claude and its conversation for the next message', async () => {
  const fake = liveSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  chats.send('s', claude('งานยาว'));
  const cli = fake.calls[0];
  assert.equal(chats.cancel('s'), true);
  const interrupt = cli.lines().find((m) => m.type === 'control_request');
  assert.equal(interrupt.request.subtype, 'interrupt');
  cli.say({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '' });
  await until(() => !chats.isRunning('s'));
  const items = chats.snapshot('s').items;
  assert.ok(items.some((i) => i.kind === 'notice' && i.text === 'หยุดแล้ว'));
  assert.ok(!items.some((i) => i.kind === 'error'), 'an interrupt is not an error');
  assert.equal(cli.proc.killed, false);
  chats.send('s', claude('งานใหม่'));
  assert.equal(fake.calls.length, 1);
  cli.say(result);
  await until(() => !chats.isRunning('s'));
  chats.stopAll();
});

test('Enter while answering interrupts the live Claude and sends the new message to the same process', async () => {
  const fake = liveSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  chats.send('i', claude('งานยาว'));
  const cli = fake.calls[0];
  assert.equal(chats.send('i', claude('เปลี่ยนแผน'), { interrupt: true }), 'interrupted');
  cli.say({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '' });
  await until(() => cli.lines().filter((m) => m.type === 'user').length === 2);
  assert.equal(fake.calls.length, 1);
  assert.equal(cli.lines().filter((m) => m.type === 'user')[1].message.content, 'เปลี่ยนแผน');
  cli.say(result);
  await until(() => !chats.isRunning('i'));
  chats.stopAll();
});

test('Claude gets project context as system prompt, never repeated in messages', async () => {
  const fake = liveSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  const projectContext = { text: '[คำสั่งประจำโปรเจกต์]\nตอบภาษาไทย', instructions: true, files: [], preparedAt: 0 };
  chats.send('c', claude('สวัสดี', { projectContext }));
  const cli = fake.calls[0];
  assert.match(cli.args[cli.args.indexOf('--append-system-prompt') + 1], /ตอบภาษาไทย/);
  assert.equal(cli.lines()[0].message.content, 'สวัสดี');
  cli.say(result);
  await until(() => !chats.isRunning('c'));
  chats.stopAll();
});

test('other CLIs get project context once per conversation, and again only when it changed', async () => {
  const sent: string[] = [];
  const spawner = (_c: string, _a: string[]) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough();
    let input = '';
    proc.stdin.on('data', (d: Buffer) => (input += d.toString()));
    proc.stdin.on('finish', () => {
      sent.push(input);
      proc.stdout.end(JSON.stringify({ type: 'thread.started', thread_id: 'th-1' }) + '\n');
      proc.stderr.end();
      Promise.all([new Promise((r) => proc.stdout.once('end', r)), new Promise((r) => proc.stderr.once('end', r))]).then(() => proc.emit('close', 0));
      proc.stdout.resume(); proc.stderr.resume();
    });
    return proc;
  };
  const chats = new CliChatManager(spawner as any, undefined, launch);
  const context = (text: string) => ({ text, instructions: true, files: [], preparedAt: 0 });
  const turn = async (text: string, ctx: string) => { chats.send('x', { agent: 'codex', cwd: process.cwd(), text, projectContext: context(ctx) }); await until(() => !chats.isRunning('x')); };
  await turn('หนึ่ง', 'RULE-A');
  await turn('สอง', 'RULE-A');
  await turn('สาม', 'RULE-B');
  assert.match(sent[0], /RULE-A/);
  assert.doesNotMatch(sent[1], /RULE-A/, 'the conversation already has it');
  assert.match(sent[2], /RULE-B/, 'changed context goes again');
});

test('rule files a CLI loads by itself are not sent again', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-native-'));
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'claude rules');
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'agents rules');
    const forClaude = buildProjectContext({ rootPath: dir }, dir, { native: nativeRuleFiles('claude-code') });
    assert.doesNotMatch(forClaude.text, /claude rules/);
    assert.match(forClaude.text, /agents rules/);
    assert.equal(forClaude.files.find((f) => f.path === 'CLAUDE.md')?.status, 'native');
    const forCodex = buildProjectContext({ rootPath: dir }, dir, { native: nativeRuleFiles('codex') });
    assert.match(forCodex.text, /claude rules/);
    assert.doesNotMatch(forCodex.text, /agents rules/);
    assert.match(buildProjectContext({ rootPath: dir }, dir, { native: nativeRuleFiles('antigravity') }).text, /claude rules[\s\S]*agents rules/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('live arguments and permission card text', () => {
  const read = claudeLiveArguments({ permission: 'read' });
  assert.equal(read[read.indexOf('--permission-mode') + 1], 'plan');
  assert.equal(read[read.indexOf('--allowedTools') + 1], 'WebSearch,WebFetch');
  const auto = claudeLiveArguments({});
  assert.equal(auto[auto.indexOf('--allowedTools') + 1], 'Bash,WebSearch,WebFetch');
  assert.ok(!auto.includes('--append-system-prompt'));
  assert.deepEqual(permissionSummary('Bash', { command: 'ls' }), { title: 'รันคำสั่ง', detail: 'ls' });
  assert.deepEqual(permissionSummary('Write', { file_path: 'C:/a.txt', content: 'x' }), { title: 'เขียนไฟล์', detail: 'C:/a.txt' });
  assert.equal(permissionSummary('mcp__x__y', { a: 1 }, 'Do Y').title, 'ใช้เครื่องมือ mcp__x__y · Do Y');
});
