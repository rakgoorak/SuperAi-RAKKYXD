import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliChatManager, type ChatMessage } from '../server/CliChat.js';
import { openCodeNoAnswer, openCodePermissionEnv, rejectedPermissions } from '../server/OpenCodePermissions.js';

const tmp = path.join('C:', 'Users', 'me', 'AppData', 'Local', 'Temp');
const allowed = (env: Record<string, string>) => JSON.parse(env.OPENCODE_CONFIG_CONTENT).permission.external_directory;

test('OpenCode may read the temp folder; the user keeps their own rules', () => {
  assert.deepEqual(allowed(openCodePermissionEnv(undefined, tmp)), { [path.join(tmp, '*')]: 'allow' });
  const merged = JSON.parse(openCodePermissionEnv(JSON.stringify({ model: 'x', permission: { bash: 'ask', external_directory: { 'D:\data\*': 'allow', [path.join(tmp, '*')]: 'deny' } } }), tmp).OPENCODE_CONFIG_CONTENT);
  assert.equal(merged.model, 'x');
  assert.equal(merged.permission.bash, 'ask');
  assert.deepEqual(merged.permission.external_directory, { [path.join(tmp, '*')]: 'deny', 'D:\data\*': 'allow' }, 'a rule the user wrote wins');
  const own = JSON.stringify({ permission: { external_directory: 'deny' } });
  assert.deepEqual(openCodePermissionEnv(own, tmp), { OPENCODE_CONFIG_CONTENT: own }, 'one word for every folder is left alone');
  assert.deepEqual(openCodePermissionEnv('{not json', tmp), {}, 'a config we cannot read is not replaced');
});

test('what OpenCode refused is read from its stderr', () => {
  const stderr = '\x1b[93m\x1b[1m! \x1b[0mpermission requested: external_directory (C:\Users\me\*); auto-rejecting\n';
  assert.deepEqual(rejectedPermissions(stderr), ['เข้าถึงโฟลเดอร์นอกโปรเจกต์ C:\Users\me\*']);
  assert.match(openCodeNoAnswer(stderr, false), /หยุดก่อนตอบ.*C:\Users\me\\*.*Ask for approval/s);
  assert.match(openCodeNoAnswer('', true), /หยุดก่อนตอบ/);
  assert.match(openCodeNoAnswer('', false), /ไม่ส่งคำตอบกลับมา/);
});

function fake() {
  const runs: { args: string[]; env: Record<string, string>; proc: any }[] = [];
  const spawner = (_command: string, args: string[], options: any) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough(); proc.kill = () => true;
    runs.push({ args, env: options.env, proc });
    return proc;
  };
  const end = (proc: any, events: unknown[], stderr = '') => {
    const ended = (s: PassThrough) => new Promise((r) => s.once('end', r));
    Promise.all([ended(proc.stdout), ended(proc.stderr)]).then(() => proc.emit('close', 0));
    proc.stdout.end(events.map((e) => JSON.stringify(e)).join('\n'));
    proc.stderr.end(stderr);
  };
  return { runs, spawner, end };
}
const settle = async (chats: CliChatManager, id: string) => {
  const until = Date.now() + 5000;
  do await new Promise((r) => setTimeout(r, 10)); while (chats.isRunning(id) && Date.now() < until);
};

test('an OpenCode turn that stops on a refused request says so instead of going quiet', async () => {
  const f = fake();
  const chats = new CliChatManager(f.spawner as any, undefined, (id: string, args: string[]) => ({ command: id, args }));
  const seen: ChatMessage[] = [];
  chats.subscribe('oc', (m) => seen.push(m));
  chats.send('oc', { agent: 'opencode', cwd: process.cwd(), text: 'อ่าน guide แล้วทำเว็บ' });
  assert.ok(allowed(f.runs[0].env), 'the run is started with the temp folder allowed');
  f.end(f.runs[0].proc, [
    { type: 'tool_use', sessionID: 's', part: { id: 'r', tool: 'read', state: { status: 'error', input: { filePath: 'C:\Users\me\guide.md' }, error: 'The user rejected permission to use this specific tool call.' } } },
    { type: 'step_finish', sessionID: 's', part: { tokens: { output: 3 } } },
  ], 'permission requested: external_directory (C:\Users\me\*); auto-rejecting\n');
  await settle(chats, 'oc');
  const items = seen.flatMap((m) => (m.type === 'item' ? [m.item] : []));
  const error = items.find((i) => i.kind === 'error');
  assert.ok(error && error.kind === 'error' && /หยุดก่อนตอบ/.test(error.text), JSON.stringify(items.map((i) => i.kind)));

  chats.send('oc', { agent: 'opencode', cwd: process.cwd(), text: 'ต่อ' });
  f.end(f.runs[1].proc, [{ type: 'text', sessionID: 's', part: { id: 't', text: 'เสร็จแล้ว' } }]);
  await settle(chats, 'oc');
  const after = seen.slice(seen.findIndex((m) => m.type === 'item' && m.item.kind === 'user' && m.item.text === 'ต่อ'));
  assert.ok(!after.some((m) => m.type === 'item' && m.item.kind === 'error'), 'a turn with an answer adds no error');
});
