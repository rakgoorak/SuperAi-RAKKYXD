import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StudioServer } from '../server/StudioServer.js';
import { chatHistoryEntries, recentConversations, runHistoryEntries } from '../client/src/historyEntries.js';
import { permissionChoices } from '../client/src/chatControls.js';
import type { Run, Session } from '../client/src/api.js';

test('general chat is idempotent and does not choose an existing user project', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-quick-chat-'));
  const server = new StudioServer({ port: 0, customWorkspacePath: path.join(directory, 'workspaces.json') });
  await server.start();
  try {
    const base = `http://127.0.0.1:${server.getPort()}`;
    const before = await (await fetch(`${base}/api/workspaces`)).json();
    const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(`${base}/api/workspaces/quick-chat`, { method: 'POST' })));
    assert.ok(responses.every(response => response.ok));
    const workspaces = await Promise.all(responses.map(response => response.json()));
    assert.equal(new Set(workspaces.map(ws => ws.id)).size, 1);
    assert.equal(workspaces[0].rootPath, path.join(directory, 'general-chat'));
    assert.equal((await fs.stat(workspaces[0].rootPath)).isDirectory(), true);
    const after = await (await fetch(`${base}/api/workspaces`)).json();
    assert.equal(after.length, before.length + 1);
    assert.deepEqual(after.filter((ws: { id: string }) => ws.id !== workspaces[0].id), before);
  } finally { await server.stop(); }
});

const session: Session = { id: 'one', name: 'ชื่องานที่ตั้งเอง', agentType: 'codex', wsId: 'project', cwd: '.', status: 'exited', exitCode: 0, mode: 'pipe', view: 'chat', createdAt: 1 };

test('history groups a renamed session once while preserving message-level search and latest activity', () => {
  const entries = chatHistoryEntries(session, [
    { id: 'u1', kind: 'user', text: 'first question', at: 10 },
    { id: 'a1', kind: 'assistant', text: 'first answer', at: 20 },
    { id: 'u2', kind: 'user', text: 'second question', at: 30 },
    { id: 'a2', kind: 'assistant', text: 'second answer', at: 40 },
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].snippet, 'first answer');
  assert.equal(entries[1].at, 40);
  const recent = recentConversations(entries);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].id, 'u2');
  assert.equal(recent[0].title, session.name);
  assert.deepEqual(recent[0].providers, ['codex']);
});

test('history retains team answers and routes separate modes and workspaces independently', () => {
  const run = { id: 'run', wsId: 'project', mode: 'chat', prompt: 'compare', output: '', createdAt: 50,
    panel: [{ seat: { provider: 'cli:claude-code' }, output: 'answer unique to Claude' }, { seat: { provider: 'cli:codex' }, output: 'Codex answer' }] } as Run;
  const entries = runHistoryEntries([run, { ...run, id: 'agent', mode: 'agent' }, { ...run, id: 'other', wsId: 'other' }]);
  assert.match(entries[0].snippet, /unique to Claude/);
  assert.deepEqual(entries[0].providers, ['claude-code', 'codex']);
  assert.equal(recentConversations([...chatHistoryEntries(session, []), ...entries]).length, 4);
});

test('every AI offers the same short permission list, with only the levels it can really do', () => {
  const values = (agent: string) => permissionChoices(agent).map(choice => choice.value);
  assert.deepEqual(values('claude-code'), ['read', 'ask', 'auto', 'full']);
  assert.deepEqual(values('codex'), ['read', 'ask', 'auto', 'full']);
  assert.deepEqual(values('opencode'), ['read', 'ask', 'auto', 'approve_all']);
  assert.deepEqual(values('antigravity'), ['read', 'auto', 'approve_all'], 'Antigravity cannot ask in chat');
  assert.deepEqual(values('openrouter'), ['read', 'auto'], 'API rooms have no unrestricted mode');
  assert.deepEqual(permissionChoices('codex').map(choice => choice.label), ['อ่านอย่างเดียว', 'ถามก่อนทำ', 'ทำเองอัตโนมัติ', 'เต็มสิทธิ์']);
  assert.ok(permissionChoices('opencode').every(choice => choice.hint));
});
