import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { buildProjectContext, MAX_CONTEXT_CHARS } from '../server/ProjectContext.js';
import { CliChatManager } from '../server/CliChat.js';
import { AgentRunManager } from '../server/AgentRunManager.js';
import { WorkspaceRegistry } from '../server/WorkspaceRegistry.js';
import { StudioServer } from '../server/StudioServer.js';
import { cliAuth } from '../server/CliAuth.js';
import { conversationMarkdown, teamMarkdown, exportFilename } from '../client/src/conversationExport.js';

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'superai-usability-'));
const cleanup = (dir: string) => { assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(), 'superai-usability-'))); fs.rmSync(dir, { recursive: true, force: true }); };

test('context snapshots instructions and pinned text, deduplicates rule files and reports omitted files', () => {
  const dir = temporary();
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'rule unique');
    fs.writeFileSync(path.join(dir, 'notes.md'), 'knowledge unique');
    fs.writeFileSync(path.join(dir, 'large.txt'), 'x'.repeat(70 * 1024));
    fs.writeFileSync(path.join(dir, 'binary.txt'), Buffer.from([0, 1]));
    const context = buildProjectContext({ rootPath: dir, instructions: 'workspace rule', pinnedFiles: ['notes.md', 'CLAUDE.md', 'missing.txt', 'large.txt', 'binary.txt', '../private.md'] }, dir);
    assert.match(context.text, /workspace rule/); assert.match(context.text, /knowledge unique/);
    assert.equal(context.text.split('rule unique').length - 1, 1);
    assert.deepEqual(context.files.map(file => file.status), ['included', 'included', 'duplicate', 'missing', 'too-large', 'unsupported', 'outside-root']);
    assert.ok(context.text.length <= MAX_CONTEXT_CHARS);
    fs.writeFileSync(path.join(dir, 'notes.md'), 'changed after snapshot');
    assert.doesNotMatch(context.text, /changed after snapshot/);
    assert.match(buildProjectContext({ rootPath: dir, pinnedFiles: ['notes.md'] }, dir).text, /changed after snapshot/);
  } finally { cleanup(dir); }
});

test('pinned files cannot escape through a junction and budget omissions are explicit', () => {
  const dir = temporary(), project = path.join(dir, 'project'), outside = path.join(dir, 'outside');
  fs.mkdirSync(project); fs.mkdirSync(outside);
  try {
    fs.writeFileSync(path.join(outside, 'secret.md'), 'never include this');
    fs.symlinkSync(outside, path.join(project, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.writeFileSync(path.join(project, 'long.md'), 'n'.repeat(11900));
    const context = buildProjectContext({ rootPath: project, instructions: 'rule'.repeat(100), pinnedFiles: ['escape/secret.md', 'long.md'] }, project);
    assert.doesNotMatch(context.text, /never include this/);
    assert.equal(context.files[0].status, 'outside-root'); assert.equal(context.files[1].status, 'budget');
    assert.throws(() => buildProjectContext({ rootPath: project, instructions: 'x'.repeat(13000) }, project), /ยาวเกินไป/);
  } finally { cleanup(dir); }
});

test('context and response style reach a CLI turn while user history remains clean and its snapshot survives restart', () => {
  const dir = temporary(); let input = '';
  const proc: any = new EventEmitter(); proc.stdout = new PassThrough(); proc.stderr = new PassThrough(); proc.stdin = new PassThrough(); proc.kill = () => true;
  proc.stdin.on('data', (value: Buffer) => { input += value.toString(); });
  const manager = new CliChatManager(() => proc, dir, (id, args) => ({ command: id, args }));
  try {
    const context = buildProjectContext({ rootPath: dir, instructions: 'isolated project instructions' }, dir);
    manager.send('chat', { agent: 'codex', cwd: dir, text: 'my short question', projectContext: context, responseStyle: 'concise' });
    assert.match(input, /isolated project instructions/); assert.match(input, /ตอบสั้นและตรงประเด็น/);
    assert.equal((manager.snapshot('chat').items[0] as any).text, 'my short question');
    proc.emit('close', 0);
    const restored = new CliChatManager(undefined, dir).snapshot('chat').items[0] as any;
    assert.equal(restored.request.responseStyle, 'concise'); assert.equal(restored.request.projectContext.text, context.text);
  } finally { manager.stopAll(); cleanup(dir); }
});

test('Agent planner, subagent, summary and all comparison participants receive the same context', async t => {
  const dir = temporary(); const manager = new AgentRunManager(path.join(dir, 'runs.json'));
  const received: string[] = [];
  const seat = { name: 'Main', provider: 'cli:codex', model: '', effort: '' };
  t.mock.method(manager as any, 'begin', (_ws: string, prompt: string) => prompt);
  t.mock.method(manager as any, 'provider', () => ({ stream: async (messages: { content: string }[]) => {
    const prompt = messages[0].content; received.push(prompt);
    return { text: prompt.includes('ตอบเป็น JSON อย่างเดียว') ? JSON.stringify({ note: 'plan', tasks: [{ id: 'one', title: 'task', assignee: 1, instructions: 'do work', dependsOn: [] }] }) : 'done' };
  } }));
  const wait = async (run: { status: string }) => {
    for (let index = 0; index < 100 && run.status === 'running'; index++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(run.status, 'completed');
  };
  try {
    const context = buildProjectContext({ rootPath: dir, instructions: 'shared context marker' }, dir);
    const agent = manager.startAgent('agent-ws', dir, { prompt: 'original question', main: seat, subagents: [{ ...seat, name: 'Worker' }], projectContext: context, responseStyle: 'explanatory' });
    await wait(agent); assert.equal(received.length, 3);
    assert.ok(received.every(prompt => prompt.includes('shared context marker')));
    assert.doesNotMatch(received[0], /รูปแบบคำตอบ:/, 'response style must not change the JSON planner protocol');
    assert.match(received[2], /รูปแบบคำตอบ: อธิบาย/);
    assert.equal(agent.prompt, 'original question');
    received.length = 0;
    const chat = manager.startChat('compare-ws', dir, { prompt: 'compare question', panel: [seat, { ...seat, name: 'Second' }], summarizer: seat, projectContext: context, responseStyle: 'concise' });
    await wait(chat); assert.equal(received.length, 3);
    assert.ok(received.every(prompt => prompt.includes('shared context marker') && prompt.includes('ตอบสั้นและตรงประเด็น')));
    assert.equal(chat.prompt, 'compare question');
  } finally { manager.stop(); cleanup(dir); }
});

test('favorites persist and invalid updates do not mutate the project', () => {
  const dir = temporary(); const file = path.join(dir, 'workspaces.json');
  try {
    const registry = new WorkspaceRegistry(file), workspace = registry.getWorkspaces()[0];
    registry.updateWorkspace(workspace.id, { favorite: true });
    assert.equal(new WorkspaceRegistry(file).getWorkspace(workspace.id)?.favorite, true);
    assert.throws(() => registry.updateWorkspace(workspace.id, { favorite: 'yes' as any, name: 'should not change' }), /ไม่ถูกต้อง/);
    assert.notEqual(registry.getWorkspace(workspace.id)?.name, 'should not change');
    registry.updateWorkspace(workspace.id, { favorite: false });
    assert.equal(new WorkspaceRegistry(file).getWorkspace(workspace.id)?.favorite, false);
  } finally { cleanup(dir); }
});

test('Markdown exports include tool and individual team outputs and filenames cannot become paths', () => {
  const text = conversationMarkdown('room', [{ kind: 'user', text: 'question' }, { kind: 'assistant', text: '**answer**' }, { kind: 'tool', title: 'command', output: '```dangerous fence```', status: 'done' }]);
  assert.match(text, /\*\*answer\*\*/); assert.match(text, /````text/);
  const team = teamMarkdown('team', [{ mode: 'chat', prompt: 'question', panel: [{ seat: { name: 'Second', provider: 'codex' }, output: 'independent answer' }], output: 'summary' }]);
  assert.match(team, /independent answer/); assert.match(team, /summary/);
  assert.ok(!/[\\/:]/.test(exportFilename('..\\bad/name:here', 'md')));
});

test('HTTP routes use server-owned context and persist the canonical session name', async t => {
  const dir = temporary(); const server = new StudioServer({ port: 0, customWorkspacePath: path.join(dir, 'workspaces.json') });
  await server.start(); const internal = server as any;
  const source = internal.workspaceRegistry.createWorkspace('Context project', dir, 'server-owned context');
  internal.terminalManager.addDormant({ id: 'one', options: { agentType: 'codex', wsId: source.id, cwd: dir, name: 'Old name' } }); internal.views.set('one', 'chat');
  const sent: any[] = [];
  t.mock.method(cliAuth, 'requireReady', async () => {});
  t.mock.method(internal.chats, 'send', (_id: string, request: any) => { sent.push(request); });
  const request = (url: string, body: unknown) => fetch(`http://127.0.0.1:${server.getPort()}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const response = await request('/api/terminals/one/chat', { text: 'question', responseStyle: 'concise', projectContext: { text: 'forged context' } });
    assert.equal(response.status, 200); assert.match(sent[0].projectContext.text, /server-owned context/); assert.doesNotMatch(sent[0].projectContext.text, /forged context/);
    assert.equal((await request('/api/terminals/one/chat', { text: 'question', responseStyle: 'invalid' })).status, 400);
    const renamed = await request('/api/terminals/one/name', { name: 'Canonical name' });
    assert.equal(renamed.status, 200); assert.equal((await renamed.json()).name, 'Canonical name');
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'superai-sessions.json'), 'utf8'));
    assert.equal(saved.sessions[0].options.name, 'Canonical name');
    assert.equal((await request('/api/terminals/one/name', { name: '' })).status, 400);
  } finally { await server.stop(); cleanup(dir); }
});
