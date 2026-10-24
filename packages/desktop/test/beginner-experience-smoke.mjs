import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/beginner-experience');
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
let checks = 0;
const errors = [];
const check = (value, message) => { assert.ok(value, message); checks++; console.log('PASS ' + message); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code'); localStorage.setItem('superai-preview', 'false'); });
  const workspaces = [{ id: 'first', name: 'งานของฉัน', rootPath: output, threads: [] }, { id: 'second', name: 'งานอื่น', rootPath: output, threads: [] }];
  const sessions = [], spawns = [], sends = [], installs = [], searches = [], toolInstalls = [];
  const clis = ['codex', 'claude-code', 'antigravity'].map(id => ({ id, name: id === 'codex' ? 'ChatGPT (Codex)' : id === 'claude-code' ? 'Claude' : 'Antigravity', available: true, nodeReady: true, maxSessions: 10, teamSupported: true, command: id }));
  const catalog = ['frontend-design', 'webapp-testing', 'find-skills'].map(name => ({ name, source: 'anthropic', sourceLabel: 'Anthropic', description: 'ความสามารถเสริมสำหรับงานตัวอย่าง', files: ['SKILL.md'], url: 'https://github.com/anthropics/skills' }));
  let failSearch = false, nodeReady = true, gitReady = true, nodeFailure = false;
  let jobs = [];
  await page.routeWebSocket('**/ws/chat/**', socket => socket.send(JSON.stringify({ type: 'snapshot', chat: { items: [], running: false } })));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), pathname = url.pathname, method = route.request().method();
    let json = [];
    if (pathname === '/api/workspaces') {
      if (method === 'POST') { json = { id: 'added', ...route.request().postDataJSON(), threads: [] }; workspaces.push(json); }
      else json = workspaces;
    } else if (pathname === '/api/health') json = { pty: true };
    else if (pathname === '/api/clis') json = clis;
    else if (pathname === '/api/terminals') json = sessions;
    else if (pathname === '/api/terminals/spawn') {
      const body = route.request().postDataJSON(); spawns.push(body);
      json = { id: 'created', ...body, agentType: body.agentType, status: 'running', view: 'chat', cwd: output, createdAt: Date.now() }; sessions.push(json);
    } else if (pathname === '/api/node/status') {
      if (nodeFailure) return route.fulfill({ status: 503, json: { error: 'Node check unavailable' } });
      json = { installed: nodeReady, ready: nodeReady, version: nodeReady ? 'v24.22.1' : null, major: nodeReady ? 24 : null };
    } else if (pathname === '/api/git/status') json = { required: true, installed: gitReady, version: gitReady ? '2.54.0' : null };
    else if (pathname === '/api/node/install') { toolInstalls.push('node'); jobs = [{ id: 'node-job', cliId: 'node', status: 'running', log: '' }]; json = jobs[0]; }
    else if (pathname === '/api/git/install') { toolInstalls.push('git'); gitReady = true; jobs = [{ id: 'git-job', cliId: 'git', status: 'completed', log: '' }]; json = jobs[0]; }
    else if (pathname === '/api/cli-installs') json = jobs;
    else if (pathname.includes('/auth')) {
      const id = pathname.split('/')[3];
      json = { id, status: id === 'antigravity' ? 'unknown' : id === 'claude-code' ? 'login-required' : 'authenticated', note: id === 'codex' ? 'เข้าสู่ระบบแล้ว' : 'เชื่อมต่อบัญชีเพื่อเริ่มใช้งาน', checkedAt: Date.now() };
    } else if (pathname === '/api/skills/catalog') json = catalog;
    else if (pathname === '/api/skills/search') {
      searches.push(url.searchParams.get('q'));
      if (failSearch) return route.fulfill({ status: 503, json: { error: 'ค้นหาบน skills.sh ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง' } });
      json = url.searchParams.get('q') === 'no-match' ? [] : [{ ...catalog[0], name: 'search-result', source: 'skills.sh', sourceLabel: 'skills.sh (fixture/repo)', repo: 'fixture/repo' }];
    } else if (/\/workspaces\/[^/]+\/skills$/.test(pathname)) {
      if (method === 'POST') { installs.push(route.request().postDataJSON()); json = { success: true }; }
      else json = installs.map(item => ({ name: item.name, source: item.source, managed: true, targets: ['.claude/skills', '.agents/skills'] }));
    } else if (pathname.endsWith('/chat/settings')) json = { agent: 'codex', model: '', effort: '', skills: [] };
    else if (pathname.endsWith('/chat') && method === 'POST') { sends.push(route.request().postDataJSON()); json = { success: true }; }
    else if (pathname.match(/\/providers\/[^/]+\/models/)) json = { models: ['model-a'], efforts: ['low', 'high'] };
    else if (pathname === '/api/ollama/models') json = { models: [] };
    return route.fulfill({ json });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base, { waitUntil: 'networkidle' });
  const setup = page.getByRole('dialog', { name: 'เริ่มต้นใช้งาน SuperAi', exact: true });
  const openSetup = async () => { await page.getByRole('button', { name: 'เริ่มต้นใช้งาน', exact: true }).click(); await setup.waitFor(); };
  await openSetup();
  await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).waitFor();
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(el => el.textContent === 'ถัดไป: เริ่มคุย')?.disabled);
  check(await setup.locator('.beginner-steps li').count() === 3, 'onboarding presents three understandable steps');
  check(await setup.locator('.provider-access').count() === 1, 'only the chosen assistant account is shown');
  check(await setup.locator('.model-combo:visible').count() === 0, 'model and effort controls are not required before starting');
  check(toolInstalls.length === 0 && spawns.length === 0 && sends.length === 0, 'opening setup does not install, spawn or send anything');
  await page.screenshot({ path: path.join(output, 'connect-assistant.png') });
  await setup.getByLabel('ผู้ช่วยสำหรับเริ่มต้น', { exact: true }).selectOption('antigravity');
  await setup.getByRole('checkbox').waitFor();
  check(await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).isDisabled(), 'unknown account status is not reported as automatically verified');
  await setup.getByRole('checkbox').check();
  check(await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).isEnabled(), 'user can acknowledge login when automatic account detection is unavailable');
  await setup.getByLabel('ผู้ช่วยสำหรับเริ่มต้น', { exact: true }).selectOption('claude-code');
  await page.waitForFunction(() => [...document.querySelectorAll('.provider-access')].some(el => el.classList.contains('login-required')));
  check(await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).isDisabled(), 'acknowledging one provider does not unlock another signed-out provider');
  await setup.getByLabel('ผู้ช่วยสำหรับเริ่มต้น', { exact: true }).selectOption('codex');
  await setup.locator('.beginner-steps button').nth(0).click();
  await setup.getByRole('button', { name: 'เพิ่มโฟลเดอร์อื่น', exact: true }).click();
  const project = page.getByRole('dialog', { name: 'เพิ่มโปรเจกต์', exact: true });
  await project.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await setup.waitFor();
  check(true, 'canceling folder selection returns to the getting-started flow');
  await setup.locator('.beginner-steps button').nth(0).click();
  await setup.getByRole('button', { name: 'เพิ่มโฟลเดอร์อื่น', exact: true }).click();
  await project.getByRole('textbox').first().fill('โฟลเดอร์ใหม่');
  await project.getByLabel('โฟลเดอร์โปรเจกต์', { exact: true }).fill(path.join(output, 'new-work'));
  await project.getByRole('button', { name: 'บันทึกโปรเจกต์', exact: true }).click();
  await setup.waitFor();
  await setup.locator('.beginner-steps button').nth(0).click();
  check(await setup.getByLabel('โฟลเดอร์ทำงาน', { exact: true }).inputValue() === 'added', 'saving a new project returns to setup with the new folder selected');
  await setup.getByLabel('โฟลเดอร์ทำงาน', { exact: true }).selectOption('second');
  await setup.getByRole('button', { name: 'ถัดไป: เลือก AI', exact: true }).click();
  await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).click();
  await setup.getByRole('button', { name: 'ช่วยอธิบายว่าไฟล์ในโฟลเดอร์นี้มีไว้ทำอะไร โดยยังไม่แก้ไฟล์', exact: true }).click();
  check((await setup.getByLabel('ข้อความแรก', { exact: true }).inputValue()).includes('โดยยังไม่แก้ไฟล์'), 'a beginner example fills an editable draft');
  await page.screenshot({ path: path.join(output, 'first-message.png') });
  await page.setViewportSize({ width: 700, height: 760 });
  check(await setup.evaluate(el => el.scrollWidth <= el.clientWidth), 'setup content fits a narrower window');
  check(await setup.getByRole('button', { name: 'เปิดห้องคุยกับ AI', exact: true }).evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'the primary start action stays visible in a shorter window');
  await page.screenshot({ path: path.join(output, 'first-message-narrow.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup.getByRole('button', { name: 'เปิดห้องคุยกับ AI', exact: true }).click();
  await setup.waitFor({ state: 'hidden' });
  check(spawns.length === 1 && spawns[0].wsId === 'second' && spawns[0].agentType === 'codex', 'first conversation opens one chosen assistant in the selected workspace');
  check(sends.length === 0 && (await page.getByLabel('คำสั่ง', { exact: true }).inputValue()).includes('โดยยังไม่แก้ไฟล์'), 'opening a conversation never sends the first prompt automatically');
  await page.getByLabel('คำสั่ง', { exact: true }).fill('ร่างเดิมยังไม่ส่ง');
  await openSetup();
  await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).click();
  await setup.getByLabel('ข้อความแรก', { exact: true }).fill('ข้อความใหม่จากหน้าช่วยเริ่ม');
  await setup.getByRole('button', { name: 'เปิดห้องคุยกับ AI', exact: true }).click();
  await setup.waitFor({ state: 'hidden' });
  check(spawns.length === 1, 'reopening setup reuses an existing running assistant');
  check((await page.getByLabel('คำสั่ง', { exact: true }).inputValue()).includes('ร่างเดิมยังไม่ส่ง\n\nข้อความใหม่จากหน้าช่วยเริ่ม') && sends.length === 0, 'returning to an existing conversation preserves its unsent draft');
  await page.getByRole('button', { name: 'Skills', exact: true }).first().click();
  const skills = page.getByRole('dialog', { name: 'Skills ของโปรเจกต์', exact: true });
  await skills.getByRole('button', { name: 'ค้นหาบน skills.sh', exact: true }).click();
  await skills.locator('.skill-card').first().waitFor();
  check(searches.length === 0 && await skills.locator('.skill-card').count() === catalog.length, 'skills.sh tab displays starter catalog items immediately without requiring a query');
  check(installs.length === 0, 'showing starter skills never installs them automatically');
  check(await skills.locator('.skills-recommend').getAttribute('open') === null, 'AI-assisted recommendations stay optional and collapsed');
  await page.screenshot({ path: path.join(output, 'skills-starters.png') });
  await skills.locator('.skill-card').first().getByRole('button', { name: 'ติดตั้ง', exact: true }).click();
  await skills.getByText('ติดตั้งแล้ว', { exact: true }).waitFor();
  check(installs.length === 1 && installs[0].name === 'frontend-design', 'a specific skill installs only after its Install button is clicked');
  failSearch = true;
  await skills.getByRole('button', { name: 'ออกแบบเว็บ', exact: true }).click();
  await skills.getByRole('alert').waitFor();
  check(searches.at(-1) === 'frontend' && !(await skills.innerText()).includes('ไม่พบ skill ที่ตรงกับคำค้นหา'), 'category search reports connectivity failure instead of claiming no matches');
  failSearch = false;
  await skills.getByRole('button', { name: 'ลองค้นหาอีกครั้ง', exact: true }).click();
  await skills.locator('.skill-card strong').filter({ hasText: 'search-result' }).waitFor();
  check(searches.length === 2, 'search can retry without losing its submitted query');
  await skills.getByLabel('ค้นหาบน skills.sh', { exact: true }).fill('no-match');
  await skills.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await skills.getByText(/ไม่พบ skill ที่ตรงกับคำค้นหา "no-match"/).waitFor();
  await skills.getByLabel('ค้นหาบน skills.sh', { exact: true }).fill('new-unsent-query');
  check((await skills.innerText()).includes('"no-match"'), 'empty result description stays tied to the actual submitted query');
  await skills.getByRole('button', { name: 'กลับรายการเริ่มต้น', exact: true }).click();
  check(await skills.locator('.skill-card').count() === catalog.length, 'clearing search restores installable starter items');
  await skills.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await skills.waitFor({ state: 'hidden' });
  nodeReady = false; gitReady = false;
  await openSetup();
  const installNode = setup.getByRole('button', { name: 'ติดตั้งเครื่องมือพื้นฐาน', exact: true });
  await installNode.waitFor();
  check(toolInstalls.length === 0, 'missing prerequisites still require an explicit install action');
  await installNode.click();
  check(await installNode.isDisabled(), 'install cannot be started again while its job runs');
  nodeReady = true; jobs[0].status = 'completed';
  await setup.getByRole('button', { name: 'ติดตั้งเครื่องมือจัดการไฟล์', exact: true }).click();
  await setup.getByRole('button', { name: 'ถัดไป: เริ่มคุย', exact: true }).waitFor();
  check(JSON.stringify(toolInstalls) === JSON.stringify(['node', 'git']), 'prerequisite actions proceed in order with no real installation');
  await setup.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await setup.waitFor({ state: 'hidden' });
  nodeFailure = true;
  await openSetup();
  await setup.getByRole('alert').waitFor();
  await setup.locator('.beginner-steps button').nth(2).click();
  check(await setup.getByRole('button', { name: 'เปิดห้องคุยกับ AI', exact: true }).isDisabled(), 'failed readiness checks cannot incorrectly mark setup ready');
  check(errors.length === 0, 'no renderer errors: ' + errors.join('; '));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
