// Rewind files: the button on a message with a checkpoint previews, rewinds and can undo.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: process.env.SUPERAI_TEST_BROWSER || 'chrome', headless: true });
const passed = [], calls = [];
try {
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code'); localStorage.setItem('superai_locale', 'en'); localStorage.setItem('superai-preview', 'false'); });
  const items = [
    { id: 't1-user', kind: 'user', text: 'Change the button colour', at: Date.now(), checkpoint: { commit: 'abc' } },
    { id: 't1-a', kind: 'assistant', text: 'Done: changed `src/Button.tsx`.', at: Date.now() },
    { id: 't2-user', kind: 'user', text: 'Only look at the code', at: Date.now() },
  ];
  await page.routeWebSocket('**/ws/chat/cp', socket => socket.send(JSON.stringify({ type: 'snapshot', chat: { items, running: false } })));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname;
    if (p.includes('/chat/checkpoint')) calls.push(`${route.request().method()} ${p.split('/chat/')[1]}${url.search}`);
    if (p.endsWith('/chat/checkpoint')) return route.fulfill({ json: { files: [{ path: 'src/Button.tsx', status: 'changed' }, { path: 'src/new.ts', status: 'created' }] } });
    if (p.endsWith('/chat/checkpoint/rewind')) return route.fulfill({ json: { files: [{}, {}] } });
    if (p.endsWith('/chat/checkpoint/undo')) return route.fulfill({ json: { files: [{}, {}] } });
    let json = [];
    if (p === '/api/workspaces') json = [{ id: 'ws', name: 'Checkpoint workspace', rootPath: 'C:/cp', threads: [] }];
    else if (p === '/api/health') json = { pty: true };
    else if (p === '/api/terminals') json = [{ id: 'cp', wsId: 'ws', name: 'Codex chat', agentType: 'codex', view: 'chat', status: 'running', cwd: 'C:/cp', createdAt: 1 }];
    else if (p === '/api/clis') json = [{ id: 'codex', available: true, name: 'Codex', command: 'codex', maxSessions: 10 }];
    else if (p.includes('/chat/settings')) json = { agent: 'codex', model: '', effort: '', skills: [] };
    else if (p.endsWith('/chat')) json = { items, running: false };
    else if (p.includes('/auth')) json = { status: 'authenticated', note: '' };
    else if (p === '/api/ollama/models') json = { models: [] };
    else if (p.includes('/node')) json = { ready: true, installed: true, major: 24 };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  const first = page.locator('[data-message-id="t1-user"]');
  await first.waitFor();
  const button = first.getByRole('button', { name: 'Rewind files to before this message' });
  assert.equal(await button.count(), 1);
  assert.equal(await page.locator('[data-message-id="t2-user"]').getByRole('button', { name: 'Rewind files to before this message' }).count(), 0, 'no button without a checkpoint');
  passed.push('only a message with a checkpoint has the Rewind files button');

  await button.click();
  const strip = first.locator('.chat-rewind');
  await strip.getByText(/Rewind 2 file\(s\) to before this message\? Revert 1 · restore deleted 0 · remove new 1/).waitFor();
  passed.push('the preview says what will change');

  await strip.getByRole('button', { name: 'Rewind files' }).click();
  await strip.getByText('Rewound 2 file(s)').waitFor();
  await strip.getByRole('button', { name: 'Undo rewind' }).click();
  await strip.waitFor({ state: 'detached' });
  assert.deepEqual(calls, ['GET checkpoint?item=t1-user', 'POST checkpoint/rewind', 'POST checkpoint/undo']);
  assert.deepEqual(errors, []);
  passed.push('Rewind files then Undo rewind call the server in order');
  console.log(JSON.stringify({ passed }, null, 1));
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
