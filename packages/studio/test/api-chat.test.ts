import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliChatManager } from '../server/CliChat.js';

async function settle(manager: CliChatManager, id: string) {
  const until = Date.now() + 3000;
  while (manager.isRunning(id) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(manager.isRunning(id), false);
}

test('API sessions use selected models without spawning a CLI and persist follow-up history', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'api-chat-'));
  const seen: any[] = [];
  const options = { apiProvider: (id: string, model: string | undefined) => ({ name: id, model: model || '', generate: async () => ({ text: '' }),
    stream: async (messages: any[], chunk: any) => { seen.push({ model, messages }); chunk('คำตอบ'); return { text: 'คำตอบ' }; } }) };
  const manager = new CliChatManager(() => { throw new Error('must not launch CLI'); }, directory, undefined, undefined, options);
  try {
    manager.send('api', { agent: 'openrouter', cwd: process.cwd(), text: 'remember blue', model: 'model-a', permission: 'read' });
    await settle(manager, 'api');
    assert.equal(seen[0].model, 'model-a');
    const restored = new CliChatManager(undefined, directory, undefined, undefined, options);
    restored.send('api', { agent: 'openrouter', cwd: process.cwd(), text: 'what color?', model: 'model-b', permission: 'read' });
    await settle(restored, 'api');
    assert.equal(seen[1].model, 'model-b');
    assert.ok(seen[1].messages.some((message: any) => message.content === 'remember blue'));
    assert.equal(restored.snapshot('api').items.filter(item => item.kind === 'assistant').length, 2);
    assert.ok(!JSON.stringify(restored.snapshot('api')).includes('apiKey'));
  } finally { manager.stopAll(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('API stop aborts the request and pauses the queued message', async () => {
  let aborted = false;
  const manager = new CliChatManager(undefined, undefined, undefined, undefined, { apiProvider: (id, model, signal) => ({ name: id, model: model || '', generate: async () => ({ text: '' }), stream: () => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
  }) }) });
  const request = { agent: 'groq', cwd: process.cwd(), text: 'wait', permission: 'read' as const };
  manager.send('api-stop', request);
  assert.equal(manager.send('api-stop', { ...request, text: 'next' }, { queue: true }), 'queued');
  assert.equal(manager.cancel('api-stop'), true);
  await settle(manager, 'api-stop');
  assert.equal(aborted, true);
  assert.equal(manager.snapshot('api-stop').queued.length, 1);
  assert.ok(manager.snapshot('api-stop').items.some(item => item.kind === 'notice' && item.text === 'หยุดแล้ว'));
});
