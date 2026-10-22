import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { chatParser, chatArguments, shellCommand, CliChatManager, type ChatMessage } from '../server/CliChat.js';

const lines = (agent: string, events: unknown[]) => {
  const parse = chatParser(agent, 't1');
  return events.map((e) => parse(JSON.stringify(e)));
};

test('Codex events become messages and command cards without the PowerShell wrapper', () => {
  const ps = '"C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" -Command \'echo hi\'';
  const [thread, , started, done, failed, message, end] = lines('codex', [
    { type: 'thread.started', thread_id: 'abc' },
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: ps, aggregated_output: '', exit_code: null, status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: ps, aggregated_output: 'hi\r\n', exit_code: 0, status: 'completed' } },
    { type: 'item.completed', item: { id: 'item_2', type: 'command_execution', command: 'bash -lc "false"', aggregated_output: '', exit_code: 1, status: 'completed' } },
    { type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'คำตอบ **ภาษาไทย**' } },
    { type: 'turn.completed', usage: {} },
  ]);
  assert.equal(thread.conversationId, 'abc');
  assert.deepEqual(started.items, [{ id: 't1-item_1', kind: 'tool', tool: 'command', title: 'echo hi', output: undefined, status: 'running' }]);
  assert.equal((done.items![0] as any).status, 'done');
  assert.equal((done.items![0] as any).output, 'hi\r\n');
  assert.equal((failed.items![0] as any).status, 'failed', 'a non-zero exit code is a failure');
  assert.equal((failed.items![0] as any).title, 'false');
  assert.deepEqual(message.items, [{ id: 't1-item_3', kind: 'assistant', text: 'คำตอบ **ภาษาไทย**' }]);
  assert.equal(end.done, true);
  assert.deepEqual(lines('codex', [{ type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'x' } }])[0], {}, 'reasoning is not shown');
  assert.deepEqual(lines('codex', ['not json'])[0], {});
  assert.match(lines('codex', [{ type: 'turn.failed', error: { message: 'quota' } }])[0].error!, /quota/);
});

test('Antigravity text deltas join into one message; tools show their main parameter', () => {
  const steps = lines('antigravity', [
    { event: 'init', conversation_id: 'conv-1' },
    { event: 'step_update', step_update: { step_index: 0, state: 'DONE', step_type: 'user_input' } },
    { event: 'step_update', step_update: { step_index: 1, state: 'DONE', step_type: 'agent_response' } },
    { event: 'step_update', step_update: { step_index: 2, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: 'npm test', Cwd: 'D:\\x' } } } },
    { event: 'step_update', step_update: { step_index: 2, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: 'npm test' }, output: 'ok' } } },
    { event: 'step_update', step_update: { step_index: 3, state: 'ACTIVE', step_type: 'agent_response', text_delta: 'สวัส' } },
    { event: 'step_update', step_update: { step_index: 3, state: 'DONE', step_type: 'agent_response', text_delta: 'ดี' } },
    { event: 'result', result: { status: 'SUCCESS', response: 'สวัสดี\n' } },
  ]);
  assert.equal(steps[0].conversationId, 'conv-1');
  assert.deepEqual(steps[1], {});
  assert.deepEqual(steps[2], {}, 'an empty response step (thinking) shows nothing');
  assert.deepEqual(steps[3].items, [{ id: 't1-s2', kind: 'tool', tool: 'command', title: 'npm test', output: undefined, status: 'running' }]);
  assert.equal((steps[4].items![0] as any).output, 'ok');
  assert.deepEqual(steps[6].items, [{ id: 't1-s3', kind: 'assistant', text: 'สวัสดี' }]);
  assert.deepEqual(steps[7], { done: true, items: undefined }, 'the final response is not repeated');
  const silent = lines('antigravity', [{ event: 'result', result: { status: 'SUCCESS', response: 'done' } }])[0];
  assert.equal((silent.items![0] as any).text, 'done', 'an answer seen only in the result is still shown');
  assert.match(lines('antigravity', [{ event: 'result', result: { status: 'ERROR', error: { message: 'quota exceeded' } } }])[0].error!, /quota/);
});

test('turn arguments resume the conversation and keep edits in the project', () => {
  const first = chatArguments('codex', { prompt: 'x', model: 'gpt-6-luna', effort: 'low', files: ['C:/a.png'] });
  assert.deepEqual(first.slice(0, 2), ['exec', '--json']);
  assert.ok(first.includes('sandbox_mode="workspace-write"'));
  assert.ok(first.includes('--image=C:/a.png'));
  assert.equal(first.at(-1), '-', 'Codex reads the prompt from stdin');
  assert.deepEqual(chatArguments('codex', { prompt: 'x', conversationId: 'abc' }).slice(0, 3), ['exec', 'resume', 'abc']);
  const agy = chatArguments('antigravity', { prompt: 'คำถาม "quoted"', conversationId: 'conv-1' });
  assert.equal(agy[agy.indexOf('--conversation') + 1], 'conv-1');
  assert.equal(agy[agy.indexOf('--output-format') + 1], 'stream-json');
  assert.equal(agy.at(-1), '--print=คำถาม "quoted"');
  assert.throws(() => chatArguments('freebuff', { prompt: 'x' }), /terminal/);
  assert.equal(shellCommand('/bin/bash -lc \'ls -la\''), 'ls -la');
  assert.equal(shellCommand('git status'), 'git status');
});

// Tests must not depend on the CLIs being installed (CI has none).
const launch = (id: string, args: string[]) => ({ command: id, args });

function fakeSpawner() {
  const calls: { command: string; args: string[]; stdin: string; proc: any }[] = [];
  const spawner = (command: string, args: string[]) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.stdin = new PassThrough();
    const call = { command, args, stdin: '', proc };
    proc.stdin.on('data', (d: Buffer) => (call.stdin += d.toString()));
    calls.push(call);
    return proc;
  };
  // Like a real child process: 'close' only after stdout and stderr have been read to the end.
  const finish = (proc: any, events: unknown[], code = 0, stderr = '') => {
    const ended = (stream: PassThrough) => new Promise((r) => stream.once('end', r));
    Promise.all([ended(proc.stdout), ended(proc.stderr)]).then(() => proc.emit('close', code));
    proc.stdout.end(events.map((e) => JSON.stringify(e)).join('\n'));
    proc.stderr.end(stderr);
  };
  return { calls, spawner, finish };
}
// Waits for the chat's turn to finish (or a short pause when nothing is running), however busy the machine.
const settle = async (chats?: CliChatManager, id?: string) => {
  const until = Date.now() + 5000;
  do await new Promise((r) => setTimeout(r, 10));
  while (chats && id && chats.isRunning(id) && Date.now() < until);
};

test('the manager streams items, resumes the next turn and rejects overlapping turns', async () => {
  const fake = fakeSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  const seen: ChatMessage[] = [];
  chats.subscribe('s1', (m) => seen.push(m));
  assert.equal(seen[0].type, 'snapshot');

  chats.send('s1', { agent: 'codex', cwd: process.cwd(), text: ' สวัสดี ', attachments: ['C:/x/shot.png', 'C:/x/spec.pdf'] });
  assert.deepEqual(chats.running(), ['s1']);
  assert.throws(() => chats.send('s1', { agent: 'codex', cwd: process.cwd(), text: 'อีก' }), /ยังตอบ/);
  const turn = fake.calls[0];
  assert.ok(turn.args.includes('--image=C:/x/shot.png'));
  fake.finish(turn.proc, [
    { type: 'thread.started', thread_id: 'th-1' },
    { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'ตอบแล้ว' } },
    { type: 'turn.completed' },
  ]);
  await settle(chats, 's1');
  assert.match(turn.stdin, /สวัสดี\n\nไฟล์แนบ:\n- C:\/x\/spec\.pdf/, 'non-image files are listed in the prompt');
  const chat = chats.snapshot('s1');
  assert.equal(chat.running, false);
  assert.equal(chat.conversationId, 'th-1');
  assert.deepEqual(chat.items.map((i) => [i.kind, (i as any).text]), [['user', 'สวัสดี'], ['assistant', 'ตอบแล้ว']]);
  assert.deepEqual((chat.items[0] as any).attachments, ['shot.png', 'spec.pdf']);
  assert.ok(seen.some((m) => m.type === 'state' && !m.running));

  chats.send('s1', { agent: 'codex', cwd: process.cwd(), text: 'ต่อ' });
  const resumed = fake.calls[1].args;
  assert.deepEqual(resumed.slice(resumed.indexOf('exec'), resumed.indexOf('exec') + 3), ['exec', 'resume', 'th-1']);
  fake.finish(fake.calls[1].proc, [], 1, '{"message":"usage limit reached"}');
  await settle(chats, 's1');
  const last = chats.snapshot('s1').items.at(-1)!;
  assert.equal(last.kind, 'error');
  assert.match((last as any).text, /usage limit reached/);
});

test('stopping a turn marks running tools and says it stopped', async () => {
  const fake = fakeSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, launch);
  chats.send('s2', { agent: 'antigravity', cwd: process.cwd(), text: 'ทำงาน' });
  const proc = fake.calls[0].proc;
  proc.stdout.write(JSON.stringify({ event: 'step_update', step_update: { step_index: 1, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'sleep 99' } } } }) + '\n');
  const until = Date.now() + 5000;
  while (!chats.snapshot('s2').items.some((i) => i.kind === 'tool') && Date.now() < until) await settle();
  assert.equal(chats.cancel('s2'), true);
  proc.emit('close', 1);
  await settle(chats, 's2');
  const items = chats.snapshot('s2').items;
  assert.equal((items.find((i) => i.kind === 'tool') as any).status, 'failed');
  assert.deepEqual([items.at(-1)!.kind, (items.at(-1) as any).text], ['notice', 'หยุดแล้ว']);
  assert.equal(items.filter((i) => i.kind === 'error').length, 0, 'a stop is not reported as an error');
  assert.equal(chats.cancel('s2'), false);
  assert.throws(() => chats.send('s3', { agent: 'freebuff', cwd: process.cwd(), text: 'x' }), /terminal/);
});

test('Claude Code stream-json: text, tool calls with their results, and the session id', () => {
  const [init, call, result, sub, answer, end] = lines('claude-code', [
    { type: 'system', subtype: 'init', session_id: 'sess-1' },
    { type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'echo hi', description: 'Print hi' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'hi', is_error: false }] } },
    { type: 'assistant', parent_tool_use_id: 'tu9', message: { id: 'm9', content: [{ type: 'text', text: 'sub-agent chatter' }] } },
    { type: 'assistant', message: { id: 'm2', content: [{ type: 'text', text: 'เสร็จแล้ว' }] } },
    { type: 'result', subtype: 'success', is_error: false, result: 'เสร็จแล้ว' },
  ]);
  assert.equal(init.conversationId, 'sess-1');
  assert.deepEqual(call.items, [{ id: 't1-tu1', kind: 'tool', tool: 'command', title: 'echo hi', status: 'running' }]);
  assert.deepEqual(result.items, [{ id: 't1-tu1', kind: 'tool', tool: 'command', title: 'echo hi', status: 'done', output: 'hi' }]);
  assert.deepEqual(sub, {}, 'sub-agent messages are left out');
  assert.deepEqual(answer.items, [{ id: 't1-m2-0', kind: 'assistant', text: 'เสร็จแล้ว' }]);
  assert.deepEqual(end, { done: true, items: undefined });
  assert.match(lines('claude-code', [{ type: 'result', subtype: 'error_max_turns', is_error: true }])[0].error!, /max_turns/);
  const read = lines('claude-code', [{ type: 'assistant', message: { id: 'm', content: [{ type: 'tool_use', id: 'r', name: 'Read', input: { file_path: 'C:/x/a.ts' } }] } }])[0];
  assert.deepEqual([(read.items![0] as any).tool, (read.items![0] as any).title], ['read', 'C:/x/a.ts']);
});

test('OpenCode run --format json: finished parts and errors', () => {
  const [tool, text, error] = lines('opencode', [
    { type: 'tool_use', sessionID: 'ses_1', part: { id: 'p1', tool: 'bash', state: { status: 'completed', input: { command: 'ls' }, output: 'a.txt', title: 'ls' } } },
    { type: 'text', sessionID: 'ses_1', part: { id: 'p2', text: 'มีไฟล์ a.txt' } },
    { type: 'error', sessionID: 'ses_1', error: { name: 'APIError', data: { message: 'Invalid credential' } } },
  ]);
  assert.equal(tool.conversationId, 'ses_1');
  assert.deepEqual(tool.items, [{ id: 't1-p1', kind: 'tool', tool: 'command', title: 'ls', output: 'a.txt', status: 'done' }]);
  assert.deepEqual(text.items, [{ id: 't1-p2', kind: 'assistant', text: 'มีไฟล์ a.txt' }]);
  assert.match(error.error!, /Invalid credential/);
  const args = chatArguments('opencode', { prompt: 'สวัสดี', conversationId: 'ses_1', files: ['C:/a.pdf'] });
  assert.deepEqual(args.slice(0, 5), ['run', '--format', 'json', '--session', 'ses_1']);
  assert.deepEqual(args.slice(-4), ['--file', 'C:/a.pdf', '--', 'สวัสดี']);
  const claude = chatArguments('claude-code', { prompt: 'x', conversationId: 'sess-1' });
  assert.equal(claude[claude.indexOf('--resume') + 1], 'sess-1');
  assert.equal(claude[claude.indexOf('--output-format') + 1], 'stream-json');
});

test('chat history is saved to disk and comes back; deleting removes it', async () => {
  const fsMod = await import('node:fs');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const dir = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'superai-chats-'));
  const fake = fakeSpawner();
  const first = new CliChatManager(fake.spawner as any, dir, launch);
  const changes: string[] = [];
  first.onChange = (id) => changes.push(id);
  first.send('s1', { agent: 'claude-code', cwd: process.cwd(), text: 'จำคำว่า KIWI' });
  fake.finish(fake.calls[0].proc, [
    { type: 'system', subtype: 'init', session_id: 'sess-9' },
    { type: 'assistant', message: { id: 'm', content: [{ type: 'text', text: 'จำแล้ว' }] } },
    { type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', id: 'cut', name: 'Bash', input: { command: 'sleep 9' } }] } },
  ]);
  await settle(first, 's1');
  assert.match(fake.calls[0].stdin, /KIWI/, 'Claude Code reads the prompt from stdin');
  assert.ok(changes.includes('s1'));
  const second = new CliChatManager(fake.spawner as any, dir, launch);
  const back = second.snapshot('s1');
  assert.equal(back.conversationId, 'sess-9');
  assert.deepEqual(back.items.filter((i) => i.kind !== 'tool').map((i) => (i as any).text), ['จำคำว่า KIWI', 'จำแล้ว']);
  second.send('s1', { agent: 'claude-code', cwd: process.cwd(), text: 'คำว่าอะไร' });
  const resumed = fake.calls[1].args;
  assert.equal(resumed[resumed.indexOf('--resume') + 1], 'sess-9');
  assert.ok(second.snapshot('s1').items.some((i) => i.id === 't2-user'), 'turn ids continue after a restart');
  fake.finish(fake.calls[1].proc, []);
  await settle(second, 's1');
  second.setConversation('s1', 'from-terminal');
  assert.equal(new CliChatManager(fake.spawner as any, dir, launch).conversationId('s1'), 'from-terminal');
  second.drop('s1');
  assert.equal(fsMod.existsSync(pathMod.join(dir, 's1.json')), false);
  fsMod.rmSync(dir, { recursive: true, force: true });
});

test('a CLI that is not installed is refused before the message joins the chat', () => {
  const fake = fakeSpawner();
  const chats = new CliChatManager(fake.spawner as any, undefined, () => { throw new Error('ยังไม่ได้ติดตั้ง Codex'); });
  assert.throws(() => chats.send('s9', { agent: 'codex', cwd: process.cwd(), text: 'สวัสดี' }), /ยังไม่ได้ติดตั้ง/);
  assert.deepEqual(chats.snapshot('s9'), { items: [], running: false, conversationId: undefined }, 'not stuck as running');
  assert.equal(fake.calls.length, 0);
});
