import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager } from '../server/AgentRunManager.js';
import type { PanelAnswer, Seat } from '../server/AgentRunManager.js';
import {
  formatLatency,
  formatTtft,
  estimateTokenCount,
  formatTokens,
} from '../client/src/comparisonMetrics.js';

const seat = (provider: string, name = provider): Seat => ({
  name,
  provider,
  model: '',
  effort: '',
});

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const settle = async (run: { status: string }) => {
  for (let i = 0; i < 200 && run.status === 'running'; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
};

const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `superai-${name}-`));

test('formatLatency: computes latency in seconds and provides fallback', () => {
  const completedAnswer: PanelAnswer = {
    seat: seat('claude-code', 'Main 1'),
    status: 'completed',
    output: 'Hello world',
    startedAt: 10000,
    completedAt: 12400,
  };
  assert.equal(formatLatency(completedAnswer as any), '2.4s');

  const runningAnswer: PanelAnswer = {
    seat: seat('claude-code', 'Main 1'),
    status: 'running',
    output: '',
    startedAt: Date.now() - 1500,
  };
  const runningLatency = formatLatency(runningAnswer as any);
  assert.match(runningLatency, /^\d+\.\d+s$/);

  const missingAnswer: PanelAnswer = {
    seat: seat('claude-code', 'Main 1'),
    status: 'pending',
    output: '',
  };
  assert.equal(formatLatency(missingAnswer as any), '—');
});

test('formatTtft: computes time to first token and provides fallback', () => {
  const answered: PanelAnswer = {
    seat: seat('claude-code', 'Main 1'),
    status: 'completed',
    output: 'Test reply',
    startedAt: 20000,
    firstChunkAt: 20800,
    completedAt: 23000,
  };
  assert.equal(formatTtft(answered as any), '0.8s');

  const noChunk: PanelAnswer = {
    seat: seat('claude-code', 'Main 1'),
    status: 'running',
    output: '',
    startedAt: 20000,
  };
  assert.equal(formatTtft(noChunk as any), '—');
});

test('estimateTokenCount & formatTokens: estimates from output length or uses tokenCount', () => {
  const withCount: PanelAnswer = {
    seat: seat('codex', 'Main 2'),
    status: 'completed',
    output: 'One two three four five',
    tokenCount: 142,
  };
  assert.equal(estimateTokenCount(withCount as any), 142);
  assert.equal(formatTokens(withCount as any), '142 tokens');

  const textOnly: PanelAnswer = {
    seat: seat('antigravity', 'Main 3'),
    status: 'completed',
    output: 'A'.repeat(400),
  };
  assert.equal(estimateTokenCount(textOnly as any), 100);
  assert.equal(formatTokens(textOnly as any), '100 tokens');

  const emptyAnswer: PanelAnswer = {
    seat: seat('ollama', 'Main 4'),
    status: 'pending',
    output: '',
  };
  assert.equal(estimateTokenCount(emptyAnswer as any), 0);
  assert.equal(formatTokens(emptyAnswer as any), '—');
});

test('startChat tracks performance metrics (startedAt, firstChunkAt, completedAt, tokenCount)', async (t) => {
  const dir = tmp('arena-metrics');
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    await new Promise((r) => setTimeout(r, 20));
    return reply(`คำตอบความเห็นของ ${body.model}`);
  });

  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const before = Date.now();
    const run = manager.startChat('p', dir, {
      prompt: 'เปรียบเทียบ TypeScript กับ Rust',
      panel: [seat('model-a', 'Model A'), seat('model-b', 'Model B')],
    });

    assert.ok(run.panel![0].startedAt, 'startedAt should be initialized');
    assert.ok(run.panel![0].startedAt! >= before);

    await settle(run);

    assert.equal(run.status, 'completed');
    for (const answer of run.panel!) {
      assert.equal(answer.status, 'completed');
      assert.ok(answer.startedAt, 'startedAt should exist');
      assert.ok(answer.completedAt, 'completedAt should exist');
      assert.ok(answer.completedAt! >= answer.startedAt!, 'completedAt >= startedAt');
      assert.ok(answer.tokenCount! > 0, 'tokenCount should be greater than 0');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('failed model answer records completedAt and error properly', async (t) => {
  const dir = tmp('arena-fail');
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    if (body.model === 'broken') throw new Error('API connection timeout');
    return reply('OK answer');
  });

  try {
    const manager = new AgentRunManager(path.join(dir, 'h.json'));
    const run = manager.startChat('p', dir, {
      prompt: 'ทดสอบ',
      panel: [seat('ok', 'Good Model'), seat('broken', 'Failing Model')],
    });

    await settle(run);

    assert.equal(run.status, 'completed');
    const failed = run.panel!.find((a) => a.seat.provider === 'broken')!;
    assert.equal(failed.status, 'failed');
    assert.match(failed.error!, /API connection timeout/);
    assert.ok(failed.completedAt, 'completedAt should be recorded even on failure');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('serialization: saved panel metrics survive reloading from JSON', async (t) => {
  const dir = tmp('arena-persist');
  const storeFile = path.join(dir, 'history.json');
  t.mock.method(globalThis, 'fetch', async () => reply('คำตอบประเมิน'));

  try {
    const manager = new AgentRunManager(storeFile);
    const run = manager.startChat('p', dir, {
      prompt: 'เซฟข้อมูล',
      panel: [seat('alpha', 'Alpha Seat')],
    });
    await settle(run);

    // Read back through fresh manager instance
    const manager2 = new AgentRunManager(storeFile);
    const restored = manager2.list('p')[0];
    assert.ok(restored);
    const ans = restored.panel![0];
    assert.ok(ans.startedAt);
    assert.ok(ans.completedAt);
    assert.ok(ans.tokenCount);
    assert.equal(ans.status, 'completed');

    // Backward compatibility: load legacy object without metric fields
    const legacyData = [
      {
        id: 'legacy-1',
        wsId: 'p',
        prompt: 'ข้อความเดิม',
        mode: 'chat',
        status: 'completed',
        output: '',
        createdAt: 1000,
        panel: [
          {
            seat: seat('legacy-seat'),
            status: 'completed',
            output: 'คำตอบเดิม',
          },
        ],
      },
    ];
    fs.writeFileSync(storeFile, JSON.stringify(legacyData));
    const manager3 = new AgentRunManager(storeFile);
    const legacyRun = manager3.list('p')[0];
    assert.equal(legacyRun.id, 'legacy-1');
    assert.equal(legacyRun.panel![0].startedAt, undefined);
    assert.equal(legacyRun.panel![0].tokenCount, undefined);
    assert.equal(formatLatency(legacyRun.panel![0] as any), '—');
    assert.equal(formatTokens(legacyRun.panel![0] as any), `${Math.ceil('คำตอบเดิม'.length / 4)} tokens`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
