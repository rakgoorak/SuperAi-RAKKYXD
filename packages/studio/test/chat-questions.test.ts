import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliChatManager } from '../server/CliChat.js';
import { cleanAnswers, describeChoices, questionRules, takeQuestions } from '../server/Questions.js';

const launch = (id: string, args: string[]) => ({ command: id, args });
const tick = () => new Promise((r) => setTimeout(r, 15));
const until = async (check: () => boolean) => { for (let i = 0; i < 300 && !check(); i++) await tick(); assert.ok(check(), 'condition reached'); };

function spawner() {
  const calls: { args: string[]; stdin: string; proc: any; say: (e: unknown) => void; lines: () => any[] }[] = [];
  const spawn = (_command: string, args: string[]) => {
    const proc: any = new EventEmitter();
    proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough();
    proc.exitCode = null; proc.kill = () => true;
    const call = {
      args, stdin: '', proc, say: (e: unknown) => proc.stdout.write(JSON.stringify(e) + '\n'),
      lines: () => call.stdin.split('\n').filter(Boolean).map((l) => JSON.parse(l)),
    };
    proc.stdin.on('data', (d: Buffer) => (call.stdin += d.toString()));
    calls.push(call);
    return proc;
  };
  const end = (proc: any, events: unknown[]) => {
    const ended = (s: PassThrough) => new Promise((r) => s.once('end', r));
    Promise.all([ended(proc.stdout), ended(proc.stderr)]).then(() => proc.emit('close', 0));
    proc.stdout.end(events.map((e) => JSON.stringify(e)).join('\n'));
    proc.stderr.end('');
  };
  return { calls, spawn, end };
}

const block = '```superai-questions\n' + JSON.stringify({ intro: 'ดูโปรเจกต์แล้ว', questions: [
  { header: 'ที่เก็บ', question: 'เก็บ key ไว้ที่ไหน?', options: [{ label: 'เข้ารหัสในเครื่อง', description: 'ปลอดภัย', recommended: true }, { label: '.env', description: 'ง่าย' }] },
  { question: 'รองรับผู้ให้บริการไหนบ้าง?', multiSelect: true, options: ['OpenRouter', 'DeepSeek', 'Groq'] },
] }) + '\n```';

test('a question block is split from the reply text; anything else is left alone', () => {
  const { text, asked } = takeQuestions(`ขอถามก่อนครับ\n\n${block}`);
  assert.equal(text, 'ขอถามก่อนครับ');
  assert.deepEqual(asked!.questions.map((q) => [q.id, q.multiSelect, q.options.length]), [['q1', false, 2], ['q2', true, 3]]);
  assert.equal(asked!.questions[0].options[0].recommended, true);
  assert.deepEqual(takeQuestions('```js\nconsole.log(1)\n```'), { text: '```js\nconsole.log(1)\n```', asked: null });
  assert.equal(takeQuestions('```superai-questions\nnot json\n```').asked, null, 'a broken block stays visible as text');
  assert.match(questionRules(), /ตัดสินใจเองว่าต้องถามผู้ใช้ก่อนหรือไม่/, 'the AI decides; there is no switch');
});

test('answers are checked against the options before going back to the AI', () => {
  const { questions } = takeQuestions(block).asked!;
  const answers = cleanAnswers(questions, { q1: { selected: ['เข้ารหัสในเครื่อง', 'made up'] }, q2: { selected: ['OpenRouter', 'Groq'], other: '' }, q9: { other: 'x' } });
  assert.deepEqual(answers, { q1: { selected: ['เข้ารหัสในเครื่อง'], other: '' }, q2: { selected: ['OpenRouter', 'Groq'], other: '' } });
  assert.throws(() => cleanAnswers(questions, { q1: { selected: ['เข้ารหัสในเครื่อง'], other: 'อีกแบบ' } }), /เลือกได้ข้อเดียว/);
  const reply = describeChoices(questions, { q1: answers.q1 }, 'Codex');
  assert.match(reply, /Codex ถามไว้/);
  assert.match(reply, /เก็บ key ไว้ที่ไหน\?\n {2}คำตอบ: เข้ารหัสในเครื่อง/);
  assert.match(reply, /รองรับผู้ให้บริการไหนบ้าง\?\n {2}คำตอบ: ข้าม/);
});

test('any agent in any permission mode: the rules go with the prompt and the block becomes a card', async () => {
  const fake = spawner();
  const chats = new CliChatManager(fake.spawn as any, undefined, launch);
  chats.send('c', { agent: 'codex', cwd: process.cwd(), text: 'ทำระบบ API key', permission: 'auto' });
  const sentPrompt = fake.calls[0].stdin;
  assert.match(sentPrompt, /^ทำระบบ API key/);
  assert.match(sentPrompt, /superai-questions/);
  fake.end(fake.calls[0].proc, [
    { type: 'thread.started', thread_id: 'th1' },
    { type: 'item.completed', item: { id: 'a1', type: 'agent_message', text: `ขอถามก่อนครับ\n\n${block}` } },
    { type: 'turn.completed', usage: {} },
  ]);
  await until(() => !chats.isRunning('c'));
  const items = chats.snapshot('c').items as any[];
  assert.equal(items.find((i) => i.kind === 'assistant').text, 'ขอถามก่อนครับ');
  const card = items.find((i) => i.kind === 'question');
  assert.equal(card.status, 'waiting');
  assert.equal(card.by, 'Codex');
  assert.throws(() => chats.answerQuestion('c', card.id, { answers: {} }), /อย่างน้อยหนึ่งข้อ/);
  const { reply } = chats.answerQuestion('c', card.id, { answers: { q1: { selected: ['.env'] } } });
  assert.match(reply!, /คำตอบ: \.env/);
  assert.equal((chats.snapshot('c').items as any[]).find((i) => i.kind === 'question').status, 'answered');
  assert.throws(() => chats.answerQuestion('c', card.id, { skip: true }), /ตอบไปแล้ว/);
  chats.stopAll();
});

test('Claude AskUserQuestion becomes the same card and the choices go straight back to Claude', async () => {
  const fake = spawner();
  const chats = new CliChatManager(fake.spawn as any, undefined, launch);
  chats.send('q', { agent: 'claude-code', cwd: process.cwd(), text: 'ทำเว็บ', permission: 'auto' });
  const cli = fake.calls[0];
  cli.say({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: { questions: [
    { question: 'โทนสี?', header: 'สี', multiSelect: false, options: [{ label: 'มืด', description: 'dark' }, { label: 'สว่าง', description: 'light' }] },
  ] } } });
  await until(() => chats.snapshot('q').items.some((i) => i.kind === 'question'));
  const card = (chats.snapshot('q').items as any[]).find((i) => i.kind === 'question');
  assert.equal(card.requestId, 'r1');
  assert.equal(chats.snapshot('q').items.some((i) => i.kind === 'permission'), false, 'not shown as a tool permission');
  assert.deepEqual(chats.answerQuestion('q', card.id, { answers: { q1: { selected: ['มืด'] } } }), { delivered: true });
  const sent = cli.lines().find((m) => m.type === 'control_response');
  assert.equal(sent.response.request_id, 'r1');
  assert.match(sent.response.response.message, /คำตอบ: มืด/);
  // A Claude question still open when the turn ends can no longer be answered.
  cli.say({ type: 'control_request', request_id: 'r2', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: { questions: [{ question: 'ต่อไหม?', options: [{ label: 'ต่อ' }, { label: 'หยุด' }] }] } } });
  await until(() => (chats.snapshot('q').items as any[]).filter((i) => i.kind === 'question').length === 2);
  cli.say({ type: 'result', subtype: 'success', is_error: false, result: '' });
  await until(() => !chats.isRunning('q'));
  assert.equal((chats.snapshot('q').items as any[]).find((i) => i.requestId === 'r2').status, 'expired');
  chats.stopAll();
});

test('a reply that ends with the bare question JSON (no fence) also becomes a card', () => {
  const json = JSON.stringify({ questions: [{ question: 'สีไหน?', options: [{ label: 'มืด' }, { label: 'สว่าง' }] }] }, null, 2);
  const bare = takeQuestions(`ขอถามก่อน\n${json}`);
  assert.equal(bare.text, 'ขอถามก่อน');
  assert.equal(bare.asked!.questions[0].question, 'สีไหน?');
  assert.ok(takeQuestions('```json\n' + json + '\n```').asked, 'a json block at the end');
  assert.equal(takeQuestions(`ตัวอย่าง ${json} แล้วเขียนต่อ`).asked, null, 'JSON in the middle of an answer stays text');
  assert.equal(takeQuestions('{"questions": "not a list"}').asked, null);
});
