import test from 'node:test';
import assert from 'node:assert/strict';
import { taskProgressNote } from '../client/src/taskProgress.js';

test('task status separates later activity from verified completion, excluding earlier and other turns', () => {
  const items = [
    { kind: 'tool', at: 1 }, { kind: 'todos', at: 2 },
    { kind: 'tool', at: 3 }, { kind: 'tool', at: 4 },
    { kind: 'user', at: 5 }, { kind: 'tool', at: 6 },
  ];
  assert.match(taskProgressNote(items, 1), /2 ครั้ง/);
  assert.match(taskProgressNote(items, 1), /ยังไม่ยืนยัน/);
  assert.equal(taskProgressNote(items, 1, 4), 'สถานะล่าสุดที่ AI รายงาน');
  assert.equal(taskProgressNote(items, 1, 4, true), 'AI รายงานว่ารายการงานเสร็จแล้ว');
});
