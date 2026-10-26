import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPrediction, nextPromptRequest, predictionSeat } from '../server/NextPrompt.js';
import type { ChatItem } from '../server/CliChat.js';

const user = (text: string): ChatItem => ({ id: `u-${text}`, kind: 'user', text, at: 0 });
const reply = (text: string): ChatItem => ({ id: `a-${text}`, kind: 'assistant', text, at: 0 });

test('builds the prompt from the last turn only', () => {
  const prompt = nextPromptRequest([user('old question'), reply('old answer'), user('เพิ่มระบบแจ้งเตือน'), reply('เพิ่มแล้ว จะให้ทำ Pet ต่อไหม')]);
  assert.ok(prompt);
  assert.match(prompt, /<user>เพิ่มระบบแจ้งเตือน<\/user>/);
  assert.match(prompt, /<assistant>เพิ่มแล้ว จะให้ทำ Pet ต่อไหม<\/assistant>/);
  assert.doesNotMatch(prompt, /old/);
});

test('no prompt without an answer, or when the turn failed', () => {
  assert.equal(nextPromptRequest([]), null);
  assert.equal(nextPromptRequest([user('hi')]), null);
  assert.equal(nextPromptRequest([user('hi'), reply('hello'), { id: 'e', kind: 'error', text: 'boom', at: 0 }]), null);
});

test('cleanPrediction keeps one plain line and drops refusals', () => {
  assert.equal(cleanPrediction('"เริ่มทำระบบ Pet ต่อเลย"\nextra'), 'เริ่มทำระบบ Pet ต่อเลย');
  assert.equal(cleanPrediction('User: run the tests'), 'run the tests');
  assert.equal(cleanPrediction('NONE'), '');
  assert.equal(cleanPrediction('   '), '');
  assert.equal(cleanPrediction('x'.repeat(200)), '');
});

test('Claude predicts with Haiku; Codex keeps its model at low effort', () => {
  assert.deepEqual(predictionSeat('claude-code', 'opus'), { model: 'haiku', effort: '' });
  assert.deepEqual(predictionSeat('codex', 'gpt-5'), { model: 'gpt-5', effort: 'low' });
});
