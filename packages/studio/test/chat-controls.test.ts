import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatPrefs, hasChatPrefs, setChatPrefs, subscribeChatPrefs } from '../client/src/chatControls.js';
test('auth checks do not replace unread session model defaults', () => {
  setChatPrefs('auth-only', { blocked: true, note: 'sign in' });
  assert.equal(hasChatPrefs('auth-only'), false);
});
test('explicit empty model and effort remain choices across remounts', () => {
  setChatPrefs('default-choice', { model: '', effort: '' });
  assert.equal(hasChatPrefs('default-choice'), true);
  assert.equal(chatPrefs('default-choice').model, '');
});
test('sessions are isolated and consumed skills notify the mounted controls', () => {
  setChatPrefs('one', { model: 'a', skillId: 'skill-a' });
  setChatPrefs('two', { model: 'b', skillId: 'skill-b' });
  let skill = 'skill-a';
  const stop = subscribeChatPrefs('one', () => { skill = chatPrefs('one').skillId; });
  setChatPrefs('one', { skillId: '' });
  assert.equal(skill, '');
  assert.equal(chatPrefs('two').skillId, 'skill-b');
  stop();
  setChatPrefs('one', { skillId: 'new' });
  assert.equal(skill, '');
});
test('project context preference is isolated per session', () => {
  assert.equal(chatPrefs('context-a').includeProjectContext, true);
  setChatPrefs('context-a', { includeProjectContext: false });
  assert.equal(chatPrefs('context-a').includeProjectContext, false);
  assert.equal(chatPrefs('context-b').includeProjectContext, true);
});
