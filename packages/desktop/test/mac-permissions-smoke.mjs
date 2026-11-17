import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/mac-permissions');
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
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let json = [];
    if (pathname === '/api/health') json = { pty: true };
    else if (pathname === '/api/clis') json = [{ id: 'codex', available: true, name: 'Codex', command: 'codex', maxSessions: 10 }];
    else if (pathname.includes('/node')) json = { ready: true, installed: true, major: 24 };
    else if (pathname.includes('/auth')) json = { status: 'authenticated' };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  // A Mac bridge added after start-up (the rest of the desktop API is not needed here), with
  // permissions still to ask so each button can be pressed. Settings reads the platform when opened.
  await page.evaluate(() => {
    const state = { microphone: 'not-determined', camera: 'denied', screen: 'not-determined', accessibility: false };
    window.__macCalls = [];
    window.superai = { isDesktop: true, platform: 'darwin', pickFolder: async () => null, openExternal: async () => {},
      browser: async () => ({ tabs: [], activeId: '' }), onBrowser: () => () => {},
      macPermissions: {
        status: async () => ({ ...state }),
        request: async (p) => { window.__macCalls.push('request:' + p); if (p === 'accessibility') state.accessibility = true; else state[p] = 'granted'; return { granted: true, status: { ...state } }; },
        openSettings: async (p) => { window.__macCalls.push('settings:' + p); },
      } };
  });
  await page.getByRole('button', { name: 'การตั้งค่า', exact: true }).first().click();
  const nav = page.getByRole('navigation', { name: 'หมวดการตั้งค่า' });
  await nav.getByRole('button', { name: 'สิทธิ์ macOS', exact: true }).click();
  const panel = page.locator('.mac-permissions-panel');
  await panel.getByText('ไมโครโฟน', { exact: true }).waitFor();
  check(await panel.locator('.mac-permission-row').count() === 5, 'macOS tab lists microphone, camera, screen, Accessibility and Full Disk Access');
  await page.screenshot({ path: path.join(output, 'mac-permissions.png') });
  await panel.locator('.mac-permission-row').nth(0).getByRole('button', { name: 'ขอ Allow' }).click();
  await panel.getByText('macOS อนุญาตไมโครโฟนแล้ว').waitFor();
  check(await panel.locator('.mac-permission-row').nth(0).getByText('พร้อมใช้').isVisible(), 'asking for the microphone shows it ready');
  await panel.locator('.mac-permission-row').nth(1).getByRole('button', { name: 'เปิด Settings' }).click();
  await panel.locator('.mac-permission-row').nth(4).getByRole('button', { name: 'เปิด Settings' }).click();
  const calls = await page.evaluate(() => window.__macCalls);
  check(calls.join() === 'request:microphone,settings:camera,settings:fullDiskAccess', 'a denied camera and Full Disk Access open their System Settings pane: ' + calls.join());
  check(errors.length === 0, 'no renderer errors: ' + errors.join('; '));
  console.log(JSON.stringify({ checks: checks.length, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
