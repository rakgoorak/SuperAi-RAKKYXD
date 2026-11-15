import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountRegistry } from '../server/Accounts.js';
import { TerminalSessionManager } from '../server/TerminalSessionManager.js';

test('saved and dormant tabs retain their selected account after the default changes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'account-tabs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = new AccountRegistry(root), manager = new TerminalSessionManager(registry);
  const a = registry.create('claude-code', 'A'), b = registry.create('claude-code', 'B');
  manager.addDormant({ id: 'a', options: { agentType: 'claude-code', accountId: a.id, cwd: root } });
  manager.addDormant({ id: 'old', options: { agentType: 'claude-code', cwd: root } });
  registry.setDefault('claude-code', b.id);
  assert.equal(manager.listSessions().find(s => s.id === 'a')?.accountId, a.id);
  assert.equal(manager.listSessions().find(s => s.id === 'old')?.accountId, 'system');
  assert.equal(manager.records().find(s => s.id === 'a')?.options.accountId, a.id);
});

test('two terminal processes receive different account directories without credential inheritance', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'account-processes-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = new AccountRegistry(root), manager = new TerminalSessionManager(registry);
  const profiles = [registry.create('claude-code', 'A'), registry.create('claude-code', 'B')];
  const sessions = profiles.map(profile => manager.spawnSession({
    agentType: 'claude-code', accountId: profile.id, command: process.execPath, forcePipe: true,
    args: ['-e', 'console.log(JSON.stringify({dir:process.env.CLAUDE_CONFIG_DIR,key:process.env.ANTHROPIC_API_KEY}))'],
    env: { ANTHROPIC_API_KEY: 'must-not-be-inherited' },
  }));
  await Promise.all(sessions.map(session => new Promise<void>(resolve => session.process!.once('close', () => resolve()))));
  const results = sessions.map(session => JSON.parse(session.bufferedOutput.split(/\r?\n/).find(line => line.startsWith('{'))!));
  assert.notEqual(results[0].dir, results[1].dir);
  assert.equal(results[0].dir, registry.directory('claude-code', profiles[0].id));
  assert.equal(results[1].dir, registry.directory('claude-code', profiles[1].id));
  assert.equal(results[0].key, undefined);
  assert.equal(results[1].key, undefined);
});

test('missing account metadata preserves unavailable tabs without breaking other session saves', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-account-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = new AccountRegistry(root), manager = new TerminalSessionManager(registry);
  const profile = registry.create('codex', 'A');
  manager.addDormant({ id: 'missing', options: { agentType: 'codex', accountId: profile.id, cwd: root } });
  manager.addDormant({ id: 'other', options: { agentType: 'codex', cwd: root } });
  registry.remove('codex', profile.id); // Simulate registry loss outside the guarded HTTP API.
  const saved = manager.records();
  assert.equal(saved.length, 2);
  assert.equal(saved.find(s => s.id === 'missing')?.options.accountId, profile.id);
  assert.throws(() => manager.restartSession('missing'), /ไม่พบบัญชี/);
});
