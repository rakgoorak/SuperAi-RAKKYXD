import test from 'node:test';
import assert from 'node:assert/strict';
import { listClis } from '../server/CliCatalog.js';
test('AI CLI catalog includes official install packages and Terminal has no fake install', () => {
  const catalog = listClis() as any[];
  assert.equal(catalog.find(c=>c.id==='codex').installPackage,'@openai/codex');
  assert.equal(catalog.find(c=>c.id==='freebuff').installPackage,'freebuff');
  assert.equal(catalog.find(c=>c.id==='terminal').installPackage,undefined);
});

test('a Claude Code npm install without its native claude.exe counts as not installed', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { incompleteInstall, cliEnv } = await import('../server/CliCatalog.js');
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-prefix-'));
  const shim = path.join(prefix, 'claude.cmd');
  const bin = path.join(prefix, 'node_modules', '@anthropic-ai', 'claude-code', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(shim, '');
  fs.writeFileSync(path.join(bin, '..', 'package.json'), '{}');
  fs.writeFileSync(path.join(bin, 'claude.exe.old.1'), 'old');
  assert.equal(incompleteInstall('claude-code', shim), true, 'renamed away by a half-finished update');
  fs.writeFileSync(path.join(bin, 'claude.exe'), 'placeholder');
  assert.equal(incompleteInstall('claude-code', shim), true, 'postinstall blocked: placeholder stub');
  fs.writeFileSync(path.join(bin, 'claude.exe'), Buffer.alloc(2_000_000));
  assert.equal(incompleteInstall('claude-code', shim), false);
  assert.equal(incompleteInstall('codex', shim), false);
  assert.equal(incompleteInstall('claude-code', path.join(os.tmpdir(), 'elsewhere', 'claude.exe')), false, 'native installs are not judged');
  fs.rmSync(prefix, { recursive: true, force: true });
  assert.match(cliEnv().npm_config_allow_scripts, /@anthropic-ai\/claude-code/, 'npm may run Claude Code\'s postinstall');
});
