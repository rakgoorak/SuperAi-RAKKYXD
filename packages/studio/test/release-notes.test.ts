import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notesInLanguage } from '../client/src/releaseNotes.js';

const notes = '- **Faster chat:** answers appear sooner\n\n## ภาษาไทย\n\n- **แชทเร็วขึ้น:** คำตอบขึ้นเร็วขึ้น';

test('the update card shows release notes in the app language', () => {
  assert.equal(notesInLanguage(notes, 'en'), '- **Faster chat:** answers appear sooner');
  assert.equal(notesInLanguage(notes, 'ja'), '- **Faster chat:** answers appear sooner');
  assert.equal(notesInLanguage(notes, 'th'), '- **แชทเร็วขึ้น:** คำตอบขึ้นเร็วขึ้น');
  assert.equal(notesInLanguage('- เดิมมีแต่ภาษาไทย', 'en'), '- เดิมมีแต่ภาษาไทย', 'older notes without the heading are shown whole');
});

test('the newest release notes have an English part and a Thai part', () => {
  const newest = fs.readFileSync(new URL('../../../docs/RELEASE.md', import.meta.url), 'utf8').split(/^---\s*$/m)[0];
  const english = notesInLanguage(newest, 'en'), thai = notesInLanguage(newest, 'th');
  assert.notEqual(english, thai, 'docs/RELEASE.md: add "## ภาษาไทย" between the English and Thai notes');
  assert.doesNotMatch(english.replace(/^#.*$/gm, ''), /[฀-๿]/, 'the English part has no Thai text');
  assert.match(thai, /[฀-๿]/);
});
