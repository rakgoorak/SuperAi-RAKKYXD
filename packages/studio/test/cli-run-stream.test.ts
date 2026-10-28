import test from 'node:test';
import assert from 'node:assert/strict';
import { createCliRunStream } from '../server/CliRunStream.js';

test('Codex emits only final message events and keeps reported cache within input', () => {
  const chunks: string[] = [];
  const parser = createCliRunStream('codex', text => chunks.push(text));
  parser.line(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', id: 'a', text: 'answer' } }));
  parser.line(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', id: 'a', text: 'answer' } }));
  parser.line(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 30, output_tokens: 7 } }));
  assert.deepEqual(chunks, ['answer']);
  assert.deepEqual(parser.result().usage, { input: 100, cachedInput: 30, output: 7, inputIncludesCache: true });
});

test('Claude collects result usage without mixing sub-agent event text or missing fields', () => {
  const chunks: string[] = [];
  const parser = createCliRunStream('claude-code', text => chunks.push(text));
  parser.line(JSON.stringify({ type: 'assistant', parent_tool_use_id: 'child', message: { id: 'child', content: [{ type: 'text', text: 'hidden' }] } }));
  parser.line(JSON.stringify({ type: 'assistant', message: { id: 'main', content: [{ type: 'text', text: 'answer' }] } }));
  parser.line(JSON.stringify({ type: 'result', subtype: 'success', result: 'answer', usage: { input_tokens: 4, cache_read_input_tokens: 50, output_tokens: 8 } }));
  assert.deepEqual(chunks, ['answer']);
  assert.deepEqual(parser.result().usage, { input: 4, cachedInput: 50, cacheWrite: undefined, output: 8, inputIncludesCache: false });
});

test('missing usage is unknown and errors do not become successful results', () => {
  const parser = createCliRunStream('codex', () => {});
  parser.line(JSON.stringify({ type: 'turn.failed', error: { message: 'quota' } }));
  assert.equal(parser.result().usage, undefined);
  assert.equal(parser.result().error, 'quota');
});
