import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudKeys } from '../server/CloudKeys.js';
import { customProviders } from '../server/CustomProviders.js';

test('separate custom providers retain independent encrypted-store keys and manual models', async () => {
  const f = fixture({});
  f.saved.set('openrouter', 'built-in-test-key');
  assert.throws(() => f.keys.removeCustom('openrouter'), /ไม่พบ Custom/);
  assert.equal(f.saved.get('openrouter'), 'built-in-test-key');
  const first = await f.keys.addCustom({ name: 'First', baseURL: 'https://first.example/v1', models: ['first-model'], key: 'first-test-key-12345' });
  const second = await f.keys.addCustom({ name: 'Second', baseURL: 'https://second.example/v1', models: ['second-model'], key: 'second-test-key-67890' });
  try {
    assert.notEqual(first.id, second.id);
    assert.equal(f.keys.key(first.id), 'first-test-key-12345');
    assert.equal(f.keys.key(second.id), 'second-test-key-67890');
    assert.deepEqual(await f.keys.models(first.id), ['first-model']);
    assert.equal(f.calls.length, 0, 'saving a custom endpoint does not make paid or unsolicited requests');
    assert.ok(!JSON.stringify(customProviders.all()).includes('test-key'));
    f.keys.removeCustom(first.id);
    assert.equal(f.keys.key(second.id), 'second-test-key-67890');
  } finally {
    if (customProviders.get(first.id)) f.keys.removeCustom(first.id);
    f.keys.removeCustom(second.id);
  }
});

function fixture(routes: Record<string, { status?: number; body?: unknown }>) {
  const saved = new Map<string, string>();
  const calls: { url: string; auth: string; redirect?: string }[] = [];
  const keys = new CloudKeys(
    () => ({ get: (_k, id) => saved.get(id), saveApi: (id, key) => void saved.set(id, key), forgetApi: (id) => void saved.delete(id) }),
    async (url, init) => {
      calls.push({ url, auth: String((init?.headers as any)?.Authorization), redirect: init?.redirect });
      const route = routes[url];
      if (!route) throw new Error('offline');
      return new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 });
    });
  return { keys, saved, calls };
}

test('a key is checked with its provider before it is saved, and only sent there', async () => {
  const f = fixture({ 'https://openrouter.ai/api/v1/key': { body: { data: { usage: 1.5 } } } });
  assert.equal(f.keys.status('openrouter').hasKey, false);
  const status = await f.keys.save('openrouter', '  sk-or-test-abcd1234  ');
  assert.deepEqual([status.hasKey, status.source, status.hint], [true, 'settings', '…1234']);
  assert.equal(f.saved.get('openrouter'), 'sk-or-test-abcd1234');
  assert.deepEqual(f.calls, [{ url: 'https://openrouter.ai/api/v1/key', auth: 'Bearer sk-or-test-abcd1234', redirect: 'error' }]);
  assert.ok(!JSON.stringify(status).includes('sk-or-test'), 'the status never carries the key');
  assert.equal(f.keys.remove('openrouter').hasKey, false);
});

test('a rejected, malformed or unreachable key is not saved', async () => {
  const f = fixture({ 'https://api.deepseek.com/models': { status: 401 } });
  await assert.rejects(f.keys.save('deepseek', 'sk-bad'), /ไม่ยอมรับ API Key/);
  await assert.rejects(f.keys.save('deepseek', 'has space'), /ไม่ถูกต้อง/);
  await assert.rejects(f.keys.save('groq', 'gsk_x'), /เชื่อมต่อ Groq ไม่ได้/);
  await assert.rejects(f.keys.save('evil', 'x'), /ไม่รู้จัก/);
  assert.equal(f.saved.size, 0);
});

test('models and credit come from the provider once a key is saved', async () => {
  const f = fixture({
    'https://openrouter.ai/api/v1/key': { body: { data: { usage: 2, limit_remaining: 8 } } },
    'https://openrouter.ai/api/v1/credits': { body: { data: { total_credits: 10, total_usage: 2.5 } } },
    'https://openrouter.ai/api/v1/models': { body: { data: [{ id: 'openai/gpt-x' }, { id: 'anthropic/claude-y:free' }, { id: 'bad id' }, {}] } },
  });
  assert.deepEqual(await f.keys.models('openrouter'), [], 'no key: nothing is asked');
  assert.equal(f.calls.length, 0);
  await f.keys.save('openrouter', 'sk-or-1');
  assert.deepEqual(await f.keys.models('openrouter'), ['anthropic/claude-y:free', 'openai/gpt-x']);
  const before = f.calls.length;
  await f.keys.models('openrouter');
  assert.equal(f.calls.length, before, 'the list is cached');
  assert.deepEqual(await f.keys.balance('openrouter'), [
    { label: 'เครดิตคงเหลือ', value: '$7.50' }, { label: 'เติมไว้ทั้งหมด', value: '$10.00' },
    { label: 'key นี้ใช้ไปแล้ว', value: '$2.00' }, { label: 'วงเงินของ key เหลือ', value: '$8.00' },
  ]);
  assert.equal(await f.keys.balance('groq'), null);
});

test('DeepSeek balance is reported per currency', async () => {
  const f = fixture({
    'https://api.deepseek.com/models': { body: { data: [{ id: 'deepseek-chat' }] } },
    'https://api.deepseek.com/user/balance': { body: { is_available: true, balance_infos: [{ currency: 'USD', total_balance: '4.20' }] } },
  });
  await f.keys.save('deepseek', 'sk-ds');
  assert.deepEqual(await f.keys.balance('deepseek'), [{ label: 'ยอดคงเหลือ (USD)', value: '4.20' }]);
});
