import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkpointChanges, createCheckpoint, restoreCheckpoint } from '../server/Checkpoints.js';

test('rewind brings back changed and deleted files, removes new ones, and can be undone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-cp-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'original\n'); fs.writeFileSync(path.join(dir, 'b.txt'), 'keep me\n');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'ignored.log\n');
    git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'user edit before the turn\n');
    fs.writeFileSync(path.join(dir, 'staged.txt'), 'staged\n'); git('add', 'staged.txt');
    const indexBefore = git('diff', '--cached', '--name-only');

    const checkpoint = createCheckpoint(dir)!;
    assert.ok(checkpoint?.commit, 'a checkpoint is made');
    assert.equal(git('diff', '--cached', '--name-only'), indexBefore, "the user's index is untouched");
    assert.equal(git('branch', '--list').trim(), git('branch', '--list').trim());

    // The "AI" works: edits, deletes, creates; an ignored file appears too.
    fs.writeFileSync(path.join(dir, 'a.txt'), 'AI edit\n'); fs.rmSync(path.join(dir, 'b.txt'));
    fs.writeFileSync(path.join(dir, 'new.txt'), 'AI file\n'); fs.writeFileSync(path.join(dir, 'ignored.log'), 'log\n');
    const plan = checkpointChanges(checkpoint).sort((x, y) => x.path.localeCompare(y.path));
    assert.deepEqual(plan, [{ path: 'a.txt', status: 'changed' }, { path: 'b.txt', status: 'deleted' }, { path: 'new.txt', status: 'created' }]);

    const { undo } = restoreCheckpoint(checkpoint);
    assert.equal(read('a.txt'), 'user edit before the turn\n', 'the file is as it was before the turn, not as committed');
    assert.equal(read('b.txt'), 'keep me\n');
    assert.ok(!fs.existsSync(path.join(dir, 'new.txt')));
    assert.ok(fs.existsSync(path.join(dir, 'ignored.log')), 'ignored files are left alone');
    assert.equal(checkpointChanges(checkpoint).length, 0);

    restoreCheckpoint(undo!);
    assert.equal(read('a.txt'), 'AI edit\n', 'the rewind can be undone');
    assert.ok(fs.existsSync(path.join(dir, 'new.txt')) && !fs.existsSync(path.join(dir, 'b.txt')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('no checkpoint outside a git repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-cp-none-'));
  try { assert.equal(createCheckpoint(dir), undefined); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
