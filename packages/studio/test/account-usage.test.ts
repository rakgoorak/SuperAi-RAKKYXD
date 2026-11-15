import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountRegistry } from '../server/Accounts.js';
import { UsageManager } from '../server/UsageManager.js';

test('quota probes and concurrent caches use the selected account', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'account-usage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = new AccountRegistry(root);
  const a = registry.create('codex', 'A'), b = registry.create('codex', 'B');
  const seen: string[] = [];
  const manager = new UsageManager({ codex: async env => {
    seen.push(env!.CODEX_HOME!);
    return { status: 'ok', windows: [], source: 'test' };
  } }, () => true, registry);
  await Promise.all([manager.get('codex', false, a.id), manager.get('codex', false, b.id), manager.get('codex', false, a.id)]);
  assert.equal(seen.length, 2);
  assert.equal(new Set(seen).size, 2);
  await assert.rejects(manager.get('codex', false, 'missing'));
});
