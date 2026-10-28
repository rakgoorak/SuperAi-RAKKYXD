import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishedRuns, runNotice, notifyDone } from '../client/src/completionNotify.js';
import type { Run } from '../client/src/api.js';

type Status = Run['status'];
const run = (id: string, status: Status) => ({ id, status });

test('first sight of a finished run does not notify', () => {
  const seen = new Map<string, Status>();
  assert.deepEqual(finishedRuns(seen, [run('a', 'completed'), run('b', 'failed')]), []);
});

test('running → completed/failed notifies once; cancelled never', () => {
  const seen = new Map<string, Status>();
  finishedRuns(seen, [run('a', 'running'), run('b', 'running'), run('c', 'running')]);
  const done = finishedRuns(seen, [run('a', 'completed'), run('b', 'failed'), run('c', 'cancelled')]);
  assert.deepEqual(done.map(r => r.id), ['a', 'b']);
  assert.deepEqual(finishedRuns(seen, [run('a', 'completed'), run('b', 'failed')]), []);
});

test('a run missing from one poll (workspace switch) keeps its last status', () => {
  const seen = new Map<string, Status>();
  finishedRuns(seen, [run('a', 'running')]);
  finishedRuns(seen, []);
  assert.deepEqual(finishedRuns(seen, [run('a', 'completed')]).map(r => r.id), ['a']);
});

test('runNotice describes the run and where to open it', () => {
  const notice = runNotice({ id: 'r1', wsId: 'w1', mode: 'agent', status: 'failed', prompt: '  fix\n the   build ' }, 'Shop');
  assert.equal(notice.title, 'Agent ทำงานไม่สำเร็จ · Shop');
  assert.equal(notice.body, 'fix the build');
  assert.equal(notice.failed, true);
  assert.deepEqual(notice.target, { kind: 'run', id: 'r1', wsId: 'w1', mode: 'agent' });
});

test('a permission in another tab notifies while the app is focused, unless notifications are disabled', async () => {
  const old = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const calls: unknown[] = [];
  let enabled = true;
  try {
    Object.assign(globalThis, {
      document: { hidden: false, hasFocus: () => true },
      localStorage: { getItem: () => JSON.stringify({ enabled, sound: false }) },
      window: { superai: { notify: async (notice: unknown) => { calls.push(notice); } } },
    });
    const notice = { tag: 'permission:1', title: 'ขออนุญาต', body: 'test', failed: false, target: { kind: 'session' as const, id: 's1' } };
    notifyDone(notice);
    assert.equal(calls.length, 0, 'the active conversation uses its in-app popup');
    notifyDone(notice, { inactiveSession: true });
    assert.deepEqual(calls, [notice]);
    enabled = false;
    notifyDone(notice, { inactiveSession: true });
    assert.equal(calls.length, 1, 'the user notification setting is respected');
  } finally { Object.assign(globalThis, old); }
});
