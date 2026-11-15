import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chatSkills, cliCommand, skillPrompt } from '../server/ChatSkills.js';

test('skill discovery follows the provider and includes project, linked and global skills', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-skills-'));
  const root = path.join(home, 'project');
  const write = (where: string, name: string, extra = '') => {
    const dir = path.join(where, name); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: skill ${name}\n${extra}---\nInstructions`);
    return dir;
  };
  try {
    write(path.join(root, '.agents/skills'), 'common');
    write(path.join(root, '.claude/skills'), 'claude-only');
    write(path.join(home, '.gemini/antigravity-cli/skills'), 'google-only');
    write(path.join(home, '.claude/skills'), 'personal');
    write(path.join(root, '.claude/skills'), 'hidden', 'user-invocable: false\n');
    const shared = write(path.join(home, 'linked'), 'linked');
    // A junction on Windows: a real symlink needs admin rights or Developer Mode there.
    fs.symlinkSync(shared, path.join(root, '.agents/skills/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.ok(chatSkills(root, 'antigravity', home).some((s) => s.name === 'google-only'));
    assert.ok(!chatSkills(root, 'antigravity', home).some((s) => s.name === 'claude-only'));
    const claude = chatSkills(root, 'claude-code', home);
    for (const name of ['common', 'claude-only', 'personal', 'linked']) assert.ok(claude.some((s) => s.name === name), name);
    assert.ok(!claude.some((s) => s.name === 'hidden'));
    assert.deepEqual(chatSkills(root, 'freebuff', home), []);
    const selected = claude.find((s) => s.name === 'linked')!;
    assert.match(skillPrompt('/skill linked ทดสอบ', root, 'claude-code', selected.id, home), /ทดสอบ/);
    assert.ok(skillPrompt('/linked ทดสอบ', root, 'claude-code', undefined, home).includes(selected.path));
    assert.throws(() => skillPrompt('/skill ../../secret', root, 'claude-code', undefined, home), /เลือก skill/);
    assert.throws(() => skillPrompt('test', root, 'claude-code', 'nonexistent', home), /ไม่พบ skill/);
    assert.equal(skillPrompt('สวัสดี', root, 'claude-code', undefined, home), 'สวัสดี');
    assert.equal(skillPrompt('/compact', root, 'claude-code', undefined, home), '/compact');
    assert.equal(skillPrompt('/cost', root, 'claude-code', undefined, home), '/cost');
    assert.equal(skillPrompt('/doctor', root, 'claude-code', undefined, home), '/doctor');
    assert.equal(skillPrompt('/compact 50%', root, 'claude-code', undefined, home), '/compact 50%');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('/goal and /boost reach only the CLIs that run them from chat', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-commands-')), root = path.join(home, 'project');
  try {
    assert.equal(skillPrompt('/goal all tests pass', root, 'claude-code', undefined, home), '/goal all tests pass');
    assert.equal(skillPrompt('/goal clear', root, 'antigravity', undefined, home), '/goal clear');
    assert.equal(skillPrompt('/boost refactor the parser', root, 'antigravity', undefined, home), '/boost refactor the parser');
    assert.throws(() => skillPrompt('/goal all tests pass', root, 'codex', undefined, home), /Terminal/);
    assert.throws(() => skillPrompt('/boost x', root, 'claude-code', undefined, home), /ไม่มีคำสั่ง \/boost.*Antigravity/);
    assert.throws(() => skillPrompt('/goal x', root, 'opencode', undefined, home), /ไม่มีคำสั่ง \/goal/);
    assert.equal(cliCommand('/goal x', 'claude-code'), 'goal');
    assert.equal(cliCommand('/boost x', 'claude-code'), undefined);
    assert.equal(cliCommand('/compact', 'codex'), 'compact');
    assert.equal(cliCommand('please /goal x', 'claude-code'), undefined);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('a selected ID distinguishes duplicate names and removed skills cannot be invoked', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicate-skills-')), root = path.join(home, 'project');
  try {
    for (const dir of [path.join(root, '.claude/skills/review'), path.join(home, '.claude/skills/review')]) {
      fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: review\n---\nReview');
    }
    const list = chatSkills(root, 'claude-code', home).filter((s) => s.name === 'review');
    assert.equal(list.length, 2); assert.notEqual(list[0].id, list[1].id);
    assert.ok(skillPrompt('/skill review check', root, 'claude-code', undefined, home).includes(list[0].path));
    assert.ok(skillPrompt('/skill review check', root, 'claude-code', list[1].id, home).includes(list[1].path));
    fs.unlinkSync(list[1].path);
    assert.throws(() => skillPrompt('/skill review check', root, 'claude-code', list[1].id, home), /ไม่พบ skill/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
