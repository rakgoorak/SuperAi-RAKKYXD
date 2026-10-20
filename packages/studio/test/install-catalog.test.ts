import test from 'node:test';
import assert from 'node:assert/strict';
import { listClis } from '../server/CliCatalog.js';
test('AI CLI catalog includes official install packages and Terminal has no fake install', () => {
  const catalog = listClis() as any[];
  assert.equal(catalog.find(c=>c.id==='codex').installPackage,'@openai/codex');
  assert.equal(catalog.find(c=>c.id==='freebuff').installPackage,'freebuff');
  assert.equal(catalog.find(c=>c.id==='terminal').installPackage,undefined);
});
