import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { diffHunks, revertHunk } from '../server/ProjectChanges.js';

test('undo one section of a file and keep the other; a stale section is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-hunk-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    fs.writeFileSync(path.join(dir, 'a.txt'), lines.join('\n') + '\n');
    git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
    const edited = [...lines]; edited[2] = 'FIRST CHANGE'; edited[35] = 'SECOND CHANGE';
    fs.writeFileSync(path.join(dir, 'a.txt'), edited.join('\n') + '\n');
    const { hunks } = diffHunks(git('diff', 'HEAD', '--', 'a.txt'));
    assert.equal(hunks.length, 2);
    await assert.rejects(revertHunk(dir, 'a.txt', 0, hunks[1]), /เปลี่ยนไปแล้ว/, 'text that does not match is refused');
    assert.equal(await revertHunk(dir, 'a.txt', 0, hunks[0]), true);
    const now = fs.readFileSync(path.join(dir, 'a.txt'), 'utf8');
    assert.ok(now.includes('line 3') && !now.includes('FIRST CHANGE'), 'the first change is undone');
    assert.ok(now.includes('SECOND CHANGE'), 'the second change stays');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
