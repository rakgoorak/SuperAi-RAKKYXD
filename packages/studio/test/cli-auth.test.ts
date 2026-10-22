import test from 'node:test';
import assert from 'node:assert/strict';
import { CliAuthManager, isAuthFailure, LOGIN_ARGS } from '../server/CliAuth.js';
import { cliFailure } from '../server/CliProvider.js';

test('missing CLI, signed-out account and unverified account are different states', async () => {
  let calls = 0;
  const manager = new CliAuthManager(async (id, args) => {
    calls++;
    if (id === 'claude-code') { assert.deepEqual(args, ['auth', 'status']); return { code: 1, stdout: '{"loggedIn":false,"authMethod":"none"}', stderr: '' }; }
    assert.deepEqual(args, ['login', 'status']);
    return { code: 1, stdout: '', stderr: 'Not logged in' };
  }, (id) => id !== 'freebuff');
  assert.equal((await manager.get('freebuff')).status, 'not-installed');
  assert.equal((await manager.get('claude-code')).status, 'login-required');
  assert.equal((await manager.get('codex')).status, 'login-required');
  await assert.rejects(manager.requireReady('codex'), /codex login/);
  assert.equal((await manager.get('antigravity')).status, 'unknown');
  assert.equal(calls, 2, 'unknown providers do not start a browser or a model request');
});

test('auth probes accept the documented CLI result without exposing credentials', async () => {
  const manager = new CliAuthManager(async (id) => ({ code: 0, stdout: id === 'claude-code' ? '{"loggedIn":true,"authMethod":"oauth_token","email":"private@example.test"}' : '', stderr: id === 'codex' ? 'Logged in using ChatGPT' : '' }), () => true);
  assert.equal((await manager.get('claude-code')).status, 'authenticated');
  assert.equal((await manager.get('codex')).status, 'authenticated');
  assert.ok(!JSON.stringify(await manager.get('claude-code')).includes('private@example.test'));
  assert.deepEqual(LOGIN_ARGS['claude-code'], ['auth', 'login']);
  assert.deepEqual(LOGIN_ARGS.codex, ['login']);
  assert.deepEqual(LOGIN_ARGS.opencode, ['auth', 'login']);
});

test('free OpenCode models are not blocked by an empty credential list or another model auth failure', async () => {
  const manager = new CliAuthManager(async () => ({ code: 0, stdout: '0 credentials', stderr: '' }), () => true);
  assert.equal((await manager.get('opencode')).status, 'unknown');
  manager.failure('opencode', 'Invalid API key');
  await manager.requireReady('opencode');
});

test('timeouts, unsupported auth commands and network failures stay unverified', async () => {
  for (const output of ['unknown command auth', 'ETIMEDOUT', '403 forbidden: model unavailable', 'usage limit reached']) {
    const manager = new CliAuthManager(async () => ({ code: 1, stdout: '', stderr: output }), () => true);
    assert.equal((await manager.get('codex')).status, 'unknown', output);
  }
});

test('expired credentials produce recovery guidance; quota and model errors retain their cause', () => {
  for (const text of ['Not logged in', 'Invalid credential', 'refresh_token expired', 'Please sign in', 'Authentication required']) assert.ok(isAuthFailure(text), text);
  for (const text of ['quota exceeded', 'rate limit reached', 'model not supported', '403 permission denied', 'connection timeout']) assert.ok(!isAuthFailure(text), text);
  assert.match(cliFailure('cli:codex', '', 'Not logged in', '', 1), /เข้าสู่ระบบ/);
  assert.match(cliFailure('cli:codex', '', 'Warning: optional feature unavailable', 'Not logged in', 1), /เข้าสู่ระบบ/);
  assert.match(cliFailure('cli:codex', '', 'quota exceeded', '', 1), /quota exceeded/);
});

test('concurrent probes are shared and a forced refresh rechecks a completed login', async () => {
  let calls = 0, signedIn = false;
  const manager = new CliAuthManager(async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { code: signedIn ? 0 : 1, stdout: signedIn ? 'Logged in using ChatGPT' : 'Not logged in', stderr: '' }; }, () => true);
  await Promise.all([manager.get('codex'), manager.get('codex', true)]);
  assert.equal(calls, 1);
  signedIn = true;
  assert.equal((await manager.get('codex', true)).status, 'authenticated');
  await manager.requireReady('codex');
});
