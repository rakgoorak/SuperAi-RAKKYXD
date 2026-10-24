import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root = path.resolve('packages/studio/client/dist'), output = path.resolve('output/composer-location');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, req.url === '/' ? 'index.html' : '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], checks = [];
const check = (value, message) => { assert.ok(value, message); checks.push(message); console.log('PASS '+message); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code'); localStorage.setItem('superai-preview', 'false'); });
  const sessions = ['one', 'two'].map((id, i) => ({ id, wsId: 'ws', name: `Codex ${i+1}`, agentType: 'codex', view: 'chat', status: 'running', cwd: i ? 'D:/Project/.worktrees/feature' : 'D:/Project', createdAt: i+1 }));
  await page.routeWebSocket('**/ws/chat/*', socket => socket.send(JSON.stringify({ type: 'snapshot', chat: { items: [], running: false } })));
  let sends = 0;
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/chat') && route.request().method() === 'POST') sends++;
    let json = [];
    if (p === '/api/workspaces') json = [{ id: 'ws', name: 'Project', rootPath: 'D:/Project', threads: [] }];
    else if (p === '/api/terminals') json = sessions;
    else if (p === '/api/clis') json = [{ id: 'codex', available: true, name: 'Codex', command: 'codex' }];
    else if (p.endsWith('/context')) { const second = p.includes('/two/'); json = { cwd: second ? sessions[1].cwd : sessions[0].cwd, git: 'ready', branch: second ? 'feature/ui' : 'main', commit: null }; }
    else if (p.includes('/chat/settings')) json = { agent: 'codex', model: 'gpt-6.1-sol', effort: 'medium', skills: [] };
    else if (p.endsWith('/chat')) json = { items: [], running: false };
    else if (p.includes('/auth')) json = { status: 'authenticated' };
    else if (p.includes('/node')) json = { ready: true, major: 24 };
    else if (p === '/api/health') json = { pty: true };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  const context = page.getByLabel('พื้นที่ทำงานของข้อความนี้');
  await context.getByText('main', { exact: true }).waitFor();
  check((await context.innerText()).includes('D:/Project'), 'working folder and actual branch are visible near the composer');
  const plus = page.getByRole('button', { name: 'แนบไฟล์', exact: true });
  const settings = page.locator('.session-chat-controls');
  check((await plus.boundingBox()).x < (await settings.boundingBox()).x, 'attachment plus precedes model and account controls');
  await plus.click();
  check(await page.getByRole('menu').isVisible(), 'leading attachment button still opens its menu');
  await page.keyboard.press('Escape');
  await page.getByLabel('คำสั่ง', { exact: true }).fill('draft remains');
  await page.getByRole('button', { name: /Codex 2/ }).first().click();
  await context.getByText('feature/ui', { exact: true }).waitFor();
  check((await context.innerText()).includes('.worktrees/feature') && !(await context.innerText()).includes('main'), 'selecting another session switches folder and branch together');
  await page.getByLabel('เป้าหมายคำสั่ง').selectOption('all');
  await context.getByText('หลายโฟลเดอร์ (2)', { exact: true }).waitFor();
  check(!(await context.innerText()).includes('feature/ui'), 'broadcast across different folders does not claim one shared branch');
  await page.getByLabel('เป้าหมายคำสั่ง').selectOption('active');
  await context.getByText('feature/ui', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  await page.setViewportSize({ width: 760, height: 900 });
  check(await plus.isVisible() && await context.isVisible(), 'attachment and context remain available in a narrow workspace');
  const modelBox = await settings.boundingBox(), buttonsBox = await page.locator('.composer-bottom').boundingBox();
  check(buttonsBox.y + buttonsBox.height <= modelBox.y + 2 || modelBox.y + modelBox.height <= buttonsBox.y + 2, 'narrow action row and model controls do not overlap');
  await page.screenshot({ path: path.join(output, 'narrow.png') });
  await page.getByRole('button', { name: 'Agent', exact: true }).click();
  await context.getByText('main', { exact: true }).waitFor();
  check(!(await context.innerText()).includes('.worktrees'), 'Agent shows its project folder rather than the selected Code session folder');
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await context.getByText('main', { exact: true }).waitFor();
  check((await context.innerText()).includes('D:/Project'), 'Chat shows its own project context');
  check(sends === 0, 'switching contexts and opening attachments never sends the draft');
  check(errors.length === 0, 'no renderer errors');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); }
