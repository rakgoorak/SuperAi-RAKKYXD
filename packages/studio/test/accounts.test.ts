import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountRegistry } from '../server/Accounts.js';

function setup(t: test.TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-accounts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, accounts: new AccountRegistry(dir) };
}

test('profiles persist with defaults without replacing the system login', t => {
  const { accounts, dir } = setup(t);
  const a = accounts.create('claude-code', 'งาน');
  const b = accounts.create('claude-code', 'ส่วนตัว');
  accounts.setDefault('claude-code', a.id);
  assert.equal(new AccountRegistry(dir).resolve('claude-code'), a.id);
  assert.equal(accounts.resolve('claude-code', 'system'), 'system');
  accounts.setDefault('claude-code', b.id);
  assert.equal(accounts.resolve('claude-code', a.id), a.id);
  assert.equal(accounts.list('claude-code').length, 3);
});

test('profiles refuse wrong providers, unknown ids and unsupported isolation', t => {
  const { accounts } = setup(t);
  const a = accounts.create('claude-code', 'A');
  assert.throws(() => accounts.resolve('codex', a.id));
  assert.throws(() => accounts.resolve('claude-code', '../escape'));
  assert.throws(() => accounts.resolve('claude-code', 'deleted'));
  assert.throws(() => accounts.create('antigravity', 'A'));
  assert.throws(() => accounts.create('codex', '  '));
  assert.throws(() => accounts.remove('claude-code', 'system'));
});

test('account processes isolate credentials and leave parent environment untouched', t => {
  const { accounts } = setup(t);
  const a = accounts.create('claude-code', 'A'), b = accounts.create('claude-code', 'B');
  const base = { PATH: 'tools', ANTHROPIC_API_KEY: 'inherited-secret', CLAUDE_CODE_OAUTH_TOKEN: 'inherited-token', CUSTOM: 'kept' };
  const ea = accounts.environment('claude-code', a.id, base);
  const eb = accounts.environment('claude-code', b.id, base);
  assert.notEqual(ea.CLAUDE_CONFIG_DIR, eb.CLAUDE_CONFIG_DIR);
  assert.equal(ea.ANTHROPIC_API_KEY, undefined);
  assert.equal(ea.CLAUDE_CODE_OAUTH_TOKEN, undefined);
  assert.equal(ea.CUSTOM, 'kept');
  assert.equal(base.ANTHROPIC_API_KEY, 'inherited-secret');
  assert.deepEqual(accounts.environment('claude-code', 'system', base), base);
});

test('Codex and OpenCode have separate persistent storage per profile', t => {
  const { accounts } = setup(t);
  const c = accounts.create('codex', 'C');
  const o = accounts.create('opencode', 'O');
  const ce = accounts.environment('codex', c.id, { OPENAI_API_KEY: 'secret', CODEX_HOME: 'global' });
  assert.notEqual(ce.CODEX_HOME, 'global');
  assert.equal(ce.OPENAI_API_KEY, undefined);
  assert.match(fs.readFileSync(path.join(ce.CODEX_HOME!, 'config.toml'), 'utf8'), /cli_auth_credentials_store = "file"/);
  const oe = accounts.environment('opencode', o.id, { ANTHROPIC_API_KEY: 'secret', OPENCODE_CONFIG_CONTENT: 'shared' });
  assert.ok(path.isAbsolute(oe.XDG_DATA_HOME!));
  assert.ok(oe.XDG_CONFIG_HOME && oe.XDG_CACHE_HOME && oe.XDG_STATE_HOME);
  assert.equal(oe.OPENCODE_CONFIG_CONTENT, undefined);
  assert.equal(oe.ANTHROPIC_API_KEY, undefined);
  const ambient = accounts.environment('opencode', o.id, {
    AWS_ACCESS_KEY_ID: 'ambient', AWS_SECRET_ACCESS_KEY: 'secret', AWS_PROFILE: 'work',
    AWS_BEARER_TOKEN_BEDROCK: 'token', GOOGLE_APPLICATION_CREDENTIALS: 'global.json',
    AZURE_OPENAI_API_KEY: 'key', GITHUB_TOKEN: 'token', PATH: 'tools',
  });
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_PROFILE', 'AWS_BEARER_TOKEN_BEDROCK', 'AZURE_OPENAI_API_KEY', 'GITHUB_TOKEN']) assert.equal(ambient[key], undefined);
  assert.ok(ambient.GOOGLE_APPLICATION_CREDENTIALS!.startsWith(path.dirname(ambient.XDG_DATA_HOME!)));
  assert.ok(ambient.AWS_SHARED_CREDENTIALS_FILE!.startsWith(path.dirname(ambient.XDG_DATA_HOME!)));
  accounts.setDefault('codex', c.id);
  accounts.remove('codex', c.id);
  assert.equal(accounts.resolve('codex'), 'system');
  assert.ok(fs.existsSync(ce.CODEX_HOME!));
});
