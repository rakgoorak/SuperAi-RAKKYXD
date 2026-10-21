import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliVersionManager, parseVersion, compareVersions, CONFIRMED_LATEST } from '../server/CliVersions.js';
import { TerminalSessionManager, UPDATE_FAILED } from '../server/TerminalSessionManager.js';

test('version strings from every CLI are parsed and compared', () => {
  assert.equal(parseVersion('2.1.306 (Claude Code)'), '2.1.306');
  assert.equal(parseVersion('codex-cli 0.163.0'), '0.163.0');
  assert.equal(parseVersion('1.19.3'), '1.19.3');
  assert.equal(parseVersion('no version'), null);
  assert.equal(compareVersions('0.99.0', '0.163.0'), -1);
  assert.equal(compareVersions('2.1.306', '2.1.306'), 0);
});

function fakeProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.kill = () => {};
  return proc;
}

test('outdated CLIs are reported and updated with their own updater', async () => {
  let installed = '0.150.0';
  const calls: string[][] = [];
  let proc: any;
  const m = new CliVersionManager({
    installed: (id) => id !== 'freebuff',
    run: async (id) => (id === 'codex' ? `codex-cli ${installed}` : id === 'antigravity' ? '1.4.4' : '2.1.306 (Claude Code)'),
    latest: async (pkg) => (pkg === '@openai/codex' ? '0.163.0' : '2.1.306'),
    spawnUpdate: (id, args) => { calls.push([id, ...args]); proc = fakeProcess(); return proc; },
  });
  const all = await m.all();
  const by = Object.fromEntries(all.map((v) => [v.id, v]));
  assert.equal(by.codex.status, 'outdated');
  assert.equal(by['claude-code'].status, 'latest');
  assert.equal(by.antigravity.status, 'unknown');
  assert.equal(by.freebuff.status, 'not-installed');
  assert.throws(() => m.startUpdate('codex', () => true), /กำลังเปิดใช้งาน/);
  const job = m.startUpdate('codex', () => false);
  assert.deepEqual(calls, [['codex', 'update']]);
  assert.throws(() => m.startUpdate('codex', () => false), /กำลังอัปเดต/);
  proc.stdout.write('\x1b[32mUpdating Codex...\x1b[0m\r\nDone\n');
  installed = '0.163.0';
  proc.emit('close', 0);
  for (let i = 0; i < 50 && job.status === 'running'; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(job.status, 'completed');
  assert.equal(job.before, '0.150.0');
  assert.equal(job.after, '0.163.0');
  assert.match(job.log, /Updating Codex/);
  assert.ok(!job.log.includes('\x1b'));
  assert.equal((await m.check('codex')).status, 'latest');
});

test('a failed update keeps the log and reports the exit code', async () => {
  let proc: any;
  const m = new CliVersionManager({
    installed: () => true, run: async () => '1.0.0', latest: async () => '2.0.0',
    spawnUpdate: () => { proc = fakeProcess(); return proc; },
  });
  await m.check('opencode');
  const job = m.startUpdate('opencode', () => false);
  proc.stderr.write('EACCES: permission denied');
  proc.emit('close', 1);
  for (let i = 0; i < 50 && job.status === 'running'; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(job.status, 'failed');
  assert.match(job.error!, /exit 1/);
  assert.match(job.log, /EACCES/);
});

test('a session that updated itself and exited can be restarted with the same id', async () => {
  const manager = new TerminalSessionManager();
  const isWindows = process.platform === 'win32';
  const session = manager.spawnSession({
    name: 'self-updating cli',
    command: isWindows ? 'cmd.exe' : 'sh',
    args: isWindows ? ['/c', 'echo Update available: 1.0 to 1.1 && echo Successfully updated'] : ['-c', 'echo "Update available: 1.0 -> 1.1"; echo "Successfully updated"'],
    forcePipe: true,
  });
  for (let i = 0; i < 200 && manager.getSession(session.id)?.status === 'running'; i++) await new Promise((r) => setTimeout(r, 25));
  const ended = manager.listSessions().find((s) => s.id === session.id)!;
  assert.equal(ended.status, 'exited');
  assert.equal(ended.selfUpdated, true);
  assert.throws(() => manager.restartSession('missing'), /ไม่พบ/);
  const again = manager.restartSession(session.id);
  assert.equal(again.id, session.id);
  assert.equal(again.name, 'self-updating cli');
  assert.equal(manager.listSessions().filter((s) => s.id === session.id).length, 1);
  assert.equal(manager.listSessions().find((s) => s.id === session.id)!.updateFailed, false);
  manager.killAll();
});

test('an update that failed is flagged so the tab is not reopened as "updated"', async () => {
  // The case Codex found: the CLI announces an update, then the download fails.
  const manager = new TerminalSessionManager();
  const session = manager.spawnSession({
    name: 'failing update',
    command: process.execPath,
    args: ['-e', 'console.log("Update available: 1.0 -> 1.1"); console.log("Download failed: network error")'],
    forcePipe: true,
  });
  for (let i = 0; i < 200 && manager.getSession(session.id)?.status === 'running'; i++) await new Promise((r) => setTimeout(r, 25));
  const ended = manager.listSessions().find((s) => s.id === session.id)!;
  assert.equal(ended.exitCode, 0);
  assert.equal(ended.selfUpdated, true);
  assert.equal(ended.updateFailed, true);
  for (const line of ['Failed to update Claude Code', 'Error installing update', 'Could not download the new version', 'upgrade failed']) assert.ok(UPDATE_FAILED.test(line), line);
  for (const line of ['Update available: 1.0 -> 1.1', 'Successfully updated to 1.1', 'Downloading...']) assert.ok(!UPDATE_FAILED.test(line), line);
  manager.killAll();
});

test('a CLI with no registry (Antigravity) is "latest" once its own updater says so', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-cli-latest-'));
  const confirmedFile = path.join(dir, 'confirmed.json');
  let installed = '1.4.4';
  let proc: any;
  const deps = {
    installed: () => true, run: async () => installed, latest: async () => null,
    spawnUpdate: () => { proc = fakeProcess(); return proc; }, confirmedFile,
  };
  try {
    const m = new CliVersionManager(deps);
    assert.equal((await m.check('antigravity')).status, 'unknown');
    const job = m.startUpdate('antigravity', () => false);
    proc.stdout.write('Checking for updates... (current version 1.4.4)\n✓ You are already on the latest version.\n');
    proc.emit('close', 0);
    for (let i = 0; i < 50 && job.status === 'running'; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(job.status, 'completed');
    assert.equal((await m.check('antigravity')).status, 'latest');
    // Remembered after a restart, and only for that exact version.
    assert.equal((await new CliVersionManager(deps).check('antigravity', true)).status, 'latest');
    installed = '1.4.5';
    assert.equal((await new CliVersionManager(deps).check('antigravity', true)).status, 'unknown');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const line of ['You are already on the latest version.', 'Already up to date', 'Successfully updated to 1.5.0']) assert.ok(CONFIRMED_LATEST.test(line), line);
  for (const line of ['Checking for updates...', 'Update available: 1.5.0']) assert.ok(!CONFIRMED_LATEST.test(line), line);
});
