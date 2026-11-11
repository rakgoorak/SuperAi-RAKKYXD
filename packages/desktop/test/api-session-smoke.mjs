import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { StudioServer } from '../../studio/dist/StudioServer.js';
import { cloudKeys } from '../../studio/dist/CloudKeys.js';

const output = path.resolve('output/api-session');
await fs.mkdir(output, { recursive: true });
const directory = await fs.mkdtemp(path.join(output, 'profile-'));
const originalStore = cloudKeys.store, credentials = new Map();
cloudKeys.store = () => ({ get: (_kind, id) => credentials.get(id), saveApi: (id, key) => credentials.set(id, key), forgetApi: id => credentials.delete(id) });
const requests = [];
const endpoint = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'demo-model' }] })); return; }
  requests.push(JSON.parse(body));
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: 'เชื่อมต่อ API ในห้องคุยสำเร็จ' } }] }) + '\n\ndata: [DONE]\n\n');
});
await new Promise(resolve => endpoint.listen(0, '127.0.0.1', resolve));
const server = new StudioServer({ port: 0, customWorkspacePath: path.join(directory, 'workspaces.json') });
let browser;
try {
  await server.start();
  const base = `http://127.0.0.1:${server.getPort()}`;
  const ws = await (await fetch(base + '/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'API Demo', rootPath: directory }) })).json();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/clis', route => route.fulfill({ json: [] }));
  await page.addInitScript(id => {
    localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-tour-dismissed', '1'); localStorage.setItem('superai-tutorial-dismissed', '1');
    localStorage.setItem('superai-mode', 'code'); localStorage.setItem('superai-workspace', id);
  }, ws.id);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'การตั้งค่า', exact: true }).click();
  await page.getByRole('navigation', { name: 'หมวดการตั้งค่า' }).getByRole('button', { name: 'API Key', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่ม Custom Provider', exact: true }).click();
  await page.getByLabel('ชื่อ Custom Provider', { exact: true }).fill('Demo API');
  await page.getByLabel('Base URL ของ Custom Provider', { exact: true }).fill(`http://127.0.0.1:${endpoint.address().port}/v1`);
  await page.getByLabel('API Key ของ Custom Provider', { exact: true }).fill('test-key-browser');
  await page.getByLabel('โมเดลของ Custom Provider', { exact: true }).fill('demo-model\nsecond-model');
  await page.screenshot({ path: path.join(output, 'custom-provider-form.png') });
  await page.getByRole('button', { name: 'บันทึก Custom Provider', exact: true }).click();
  await page.locator('.api-key-row').filter({ hasText: 'Demo API' }).getByText('เชื่อมต่อแล้ว', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await page.getByRole('button', { name: 'เปิด session ใหม่', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Demo API · API' }).click();
  await page.getByRole('combobox', { name: 'model ของDemo API · API', exact: true }).fill('demo-model');
  await page.screenshot({ path: path.join(output, 'new-api-session.png') });
  await page.getByRole('button', { name: 'เปิด 1 session', exact: true }).click();
  await page.locator('.chat-view').waitFor();
  assert.equal(await page.getByRole('button', { name: 'มุมมอง Terminal', exact: true }).count(), 0);
  const composer = page.getByLabel('คำสั่ง', { exact: true });
  await composer.fill('ทดสอบ API'); await composer.press('Enter');
  await page.getByText('เชื่อมต่อ API ในห้องคุยสำเร็จ', { exact: true }).waitFor();
  assert.equal(requests[0].model, 'demo-model');
  await page.screenshot({ path: path.join(output, 'api-chat.png') });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('เชื่อมต่อ API ในห้องคุยสำเร็จ', { exact: true }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ passed: true, checks: ['custom form', 'API session creation', 'model forwarding', 'streamed answer', 'no raw CLI toggle', 'history after reload', 'no renderer errors'], screenshots: output }));
} finally {
  await browser?.close(); await server.stop();
  await new Promise(resolve => endpoint.close(resolve)); cloudKeys.store = originalStore;
}
