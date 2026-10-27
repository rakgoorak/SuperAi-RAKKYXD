import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root = path.resolve('packages/studio/client/dist'), output = path.resolve('output/composer-balanced');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, new URL(req.url, 'http://localhost').pathname === '/' ? 'index.html' : '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`PASS ${label}`); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = [], sent = [], cancelled = [], sockets = new Map();
  let modelReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code');
    localStorage.setItem('superai-canvas-layout-v2', 'tabs'); localStorage.setItem('superai-preview', 'false');
  });
  const workspace = { id: 'ws', name: 'AgentBuild', rootPath: 'D:/AgentBuild', instructions: 'กฎโปรเจกต์ที่บันทึกไว้', pinnedFiles: ['README.md'], threads: [] };
  const sessions = ['Codex · gpt-6.1-sol', 'ตอนนี้โปรแกรมเรายังขาดฟังก์ชันอะไรอีกไหมครับช่วยตรวจสอบให้หน่อย'].map((name, index) => ({ id: `room-${index}`, wsId: 'ws', name, agentType: index ? 'claude-code' : 'codex', status: 'exited', dormant: true, view: 'chat', cwd: workspace.rootPath, createdAt: 1 }));
  await page.routeWebSocket('**/ws/chat/**', socket => {
    sockets.set(socket.url().split('/').at(-1), socket);
    socket.send(JSON.stringify({ type: 'snapshot', chat: { items: [{ id: 'answer', kind: 'assistant', text: 'พื้นที่สำหรับบทสนทนา\n\nช่องพิมพ์ด้านล่างเหลือเฉพาะสิ่งที่ใช้บ่อย', at: Date.now() }], running: false } }));
  });
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname, method = route.request().method();
    let json = [];
    if (pathname === '/api/workspaces') json = [workspace];
    else if (pathname === '/api/terminals' || pathname === '/api/sessions') json = sessions;
    else if (pathname === '/api/clis') json = ['codex', 'claude-code'].map(id => ({ id, name: id, available: true, nodeReady: true, maxSessions: 10, teamSupported: true }));
    else if (pathname.endsWith('/chat/settings')) json = { agent: pathname.includes('room-1') ? 'claude-code' : 'codex', model: pathname.includes('room-1') ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'medium', skills: [] };
    else if (pathname.includes('/auth')) json = { status: 'authenticated', note: 'ready', checkedAt: Date.now() };
    else if (pathname.includes('/models')) json = { models: ['gpt-6.1-sol', 'claude-opus-5-5', ...(++modelReads > 1 ? ['gpt-6.1-terra'] : [])], efforts: ['low', 'medium', 'high'] };
    else if (pathname.endsWith('/context') || pathname.endsWith('/branches')) json = { cwd: workspace.rootPath, git: 'ready', branch: 'main', commit: null, branches: ['main', 'feature/composer'] };
    else if (pathname.endsWith('/project-context')) json = { text: 'rules', instructions: true, files: [{ path: 'README.md', source: 'pinned', status: 'included' }], preparedAt: Date.now() };
    else if (pathname.endsWith('/pinned-content')) json = { files: [{ path: 'README.md', name: 'README.md', content: 'notes', size: 5 }] };
    else if (pathname.endsWith('/files')) json = { files: ['README.md', 'src/App.tsx'] };
    else if (pathname.endsWith('/chat/cancel')) { cancelled.push(pathname); json = { success: true }; sockets.get(pathname.split('/')[3])?.send(JSON.stringify({ type: 'state', running: false })); }
    else if (pathname.endsWith('/chat')) {
      if (method === 'POST') { sent.push({ id: pathname.split('/')[3], ...route.request().postDataJSON() }); json = { success: true }; }
      else json = { items: [], running: false };
    }
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  await page.locator('.session-tab').filter({ hasText: 'Codex ·' }).locator('button').first().click();
  const composer = page.getByLabel('คำสั่ง', { exact: true });
  const footer = page.getByLabel('การตั้งค่าข้อความ', { exact: true });
  await footer.getByLabel('Model ในแชท Codex · gpt-6.1-sol', { exact: true }).waitFor();
  await page.locator('.chat-model-controls .model-combo-toggle').click();
  await page.getByRole('option', { name: 'gpt-6.1-terra', exact: true }).waitFor();
  check(modelReads > 1, 'opening the model picker refreshes the provider catalog without restarting');
  check(await footer.getByLabel('Model ในแชท Codex · gpt-6.1-sol', { exact: true }).inputValue() === 'gpt-6.1-sol', 'refreshing the model catalog preserves the selected model');
  await page.keyboard.press('Escape');
  check(!await page.getByRole('region', { name: 'บริบทและการทำงาน', exact: true }).isVisible(), 'project context starts folded without a floating pin row');
  check(await composer.getAttribute('placeholder') === 'พิมพ์ข้อความ…', 'short placeholder is independent of the room title');
  check(await page.getByTitle('หยุดคำสั่ง (Ctrl+C)', { exact: true }).isHidden(), 'idle writing surface omits the unavailable Stop action');
  const geometry = async () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    return { box:rect('.composer-box'), area:rect('.composer-area'), field:rect('textarea[aria-label="คำสั่ง"]'), plus:rect('.attach-menu>button'), mic:rect('.dictation-button'), footer:rect('.composer-meta'), folder:rect('.composer-folder'), branch:rect('.composer-branch'), permission:rect('.chat-permission-select'), model:rect('.chat-model-controls input'), effort:rect('.chat-effort-select'), options:rect('.session-chat-controls .composer-options>summary') };
  });
  let layout = await geometry();
  check(layout.box.height <= 60 && layout.area.height <= 115, `idle desktop composer fits a writing row and a metadata row: ${JSON.stringify(layout)}`);
  const middle = rect => rect.y + rect.height / 2;
  check(Math.abs(middle(layout.field) - middle(layout.plus)) < 4 && Math.abs(middle(layout.field) - middle(layout.mic)) < 4, 'attach, writing and microphone align in the same row');
  check(layout.footer.y >= layout.box.bottom && Math.abs(middle(layout.folder) - middle(layout.model)) < 4 && Math.abs(middle(layout.branch) - middle(layout.permission)) < 4, 'folder, branch, permission and model occupy one aligned footer');
  check(layout.folder.x < layout.permission.x && layout.permission.x < layout.model.x, 'work context stays left while model controls stay right');
  check(await page.locator('.composer-box .composer-target').count() === 0 && await page.locator('.composer-box .session-chat-controls').count() === 0, 'recipient and model controls do not compete with the writing field');
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  const plus = page.getByRole('button', { name: 'แนบไฟล์', exact: true });
  await plus.click(); await page.getByRole('menuitem', { name: 'บริบทและไฟล์ปักหมุด', exact: true }).click();
  const panel = page.getByRole('region', { name: 'บริบทและการทำงาน', exact: true });
  await panel.getByTitle('ปักหมุดไฟล์เป็น Context ให้ AI อัตโนมัติ', { exact: true }).click();
  await panel.getByRole('button').filter({ hasText: 'App.tsx' }).waitFor();
  check(await panel.isVisible() && await panel.getByText('กฎโปรเจกต์: กฎโปรเจกต์ที่บันทึกไว้').isVisible(), 'plus opens the retained project rules and pin controls');
  await panel.getByRole('button', { name: 'ปิดบริบทและการทำงาน', exact: true }).click();
  await plus.click(); await page.getByRole('menuitem', { name: 'ขยายช่องพิมพ์', exact: true }).click();
  check(await composer.evaluate(element => element.getBoundingClientRect().height) >= 110, 'larger writing area remains available from plus');
  await plus.click(); await page.getByRole('menuitem', { name: 'ย่อช่องพิมพ์', exact: true }).click();
  await composer.fill('draft stays while changing the model');
  await footer.getByLabel('Effort ในแชท Codex · gpt-6.1-sol').selectOption('high');
  await footer.getByLabel('สิทธิ์ของ Codex · gpt-6.1-sol ในข้อความถัดไป').selectOption('read');
  await footer.getByLabel('เป้าหมายคำสั่ง', { exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="คำสั่ง"]').value === '');
  check(sent.length === 1 && sent[0].effort === 'high' && sent[0].permission === 'read', 'footer settings reach the same selected chat request');
  sockets.get('room-0').send(JSON.stringify({ type: 'state', running: true }));
  await page.getByTitle('หยุดคำสั่ง (Ctrl+C)', { exact: true }).waitFor();
  check(await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).isHidden(), 'idle busy composer presents Stop instead of a disabled Send');
  await page.getByTitle('หยุดคำสั่ง (Ctrl+C)', { exact: true }).click();
  check(cancelled[0] === '/api/terminals/room-0/chat/cancel', 'Stop still targets the current chat');
  await page.getByLabel('เลือกโฟลเดอร์ทำงาน').click();
  await page.getByRole('dialog', { name: 'เลือกโฟลเดอร์', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByLabel('เลือก Git branch').click();
  await page.getByRole('dialog', { name: 'เลือก branch', exact: true }).waitFor();
  check(true, 'folder and branch menus remain operable from the single footer');
  await page.keyboard.press('Escape');
  await page.locator('.session-tab').filter({ hasText: 'ตอนนี้โปรแกรม' }).locator('button').first().click();
  check(await composer.getAttribute('placeholder') === 'พิมพ์ข้อความ…', 'long conversation names do not turn into long placeholders');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: path.join(output, 'laptop.png') });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'laptop viewport has no horizontal overflow');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('.right-dock:visible').waitFor();
  const narrow = await geometry();
  check(Math.abs(middle(narrow.field) - middle(narrow.mic)) < 4 && narrow.box.height <= 60, 'narrow preview keeps writing and actions on the same row');
  check(Math.abs(middle(narrow.permission) - middle(narrow.options)) < 4, 'narrow metadata wraps into two complete rows without a stranded options icon');
  const footerBounds = await footer.boundingBox();
  check(footerBounds.x >= 0 && footerBounds.x + footerBounds.width <= 1024 && await composer.isVisible(), 'narrow preview pane retains the writing area and metadata controls');
  await page.screenshot({ path: path.join(output, 'preview.png') });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const modes = page.getByRole('navigation', { name: 'โหมดทำงาน' });
  await modes.getByRole('button', { name: 'Chat', exact: true }).click();
  check(await composer.evaluate(element => element.getBoundingClientRect().height) <= 60, 'comparison chat uses the same compact writing surface');
  const teamBox = await page.locator('.composer-box').boundingBox(), teamSend = await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).boundingBox();
  check(teamSend.x > teamBox.x + teamBox.width - 60, 'comparison chat keeps Send at the trailing edge of the field');
  await page.screenshot({ path: path.join(output, 'team-chat.png') });
  await modes.getByRole('button', { name: 'Agent', exact: true }).click();
  check(await composer.evaluate(element => element.getBoundingClientRect().height) <= 60, 'Agent uses the same compact writing surface');
  check(errors.length === 0, `no renderer errors: ${errors.join('; ')}`);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors, layout }, null, 2));
  console.log(JSON.stringify({ checks, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
