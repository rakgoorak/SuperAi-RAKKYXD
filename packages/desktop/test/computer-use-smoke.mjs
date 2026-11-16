// Computer use, end to end on the real desktop: the tools refuse while the switch is off; once on,
// the AI asks for apps in the Allow / Deny window (Deny refuses, Allow lets it through, and clicks
// reach only allowed apps; SuperAi's own window is allowed here only through a test switch), then
// the AI sees the screen, clicks the app's own message box and types into it with real OS input
// (Thai included), presses keys, and the switch is turned off again. Moves the real mouse briefly.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
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
  desktop = await electron.launch({ executablePath: require('electron'), args: [path.resolve('packages/desktop/test/browser-tools-main.mjs')], env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_COMPUTER_ALLOW_SELF: '1' }, timeout: 60000 });
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
  const noAsk = await call('computer_screenshot');
  assert.equal(noAsk.isError, true, 'nothing works before computer_request_access');
  assert.match(noAsk.content[0].text, /computer_request_access/);
  const deniedCall = call('computer_request_access', { apps: ['SuperAi'] });
  await (await permissionWindow()).click('#deny');
  const denied = await deniedCall;
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /denied/);
  const again = await call('computer_request_access', { apps: ['SuperAi'] });
  assert.equal(again.isError, true, 'a second call right after Deny is refused without a new window');
  assert.match(again.content[0].text, /denied/);

  steps.step('revoke, then Allow this chat');
  await page.evaluate(() => window.superai.computer('revoke'));
  const allowedCall = call('computer_request_access', { apps: ['Notepad', 'Google Chrome', 'Windows Terminal', '1Password'], reason: 'smoke test' });
  const askWindow = await permissionWindow();
  await askWindow.waitForTimeout(500);
  await askWindow.screenshot({ path: path.join(output, 'permission-window.png') });
  await askWindow.click('#allow-chat');
  const granted = await allowedCall;
  assert.ok(!granted.isError, granted.content?.[0]?.text);
  assert.ok(granted.content[0].text.includes('Notepad (full control)'), granted.content[0].text);
  assert.ok(granted.content[0].text.includes('Google Chrome (view only'), 'browsers are view-only');
  assert.ok(granted.content[0].text.includes('Windows Terminal (left-click and scroll only'), 'terminals take clicks only');
  assert.ok(granted.content[0].text.includes('1Password (view only: it holds passwords'), 'password managers are view-only');
  const shot = await call('computer_screenshot');
  // The status bar the user sees while the AI acts (hidden from the AI's own screenshots).
  for (const w of desktop.windows()) if ((await w.evaluate(() => !!window.setStatus).catch(() => false))) { await w.waitForTimeout(400); await w.screenshot({ path: path.join(output, 'status-bar.png') }); }
  assert.ok(!shot.isError, shot.content?.[0]?.text);
  assert.equal(shot.content[1].type, 'image');
  await fs.writeFile(path.join(output, 'screen.png'), Buffer.from(shot.content[1].data, 'base64'));
  const [, w] = /Screen (\d+)x(\d+)/.exec(shot.content[0].text).map(Number);
  const state = await page.evaluate(() => window.superai.computer('state'));
  assert.equal(state.allowed.length, 1, 'Settings lists the allowed chat');
  assert.equal(state.allowed[0].scope, 'chat');
  assert.deepEqual(state.allowed[0].apps, ['Notepad', 'Google Chrome', 'Windows Terminal', '1Password'], 'Settings lists the allowed apps');
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
  // Coordinates map to the right screen: the AI cursor goes to the point on each one, and the
  // user's own mouse stays where it was.
  const mouseNow = () => desktop.evaluate(({ screen }) => screen.getCursorScreenPoint());
  const aiCursorAt = () => desktop.evaluate(({ BrowserWindow }) => { const c = BrowserWindow.getAllWindows().find((x) => { const b = x.getBounds(); return b.width === 260 && b.height === 44; }); return c && c.isVisible() ? c.getBounds() : null; });
  for (let n = screens; n >= 1; n--) {
    const shotN = await call('computer_screenshot', { display: n });
    const [, sw] = /Screen (\d+)x/.exec(shotN.content[0].text).map(Number);
    const before = await mouseNow();
    await call('computer_move', { x: 120, y: 90 });
    const d = await desktop.evaluate(({ screen }, i) => { const p = screen.getPrimaryDisplay(); const list = [p, ...screen.getAllDisplays().filter((x) => x.id !== p.id).sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)]; return list[i].bounds; }, n - 1);
    const k = d.width / sw, at = await aiCursorAt();
    assert.ok(at && Math.abs(at.x - (d.x + 120 * k)) <= 3 && Math.abs(at.y - (d.y + 90 * k)) <= 3, `screen ${n}: the AI cursor should point at 120,90: ${JSON.stringify({ at, d, sw })}`);
    assert.deepEqual(await mouseNow(), before, "computer_move leaves the user's mouse alone");
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
  const blocked = await call('computer_click', { x, y });
  assert.equal(blocked.isError, true, 'a click on an app that was not allowed is refused');
  assert.match(blocked.content[0].text, /not among the apps the user allowed/);
  const moreCall = call('computer_request_access', { apps: ['SuperAi'] });
  await (await permissionWindow()).click('#allow-chat');
  assert.ok(!(await moreCall).isError);
  // When the permission window closes, Windows may raise another app (the user's) over the test window.
  await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().filter((x) => x.isVisible()).sort((a, b) => b.getBounds().width * b.getBounds().height - a.getBounds().width * a.getBounds().height)[0]; w.show(); w.focus(); w.moveTop(); });
  await page.waitForTimeout(300);
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

  // The accessibility tools (agent-desktop), on a tiny app built here: read it, fill the box, press Save.
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  if (process.platform === 'win32' && await fs.stat(csc).then(() => true, () => false)) {
    steps.step('accessibility tools: read an app, fill a box and press a button without the mouse');
    const source = path.join(output, 'UiTestPad.cs'), exe = path.join(output, 'UiTestPad.exe');
    await fs.writeFile(source, `using System.Windows.Forms; static class P { static void Main() { var f = new Form { Text = "UiTestPad", Width = 480, Height = 260 };
      var t = new TextBox { Multiline = true, Dock = DockStyle.Fill, AccessibleName = "Note" }; var b = new Button { Text = "Save", Dock = DockStyle.Bottom };
      var pw = new TextBox { UseSystemPasswordChar = true, Dock = DockStyle.Top, AccessibleName = "Secret" };
      int n = 0; b.Click += (s, e) => f.Text = "UiTestPad saved " + t.Text.Length + " #" + (++n); f.Controls.Add(t); f.Controls.Add(pw); f.Controls.Add(b);
      f.StartPosition = FormStartPosition.Manual; f.Location = new System.Drawing.Point(80, 80);
      f.Shown += (s, e) => { var r = b.RectangleToScreen(b.ClientRectangle); var q = pw.RectangleToScreen(pw.ClientRectangle);
        System.Console.WriteLine((r.X + r.Width / 2) + " " + (r.Y + r.Height / 2) + " " + (q.X + 30) + " " + (q.Y + q.Height / 2)); };
      Application.Run(f); } }`);
    execFileSync(csc, ['/nologo', '/target:exe', `/out:${exe}`, source]);
    const pad = spawn(exe, [], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: false });
    const saveAt = new Promise((resolve) => pad.stdout.on('data', (d) => resolve(String(d).trim().split(' ').map(Number))));
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const notYet = await call('computer_ui_snapshot', { app: 'UiTestPad' });
      assert.equal(notYet.isError, true, 'an app that was not allowed cannot be read');
      assert.match(notYet.content[0].text, /not among the apps the user allowed/);
      const padCall = call('computer_request_access', { apps: ['UiTestPad'] });
      await (await permissionWindow()).click('#allow-chat');
      assert.ok(!(await padCall).isError);
      const started = performance.now();
      const ui = await call('computer_ui_snapshot', { app: 'UiTestPad' });
      assert.ok(!ui.isError, ui.content?.[0]?.text);
      const text = ui.content[0].text;
      steps.log(text);
      const box = /(e\d+) textfield "Note"/.exec(text)?.[1], save = /(e\d+) button "Save"/.exec(text)?.[1];
      assert.ok(box && save, 'the box and the button are listed with refs');
      const filled = await call('computer_ui_action', { ref: box, action: 'set_value', text: 'hello ไทย 日本' });
      assert.ok(!filled.isError, filled.content?.[0]?.text);
      assert.match(filled.content[0].text, /textfield "Note" = "hello ไทย 日本"/, 'the new list shows the value, any language');
      const pressed = await call('computer_ui_action', { ref: save, action: 'click' });
      assert.ok(!pressed.isError, pressed.content?.[0]?.text);
      assert.match(pressed.content[0].text, /UiTestPad saved 12 #1/, 'the button ran');
      // computer_click on the same button from a screenshot: done through accessibility, the user's mouse stays put.
      const [bx, by, qx, qy] = await saveAt;
      const shot1 = await call('computer_screenshot', { display: 1 });
      const [, s1] = /Screen (\d+)x/.exec(shot1.content[0].text).map(Number);
      const px = await desktop.evaluate(({ screen }) => { const d = screen.getPrimaryDisplay(); return d.size.width * d.scaleFactor; });
      const mouseBefore = await mouseNow();
      const quiet = await call('computer_click', { x: Math.round(bx * s1 / px), y: Math.round(by * s1 / px) });
      assert.ok(!quiet.isError, quiet.content?.[0]?.text);
      steps.log(quiet.content[0].text.split('.')[0]);
      assert.match(quiet.content[0].text, /the user's mouse did not move/, 'a button is clicked without the mouse');
      assert.deepEqual(await mouseNow(), mouseBefore, 'the user keeps the mouse');
      const after = await call('computer_ui_snapshot', { app: 'UiTestPad' });
      assert.match(after.content[0].text, /UiTestPad saved 12 #2/, 'the click reached the button');
      steps.step('the AI never types into a password field');
      steps.log('secret field: ' + (after.content[0].text.split('\n').find((l) => /password/.test(l)) || '(not listed)'));
      const secretRef = /(e\d+) textfield[^\n]*\(password/.exec(after.content[0].text)?.[1];
      assert.ok(secretRef, 'the element list marks the password field');
      {
        const viaTree = await call('computer_ui_action', { ref: secretRef, action: 'set_value', text: 'hunter2' });
        steps.log('set_value on it: ' + viaTree.content[0].text.split('\n')[0]);
        assert.equal(viaTree.isError, true, 'set_value into a password field is refused');
        assert.match(viaTree.content[0].text, /password field/);
      }
      await call('computer_click', { x: Math.round(qx * s1 / px), y: Math.round(qy * s1 / px) });
      const typedSecret = await call('computer_type', { text: 'hunter2' });
      assert.equal(typedSecret.isError, true, 'typing into a password field is refused');
      assert.match(typedSecret.content[0].text, /password field/);
      steps.log(`read + fill + press + 2 re-reads: ${Math.round(performance.now() - started)} ms; list ${text.length} chars`);
    } finally { pad.kill(); }
  }

  if (process.platform === 'win32') {
    steps.step('the stop key stops the AI from anywhere');
    await call('computer_screenshot');
    const { stopKey } = await page.evaluate(() => window.superai.computer('state'));
    const keys = { 'Ctrl+Alt+Esc': ['Control+Alt+Escape', '^%{ESC}'], 'Ctrl+Alt+End': ['Control+Alt+End', '^%{END}'], 'Ctrl+Shift+Alt+S': ['Control+Shift+Alt+S', '^+%s'] }[stopKey];
    assert.ok(keys, `a stop key is held while the AI has control (got "${stopKey}")`);
    steps.log(`stop key: ${stopKey}`);
    assert.equal(await desktop.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), keys[0]), true);
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys[1]}')`]);
    let stopped = false;
    for (let i = 0; i < 30 && !stopped; i++) { stopped = !(await page.evaluate(() => window.superai.computer('state'))).enabled; if (!stopped) await new Promise((r) => setTimeout(r, 100)); }
    assert.ok(stopped, 'the stop key turned computer control off');
    assert.equal(await desktop.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), keys[0]), false, 'the key is let go once control is off');
  }

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
