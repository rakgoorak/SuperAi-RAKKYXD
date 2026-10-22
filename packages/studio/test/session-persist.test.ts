import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StudioServer } from '../server/StudioServer.js';

const json = async (port: number, url: string, body?: unknown) => {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('chat sessions open without a CLI process, survive a restart and are deleted when closed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-sessions-'));
  const file = path.join(dir, 'workspaces.json');
  let server = new StudioServer({ port: 0, customWorkspacePath: file });
  await server.start();
  try {
    const opened = await json(server.getPort(), '/api/terminals/spawn', { agentType: 'codex', name: 'Codex · test', model: 'gpt-6-luna' });
    assert.equal(opened.status, 200);
    assert.deepEqual([opened.body.view, opened.body.dormant, opened.body.status], ['chat', true, 'exited'], 'a chat needs no terminal process');
    const id = opened.body.id;
    const chat = await json(server.getPort(), `/api/terminals/${id}/chat`);
    assert.deepEqual(chat.body.items, []);
    // A CLI without a chat view still opens its terminal right away.
    const shell = await json(server.getPort(), '/api/terminals/spawn', { forcePipe: true, command: process.platform === 'win32' ? 'cmd.exe' : 'sh', args: process.platform === 'win32' ? ['/c', 'exit'] : ['-c', 'exit'] });
    assert.equal(shell.body.view, 'terminal');
    assert.equal((await json(server.getPort(), `/api/terminals/${shell.body.id}/view`, { view: 'chat' })).status, 400);
    assert.equal((await json(server.getPort(), `/api/terminals/${id}/chat`, { text: '' })).status, 400);
    await server.stop();

    // Restart: the session is back, still a dormant chat with its model.
    server = new StudioServer({ port: 0, customWorkspacePath: file });
    await server.start();
    const list = (await json(server.getPort(), '/api/terminals')).body;
    const back = list.find((s: any) => s.id === id);
    assert.ok(back, 'the chat session was kept');
    assert.deepEqual([back.view, back.dormant, back.name], ['chat', true, 'Codex · test']);
    assert.equal(list.filter((s: any) => s.agentType === 'terminal').length, 0, 'plain shells are not kept');
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'superai-sessions.json'), 'utf8'));
    assert.equal(saved.sessions[0].options.model, 'gpt-6-luna');

    // Closing deletes it for good.
    assert.equal((await json(server.getPort(), `/api/terminals/${id}/kill`, {})).body.success, true);
    await server.stop();
    server = new StudioServer({ port: 0, customWorkspacePath: file });
    await server.start();
    assert.equal((await json(server.getPort(), '/api/terminals')).body.length, 0);
  } finally {
    await server.stop().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a port that fails to start never overwrites the saved sessions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-sessions-'));
  const file = path.join(dir, 'workspaces.json');
  fs.writeFileSync(path.join(dir, 'superai-sessions.json'), JSON.stringify({ sessions: [{ id: 'keep-me', options: { agentType: 'codex', name: 'Codex' }, view: 'chat' }] }));
  const unused = new StudioServer({ port: 0, customWorkspacePath: file });
  await unused.stop().catch(() => {}); // like the desktop app does after a failed port
  assert.match(fs.readFileSync(path.join(dir, 'superai-sessions.json'), 'utf8'), /keep-me/);
  fs.rmSync(dir, { recursive: true, force: true });
});
