import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillManager } from '../server/SkillManager.js';

function fakeGitHub(extraFiles: string[] = []) {
  const calls: string[] = [];
  const http = (async (url: any) => {
    const u = String(url); calls.push(u);
    if (u.includes('api.github.com/repos/anthropics')) return new Response(JSON.stringify({ tree: [
      { type: 'blob', path: 'skills/webapp-testing/SKILL.md' },
      { type: 'blob', path: 'skills/webapp-testing/scripts/run.py' },
      ...extraFiles.map(p => ({ type: 'blob', path: p })),
      { type: 'blob', path: 'README.md' },
    ] }));
    if (u.includes('api.github.com')) return new Response('{}', { status: 404 });
    if (u.endsWith('SKILL.md')) return new Response('---\nname: webapp-testing\ndescription: Test web apps with Playwright\n---\n# body');
    return new Response('print("ok")');
  }) as typeof fetch;
  return { http, calls };
}

test('catalog lists official skills and install writes them for Claude and Codex with a marker', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-skills-'));
  try {
    const { http, calls } = fakeGitHub();
    const manager = new SkillManager(http);
    const catalog = await manager.catalog();
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].description, 'Test web apps with Playwright');
    assert.deepEqual(catalog[0].files.sort(), ['SKILL.md', 'scripts/run.py']);
    await manager.install(root, 'anthropic', 'webapp-testing');
    for (const target of ['.claude/skills', '.agents/skills']) {
      assert.ok(fs.existsSync(path.join(root, target, 'webapp-testing', 'scripts', 'run.py')));
      assert.ok(fs.existsSync(path.join(root, target, 'webapp-testing', '.superai-skill.json')));
    }
    assert.ok(calls.every(u => u.startsWith('https://api.github.com/') || u.startsWith('https://raw.githubusercontent.com/')));
    await assert.rejects(manager.install(root, 'anthropic', 'webapp-testing'), /แล้ว/);
    assert.equal(manager.installed(root)[0].managed, true);
    manager.uninstall(root, 'webapp-testing');
    assert.equal(manager.installed(root).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('uninstall never removes skills the user added by hand', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-own-skill-'));
  try {
    fs.mkdirSync(path.join(root, '.claude/skills/mine'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude/skills/mine/SKILL.md'), '---\nname: mine\n---');
    const manager = new SkillManager((async () => new Response('{}')) as any);
    assert.throws(() => manager.uninstall(root, 'mine'), /SuperAi/);
    assert.ok(fs.existsSync(path.join(root, '.claude/skills/mine/SKILL.md')));
    assert.throws(() => manager.uninstall(root, '../x'), /ชื่อ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('install refuses skill files with path traversal', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-bad-skill-'));
  try {
    const manager = new SkillManager(fakeGitHub(['skills/webapp-testing/../../evil.txt']).http);
    await assert.rejects(manager.install(root, 'anthropic', 'webapp-testing'), /ไม่ปลอดภัย/);
    assert.ok(!fs.existsSync(path.join(root, 'evil.txt')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('multi-line YAML descriptions are read in full', async () => {
  const http = (async (url: any) => String(url).includes('api.github.com/repos/anthropics') ? new Response(JSON.stringify({ tree: [{ type: 'blob', path: 'skills/demo/SKILL.md' }] })) : String(url).includes('api.github.com') ? new Response('{}', { status: 404 }) : new Response('---\nname: demo\ndescription: >\n  First line\n  second line\nlicense: MIT\n---\nbody')) as typeof fetch;
  const [skill] = await new SkillManager(http).catalog();
  assert.equal(skill.description, 'First line second line');
});

test('search finds skills from skills.sh and reads descriptions', async () => {
  const http = (async (url: any) => {
    const u = String(url);
    if (u.includes('skills.sh/api/search')) {
      return new Response(JSON.stringify({
        skills: [
          { id: 'vercel-labs/agent-browser/agent-browser', source: 'vercel-labs/agent-browser', skillId: 'agent-browser', name: 'agent-browser', installs: 1000 },
        ],
      }));
    }
    if (u.includes('SKILL.md')) {
      return new Response('---\nname: agent-browser\ndescription: Browser automation CLI\n---\nbody');
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const manager = new SkillManager(http);
  const results = await manager.search('browser');
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'agent-browser');
  assert.equal(results[0].repo, 'vercel-labs/agent-browser');
  assert.equal(results[0].installs, 1000);
  assert.equal(results[0].description, 'Browser automation CLI');
});

test('skills search distinguishes an unavailable registry from an empty result', async () => {
  const unavailable = new SkillManager((async () => new Response('{}', { status: 503 })) as typeof fetch);
  await assert.rejects(unavailable.search('browser'), /ค้นหา.*ไม่สำเร็จ/);
  const empty = new SkillManager((async () => new Response(JSON.stringify({ skills: [] }))) as typeof fetch);
  assert.deepEqual(await empty.search('no-matching-skills'), []);
});

test('install works for skills from skills.sh with custom repo options', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-sh-skill-'));
  try {
    const http = (async (url: any) => {
      const u = String(url);
      if (u.includes('api.github.com/repos/vercel-labs/agent-browser')) {
        return new Response(JSON.stringify({
          tree: [
            { type: 'blob', path: 'skills/agent-browser/SKILL.md' },
            { type: 'blob', path: 'skills/agent-browser/helper.sh' },
          ],
        }));
      }
      if (u.endsWith('SKILL.md')) return new Response('---\nname: agent-browser\n---\n# content');
      return new Response('echo hello');
    }) as typeof fetch;

    const manager = new SkillManager(http);
    await manager.install(root, 'skills.sh', 'agent-browser', { repo: 'vercel-labs/agent-browser' });
    for (const target of ['.claude/skills', '.agents/skills']) {
      assert.ok(fs.existsSync(path.join(root, target, 'agent-browser', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(root, target, 'agent-browser', 'helper.sh')));
      assert.ok(fs.existsSync(path.join(root, target, 'agent-browser', '.superai-skill.json')));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
