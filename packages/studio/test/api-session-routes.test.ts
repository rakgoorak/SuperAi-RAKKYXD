import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { StudioServer } from '../server/StudioServer.js';
import { cloudKeys } from '../server/CloudKeys.js';

test('custom API connection opens, streams, follows up and restores in Terminal chat without a CLI', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'api-session-route-'));
  const credentials = new Map<string, string>(), modelRequests: any[] = [];
  const originalStore = (cloudKeys as any).store;
  (cloudKeys as any).store = () => ({ get: (_kind: string, id: string) => credentials.get(id), saveApi: (id: string, key: string) => credentials.set(id, key), forgetApi: (id: string) => credentials.delete(id) });
  const endpoint = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-custom-key');
    modelRequests.push(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: 'API answer' } }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise<void>(resolve => endpoint.listen(0, '127.0.0.1', resolve));
  const options = { port: 0, customWorkspacePath: path.join(directory, 'workspaces.json') };
  let server = new StudioServer(options);
  try {
    await server.start();
    let base = `http://127.0.0.1:${server.getPort()}`;
    const request = async (route: string, body?: unknown) => {
      const response = await fetch(base + route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
      const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
    };
    const custom = await request('/api/custom-providers', { name: 'Local Test', baseURL: `http://127.0.0.1:${(endpoint.address() as any).port}/v1`, key: 'test-custom-key', models: ['test-model'] });
    assert.ok(!JSON.stringify(custom).includes('test-custom-key'));
    const session = await request('/api/terminals/spawn', { agentType: custom.id, cwd: directory, model: 'test-model' });
    assert.equal(session.view, 'chat');
    assert.equal(session.dormant, true);
    assert.equal((await request(`/api/terminals/${session.id}/chat/settings`)).model, 'test-model');
    const wait = async () => {
      const until = Date.now() + 5000;
      let snapshot: any;
      do { snapshot = await request(`/api/terminals/${session.id}/chat`); if (!snapshot.running) return snapshot; await new Promise(resolve => setTimeout(resolve, 10)); } while (Date.now() < until);
      throw new Error('API session did not complete');
    };
    await request(`/api/terminals/${session.id}/chat`, { text: 'remember this', permission: 'read' });
    assert.ok((await wait()).items.some((item: any) => item.kind === 'assistant' && item.text === 'API answer'));
    await request(`/api/terminals/${session.id}/chat`, { text: 'follow up', permission: 'read' });
    await wait();
    assert.equal(modelRequests[0].model, 'test-model');
    assert.ok(modelRequests[1].messages.some((message: any) => message.content === 'remember this'));
    const raw = await fetch(base + `/api/terminals/${session.id}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view: 'terminal' }) });
    assert.equal(raw.status, 400);
    await server.stop(); server = new StudioServer(options); await server.start(); base = `http://127.0.0.1:${server.getPort()}`;
    assert.ok((await request('/api/terminals')).some((item: any) => item.id === session.id && item.view === 'chat'));
    assert.equal((await request(`/api/terminals/${session.id}/chat`)).items.filter((item: any) => item.kind === 'assistant').length, 2);
  } finally {
    await server.stop();
    await new Promise<void>(resolve => endpoint.close(() => resolve()));
    (cloudKeys as any).store = originalStore;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
