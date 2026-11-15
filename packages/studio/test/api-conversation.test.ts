import test from 'node:test';
import assert from 'node:assert/strict';
import { runApiConversation } from '../server/ApiConversation.js';

test('API chat streams follow-up context and restricts available tools in read mode', async () => {
  const calls: any[] = [], items: any[] = [];
  const provider: any = { stream: async (messages: any[], chunk: (s: string) => void, tools: any[]) => {
    calls.push(structuredClone(messages));
    assert.ok(tools.every(t => ['view_file', 'glob_search', 'grep_search'].includes(t.name)));
    chunk('hello'); return { text: 'hello' };
  } };
  await runApiConversation({ provider, cwd: process.cwd(), signal: new AbortController().signal, prefix: 't2', permission: 'read',
    history: [{ kind: 'user', text: 'remember blue' }, { kind: 'assistant', text: 'blue' }, { kind: 'user', text: 'what color?' }],
    onItem: item => items.push(item) });
  assert.ok(calls[0].some((m: any) => m.content === 'remember blue'));
  assert.equal(calls[0].at(-1).content, 'what color?');
  assert.equal(items.at(-1).text, 'hello');
});

test('API chat rejects an unoffered command tool and returns the denial to the model', async () => {
  const items: any[] = [];
  let step = 0;
  const provider: any = { stream: async (messages: any[]) => {
    if (!step++) return { text: '', toolCalls: [{ id: 'denied', name: 'bash', arguments: { command: 'must never execute' } }] };
    assert.equal(messages.at(-1).role, 'tool');
    assert.match(messages.at(-1).content, /ไม่ได้รับอนุญาต/);
    return { text: 'cannot run' };
  } };
  await runApiConversation({ provider, cwd: process.cwd(), signal: new AbortController().signal, prefix: 't1', permission: 'read', history: [{ kind: 'user', text: 'try' }], onItem: item => items.push(item) });
  assert.ok(items.some(item => item.kind === 'tool' && item.status === 'failed'));
  assert.equal(items.at(-1).text, 'cannot run');
});

test('cancelled API chat never publishes a late answer', async () => {
  const controller = new AbortController(), items: any[] = [];
  const provider: any = { stream: async (_: any, chunk: any) => { controller.abort(); chunk('late'); return { text: 'late' }; } };
  await assert.rejects(runApiConversation({ provider, cwd: process.cwd(), signal: controller.signal, prefix: 't1', permission: 'read', history: [{ kind: 'user', text: 'hi' }], onItem: item => items.push(item) }));
  assert.equal(items.length, 0);
});
