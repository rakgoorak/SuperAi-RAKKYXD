import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRules, formatRulesForPrompt } from '../server/ProjectRules.js';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'superai-rules-'));

test('getProjectRules returns empty when no rule files exist', () => {
  const dir = temp();
  try {
    const res = getProjectRules(dir);
    assert.equal(res.rules, '');
    assert.equal(res.files.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getProjectRules detects .cursorrules and CLAUDE.md', () => {
  const dir = temp();
  try {
    fs.writeFileSync(path.join(dir, '.cursorrules'), 'Always respond in Thai\nUse TypeScript');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Project Guidelines\nNo extra fluff');

    const res = getProjectRules(dir);
    assert.ok(res.rules.includes('Always respond in Thai'));
    assert.ok(res.rules.includes('# Project Guidelines'));
    assert.equal(res.files.length, 2);
    assert.ok(res.files.includes('.cursorrules'));
    assert.ok(res.files.includes('CLAUDE.md'));

    const formatted = formatRulesForPrompt(res.rules);
    assert.ok(formatted.includes('[Project Instructions & Rules]'));
    assert.ok(formatted.includes('Always respond in Thai'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getProjectRules detects .superairules with priority', () => {
  const dir = temp();
  try {
    fs.writeFileSync(path.join(dir, '.superairules'), 'Custom SuperAi Rule 1');
    const res = getProjectRules(dir);
    assert.ok(res.rules.includes('Custom SuperAi Rule 1'));
    assert.ok(res.files.includes('.superairules'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
