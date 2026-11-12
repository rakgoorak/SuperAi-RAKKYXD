// Claude-style minimal chat: one-row composer pill, a quiet footer (permission left, AI/model/effort right),
// and notices as a small toast that never pushes the layout.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const output = path.resolve('output/playwright/chat-minimal');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(path.resolve('output/playwright'), 'chat-minimal-'));
const launch = () => electron.launch({
  executablePath: process.env.SUPERAI_PORTABLE_DIR ? path.join(process.env.SUPERAI_PORTABLE_DIR, 'SuperAi-RAKKYXD.exe') : require('electron'),
  args: process.env.SUPERAI_PORTABLE_DIR ? [] : ['packages/desktop'],
  env: { ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000,
});
const ready = async app => {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1'));
  await page.reload(); await page.waitForSelector('.app-shell');
  return page;
};
const request = (page, route, body) => page.evaluate(async ({ route, body }) => {
  const response = await fetch(route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}, { route, body });

// 1st launch: a project with one Claude chat room.
let app = await launch();
let session;
try {
  const page = await ready(app);
  const workspace = await request(page, '/api/workspaces', { name: 'AgentBuild', rootPath: data });
  session = await request(page, '/api/terminals/spawn', { wsId: workspace.id, agentType: 'claude-code', name: 'ปรับ UI แชท', view: 'chat', trustFolder: false });
  await page.evaluate(id => { localStorage.setItem('superai-workspace', id); localStorage.setItem('superai-mode', 'code'); }, workspace.id);
} finally { await app.close(); }
// A saved conversation for that room, read back on the next launch.
const at = Date.now();
await fs.mkdir(path.join(data, 'superai-chats'), { recursive: true });
await fs.writeFile(path.join(data, 'superai-chats', `${session.id}.json`), JSON.stringify({ turns: 1, items: [
  { id: 't1-user', kind: 'user', text: 'ปรับ UI แชทให้ดู minimal เหมือนแชทของ Claude หน่อย', at },
  { id: 't1-tool', kind: 'tool', tool: 'read', title: 'Read App.tsx', status: 'done', at },
  { id: 't1-answer', kind: 'assistant', text: 'ได้ครับ ช่องพิมพ์จะเหลือแถวเดียว: ปุ่มแนบ ช่องข้อความ ไมค์ และปุ่มส่ง\n\nใต้ช่องพิมพ์มีสิทธิ์ทางซ้าย และ Model กับ Effort ทางขวา', at },
  { id: 't1-permission-a', kind: 'permission', requestId: 'a', tool: 'Bash', title: 'รันคำสั่ง', detail: 'npm test', status: 'allowed', at },
  { id: 't1-permission-b', kind: 'permission', requestId: 'b', tool: 'WebFetch', title: 'เปิดเว็บ', detail: 'https://code.claude.com/docs', status: 'pending', at },
] }));

app = await launch();
try {
  const page = await ready(app);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(1366, 768); });
  await page.waitForSelector('.chat-view');
  await page.waitForSelector('.composer-area.chat-minimal');
  const layout = await page.evaluate(() => {
    const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
    return { input: rect('.chat-minimal .composer-input-container'), attach: rect('.chat-minimal .composer-leading'),
      send: rect('.chat-minimal .send-button'), footer: rect('.chat-minimal .session-chat-controls'),
      permission: rect('.chat-minimal .chat-permission-select'), model: rect('.chat-minimal .chat-model-controls') };
  });
  await page.screenshot({ path: path.join(output, '01-chat.png') });
  // Permission cards: an answered one only says what was chosen. A request still open when the app
  // closed can no longer be answered, so it comes back expired and without buttons (the live buttons
  // are covered by permission-popup-smoke).
  const open = page.locator('.chat-scroll .chat-permission.expired');
  await open.waitFor();
  assert.equal(await open.locator('button').count(), 0);
  assert.equal(await page.locator('.chat-permission.allowed button').count(), 0);
  assert.match(await page.locator('.chat-permission.allowed').innerText(), /อนุญาตแล้ว/);
  await open.screenshot({ path: path.join(output, '03-permission.png') });
  for (const key of Object.keys(layout)) assert.ok(layout[key], `${key} is shown`);
  // One row: attach, input and send share a line; the footer sits under it.
  const middle = r => (r.top + r.bottom) / 2;
  assert.ok(Math.abs(middle(layout.attach) - middle(layout.input)) < 12, JSON.stringify(layout));
  assert.ok(Math.abs(middle(layout.send) - middle(layout.input)) < 12, JSON.stringify(layout));
  assert.ok(layout.permission.top >= layout.input.bottom - 2 && layout.model.top >= layout.input.bottom - 2, `footer controls below the input row ${JSON.stringify(layout)}`);
  assert.ok(layout.permission.left < layout.model.left, 'permission left, model right');
  // A notice is a floating toast: the conversation does not move.
  const before = await page.evaluate(() => document.querySelector('.chat-view').getBoundingClientRect().top);
  // "/model" is answered locally (pick it in the footer) — an error without calling any AI.
  await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).fill('/model');
  await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).press('Escape');
  await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).press('Enter');
  await page.waitForSelector('.message-banner.error');
  const toast = await page.evaluate(() => { const r = document.querySelector('.message-banner').getBoundingClientRect(); return { position: getComputedStyle(document.querySelector('.message-banner')).position, width: r.width }; });
  assert.equal(toast.position, 'absolute');
  assert.ok(toast.width <= 520, JSON.stringify(toast));
  assert.equal(await page.evaluate(() => document.querySelector('.chat-view').getBoundingClientRect().top), before);
  await page.screenshot({ path: path.join(output, '02-toast.png') });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, layout, toast, screenshots: output }, null, 2));
} finally { await app.close(); }
