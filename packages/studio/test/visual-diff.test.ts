import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeDiffLines,
  computeSideBySideRows,
  splitLines,
} from '../client/src/diffUtils.js';

test('splitLines: handles empty, single, CRLF, and trailing newlines', () => {
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines('single line'), ['single line']);
  assert.deepEqual(splitLines('line1\nline2\n'), ['line1', 'line2']);
  assert.deepEqual(splitLines('line1\r\nline2\r\nline3'), ['line1', 'line2', 'line3']);
  assert.deepEqual(splitLines('a\n\nb'), ['a', '', 'b']);
});

test('computeDiffLines: identical content produces only unchanged lines with matching numbers', () => {
  const content = 'first line\nsecond line\nthird line';
  const diff = computeDiffLines(content, content);

  assert.equal(diff.length, 3);
  assert.deepEqual(
    diff.map(d => ({ type: d.type, text: d.text, old: d.oldLineNumber, new: d.newLineNumber })),
    [
      { type: 'unchanged', text: 'first line', old: 1, new: 1 },
      { type: 'unchanged', text: 'second line', old: 2, new: 2 },
      { type: 'unchanged', text: 'third line', old: 3, new: 3 },
    ]
  );
});

test('computeDiffLines: newly created file produces only additions', () => {
  const diff = computeDiffLines('', 'line A\nline B\nline C');

  assert.equal(diff.length, 3);
  assert.deepEqual(
    diff.map(d => ({ type: d.type, text: d.text, old: d.oldLineNumber, new: d.newLineNumber })),
    [
      { type: 'add', text: 'line A', old: undefined, new: 1 },
      { type: 'add', text: 'line B', old: undefined, new: 2 },
      { type: 'add', text: 'line C', old: undefined, new: 3 },
    ]
  );
});

test('computeDiffLines: deleted file produces only deletions', () => {
  const diff = computeDiffLines('old 1\nold 2', '', true);

  assert.equal(diff.length, 2);
  assert.deepEqual(
    diff.map(d => ({ type: d.type, text: d.text, old: d.oldLineNumber, new: d.newLineNumber })),
    [
      { type: 'delete', text: 'old 1', old: 1, new: undefined },
      { type: 'delete', text: 'old 2', old: 2, new: undefined },
    ]
  );
});

test('computeDiffLines: edits with common prefix and suffix preserve continuous line numbers', () => {
  const original = 'header\nline 2\nline 3\nfooter';
  const modified = 'header\nline 2 modified\nline 2.5 added\nfooter';
  const diff = computeDiffLines(original, modified);

  // Expected:
  // unchanged header (1, 1)
  // delete line 2 (2, -)
  // delete line 3 (3, -)
  // add line 2 modified (-, 2)
  // add line 2.5 added (-, 3)
  // unchanged footer (4, 4)
  assert.equal(diff[0].type, 'unchanged');
  assert.equal(diff[0].text, 'header');
  assert.equal(diff[0].oldLineNumber, 1);
  assert.equal(diff[0].newLineNumber, 1);

  const middle = diff.slice(1, diff.length - 1);
  const deletes = middle.filter(m => m.type === 'delete');
  const adds = middle.filter(m => m.type === 'add');

  assert.equal(deletes.length, 2);
  assert.equal(deletes[0].oldLineNumber, 2);
  assert.equal(deletes[1].oldLineNumber, 3);

  assert.equal(adds.length, 2);
  assert.equal(adds[0].newLineNumber, 2);
  assert.equal(adds[1].newLineNumber, 3);

  const last = diff[diff.length - 1];
  assert.equal(last.type, 'unchanged');
  assert.equal(last.text, 'footer');
  assert.equal(last.oldLineNumber, 4);
  assert.equal(last.newLineNumber, 4);
});

test('computeSideBySideRows: pairs changes and inserts spacers', () => {
  const original = 'A\nB\nC';
  const modified = 'A\nX\nY\nC';
  const diff = computeDiffLines(original, modified);
  const rows = computeSideBySideRows(diff);

  assert.equal(rows.length, 4);

  // Row 1: Unchanged A
  assert.deepEqual(rows[0], {
    left: { lineNumber: 1, text: 'A', type: 'unchanged' },
    right: { lineNumber: 1, text: 'A', type: 'unchanged' },
  });

  // Row 2: Delete B vs Add X
  assert.deepEqual(rows[1], {
    left: { lineNumber: 2, text: 'B', type: 'delete' },
    right: { lineNumber: 2, text: 'X', type: 'add' },
  });

  // Row 3: Spacer left vs Add Y
  assert.deepEqual(rows[2], {
    left: { text: '', type: 'empty' },
    right: { lineNumber: 3, text: 'Y', type: 'add' },
  });

  // Row 4: Unchanged C
  assert.deepEqual(rows[3], {
    left: { lineNumber: 3, text: 'C', type: 'unchanged' },
    right: { lineNumber: 4, text: 'C', type: 'unchanged' },
  });
});

test('computeDiffLines: empty inputs return empty diff', () => {
  assert.deepEqual(computeDiffLines('', ''), []);
});
