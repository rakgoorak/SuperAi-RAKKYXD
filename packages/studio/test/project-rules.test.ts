import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectRules, formatRulesForPrompt, nativeRuleFiles } from '../server/ProjectRules.js';
import { buildProjectContext, contextForAgent } from '../server/ProjectContext.js';

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

test('nativeRuleFiles identifies native rules for each CLI and handles cli: prefix', () => {
  assert.deepEqual(nativeRuleFiles('claude-code'), ['CLAUDE.md']);
  assert.deepEqual(nativeRuleFiles('cli:claude-code'), ['CLAUDE.md']);
  assert.deepEqual(nativeRuleFiles('claude'), ['CLAUDE.md']);
  assert.deepEqual(nativeRuleFiles('codex'), ['AGENTS.md']);
  assert.deepEqual(nativeRuleFiles('cli:codex'), ['AGENTS.md']);
  assert.deepEqual(nativeRuleFiles('opencode'), ['AGENTS.md']);
  assert.deepEqual(nativeRuleFiles('cli:opencode'), ['AGENTS.md']);
  assert.deepEqual(nativeRuleFiles('antigravity'), []);
  assert.deepEqual(nativeRuleFiles('deepseek'), []);
});

test('contextForAgent filters out native rules per agent and marks them as native', () => {
  const dir = temp();
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Claude Rules');
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents Rules');
    fs.writeFileSync(path.join(dir, '.cursorrules'), '# Cursor Rules');

    const ctx = buildProjectContext({ rootPath: dir }, dir);
    assert.ok(ctx.text.includes('# Claude Rules'));
    assert.ok(ctx.text.includes('# Agents Rules'));
    assert.ok(ctx.text.includes('# Cursor Rules'));

    // Claude Code excludes CLAUDE.md but keeps AGENTS.md and .cursorrules
    const claudeCtx = contextForAgent(ctx, 'cli:claude-code')!;
    assert.ok(!claudeCtx.text.includes('# Claude Rules'));
    assert.ok(claudeCtx.text.includes('# Agents Rules'));
    assert.ok(claudeCtx.text.includes('# Cursor Rules'));
    assert.equal(claudeCtx.files.find(f => f.path === 'CLAUDE.md')?.status, 'native');
    assert.equal(claudeCtx.files.find(f => f.path === 'AGENTS.md')?.status, 'included');

    // Codex excludes AGENTS.md but keeps CLAUDE.md and .cursorrules
    const codexCtx = contextForAgent(ctx, 'cli:codex')!;
    assert.ok(codexCtx.text.includes('# Claude Rules'));
    assert.ok(!codexCtx.text.includes('# Agents Rules'));
    assert.ok(codexCtx.text.includes('# Cursor Rules'));
    assert.equal(codexCtx.files.find(f => f.path === 'AGENTS.md')?.status, 'native');
    assert.equal(codexCtx.files.find(f => f.path === 'CLAUDE.md')?.status, 'included');

    // Cloud provider (e.g. DeepSeek) keeps all rules
    const cloudCtx = contextForAgent(ctx, 'deepseek')!;
    assert.ok(cloudCtx.text.includes('# Claude Rules'));
    assert.ok(cloudCtx.text.includes('# Agents Rules'));
    assert.ok(cloudCtx.text.includes('# Cursor Rules'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
