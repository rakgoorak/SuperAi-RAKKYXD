import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CustomProviders } from '../server/CustomProviders.js';

test('custom provider metadata persists without accepting credentials or unsafe destinations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-providers-'));
  try {
    const file = path.join(dir, 'providers.json');
    const registry = new CustomProviders(file);
    const config = registry.add({ name: 'My endpoint', baseURL: 'https://example.test/v1/', models: ['model-a', 'model-b'], key: 'never-write-this' });
    assert.equal(config.baseURL, 'https://example.test/v1');
    assert.ok(!fs.readFileSync(file, 'utf8').includes('never-write-this'));
    assert.deepEqual(new CustomProviders(file).get(config.id), config);
    for (const baseURL of ['http://remote.test/v1', 'https://user:pass@example.test', 'https://example.test/v1?key=secret', 'file:///tmp/api']) {
      assert.throws(() => registry.add({ name: 'invalid', baseURL, models: ['x'] }));
    }
    registry.remove(config.id);
    assert.equal(new CustomProviders(file).all().length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
