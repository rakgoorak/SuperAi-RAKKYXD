import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager } from '../server/AgentRunManager.js';
import { questionRules } from '../server/Questions.js';
import { replyLanguageRule, serverLocale, setServerLocale } from '../server/i18n.js';

const seat = (provider: string, name = provider) => ({ name, provider, model: '', effort: '' });
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const settle = async (run: { status: string }) => { for (let i = 0; i < 200 && run.status === 'running'; i++) await new Promise(r => setTimeout(r, 10)); };

test('the AI answers in the language the user writes in, falling back to the app language', () => {
  const before = serverLocale();
  try {
    setServerLocale('en', false);
    assert.match(replyLanguageRule(), /same language the user writes in .*English/);
    assert.match(questionRules(), /same language the user writes in/);
    setServerLocale('ja', false);
    assert.match(replyLanguageRule(), /Japanese/);
  } finally { setServerLocale(before, false); }
});

test('asking several AIs never forces Thai answers', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-reply-language-'));
  const prompts: string[] = [];
  const before = serverLocale();
  setServerLocale('en', false);
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    prompts.push(body.messages.map((m: any) => m.content).join('\n'));
    return reply('Use PostgreSQL.');
  });
  try {
    const run = new AgentRunManager(path.join(dir, 'h.json')).startChat('p', dir, { prompt: 'Which database should I use?', panel: [seat('alpha')], summarizer: seat('judge') });
    await settle(run);
    assert.equal(run.status, 'completed');
    assert.equal(prompts.length, 2);
    for (const prompt of prompts) {
      assert.doesNotMatch(prompt, /ภาษาไทย/);
      assert.match(prompt, /same language the user writes in \(if unclear, use English\)/);
    }
  } finally {
    setServerLocale(before, false);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
