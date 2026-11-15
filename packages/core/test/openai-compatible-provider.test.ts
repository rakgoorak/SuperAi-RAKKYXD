import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenAiCompatibleProvider,
  APPROVED_OPENAI_COMPATIBLE_ORIGINS,
} from '../src/providers/OpenAiCompatibleProvider.js';
import { createProvider, loadStoredAuth } from '../src/providers/index.js';

test('custom endpoints receive only explicitly approved origins and retain cancellation', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests++;
    assert.equal(init?.signal, controller.signal);
    assert.equal(init?.redirect, 'error');
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
  try {
    const provider = new OpenAiCompatibleProvider({ providerId: 'custom', baseURL: 'https://custom.example/v1', apiKey: 'dummy-custom-token', model: 'demo', approvedOrigins: ['https://custom.example'], signal: controller.signal, throwErrors: true });
    assert.equal((await provider.stream([{ role: 'user', content: 'hi' }], () => {})).text, 'ok');
    provider.baseURL = 'https://other.example/v1';
    await assert.rejects(provider.stream([{ role: 'user', content: 'hi' }], () => {}), /destination/);
    assert.equal(requests, 1, 'the credential never reaches an unapproved destination');
  } finally { globalThis.fetch = originalFetch; }
});

test('OpenAiCompatibleProvider initializes with correct defaults for DeepSeek, Groq, and OpenRouter', () => {
  const deepseek = new OpenAiCompatibleProvider({ providerId: 'deepseek' });
  assert.equal(deepseek.name, 'deepseek');
  assert.equal(deepseek.baseURL, 'https://api.deepseek.com/v1');
  assert.equal(deepseek.model, 'deepseek-chat');

  const groq = new OpenAiCompatibleProvider({ providerId: 'groq' });
  assert.equal(groq.name, 'groq');
  assert.equal(groq.baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(groq.model, 'llama-3.3-70b-versatile');

  const openrouter = new OpenAiCompatibleProvider({ providerId: 'openrouter' });
  assert.equal(openrouter.name, 'openrouter');
  assert.equal(openrouter.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(openrouter.model, 'deepseek/deepseek-r1');
});

test('OpenAiCompatibleProvider enforces approved origins and blocks untrusted destinations', () => {
  assert.ok(APPROVED_OPENAI_COMPATIBLE_ORIGINS.includes('https://api.openai.com'));
  assert.ok(APPROVED_OPENAI_COMPATIBLE_ORIGINS.includes('https://api.deepseek.com'));
  assert.ok(APPROVED_OPENAI_COMPATIBLE_ORIGINS.includes('https://api.groq.com'));
  assert.ok(APPROVED_OPENAI_COMPATIBLE_ORIGINS.includes('https://openrouter.ai'));

  const badProvider = new OpenAiCompatibleProvider({
    providerId: 'deepseek',
    apiKey: 'sk-test-fake-key-123',
    baseURL: 'https://evil-hacker.com/v1',
  });

  return badProvider.generate([{ role: 'user', content: 'test' }]).then((res) => {
    assert.match(res.text, /destination is not approved|Error calling/);
  });
});

test('OpenAiCompatibleProvider non-streaming generate parses OpenAI response and usage', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = (async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/v1/chat/completions');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer ds-fake-key');

    return new Response(JSON.stringify({
      id: 'chatcmpl-1',
      choices: [{
        message: { role: 'assistant', content: 'คำตอบจาก DeepSeek' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 15, completion_tokens: 30, total_tokens: 45 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const provider = new OpenAiCompatibleProvider({
    providerId: 'deepseek',
    apiKey: 'ds-fake-key',
  });

  const res = await provider.generate([{ role: 'user', content: 'สวัสดี' }]);
  assert.equal(res.text, 'คำตอบจาก DeepSeek');
  assert.equal(res.usage?.promptTokens, 15);
  assert.equal(res.usage?.completionTokens, 30);
  assert.equal(res.usage?.totalTokens, 45);
});

test('OpenAiCompatibleProvider stream() parses SSE lines and delivers delta chunks', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const ssePayload = [
    'data: {"choices":[{"delta":{"content":"ข้อความ"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"ที่ส่งแบบ"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"สตรีม"}}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');

  globalThis.fetch = (async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.stream, true);

    return new Response(ssePayload, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;

  const provider = new OpenAiCompatibleProvider({
    providerId: 'groq',
    apiKey: 'groq-fake-key',
  });

  const chunks: string[] = [];
  const res = await provider.stream(
    [{ role: 'user', content: 'เทสต์การสตรีม' }],
    (chunk) => chunks.push(chunk),
  );

  assert.equal(chunks.join(''), 'ข้อความที่ส่งแบบสตรีม');
  assert.equal(res.text, 'ข้อความที่ส่งแบบสตรีม');
});

test('createProvider instantiates deepseek, groq, and openrouter cleanly', () => {
  const deepseek = createProvider({ provider: 'deepseek', apiKey: 'test-ds' });
  assert.equal(deepseek.name, 'deepseek');

  const groq = createProvider({ provider: 'groq', apiKey: 'test-groq' });
  assert.equal(groq.name, 'groq');

  const openrouter = createProvider({ provider: 'openrouter', apiKey: 'test-or' });
  assert.equal(openrouter.name, 'openrouter');

  const custom = createProvider({
    provider: 'openai_compatible',
    apiKey: 'test-custom',
    baseURL: 'http://localhost:11434/v1',
    model: 'mistral',
  });
  assert.equal(custom.name, 'openai_compatible');
});
