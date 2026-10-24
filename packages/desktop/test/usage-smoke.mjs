import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/usage');
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
const browser = await chromium.launch({ channel: process.env.SUPERAI_TEST_BROWSER || 'chrome', headless: true });
const errors = [];
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; console.log('PASS ' + message); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code'); });
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    let json = [];
    if (pathname === '/api/workspaces') json = [{ id: 'usage-fixture', name: 'Usage preview', rootPath: output, threads: [] }];
    else if (pathname === '/api/health') json = { pty: true };
    else if (pathname === '/api/ollama/models') json = { models: [] };
    else if (pathname.includes('/node')) json = { ready: true, installed: true, major: 24, version: 'v24.0.0' };
    else if (pathname.startsWith('/api/usage/')) {
      const id = pathname.split('/').at(-1);
      const short = { label: '5 ชั่วโมง', remainingPercent: 87, resetsAt: '2027-01-01T21:00:00Z' };
      const weekly = { label: 'รายสัปดาห์', remainingPercent: 59, resetsAt: '2027-01-05T21:00:00Z' };
      json = { id, name: id, status: 'ok', updatedAt: Date.now(), windows: id === 'claude-code'
        ? [{ ...short, resetsAt: undefined, resetsText: 'Jan 2, 4am (Asia/Bangkok)' }, { ...weekly, label: 'รายสัปดาห์ (ทุกรุ่น)' }]
        : id === 'antigravity' ? [{ ...weekly, group: 'Gemini Models' }, { ...short, group: 'Gemini Models' }]
        : id === 'codex' ? [short, weekly] : [] };
    }
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Usage', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'โควตาการใช้งาน', exact: true });
  await panel.locator('.usage-row').nth(5).waitFor();
  const cards = panel.locator('.usage-card');
  const labels = card => card.locator('.usage-row-head > span').allTextContents();
  check(JSON.stringify(await labels(cards.nth(0))) === JSON.stringify(['5 ชั่วโมง', 'รายสัปดาห์ (ทุกรุ่น)']), 'Claude keeps model scope and short-window-first order');
  for (const index of [1, 2]) check(JSON.stringify(await labels(cards.nth(index))) === JSON.stringify(['5 ชั่วโมง', 'รายสัปดาห์']), 'provider ' + index + ' uses the same window order');
  const resetLines = await Promise.all([0, 1, 2].map(index => cards.nth(index).locator('.usage-row > small').first().innerText()));
  check(resetLines.every(text => text === 'รีเซ็ต: 2 ม.ค. 04:00 (Asia/Bangkok)'), 'text and ISO dates share one reset format');
  check(await cards.nth(2).locator('.usage-group-name').innerText() === 'Gemini Models', 'provider model groups are preserved');
  check(await cards.nth(2).getByRole('meter').first().getAttribute('aria-valuenow') === '87', 'sorting preserves the matching remaining percentage');
  await page.screenshot({ path: path.join(output, 'consistent-desktop.png') });
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  check(errors.length === 0, 'no renderer errors: ' + errors.join('; '));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
