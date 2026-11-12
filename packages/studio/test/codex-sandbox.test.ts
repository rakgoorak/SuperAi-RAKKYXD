import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codexSandboxArgs } from '../server/CodexSandbox.js';

test('Windows Codex gets a sandbox when its home never chose one, so auto can edit files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
  const env = { CODEX_HOME: home };
  assert.deepEqual(codexSandboxArgs(env, 'win32'), ['-c', 'windows.sandbox="unelevated"'], 'no config at all');
  fs.writeFileSync(path.join(home, 'config.toml'), 'model = "x"\n[projects.\'d:\test\']\ntrust_level = "trusted"\n');
  assert.deepEqual(codexSandboxArgs(env, 'win32'), ['-c', 'windows.sandbox="unelevated"'], 'config without a Windows sandbox');
  fs.writeFileSync(path.join(home, 'config.toml'), 'model = "x"\n[windows]\nsandbox = "elevated"\n\n[tui]\nx = 1\n');
  assert.deepEqual(codexSandboxArgs(env, 'win32'), [], 'the home\'s own choice is kept');
  fs.writeFileSync(path.join(home, 'config.toml'), '[windows]\nother = 1\n[tui]\nsandbox = "x"\n');
  assert.equal(codexSandboxArgs(env, 'win32').length, 2, 'a sandbox key in another section does not count');
  assert.deepEqual(codexSandboxArgs(env, 'darwin'), [], 'other systems are untouched');
  fs.rmSync(home, { recursive: true, force: true });
});
