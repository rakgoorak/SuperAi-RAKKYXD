import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listModels } from '../server/Providers.js';

test('Codex catalog reads new provider models and their efforts without restarting', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-models-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = directory;
  try {
    const file = path.join(directory, 'models_cache.json');
    await fs.writeFile(file, JSON.stringify({ models: [{ slug: 'gpt-6.1-sol', visibility: 'list' }] }));
    assert.deepEqual((await listModels('codex')).models, ['gpt-6.1-sol']);
    await fs.writeFile(file, JSON.stringify({ models: [
      { slug: 'gpt-6.1-sol', visibility: 'list' },
      { slug: 'gpt-6.1-terra', visibility: 'list', supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }] },
      { slug: 'internal-model', visibility: 'hide' },
      { slug: 'gpt-6.1-terra', visibility: 'list' },
      { slug: '' },
    ] }));
    const updated = await listModels('codex');
    assert.deepEqual(updated.models, ['gpt-6.1-sol', 'gpt-6.1-terra']);
    assert.deepEqual(updated.modelEfforts?.['gpt-6.1-terra'], ['medium', 'high']);
    await fs.writeFile(file, 'invalid json');
    assert.deepEqual((await listModels('codex')).models, []);
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('Claude models are listed once each, with the names Claude Desktop uses', async () => {
  const list = await listModels('claude-code');
  assert.deepEqual(list.models, ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2']);
  assert.deepEqual(list.models.map((m) => list.modelLabels?.[m]), ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5', 'Fable 5.2']);
  // Values saved by older versions still get a readable name.
  assert.equal(list.modelLabels?.opus, 'Opus (latest)');
});
