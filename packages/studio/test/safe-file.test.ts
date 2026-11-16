import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeFileSafely, readJsonSafely } from '../server/SafeFile.js';

test('a session list cut off by a power cut falls back to the previous copy and is not saved over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-safe-file-'));
  const file = path.join(dir, 'superai-sessions.json');
  try {
    assert.deepEqual(readJsonSafely(file), { missing: true, recovered: false }, 'first start: nothing saved yet');

    writeFileSafely(file, JSON.stringify({ sessions: ['a'] }), { backup: true });
    writeFileSafely(file, JSON.stringify({ sessions: ['a', 'b'] }), { backup: true });
    assert.deepEqual(readJsonSafely(file).value, { sessions: ['a', 'b'] });
    assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')), { sessions: ['a'] }, 'the previous version is kept');
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [], 'no temporary file is left behind');

    // What a power cut mid-write leaves on Windows: an empty or zero-filled file.
    fs.writeFileSync(file, Buffer.alloc(40));
    const read = readJsonSafely(file);
    assert.equal(read.recovered, true);
    assert.deepEqual(read.value, { sessions: ['a'] }, 'the previous copy comes back');
    assert.equal(fs.readdirSync(dir).filter((f) => f.includes('.broken-')).length, 1, 'the damaged file is kept aside for a look');

    fs.writeFileSync(file + '.bak', '{"sessions": [');
    fs.writeFileSync(file, '');
    assert.deepEqual(readJsonSafely(file), { missing: false, recovered: false }, 'both damaged: reported, not mistaken for a first start');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
