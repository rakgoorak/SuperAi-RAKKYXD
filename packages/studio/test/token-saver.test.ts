import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager } from '../server/AgentRunManager.js';

test('token saver sends fewer and shorter earlier runs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-token-saver-'));
  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const runs = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, wsId: 'ws', mode: 'chat', status: 'completed', prompt: `question ${i}`, output: `answer ${i} ` + 'x'.repeat(2000), createdAt: i }));
    (manager as any).list = () => runs;
    const full: string = (manager as any).history('ws', 'chat');
    const lean: string = (manager as any).history('ws', 'chat', true);
    assert.equal(full.match(/question \d/g)?.length, 6);
    assert.equal(lean.match(/question \d/g)?.length, 3);
    assert.ok(lean.length < full.length / 2, `lean ${lean.length} vs full ${full.length}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
