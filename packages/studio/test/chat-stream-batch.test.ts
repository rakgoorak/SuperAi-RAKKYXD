import test from 'node:test';
import assert from 'node:assert/strict';
import { createItemBatch } from '../client/src/chatStreamBatch.js';

test('bursts schedule one render and keep only the latest version of each item in arrival order', () => {
  const frames: (() => void)[] = [], rendered: { id: string; text: string }[][] = [];
  const batch = createItemBatch<{ id: string; text: string }>(items => rendered.push(items), cb => { frames.push(cb); return frames.length; }, () => {});
  for (let n = 0; n < 1000; n++) batch.push({ id: 'answer', text: String(n) });
  batch.push({ id: 'tool', text: 'done' });
  assert.equal(frames.length, 1);
  assert.equal(rendered.length, 0);
  frames[0]();
  assert.deepEqual(rendered, [[{ id: 'answer', text: '999' }, { id: 'tool', text: 'done' }]]);
});

test('flush delivers before end-of-turn; reset prevents old events leaking into snapshots or another session', () => {
  let scheduled: (() => void) | undefined;
  const rendered: { id: string }[][] = [], cancelled: number[] = [];
  const batch = createItemBatch<{ id: string }>(items => rendered.push(items), cb => { scheduled = cb; return 1; }, id => cancelled.push(id));
  batch.push({ id: 'final' }); batch.flush();
  assert.deepEqual(rendered, [[{ id: 'final' }]]);
  batch.push({ id: 'obsolete' }); batch.reset(); scheduled?.();
  assert.equal(rendered.length, 1);
  assert.equal(cancelled.length, 2);
});
