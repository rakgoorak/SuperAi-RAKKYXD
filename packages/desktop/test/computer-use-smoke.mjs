// Computer use, end to end on the real desktop: the tools refuse while the switch is off; once on,
// the first call waits for the Allow / Deny window (Deny refuses, Allow lets it through), then
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

  steps.step('turn it on from Settings');
  assert.equal((await page.evaluate(() => window.superai.computer('set', true))).enabled, true);

  // The Allow / Deny window: always on top, kept out of screenshots; the call waits for it.
  const permissionWindow = async () => {
    for (let i = 0; i < 100; i++) {
      for (const w of desktop.windows()) if ((await w.title().catch(() => '')) === 'SuperAi permission') return w;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('The Allow / Deny window did not appear');
  };
  steps.step('Deny refuses, and is not asked again right away');
  const deniedCall = call('computer_screenshot');
  await (await permissionWindow()).click('#deny');
  const denied = await deniedCall;
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /denied/);
  const again = await call('computer_screenshot');
  assert.equal(again.isError, true, 'a second call right after Deny is refused without a new window');
  assert.match(again.content[0].text, /denied/);

  steps.step('revoke, then Allow this chat');
  await page.evaluate(() => window.superai.computer('revoke'));
  const allowedCall = call('computer_screenshot');
  const askWindow = await permissionWindow();
  await askWindow.waitForTimeout(500);
  await askWindow.screenshot({ path: path.join(output, 'permission-window.png') });
  await askWindow.click('#allow-chat');
  const shot = await allowedCall;
  // The status bar the user sees while the AI acts (hidden from the AI's own screenshots).
  for (const w of desktop.windows()) if ((await w.evaluate(() => !!window.setStatus).catch(() => false))) { await w.waitForTimeout(400); await w.screenshot({ path: path.join(output, 'status-bar.png') }); }
  assert.ok(!shot.isError, shot.content?.[0]?.text);
  assert.equal(shot.content[1].type, 'image');
  await fs.writeFile(path.join(output, 'screen.png'), Buffer.from(shot.content[1].data, 'base64'));
  const [, w] = /Screen (\d+)x(\d+)/.exec(shot.content[0].text).map(Number);
  const state = await page.evaluate(() => window.superai.computer('state'));
  assert.equal(state.allowed.length, 1, 'Settings lists the allowed chat');
  assert.equal(state.allowed[0].scope, 'chat');
  steps.step('screens: a wrong number is refused; every screen can be seen');
  const screens = await desktop.evaluate(({ screen }) => screen.getAllDisplays().length);
  const wrong = await call('computer_screenshot', { display: screens + 1 });
  assert.equal(wrong.isError, true);
  assert.match(wrong.content[0].text, /display must be/);
  for (let n = screens; n >= 1; n--) {
    const each = await call('computer_screenshot', { display: n });
    assert.ok(!each.isError, each.content?.[0]?.text);
    assert.equal(each.content[1].type, 'image');
    if (screens > 1) assert.match(each.content[0].text, new RegExp(`screen ${n} of ${screens}`));
    if (screens > 1) assert.match(await desktop.evaluate(async ({ BrowserWindow }) => {
      const texts = await Promise.all(BrowserWindow.getAllWindows().map((w) => w.webContents.executeJavaScript("document.getElementById('sub')?.textContent || ''").catch(() => '')));
      return texts.filter(Boolean).join(' | ');
    }), new RegExp(`จอ ${n}`), 'the bar says which screen the AI works on');
    await fs.writeFile(path.join(output, `screen-${n}.png`), Buffer.from(each.content[1].data, 'base64'));
  }
  steps.log(`${screens} screen(s)`);
  // Coordinates map to the right screen: move on each one, then read the position back.
  for (let n = screens; n >= 1; n--) {
    await call('computer_screenshot', { display: n });
    await call('computer_move', { x: 120, y: 90 });
    const where = (await call('computer_cursor')).content[0].text;
    const [, cx, cy] = /x=(-?\d+) y=(-?\d+)/.exec(where) || [];
    assert.ok(Math.abs(cx - 120) <= 2 && Math.abs(cy - 90) <= 2, `screen ${n}: moved to 120,90 but the mouse is reported at: ${where}`);
  }
  steps.step('no second window once allowed; zoom and cursor work');
  const zoomed = await call('computer_zoom', { x: 0, y: 0, width: 200, height: 120 });
  assert.ok(!zoomed.isError, zoomed.content?.[0]?.text);
  assert.equal(zoomed.content[1].type, 'image');
  const cursor = await call('computer_cursor');
  assert.ok(!cursor.isError, cursor.content?.[0]?.text);
  // The mouse may be on another screen (the user's), which the tool says instead of giving coordinates.
  assert.match(cursor.content[0].text, /x=-?\d+ y=-?\d+|on screen \d+/);

  steps.step('click the message box and type with real input');
  const composer = page.getByLabel('คำสั่ง', { exact: true });
  await composer.fill('');
  const point = await page.evaluate(() => { const r = document.querySelector('textarea[aria-label="คำสั่ง"]').getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
  const where = await desktop.evaluate(({ BrowserWindow, screen }) => { const win = BrowserWindow.getAllWindows().filter((x) => x.isVisible()).sort((a, b) => b.getBounds().width * b.getBounds().height - a.getBounds().width * a.getBounds().height)[0]; const d = screen.getPrimaryDisplay(); return { content: win.getContentBounds(), scaleFactor: d.scaleFactor, width: d.size.width }; });
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
  const off = await page.evaluate(() => window.superai.computer('set', false));
  assert.equal(off.enabled, false);
  assert.equal(off.allowed.length, 0, 'turning it off forgets every Allow');
  assert.equal((await call('computer_screenshot')).isError, true);
  console.log(JSON.stringify({ passed: true, screenshotWidth: w, scaleFactor: where.scaleFactor, output }));
} finally {
  clearTimeout(guard);
  mcp?.kill();
  if (desktop) await closeApp(desktop, steps);
}
