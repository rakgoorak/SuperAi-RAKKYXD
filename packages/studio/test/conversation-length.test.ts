import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LONG_CHAT_TOKENS, conversationTokens, estimateTokens } from '../client/src/conversationLength.js';

test('long-chat estimate counts Thai per character, other text per four, and restarts after /compact', () => {
  assert.equal(estimateTokens('abcdefgh'), 2);
  assert.equal(estimateTokens('สวัสดี'), 6);
  const long = { kind: 'assistant', text: 'x'.repeat(LONG_CHAT_TOKENS * 4) };
  assert.ok(conversationTokens([{ kind: 'user', text: 'hi' }, long]) >= LONG_CHAT_TOKENS);
  assert.equal(conversationTokens([long, { kind: 'user', text: '/compact' }, { kind: 'assistant', text: 'abcd' }]), 1);
  assert.ok(conversationTokens([{ kind: 'tool', output: 'y'.repeat(400) }]) === 100, 'tool output counts too');
});
