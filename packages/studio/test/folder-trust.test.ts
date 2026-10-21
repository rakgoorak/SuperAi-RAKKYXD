import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { trustFolder } from '../server/FolderTrust.js';

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-trust-'));
  const codexHome = path.join(home, '.codex');
  fs.mkdirSync(codexHome);
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ oauthAccount: { keep: 1 }, projects: { 'D:/Other': { hasTrustDialogAccepted: true, allowedTools: ['x'] } } }));
  fs.writeFileSync(path.join(codexHome, 'config.toml'), "model = \"gpt\"\n\n[projects.'d:\\other']\ntrust_level = \"trusted\"\n");
  fs.writeFileSync(path.join(home, '.gemini', 'antigravity-cli', 'settings.json'), JSON.stringify({ theme: 'dark', trustedWorkspaces: ['C:\\Users\\me'] }));
  return { home, codexHome };
}

test('trusts a project folder in Claude, Codex and Antigravity without touching other settings', () => {
  const p = fakeHome();
  const dir = path.resolve(os.tmpdir(), 'My Project');
  try {
    for (const cli of ['claude-code', 'codex', 'antigravity']) assert.equal(trustFolder(cli, dir, p), true, cli);
    const claude = JSON.parse(fs.readFileSync(path.join(p.home, '.claude.json'), 'utf8'));
    assert.equal(claude.projects[dir.replace(/\\/g, '/')].hasTrustDialogAccepted, true);
    assert.deepEqual(claude.oauthAccount, { keep: 1 });
    assert.deepEqual(claude.projects['D:/Other'].allowedTools, ['x']);
    const toml = fs.readFileSync(path.join(p.codexHome, 'config.toml'), 'utf8');
    assert.ok(toml.startsWith('model = "gpt"'));
    const key = process.platform === 'win32' ? dir.toLowerCase() : dir;
    assert.ok(toml.includes(`[projects.'${key}']\ntrust_level = "trusted"`));
    const agy = JSON.parse(fs.readFileSync(path.join(p.home, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8'));
    assert.deepEqual(agy.trustedWorkspaces, ['C:\\Users\\me', dir]);
    assert.equal(agy.theme, 'dark');
    // A second call adds nothing.
    for (const cli of ['claude-code', 'codex', 'antigravity']) assert.equal(trustFolder(cli, dir, p), false, cli);
    assert.equal(fs.readFileSync(path.join(p.codexHome, 'config.toml'), 'utf8'), toml);
  } finally { fs.rmSync(p.home, { recursive: true, force: true }); }
});

test('missing or unreadable configs and other CLIs are left alone', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-trust-empty-'));
  try {
    const p = { home, codexHome: path.join(home, '.codex') };
    assert.equal(trustFolder('claude-code', 'D:\\Test', p), false);
    assert.equal(fs.existsSync(path.join(home, '.claude.json')), false);
    fs.writeFileSync(path.join(home, '.claude.json'), '{ broken');
    assert.equal(trustFolder('claude-code', 'D:\\Test', p), false);
    assert.equal(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'), '{ broken');
    assert.equal(trustFolder('opencode', 'D:\\Test', p), false);
    assert.equal(trustFolder('codex', "D:\\it's", { home, codexHome: home }), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
