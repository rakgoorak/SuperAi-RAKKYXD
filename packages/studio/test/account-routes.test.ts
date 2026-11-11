import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { AccountRegistry } from '../server/Accounts.js';
import { registerAccountRoutes } from '../server/AccountRoutes.js';

test('account API persists names/defaults, rejects wrong providers and protects referenced profiles', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'account-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = new AccountRegistry(root), app = express(); app.use(express.json());
  let referenced = '';
  registerAccountRoutes(app, id => id === referenced, registry);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (route: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  const created = await request('/api/accounts/codex', 'POST', { name: 'งาน' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await request(`/api/accounts/claude-code/${id}/default`, 'POST')).status, 400);
  assert.equal((await request(`/api/accounts/codex/${id}/default`, 'POST')).status, 200);
  assert.equal((await request(`/api/accounts/codex/${id}`, 'PATCH', { name: 'ทีม' })).status, 200);
  const groups = (await request('/api/accounts')).data;
  assert.equal(groups.find((p: any) => p.provider === 'codex').profiles.find((p: any) => p.id === id).name, 'ทีม');
  assert.ok(!JSON.stringify(groups).includes(root), 'API does not expose credential paths');
  assert.equal((await request('/api/accounts/antigravity', 'POST', { name: 'unsupported' })).status, 400);
  referenced = id;
  assert.equal((await request(`/api/accounts/codex/${id}`, 'DELETE')).status, 409);
  referenced = '';
  assert.equal((await request(`/api/accounts/codex/${id}`, 'DELETE')).status, 200);
  assert.equal(registry.resolve('codex'), 'system');
});
