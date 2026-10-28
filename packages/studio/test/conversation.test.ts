import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager, parsePlan } from '../server/AgentRunManager.js';
import { validateSeat } from '../server/Providers.js';

const seat = (provider: string, name = provider) => ({ name, provider, model: '', effort: '' });
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const settle = async (run: { status: string }) => { for (let i = 0; i < 200 && run.status === 'running'; i++) await new Promise(r => setTimeout(r, 10)); };
const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `superai-${name}-`));

test('chat sends one prompt to every Main and the summarizer credits each answer', async t => {
  const dir = tmp('chat'); const prompts: Record<string, string> = {};
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body); prompts[body.model] = body.messages.map((m: any) => m.content).join('\n');
    return reply(body.model === 'judge' ? 'สรุปจากทั้งสองตัว' : `ความเห็นของ ${body.model}`);
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startChat('p', dir, { prompt: 'ควรใช้ฐานข้อมูลอะไร', panel: [seat('alpha', 'Main 1'), seat('beta', 'Main 2')], summarizer: seat('judge', 'ผู้สรุป'), summaryStyle: 'best' });
    assert.throws(() => manager.startChat('p', dir, { prompt: 'อีกงาน', panel: [seat('alpha')] }), /กำลังทำ/);
    await settle(run);
    assert.equal(run.status, 'completed');
    assert.deepEqual(run.panel!.map(a => a.output), ['ความเห็นของ alpha', 'ความเห็นของ beta']);
    assert.equal(run.output, 'สรุปจากทั้งสองตัว');
    assert.match(prompts.judge, /Main 1[\s\S]*ความเห็นของ alpha/);
    assert.match(prompts.judge, /Main 2[\s\S]*ความเห็นของ beta/);
    assert.match(prompts.judge, /ตัดส่วนที่ผิด/);
    assert.equal(new AgentRunManager(path.join(dir, 'h.json')).list('p')[0].panel!.length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('chat keeps successful answers when one Main fails and works without a summarizer', async t => {
  const dir = tmp('chat-fail');
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    if (JSON.parse(options.body).model === 'broken') throw new Error('offline');
    return reply('คำตอบภาษาไทย');
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startChat('p', dir, { prompt: 'สวัสดี', panel: [seat('ok'), seat('broken')] });
    await settle(run);
    assert.equal(run.status, 'completed');
    assert.equal(run.panel![1].status, 'failed');
    assert.match(run.panel![1].error!, /offline/);
    assert.equal(run.output, '');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('usage is tracked separately for answers and summary and remains unknown when absent', async t => {
  const dir = tmp('usage');
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const model = JSON.parse(options.body).model;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], ...(model === 'a' ? { usage: { prompt_tokens: 120, completion_tokens: 12 } } : {}) }), { status: 200 });
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startChat('p', dir, { prompt: 'test', panel: [seat('a'), seat('b')], summarizer: seat('judge') });
    await settle(run);
    assert.equal(run.status, 'completed');
    assert.equal(run.usageSteps?.length, 3);
    assert.deepEqual(run.usageSteps?.[0].calls, [{ input: 120, output: 12 }]);
    assert.equal(run.usageSteps?.[0].missing, false);
    assert.equal(run.usageSteps?.[1].missing, true);
    assert.equal(run.usageSteps?.[2].stage, 'สรุปคำตอบ');
    assert.equal(new AgentRunManager(path.join(dir, 'h.json')).list('p')[0].usageSteps?.length, 3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('cancel aborts every Main and reports cancelled', async t => {
  const dir = tmp('cancel');
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => new Promise((_r, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startChat('p', dir, { prompt: 'รอก่อน', panel: [seat('a'), seat('b')], summarizer: seat('c') });
    assert.equal(manager.cancel(run.id), true);
    await settle(run);
    assert.equal(run.status, 'cancelled');
    assert.equal(run.error, 'ยกเลิกงานแล้ว');
    assert.equal(run.summaryStatus, 'cancelled');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agent: Main assigns tasks, independent Sub-agents run in parallel, dependents get earlier results', async t => {
  const dir = tmp('agent'); const order: string[] = []; let inFlight = 0, peak = 0; let mainCalls = 0; let finalPrompt = '';
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body); const text = body.messages.map((m: any) => m.content).join('\n');
    if (body.model === 'main') {
      mainCalls++;
      if (mainCalls === 1) return reply('แผนงาน:\n```json\n' + JSON.stringify({ note: 'แบ่งสองฝั่ง', tasks: [
        { id: 'ui', title: 'หน้าเว็บ', assignee: 1, instructions: 'ทำ UI' },
        { id: 'api', title: 'API', assignee: 2, instructions: 'ทำ API' },
        { id: 'check', title: 'ตรวจรวม', assignee: 1, instructions: 'ตรวจ', dependsOn: ['ui', 'api'] },
      ] }) + '\n```');
      finalPrompt = text; return reply('รายงานจาก Main');
    }
    order.push(`${body.model}:start`); inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(r => setTimeout(r, 30));
    inFlight--; order.push(`${body.model}:end`);
    if (text.includes('ตรวจรวม')) { assert.match(text, /ผลของ worker-a/); assert.match(text, /ผลของ worker-b/); return reply('ตรวจแล้วผ่าน'); }
    return reply(`ผลของ ${body.model}`);
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startAgent('p', dir, { prompt: 'สร้างระบบจอง', main: seat('main', 'Main'), subagents: [seat('worker-a', 'ฝั่งหน้า'), seat('worker-b', 'ฝั่งหลัง')] });
    await settle(run);
    assert.equal(run.status, 'completed', run.error);
    assert.equal(peak, 2);
    assert.deepEqual(run.tasks!.map(t => t.status), ['completed', 'completed', 'completed']);
    assert.equal(run.tasks![2].output, 'ตรวจแล้วผ่าน');
    assert.equal(run.output, 'รายงานจาก Main');
    assert.match(finalPrompt, /ฝั่งหลัง[\s\S]*ผลของ worker-b/);
    assert.ok(run.activity.some(a => a.who === 'Main' && a.text.includes('มอบ')));
    assert.ok(run.activity.some(a => a.who === 'ฝั่งหน้า' && a.text.includes('เริ่ม')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agent skips tasks whose dependency failed and reports failure honestly', async t => {
  const dir = tmp('agent-fail'); let mainCalls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    if (body.model === 'main') return reply(++mainCalls === 1 ? JSON.stringify([{ id: 'a', assignee: 1, instructions: 'ทำ' }, { id: 'b', assignee: 1, instructions: 'ต่อ', dependsOn: ['a'] }]) : 'Main: งานแรกล้มเหลว');
    throw new Error('worker unavailable');
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startAgent('p', dir, { prompt: 'ทำงาน', main: seat('main', 'Main'), subagents: [seat('w')] });
    await settle(run);
    assert.equal(run.status, 'failed');
    assert.deepEqual(run.tasks!.map(t => t.status), ['failed', 'skipped']);
    assert.match(run.tasks![0].error!, /worker unavailable/);
    assert.match(run.output, /ล้มเหลว/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('plans that assign unknown Sub-agents or loop forever are rejected', () => {
  assert.throws(() => parsePlan(JSON.stringify([{ assignee: 3, instructions: 'x' }]), 2), /ไม่มีอยู่/);
  assert.throws(() => parsePlan(JSON.stringify([{ id: 'a', assignee: 1, instructions: 'x', dependsOn: ['b'] }, { id: 'b', assignee: 1, instructions: 'y', dependsOn: ['a'] }]), 1), /วง/);
  assert.throws(() => parsePlan('ไม่มี JSON', 1), /JSON/);
});

test('seats reject Freebuff, bad effort levels and option-like model names', () => {
  assert.throws(() => validateSeat({ provider: 'cli:freebuff', model: '', effort: '' }), /Code/);
  assert.throws(() => validateSeat({ provider: 'cli:claude-code', model: '', effort: 'ultra' }), /effort/);
  assert.throws(() => validateSeat({ provider: 'cli:codex', model: '--dangerous', effort: '' }), /รุ่น/);
  assert.equal(validateSeat({ provider: 'cli:antigravity', model: 'gemini-4-argon-high', effort: 'high' }).effort, 'high');
});
