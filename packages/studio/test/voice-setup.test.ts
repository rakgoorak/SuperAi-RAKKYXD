import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager } from '../server/AgentRunManager.js';
import { bashForGit, getGitStatus, pickPortableGitAsset, managedGitCmd } from '../server/GitInstaller.js';
import { SpeechService } from '../server/SpeechService.js';
import { cliPath } from '../server/CliCatalog.js';
import { CliInstallManager } from '../server/CliInstallManager.js';

test('voice runs ask the model for short spoken answers; typed runs do not', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-voice-'));
  const systems: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    systems.push(JSON.parse(options.body).messages.find((m: any) => m.role === 'system').content);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ได้ครับ' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'history.json'));
    const wait = async (run: any) => { for (let i = 0; i < 50 && run.status === 'running'; i++) await new Promise(r => setTimeout(r, 10)); };
    const spoken = manager.start('p', 'สวัสดี', 'test', dir, 'chat', false, '', undefined, true);
    await wait(spoken);
    const typed = manager.start('p', 'สวัสดี', 'test', dir, 'chat');
    await wait(typed);
    assert.equal(spoken.voice, true);
    assert.equal(typed.voice, undefined);
    assert.match(systems[0], /อ่านออกเสียง/);
    assert.doesNotMatch(systems[1], /อ่านออกเสียง/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('PortableGit asset choice follows the CPU and carries the published SHA-256', () => {
  const release = { tag_name: 'v2.56.0.windows.2', assets: [
    { name: 'Git-2.56.0.2-64-bit.exe', browser_download_url: 'https://x/installer' },
    { name: 'PortableGit-2.56.0.2-64-bit.7z.exe', browser_download_url: 'https://x/x64', digest: 'sha256:abc' },
    { name: 'PortableGit-2.56.0.2-arm64.7z.exe', browser_download_url: 'https://x/arm' },
  ] };
  assert.deepEqual(pickPortableGitAsset(release, 'x64'), { url: 'https://x/x64', filename: 'PortableGit-2.56.0.2-64-bit.7z.exe', sha256: 'abc', version: '2.56.0.windows.2' });
  assert.equal(pickPortableGitAsset(release, 'arm64').sha256, undefined);
  assert.throws(() => pickPortableGitAsset({ assets: [] }), /ไม่พบ PortableGit/);
});

test('Git status needs Git Bash on Windows but only git elsewhere', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-git-'));
  try {
    const git = path.join(root, 'cmd', 'git.exe');
    fs.mkdirSync(path.dirname(git), { recursive: true }); fs.writeFileSync(git, '');
    const saved = process.env.CLAUDE_CODE_GIT_BASH_PATH; delete process.env.CLAUDE_CODE_GIT_BASH_PATH;
    try {
      assert.equal(getGitStatus(() => null, () => '', 'win32').installed, false);
      assert.equal(getGitStatus(() => git, () => 'git version 2.56.0', 'win32').installed, false, 'git.exe without bash.exe is not enough for Claude Code');
      fs.mkdirSync(path.join(root, 'bin')); fs.writeFileSync(path.join(root, 'bin', 'bash.exe'), '');
      const ready = getGitStatus(() => git, () => 'git version 2.56.0', 'win32');
      assert.equal(ready.installed, true); assert.equal(ready.version, '2.56.0'); assert.equal(ready.bashPath, bashForGit(git));
      const mac = getGitStatus(() => '/usr/bin/git', () => 'git version 2.39.5', 'darwin');
      assert.equal(mac.required, false); assert.equal(mac.installed, true);
    } finally { if (saved !== undefined) process.env.CLAUDE_CODE_GIT_BASH_PATH = saved; }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('managed Git is on the CLI PATH on Windows only', () => {
  assert.equal(cliPath().split(path.delimiter).includes(managedGitCmd()), process.platform === 'win32');
});

test('Git installs through the shared installer queue and reports failures', async () => {
  const manager = new CliInstallManager({ installGit: async () => { throw new Error('ไม่มีอินเทอร์เน็ต'); } });
  const job = manager.start('git');
  assert.equal(job.cliId, 'git');
  assert.throws(() => manager.start('node'), /กำลังติดตั้ง/);
  for (let i = 0; i < 50 && job.status === 'running'; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(job.status, 'failed'); assert.equal(job.error, 'ไม่มีอินเทอร์เน็ต');
});

test('system speech rejects bad input and unsupported platforms without running PowerShell', async () => {
  const mac = new SpeechService('darwin');
  assert.deepEqual(await mac.voices(), []);
  await assert.rejects(mac.synthesize('hello', 'en-US'), /เฉพาะ Windows/);
  const win = new SpeechService('win32');
  await assert.rejects(win.synthesize('   ', 'th-TH'), /ไม่มีข้อความ/);
  await assert.rejects(win.synthesize('hi', 'th-TH; rm -rf'), /ภาษาไม่ถูกต้อง/);
});

test('Windows system speech lists voices and returns WAV audio', { skip: process.platform !== 'win32' }, async () => {
  const speech = new SpeechService();
  const voices = await speech.voices();
  const english = voices.find(v => v.lang.startsWith('en'));
  if (!english) return;
  const audio = await speech.synthesize('Hello from SuperAi', 'en-US');
  assert.equal(audio.subarray(0, 4).toString('ascii'), 'RIFF');
  if (!voices.some(v => v.lang.startsWith('th')))
    await assert.rejects(speech.synthesize('สวัสดี', 'th-TH'), (e: any) => e.code === 'NO_VOICE');
});
