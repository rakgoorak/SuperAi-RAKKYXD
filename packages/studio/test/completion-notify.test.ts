import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishedRuns, runNotice } from '../client/src/completionNotify.js';
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
