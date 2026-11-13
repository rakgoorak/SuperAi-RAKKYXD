// Computer use, end to end on the real desktop: the tools refuse while the switch is off; once on,
// the AI sees the screen, clicks the app's own message box and types into it with real OS input
// (Thai included), presses keys, and the switch is turned off again. Moves the real mouse briefly.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeApp, stepper, watchdog, watchPage } from './smoke-harness.mjs';

const require = createRequire(import.meta.url), steps = stepper('computer-use');
const output = path.resolve('output/computer-use');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'profile-'));
let desktop, mcp;
const guard = watchdog(120000, steps, () => closeApp(desktop, steps));
try {
  steps.step('launch app');
  desktop = await electron.launch({ executablePath: require('electron'), args: [path.resolve('packages/desktop/test/browser-tools-main.mjs')], env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000 });
  const page = await desktop.firstWindow();
  watchPage(page, steps);
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => { for (const key of ['superai-setup-dismissed', 'superai-tour-dismissed', 'superai-tutorial-dismissed']) localStorage.setItem(key, '1'); });
  await page.reload(); await page.waitForSelector('.app-shell');
  await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.isVisible()); w.setBounds({ x: 60, y: 40, width: 1200, height: 640 }); w.show(); w.focus(); });
  await page.waitForTimeout(600);

  let launch = null;
  for (let i = 0; i < 50 && !launch; i++) { launch = await desktop.evaluate(() => globalThis.superaiBrowserTools.browserMcpLaunch()); if (!launch) await new Promise((r) => setTimeout(r, 100)); }
  mcp = spawn(launch.command, launch.args, { env: { ...process.env, ...launch.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = ''; const waiting = new Map();
  mcp.stdout.on('data', (chunk) => { buffer += chunk; for (let i; (i = buffer.indexOf('\n')) >= 0;) { const m = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1); waiting.get(m.id)?.(m); } });
  let next = 0;
  const rpc = (method, params) => new Promise((resolve) => { const id = ++next; waiting.set(id, resolve); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).result;
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
  const tools = (await rpc('tools/list', {})).result.tools.map((t) => t.name);
  assert.ok(tools.includes('computer_screenshot') && tools.includes('computer_click') && tools.includes('computer_type'));

  steps.step('off by default: the tools refuse');
  const refused = await call('computer_screenshot');
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /turned off/);

  steps.step('turn it on from Settings and see the screen');
  assert.deepEqual(await page.evaluate(() => window.superai.computer('set', true)), { enabled: true });
  const shot = await call('computer_screenshot');
  assert.ok(!shot.isError, shot.content?.[0]?.text);
  assert.equal(shot.content[1].type, 'image');
  await fs.writeFile(path.join(output, 'screen.png'), Buffer.from(shot.content[1].data, 'base64'));
  const [, w] = /Screen (\d+)x(\d+)/.exec(shot.content[0].text).map(Number);

  steps.step('click the message box and type with real input');
  const composer = page.getByLabel('คำสั่ง', { exact: true });
  await composer.fill('');
  const point = await page.evaluate(() => { const r = document.querySelector('textarea[aria-label="คำสั่ง"]').getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
  const where = await desktop.evaluate(({ BrowserWindow, screen }) => { const win = BrowserWindow.getAllWindows().filter((x) => x.isVisible()).sort((a, b) => b.getBounds().width - a.getBounds().width)[0]; const d = screen.getPrimaryDisplay(); return { content: win.getContentBounds(), scaleFactor: d.scaleFactor, width: d.size.width }; });
  const toShot = (dip) => Math.round(dip * where.scaleFactor * w / (where.width * where.scaleFactor));
  const x = toShot(where.content.x + point.x), y = toShot(where.content.y + point.y);
  const clicked = await call('computer_click', { x, y });
  assert.ok(!clicked.isError, clicked.content?.[0]?.text);
  steps.log(JSON.stringify({ x, y, w, where, point }));
  await fs.writeFile(path.join(output, 'after-click.png'), Buffer.from(clicked.content[1].data, 'base64'));
  steps.log('focused: ' + await page.evaluate(() => document.activeElement?.getAttribute('aria-label') + ' hasFocus=' + document.hasFocus()));
  const typed = await call('computer_type', { text: 'hello ไทย 日本' });
  assert.ok(!typed.isError, typed.content?.[0]?.text);
  await page.waitForTimeout(300);
  assert.equal(await composer.inputValue(), 'hello ไทย 日本', 'real keyboard input reached the focused box, in any language');
  await call('computer_key', { key: 'ctrl+a' });
  await call('computer_key', { key: 'Backspace' });
  await page.waitForTimeout(200);
  assert.equal(await composer.inputValue(), '', 'key combinations work');
  await page.screenshot({ path: path.join(output, 'app.png') });

  steps.step('turn it off again');
  assert.deepEqual(await page.evaluate(() => window.superai.computer('set', false)), { enabled: false });
  assert.equal((await call('computer_screenshot')).isError, true);
  console.log(JSON.stringify({ passed: true, screenshotWidth: w, scaleFactor: where.scaleFactor, output }));
} finally {
  clearTimeout(guard);
  mcp?.kill();
  if (desktop) await closeApp(desktop, steps);
}
