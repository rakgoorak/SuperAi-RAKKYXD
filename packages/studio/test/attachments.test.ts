import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveAttachment, resolveAttachments, AttachmentError } from '../server/AttachmentStore.js';
import { StudioServer } from '../server/StudioServer.js';
import { attachmentProblem, promptArguments } from '../server/CliProvider.js';
import { attachMode, formatPath, isSupportedAttachment, isSupportedImage } from '../client/src/attachments.ts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF\n');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'superai-attach-'));

test('saveAttachment stores images and PDFs under .superai/attachments without overwriting', () => {
  const root = temp();
  const when = new Date(2026, 9, 20, 9, 5, 7);
  const a = saveAttachment(root, PNG, when);
  const b = saveAttachment(root, PNG, when);
  assert.notEqual(a.path, b.path);
  assert.match(a.relativePath, /^\.superai\/attachments\/image-20261020-090507-[0-9a-f]{6}\.png$/);
  assert.deepEqual(fs.readFileSync(a.path), PNG);
  assert.equal(a.size, PNG.length);
  assert.match(saveAttachment(root, PDF, when).name, /^document-20261020-090507-[0-9a-f]{6}\.pdf$/);
});

test('saveAttachment rejects other files and empty data with Thai guidance', () => {
  const root = temp();
  assert.throws(() => saveAttachment(root, Buffer.from('hello')), (e: AttachmentError) => e.status === 415 && /PNG, JPG, GIF, WEBP และไฟล์ PDF/.test(e.message));
  assert.throws(() => saveAttachment(root, Buffer.alloc(0)), /ไม่พบข้อมูลไฟล์/);
  assert.equal(fs.existsSync(path.join(root, '.superai')), false);
});

test('resolveAttachments only accepts files saved in the project attachment folder', () => {
  const root = temp();
  const saved = saveAttachment(root, PNG);
  assert.deepEqual(resolveAttachments(root, [saved.path]), [saved.path]);
  assert.deepEqual(resolveAttachments(root, undefined), []);
  const outside = path.join(root, 'secret.png');
  fs.writeFileSync(outside, PNG);
  assert.throws(() => resolveAttachments(root, [outside]), /แนบไฟล์ใหม่/);
  assert.throws(() => resolveAttachments(root, [path.join(root, '.superai', 'attachments', '..', '..', 'secret.png')]), /แนบไฟล์ใหม่/);
  assert.throws(() => resolveAttachments(root, 'x'), /ไม่เกิน 20 ไฟล์/);
});

test('attachment endpoints save into the session and project folders', async () => {
  const root = temp();
  const server = new StudioServer({ port: 0, customWorkspacePath: path.join(root, 'workspaces.json') });
  await server.start();
  const base = `http://127.0.0.1:${server.getPort()}`;
  const upload = (route: string, body: string | Buffer) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  try {
    const session = server.getTerminalManager().spawnSession({ name: 'attach', cwd: root, forcePipe: true });
    const ok = await upload(`/api/terminals/${session.id}/attachments`, PNG);
    const saved = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(path.dirname(saved.path), path.join(root, '.superai', 'attachments'));
    assert.ok(fs.existsSync(saved.path));
    assert.equal((await upload(`/api/terminals/${session.id}/attachments`, 'not an image')).status, 415);
    const missing = await upload('/api/terminals/nope/attachments', PNG);
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /เปิด session ใหม่/);

    const project = path.join(root, 'project');
    fs.mkdirSync(project);
    const workspace = server.getWorkspaceRegistry().createWorkspace('รูป', project);
    const pdf = await upload(`/api/workspaces/${workspace.id}/attachments`, PDF);
    assert.equal(pdf.status, 200);
    assert.equal(path.dirname((await pdf.json()).path), path.join(project, '.superai', 'attachments'));
    const bad = await fetch(`${base}/api/conversations/${workspace.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ดูรูป', model: 'cli:claude-code', mode: 'chat', attachments: [path.join(root, 'elsewhere.png')] }),
    });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /แนบไฟล์ใหม่/);
  } finally {
    await server.stop();
  }
});

test('chat providers get attachments the way each CLI reads files', () => {
  assert.equal(attachmentProblem('cli:claude-code', ['/p/a.pdf']), '');
  assert.equal(attachmentProblem('cli:opencode', ['/p/a.pdf']), '');
  assert.equal(attachmentProblem('cli:codex', ['/p/a.png']), '');
  assert.match(attachmentProblem('cli:codex', ['/p/a.pdf']), /ไม่รับ PDF/);
  assert.match(attachmentProblem('qwen2.5-coder:7b', ['/p/a.png']), /Ollama/);
  assert.equal(attachmentProblem('qwen2.5-coder:7b', []), '');
  assert.deepEqual(promptArguments('claude-code', false, undefined, '', false, ['/p/a.png']).slice(-4), ['--permission-mode', 'plan', '--tools', 'Read']);
  assert.deepEqual(promptArguments('claude-code', false).slice(-1), ['']);
  assert.ok(promptArguments('codex', false, undefined, '', false, ['/p/a.png']).includes('--image=/p/a.png'));
  const open = promptArguments('opencode', false, '/tmp/request.txt', '', false, ['/p/a.pdf']);
  assert.deepEqual(open.slice(open.indexOf('/p/a.pdf') - 1, open.indexOf('/p/a.pdf') + 1), ['--file', '/p/a.pdf']);
});

test('terminal panes: each CLI gets files the way it accepts them', () => {
  assert.equal(attachMode('claude-code'), 'path');
  assert.equal(attachMode('opencode'), 'path');
  assert.equal(attachMode('antigravity'), 'path');
  assert.equal(attachMode('codex'), 'clipboard');
  assert.equal(formatPath('C:\\My Project\\a.png'), '"C:\\My Project\\a.png" ');
  assert.equal(formatPath('D:\\proj\\a.png'), 'D:\\proj\\a.png ');
  assert.ok(isSupportedImage({ type: '', name: 'shot.JPG' }));
  assert.ok(!isSupportedImage({ type: 'image/bmp', name: 'shot.bmp' }));
  assert.ok(isSupportedAttachment({ type: 'application/pdf', name: 'spec.pdf' }));
});
