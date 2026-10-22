import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StudioServer } from '../server/StudioServer.js';
import { cliAuth } from '../server/CliAuth.js';

// Invoke the actual Express route without opening a socket; the desktop API is local.
async function request(server: StudioServer, route: string, params: Record<string, string>, body: unknown = {}, method = 'post') {
  const app = (server as any).app;
  const layer = app._router.stack.find((s: any) => s.route?.path === route && s.route.methods[method]);
  assert.ok(layer, route);
  let status = 200, value: any;
  const response: any = { status(code: number) { status = code; return this; }, json(data: unknown) { value = data; return this; } };
  await layer.route.stack[0].handle({ params, body, query: {} }, response);
  return { status, body: value };
}

test('switching to chat waits for terminal exit and rejects competing writers during handoff', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-handoff-'));
  const server = new StudioServer({ customWorkspacePath: path.join(dir, 'workspaces.json') });
  const internal = server as any;
  internal.sessionsLoaded = true;
  const session = internal.terminalManager.addDormant({ id: 'handoff', resume: 'thread-handoff', options: { agentType: 'codex', cwd: dir } });
  session.status = 'running';
  internal.views.set(session.id, 'terminal');
  t.mock.method(internal.terminalManager, 'terminate', () => {});
  let sends = 0;
  t.mock.method(internal.chats, 'send', () => { sends++; });
  t.mock.method(cliAuth, 'requireReady', async () => {});
  try {
    const switching = request(server, '/api/terminals/:id/view', { id: session.id }, { view: 'chat' });
    assert.equal(internal.views.get(session.id), 'terminal');
    assert.equal(session.status, 'stopping');
    assert.equal((await request(server, '/api/terminals/:id/view', { id: session.id }, { view: 'terminal' })).status, 409);
    assert.equal((await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'too early' })).status, 409);
    assert.equal((await request(server, '/api/terminals/:id/restart', { id: session.id })).status, 400);
    assert.equal(sends, 0);
    session.exitObserved = session.terminationConfirmed = true;
    assert.equal((await switching).status, 200);
    assert.equal(internal.views.get(session.id), 'chat');
    assert.equal(internal.chats.conversationId(session.id), 'thread-handoff');
    assert.equal((await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'ready' })).status, 200);
    assert.equal(sends, 1);
    t.mock.method(internal.chats, 'isRunning', () => true);
    assert.equal((await request(server, '/api/terminals/:id/restart', { id: session.id })).status, 409);
  } finally { await server.stop().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('per-message models reach the chat, persist, and support resetting to CLI defaults', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-settings-'));
  const server = new StudioServer({ customWorkspacePath: path.join(dir, 'workspaces.json') });
  const internal = server as any;
  internal.sessionsLoaded = true;
  const session = internal.terminalManager.addDormant({ id: 'test-chat', options: { agentType: 'codex', cwd: dir, model: 'old', effort: 'low' } });
  internal.views.set(session.id, 'chat');
  const sent: any[] = [];
  t.mock.method(cliAuth, 'requireReady', async () => {});
  t.mock.method(internal.chats, 'send', (_id: string, input: unknown) => { sent.push(input); });
  try {
    let result = await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'hello', model: 'chosen', effort: 'high' });
    assert.equal(result.status, 200);
    assert.equal(sent[0].model, 'chosen'); assert.equal(sent[0].effort, 'high');
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'superai-sessions.json'), 'utf8'));
    assert.equal(saved.sessions[0].options.model, 'chosen');
    const settings = await request(server, '/api/terminals/:id/chat/settings', { id: session.id }, {}, 'get');
    assert.equal(settings.body.model, 'chosen');
    result = await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'next', model: '', effort: '' });
    assert.equal(result.status, 200); assert.equal(sent[1].model, ''); assert.equal(session.restart.model, '');
    result = await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'bad', model: '--bad' });
    assert.equal(result.status, 400); assert.equal(sent.length, 2);
    result = await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'bad', effort: 'nonexistent' });
    assert.equal(result.status, 400); assert.equal(sent.length, 2);
  } finally { await server.stop().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('signed-out chat does not start a turn or change preferences and can retry after login', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signed-out-chat-'));
  const server = new StudioServer({ customWorkspacePath: path.join(dir, 'workspaces.json') });
  const internal = server as any;
  const session = internal.terminalManager.addDormant({ id: 'test-chat', options: { agentType: 'codex', cwd: dir, model: 'old' } });
  internal.views.set(session.id, 'chat');
  let ready = false, sends = 0;
  t.mock.method(cliAuth, 'requireReady', async () => { if (!ready) throw new Error('กรุณาเข้าสู่ระบบ (codex login)'); });
  t.mock.method(internal.chats, 'send', () => { sends++; });
  try {
    const failed = await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'hello', model: 'new' });
    assert.equal(failed.status, 400); assert.match(failed.body.error, /เข้าสู่ระบบ/);
    assert.equal(sends, 0); assert.equal(session.restart.model, 'old');
    assert.equal(internal.chats.snapshot(session.id).running, false);
    ready = true;
    assert.equal((await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'hello', model: 'new' })).status, 200);
    assert.equal(sends, 1);
    internal.views.set(session.id, 'terminal');
    assert.equal((await request(server, '/api/terminals/:id/chat', { id: session.id }, { text: 'conflict' })).status, 409);
  } finally { await server.stop().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('login terminals cannot become chats and never enter the saved conversation list', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'login-only-'));
  const server = new StudioServer({ customWorkspacePath: path.join(dir, 'workspaces.json') });
  const internal = server as any;
  try {
    const login = internal.terminalManager.addDormant({ id: 'login', options: { agentType: 'codex', authOnly: true, cwd: dir } });
    internal.views.set(login.id, 'terminal');
    const result = await request(server, '/api/terminals/:id/view', { id: login.id }, { view: 'chat' });
    assert.equal(result.status, 400); assert.match(result.body.error, /เข้าสู่ระบบ/);
    assert.equal(internal.terminalManager.records().length, 0);
    assert.equal(internal.terminalManager.listSessions()[0].authOnly, true);
  } finally { await server.stop().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); }
});
