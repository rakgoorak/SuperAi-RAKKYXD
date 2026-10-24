import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parsePreviewTarget } from '../client/src/previewLinks.js';
import { readPreviewFile } from '../server/PreviewFiles.js';
import { StudioServer } from '../server/StudioServer.js';
import { saveAttachment } from '../server/AttachmentStore.js';

test('preview targets normalize web URLs, Windows links, spaces and source line references', () => {
  assert.deepEqual(parsePreviewTarget('https://example.com/a?q=b'), { kind: 'web', url: 'https://example.com/a?q=b' });
  assert.deepEqual(parsePreviewTarget('www.example.com/demo'), { kind: 'web', url: 'https://www.example.com/demo' });
  assert.deepEqual(parsePreviewTarget('/D:/AgentBuild/output/preview%20sample.png'), { kind: 'file', path: 'D:/AgentBuild/output/preview sample.png' });
  assert.deepEqual(parsePreviewTarget('<docs/My Guide.md:12>'), { kind: 'file', path: 'docs/My Guide.md', line: 12 });
  assert.deepEqual(parsePreviewTarget('file:///D:/AgentBuild/readme.md#L4'), { kind: 'file', path: 'D:/AgentBuild/readme.md', line: 4 });
  assert.deepEqual(parsePreviewTarget('src/App.tsx:25:3'), { kind: 'file', path: 'src/App.tsx', line: 25 });
});

test('executable schemes, embedded credentials and network file paths cannot become Preview links', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,hi', 'vscode://file/test', 'https://user:password@example.com', 'file://server/share/file.png', '//remote/file', '\\\\server\\share', 'file.txt%00.png']) assert.throws(() => parsePreviewTarget(href));
});

test('local previews read media/text but enforce real project boundaries, types and size', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-preview-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-preview-outside-'));
  try {
    await fs.writeFile(path.join(root, 'image.png'), Buffer.from([137, 80, 78, 71, 0]));
    await fs.writeFile(path.join(root, 'sample.pdf'), '%PDF-1.4\n%%EOF');
    await fs.writeFile(path.join(root, 'page.html'), '<script>neverExecute()</script>');
    assert.equal((await readPreviewFile(root, 'image.png')).contentType, 'image/png');
    assert.equal((await readPreviewFile(root, path.join(root, 'sample.pdf'))).contentType, 'application/pdf');
    const html = await readPreviewFile(root, 'page.html');
    assert.equal(html.contentType, 'text/plain; charset=utf-8');
    assert.equal(html.content.toString(), '<script>neverExecute()</script>');
    await fs.writeFile(path.join(outside, 'private.txt'), 'outside');
    await assert.rejects(readPreviewFile(root, path.join(outside, 'private.txt')), /โปรเจกต์/);
    await fs.symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(readPreviewFile(root, 'linked/private.txt'), /โปรเจกต์/);
    await assert.rejects(readPreviewFile(root, '../' + path.basename(outside) + '/private.txt'), /โปรเจกต์/);
    await fs.writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2]));
    await assert.rejects(readPreviewFile(root, 'binary.bin'), /ชนิดนี้/);
    await fs.writeFile(path.join(root, 'large.txt'), 'x'.repeat(512 * 1024 + 1));
    await assert.rejects(readPreviewFile(root, 'large.txt'), /512 KB/);
    await fs.writeFile(path.join(root, 'large.png'), Buffer.alloc(20 * 1024 * 1024 + 1));
    await assert.rejects(readPreviewFile(root, 'large.png'), /20 MB/);
  } finally { await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true }); }
});

test('preview endpoint serves registered project bytes with safe content types and useful errors', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-preview-api-'));
  const server = new StudioServer({ port: 0, customWorkspacePath: path.join(root, 'workspaces.json') });
  try {
    await fs.writeFile(path.join(root, 'note.html'), '<h1>show as text</h1>');
    await server.start();
    const base = `http://localhost:${server.getPort()}`;
    const workspace = await fetch(base + '/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Preview fixture', rootPath: root }) }).then(response => response.json()) as { id: string };
    const url = `${base}/api/workspaces/${workspace.id}/preview-file?path=`;
    const response = await fetch(url + encodeURIComponent('note.html'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /^text\/plain/);
    assert.match(response.headers.get('content-security-policy') || '', /sandbox/);
    assert.equal(await response.text(), '<h1>show as text</h1>');
    assert.equal((await fetch(url + 'missing.png')).status, 404);
    assert.equal((await fetch(`${base}/api/workspaces/unknown/preview-file?path=x`)).status, 404);
    const crossOrigin = await fetch(url + 'note.html', { headers: { Origin: 'https://other.example' } });
    assert.equal(crossOrigin.status, 403);
  } finally { await server.stop(); await fs.rm(root, { recursive: true, force: true }); }
});

test('saved session images remain readable in dormant sessions and cannot escape their folder', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-session-images-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-session-images-outside-'));
  const server = new StudioServer({ port: 0, customWorkspacePath: path.join(root, 'workspaces.json') });
  try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const saved = saveAttachment(root, png);
    server.getTerminalManager().addDormant({ id: 'image-history', options: { cwd: root, agentType: 'codex' } });
    await server.start();
    const base = `http://127.0.0.1:${server.getPort()}`;
    const url = `${base}/api/terminals/image-history/preview-file?path=`;
    for (const file of [saved.path, saved.relativePath]) {
      const response = await fetch(url + encodeURIComponent(file));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /^image\/png/);
      assert.match(response.headers.get('content-security-policy') || '', /sandbox/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    }
    assert.equal((await fetch(`${base}/api/terminals/missing/preview-file?path=x.png`)).status, 404);
    assert.equal((await fetch(url + encodeURIComponent('.superai/attachments/missing.png'))).status, 404);
    await fs.writeFile(path.join(outside, 'private.png'), png);
    assert.equal((await fetch(url + encodeURIComponent(path.join(outside, 'private.png')))).status, 400);
    await fs.symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal((await fetch(url + encodeURIComponent('linked/private.png'))).status, 400);
    assert.equal((await fetch(url + encodeURIComponent(saved.path), { headers: { Origin: 'https://other.example' } })).status, 403);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});
