import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve('packages/studio/client/dist');
const output = path.resolve('output/project-usability');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let checks = 0;
const check = (condition, text) => { assert.ok(condition, text); checks++; console.log(`PASS ${text}`); };
try {
  const page = await browser.newPage({ locale: 'th-TH',  viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = [], sends = [], teamSends = [];
  let renameFails = false, contextFails = false, exportFails = false;
  const sockets = new Map();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code');
    localStorage.setItem('superai-canvas-layout-v2', 'tabs'); localStorage.setItem('superai-preview', 'false');
  });
  const workspaces = [{ id: 'project-a', name: 'Alpha', rootPath: output, instructions: 'ตอบภาษาไทย', pinnedFiles: ['notes.md', 'missing.md'], threads: [] }, { id: 'project-b', name: 'Beta', rootPath: output, threads: [] }];
  const sessions = [{ id: 'one', name: 'One', wsId: 'project-a', agentType: 'codex', cwd: output, status: 'exited', dormant: true, view: 'chat', createdAt: 1 }, { id: 'two', name: 'Two', wsId: 'project-a', agentType: 'codex', cwd: output, status: 'exited', dormant: true, view: 'chat', createdAt: 1 }];
  const items = [{ id: 'u1', kind: 'user', text: 'question for export', at: 1 }, { id: 'a1', kind: 'assistant', text: '**answer for export**\n\n' + Array.from({ length: 55 }, (_, index) => `paragraph ${index}: detailed content for scrolling`).join('\n\n'), at: 2 }];
  const context = { text: 'server-owned context', instructions: true, preparedAt: Date.now(), files: [{ path: 'notes.md', source: 'pinned', status: 'included' }, { path: 'missing.md', source: 'pinned', status: 'missing' }] };
  const run = { id: 'run1', wsId: 'project-a', mode: 'chat', prompt: 'team question', output: 'team summary', status: 'completed', createdAt: 3, allowTools: false, activity: [], panel: [{ seat: { name: 'Independent', provider: 'cli:codex', model: '', effort: '' }, status: 'completed', output: 'individual team answer' }] };
  await page.routeWebSocket('**/ws/chat/**', socket => { const id = socket.url().split('/').at(-1); sockets.set(id, socket); socket.send(JSON.stringify({ type: 'snapshot', chat: { items, running: false } })); });
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname, method = route.request().method();
    let json = [];
    if (pathname === '/api/workspaces') json = workspaces;
    else if (pathname === '/api/workspaces/project-a' && method === 'PATCH') { Object.assign(workspaces[0], route.request().postDataJSON()); json = workspaces[0]; }
    else if (pathname === '/api/terminals' || pathname === '/api/sessions') json = sessions;
    else if (pathname === '/api/terminals/spawn') {
      const body = route.request().postDataJSON();
      json = { ...sessions[0], id: 'fresh', name: body.name, wsId: body.wsId, createdAt: Date.now() }; sessions.push(json);
    }
    else if (pathname === '/api/clis') json = [{ id: 'codex', name: 'Codex', command: 'codex', available: true, nodeReady: true, teamSupported: true, maxSessions: 10 }];
    else if (pathname.endsWith('/project-context')) {
      if (contextFails) return route.fulfill({ status: 503, json: { error: 'context temporarily unavailable' } });
      json = context;
    } else if (pathname.endsWith('/name')) {
      if (renameFails) return route.fulfill({ status: 400, json: { error: 'cannot save name now' } });
      const session = sessions.find(item => item.id === pathname.split('/')[3]); session.name = route.request().postDataJSON().name; json = session;
    } else if (pathname.endsWith('/chat/settings')) json = { agent: 'codex', model: 'model-a', effort: 'high', skills: [] };
    else if (pathname.includes('/auth')) json = { status: 'authenticated', note: 'ready', checkedAt: Date.now() };
    else if (pathname.includes('/models')) json = { models: ['model-a'], efforts: ['high'] };
    else if (pathname.endsWith('/context')) json = { cwd: output, isGit: false, branches: [], branch: null };
    else if (pathname.endsWith('/files') || pathname.endsWith('/pinned-content')) json = { files: [] };
    else if (pathname.startsWith('/api/conversations/')) {
      if (method === 'POST') { const body = route.request().postDataJSON(); teamSends.push(body); json = { ...run, id: 'new-run', mode: body.mode, status: 'completed' }; }
      else json = [run];
    } else if (pathname.endsWith('/chat')) {
      if (method === 'POST') { sends.push(route.request().postDataJSON()); json = { success: true }; }
      else {
        if (exportFails) return route.fulfill({ status: 503, json: { error: 'cannot export right now' } });
        json = { items, running: false };
      }
    }
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  const pane = page.locator('[data-session-id="one"]');
  const composer = page.getByLabel('คำสั่ง', { exact: true });
  await page.getByLabel('เป้าหมายคำสั่ง', { exact: true }).selectOption('active');
  await page.locator('.session-tab').filter({ hasText: 'One' }).locator('button').first().click();
  const contextStatus = page.locator('.project-context-status');
  await page.getByRole('button', { name: 'แนบไฟล์', exact: true }).click();
  await page.getByRole('menuitem', { name: 'บริบทและไฟล์ปักหมุด', exact: true }).click();
  await contextStatus.locator('summary').click();
  await contextStatus.getByText('ไม่พบไฟล์', { exact: true }).waitFor();
  check(await contextStatus.innerText().then(text => text.includes('notes.md') && text.includes('พร้อมแนบ') && text.includes('missing.md')), 'project context lists included and missing files instead of claiming all pins are usable');
  contextFails = true;
  await contextStatus.getByRole('button', { name: 'ตรวจอีกครั้ง' }).click();
  await contextStatus.getByRole('alert').waitFor();
  check(true, 'context lookup failures are visible and can be retried');
  contextFails = false;
  await contextStatus.getByRole('button', { name: 'ตรวจอีกครั้ง' }).click();
  await contextStatus.getByText('พร้อมแนบ', { exact: true }).waitFor();
  const shortFiles = context.files;
  context.files = [...shortFiles, ...Array.from({ length: 80 }, (_, index) => ({ path: `document-${index}.md`, source: 'pinned', status: 'included' }))];
  await contextStatus.getByRole('button', { name: 'ตรวจอีกครั้ง' }).click();
  await contextStatus.getByText('document-79.md', { exact: true }).waitFor();
  check(await contextStatus.locator('.project-context-details').evaluate(element => element.clientHeight <= 244 && element.scrollHeight > element.clientHeight), 'a long context list scrolls internally instead of covering the composer');
  context.files = shortFiles;
  await page.screenshot({ path: path.join(output, 'context-desktop.png') });
  await contextStatus.locator('summary').click();

  await page.getByTitle('จัดการโปรเจกต์ Alpha', { exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มในโปรเจกต์โปรด', exact: true }).click();
  await page.locator('.project-favorite-mark').waitFor();
  await page.getByRole('button', { name: 'โปรเจกต์โปรด', exact: true }).click();
  check(await page.locator('.project-list .project-group').count() === 1 && await page.locator('.project-list').innerText().then(text => text.includes('Alpha') && !text.includes('Beta')), 'favorite filter retains only the starred project');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('.project-favorite-mark').count() === 1, 'favorite project is restored from the API after reload');

  const options = page.locator('.session-chat-controls .composer-options > summary');
  await options.click();
  await page.getByLabel('รูปแบบคำตอบ', { exact: true }).selectOption('concise');
  await page.keyboard.press('Escape');
  await composer.fill('style question');
  await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="คำสั่ง"]')?.value === '');
  check(sends.length === 1 && sends[0].responseStyle === 'concise' && sends[0].text === 'style question', 'Code response style reaches the request without polluting the user question');
  await page.reload({ waitUntil: 'networkidle' });
  await options.click();
  check(await page.getByLabel('รูปแบบคำตอบ', { exact: true }).inputValue() === 'concise', 'Code response style persists across reload');
  await page.keyboard.press('Escape');
  await pane.getByRole('button', { name: 'เปลี่ยนชื่อห้อง', exact: true }).click();
  await page.getByLabel('ชื่อห้องใหม่').fill('Canonical · room');
  renameFails = true;
  await page.getByRole('button', { name: 'บันทึกชื่อ', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'cannot save name now' }).waitFor();
  check(await page.getByLabel('ชื่อห้องใหม่').inputValue() === 'Canonical · room', 'failed rename preserves the proposed name for retry');
  renameFails = false;
  await page.getByRole('button', { name: 'บันทึกชื่อ', exact: true }).click();
  await page.getByLabel('ชื่อห้องใหม่').waitFor({ state: 'hidden' });
  check(await page.locator('.project-sessions').innerText().then(text => text.includes('Canonical · room')) && await page.locator('.session-tabs').innerText().then(text => text.includes('Canonical · room')), 'renamed session appears consistently in tabs and sidebar');
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'ค้นหาคำสั่งด่วน' }).getByLabel('ค้นหาคำสั่งด่วน').fill('Canonical');
  check(await page.getByRole('option').filter({ hasText: 'Canonical · room' }).count() === 1, 'command search uses the canonical session name');
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('.session-tabs').innerText().then(text => text.includes('Canonical · room')), 'canonical name survives reload');
  await page.getByRole('button', { name: 'ค้นหาประวัติ', exact: true }).click();
  await page.getByRole('dialog').getByText('Canonical · room', { exact: true }).waitFor();
  check(true, 'recent history uses the same canonical name');
  await page.keyboard.press('Escape');

  const exportMenu = pane.locator('.conversation-export');
  await exportMenu.locator('summary').click();
  let downloading = page.waitForEvent('download');
  await exportMenu.getByRole('button', { name: 'Markdown (.md)', exact: true }).click();
  let download = await downloading;
  let content = await fs.readFile(await download.path(), 'utf8');
  check(download.suggestedFilename() === 'Canonical · room.md' && content.includes('question for export') && content.includes('**answer for export**'), 'Markdown download includes the selected conversation with its canonical name');
  await exportMenu.locator('summary').click();
  downloading = page.waitForEvent('download');
  await exportMenu.getByRole('button', { name: 'JSON (.json)', exact: true }).click();
  download = await downloading; content = await fs.readFile(await download.path(), 'utf8');
  check(JSON.parse(content).items.length === 2 && JSON.parse(content).schemaVersion === 1, 'JSON download retains structured conversation items');
  exportFails = true;
  await exportMenu.locator('summary').click();
  await exportMenu.getByRole('button', { name: 'Markdown (.md)', exact: true }).click();
  await exportMenu.getByRole('alert').waitFor();
  check(true, 'failed export leaves an actionable error instead of downloading an empty file');
  exportFails = false; await page.keyboard.press('Escape');

  const scroller = pane.locator('.chat-scroll');
  await scroller.evaluate(element => { element.scrollTop = 0; });
  await pane.getByRole('button', { name: 'กลับข้อความล่าสุด', exact: true }).waitFor();
  const before = await scroller.evaluate(element => element.scrollTop);
  sockets.get('one').send(JSON.stringify({ type: 'item', item: { ...items[1], text: items[1].text + '\n\nnewly streamed answer' } }));
  await pane.getByRole('button', { name: 'กลับข้อความล่าสุด', exact: true }).getByText('มีข้อความใหม่ · กลับล่าสุด', { exact: true }).waitFor();
  check(await scroller.evaluate(element => element.scrollTop) <= before + 2, 'new output does not pull a reader away from earlier content');
  await page.screenshot({ path: path.join(output, 'reading-desktop.png') });
  await pane.getByRole('button', { name: 'กลับข้อความล่าสุด', exact: true }).click();
  check(await scroller.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight) < 3, 'return-to-latest reaches the end and resumes following');
  await scroller.evaluate(element => { element.scrollTop = 0; });
  await page.keyboard.press('Control+f');
  await pane.getByLabel('คำค้นหาในบทสนทนา').fill('paragraph');
  check(await pane.getByRole('button', { name: 'กลับข้อความล่าสุด', exact: true }).count() === 0, 'return-to-latest stays out of the way while searching');
  await pane.getByLabel('คำค้นหาในบทสนทนา').press('Escape');
  const modes = page.getByRole('navigation', { name: 'โหมดทำงาน' });
  await modes.getByRole('button', { name: 'Chat', exact: true }).click();
  const teamOptions = page.locator('.composer-options').filter({ has: page.getByLabel('ตัวเลือกคำตอบ', { exact: true }) });
  await teamOptions.locator('summary').click();
  await page.getByLabel('รูปแบบคำตอบ', { exact: true }).selectOption('explanatory');
  await page.keyboard.press('Escape');
  await composer.fill('team style question');
  await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="คำสั่ง"]')?.value === '');
  check(teamSends[0]?.responseStyle === 'explanatory', 'comparison chat sends its independently selected response style');
  const teamExport = page.locator('.canvas-heading .conversation-export');
  await teamExport.locator('summary').click();
  downloading = page.waitForEvent('download');
  await teamExport.getByRole('button', { name: 'Markdown (.md)', exact: true }).click();
  download = await downloading; content = await fs.readFile(await download.path(), 'utf8');
  check(content.includes('individual team answer') && content.includes('team summary'), 'team export includes individual answers as well as the summary');
  await modes.getByRole('button', { name: 'Agent', exact: true }).click();
  await teamOptions.locator('summary').click();
  check(await page.getByLabel('รูปแบบคำตอบ', { exact: true }).inputValue() === 'normal', 'Agent style is isolated from Chat style in the same project');
  await page.getByLabel('รูปแบบคำตอบ', { exact: true }).selectOption('concise');
  await page.keyboard.press('Escape');
  await composer.fill('agent style question');
  await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="คำสั่ง"]')?.value === '');
  check(teamSends.at(-1)?.mode === 'agent' && teamSends.at(-1)?.responseStyle === 'concise', 'Agent sends its selected response style');
  await modes.getByRole('button', { name: 'Chat', exact: true }).click();
  await teamOptions.locator('summary').click();
  check(await page.getByLabel('รูปแบบคำตอบ', { exact: true }).inputValue() === 'explanatory', 'returning to Chat restores its response style');
  await page.setViewportSize({ width: 1024, height: 768 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'new controls do not overflow a laptop viewport');
  await page.screenshot({ path: path.join(output, 'options-laptop.png') });
  await page.keyboard.press('Escape');
  await modes.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'บทสนทนาใหม่', exact: true }).click();
  await page.locator('.quick-chat-controls .composer-options > summary').click();
  await page.getByLabel('รูปแบบคำตอบ', { exact: true }).selectOption('explanatory');
  await page.keyboard.press('Escape');
  await composer.fill('new conversation style question');
  await page.getByRole('button', { name: 'ส่งคำสั่ง (Enter)', exact: true }).click();
  await page.locator('[data-session-id="fresh"].focused').waitFor();
  check(sends.at(-1)?.responseStyle === 'explanatory' && sends.at(-1)?.text === 'new conversation style question', 'a quick first message uses the selected style');
  await page.locator('.session-chat-controls .composer-options > summary').click();
  check(await page.getByLabel('รูปแบบคำตอบ', { exact: true }).inputValue() === 'explanatory', 'the new session retains its first-message response style');
  check(errors.length === 0, `no renderer exceptions: ${errors.join('; ')}`);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
