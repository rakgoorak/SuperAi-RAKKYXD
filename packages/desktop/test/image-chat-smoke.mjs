import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/image-chat');
await fs.mkdir(output, { recursive: true });
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
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], checks = [];
const check = (value, message) => { assert.ok(value, message); checks.push(message); console.log('PASS ' + message); };
try {
  const page = await browser.newPage({ locale: 'th-TH',  viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code');
    localStorage.setItem('superai-preview', 'false');
  });
  const imagePath = 'D:/AgentBuild/output/example image.png';
  const answer = `[ดูภาพตัวอย่าง](/D:/AgentBuild/output/example%20image.png)\n\n![ภาพ Markdown](docs/image.png)\n\n[รูปที่หาย](missing.png)\n\n[อ่านเอกสาร](docs/readme.txt)`;
  const items = [{ id: 'u', kind: 'user', text: 'แสดงรูปภาพ', attachments: ['saved.png'], at: Date.now() }, { id: 'a', kind: 'assistant', text: answer, at: Date.now() }];
  await page.routeWebSocket('**/ws/chat/images', socket => socket.send(JSON.stringify({ type: 'snapshot', chat: { items, running: false } })));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/preview-file')) {
      const requested = new URL(route.request().url()).searchParams.get('path');
      if (requested === 'missing.png') return route.fulfill({ status: 404, json: { error: 'missing' } });
      return route.fulfill({ contentType: 'image/png', body: await fs.readFile('docs/images/workspace.png') });
    }
    let json = [];
    if (pathname === '/api/workspaces') json = [{ id: 'image-workspace', name: 'Image workspace', rootPath: output, threads: [] }];
    else if (pathname === '/api/health') json = { pty: true };
    else if (pathname === '/api/terminals') json = [{ id: 'images', wsId: 'image-workspace', name: 'Image session', agentType: 'codex', view: 'chat', status: 'running', cwd: output, createdAt: 1 }];
    else if (pathname === '/api/clis') json = [{ id: 'codex', available: true, name: 'Codex', command: 'codex', maxSessions: 10, teamSupported: true }];
    else if (pathname.includes('/conversations/')) json = ['agent', 'chat'].map(mode => ({ id: mode, wsId: 'image-workspace', mode, status: 'completed', prompt: 'ตัวอย่าง', output: answer, createdAt: Date.now() }));
    else if (pathname.includes('/chat/settings')) json = { agent: 'codex', model: '', effort: '', skills: [] };
    else if (pathname.endsWith('/chat')) json = { items, running: false };
    else if (pathname.includes('/auth')) json = { status: 'authenticated', note: 'พร้อมใช้งาน' };
    else if (pathname === '/api/ollama/models') json = { models: [] };
    else if (pathname.includes('/node')) json = { ready: true, installed: true, major: 24 };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  const inline = page.getByRole('button', { name: 'ขยายรูป ดูภาพตัวอย่าง', exact: true });
  await inline.waitFor();
  await page.waitForFunction(() => document.querySelector('.markdown-image-open img')?.naturalWidth > 0);
  check(await inline.locator('img').getAttribute('src') === '/api/terminals/images/preview-file?path=' + encodeURIComponent(imagePath), 'answer image loads inline through its originating session');
  check(await page.getByRole('button', { name: 'ขยายรูป ภาพ Markdown', exact: true }).isVisible(), 'standard Markdown image syntax displays a thumbnail');
  check(await page.getByRole('link', { name: 'รูปที่หาย', exact: true }).isVisible() && await page.getByRole('button', { name: 'ขยายรูป รูปที่หาย', exact: true }).count() === 0, 'missing image keeps a Preview fallback link');
  await page.screenshot({ path: path.join(output, 'inline-images.png') });
  await inline.click();
  const viewer = page.getByRole('dialog', { name: 'ดูรูป ดูภาพตัวอย่าง', exact: true });
  const zoom = viewer.getByLabel('ระดับการซูม', { exact: true });
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.image-viewer-controls button')?.disabled);
  const percent = async () => Number((await zoom.innerText()).replace('%', ''));
  const fitted = await percent();
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  check(await percent() > fitted, 'zoom in increases the actual image scale');
  await viewer.getByRole('button', { name: 'ซูมออก', exact: true }).click();
  check(Math.abs(await percent() - fitted) <= 1, 'zoom out reduces the image scale');
  await viewer.getByRole('button', { name: '100%', exact: true }).click();
  check(await percent() === 100, '100 percent shows actual pixels');
  await page.keyboard.press('+');
  check(await percent() === 125, 'keyboard plus zooms without closing the viewer');
  const area = viewer.locator('.image-viewer-viewport');
  await area.hover();
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => Number(document.querySelector('.image-viewer-controls output').textContent.replace('%', '')) > 125);
  check(await percent() > 125, 'mouse wheel zoom is supported');
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  const before = await area.evaluate(el => el.scrollLeft);
  const box = await area.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2); await page.mouse.up();
  check(await area.evaluate(el => el.scrollLeft) > before, 'dragging pans a magnified image');
  await viewer.getByRole('button', { name: 'พอดีจอ', exact: true }).click();
  check(Math.abs(await percent() - fitted) <= 1, 'Fit restores the initial scale');
  await page.screenshot({ path: path.join(output, 'zoom-viewer.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  check(await viewer.locator('.image-viewer-controls').evaluate(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'zoom controls fit a narrow viewport');
  check(await viewer.getByRole('button', { name: 'ปิดรูปภาพ', exact: true }).evaluate(el => el.getBoundingClientRect().y >= 65), 'close action stays below native titlebar');
  await page.screenshot({ path: path.join(output, 'zoom-viewer-narrow.png') });
  await page.keyboard.press('Escape');
  check(await inline.evaluate(el => el === document.activeElement), 'closing restores focus to the inline image');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'ดูรูป saved.png', exact: true }).click();
  await page.getByRole('dialog', { name: 'ดูรูป saved.png', exact: true }).getByRole('group', { name: 'ซูมรูปภาพ', exact: true }).waitFor();
  check(true, 'sent attachments share the same zoom viewer');
  await page.keyboard.press('Escape');
  const modes = page.getByRole('navigation', { name: 'โหมดทำงาน' });
  for (const mode of ['Agent', 'Chat']) {
    await modes.getByRole('button', { name: mode, exact: true }).click();
    const image = page.getByRole('button', { name: 'ขยายรูป ดูภาพตัวอย่าง', exact: true });
    await image.waitFor();
    check((await image.locator('img').getAttribute('src')).startsWith('/api/workspaces/image-workspace/preview-file?'), mode + ' images use their workspace endpoint');
  }
  check(errors.length === 0, 'no renderer errors: ' + errors.join('; '));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
