// The AI's browser tools, end to end: the real app, the MCP server a chat CLI would start, and a
// small local page with a form. Checks open, snapshot, type, click, select, press, scroll,
// screenshot and that the side browser panel is shown while the AI works.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeApp, stepper, watchdog, watchPage } from './smoke-harness.mjs';

const require = createRequire(import.meta.url), steps = stepper('browser-tools');
const output = path.resolve('output/browser-tools');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'profile-'));

const site = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url.startsWith('/done')) return res.end(`<title>Done</title><h1>Thanks ${new URL(req.url, 'http://x').searchParams.get('name')}</h1><p>size=${new URL(req.url, 'http://x').searchParams.get('size')}</p>`);
  res.end(`<title>Order form</title><h1>Order</h1>
    <form action="/done"><label>Name <input name="name" placeholder="Your name"></label>
    <select name="size" aria-label="Size"><option value="s">Small</option><option value="l">Large</option></select>
    <button type="submit">Send order</button></form><div style="height:3000px"></div><p id="end">Bottom of page</p>`);
});
await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
const pageUrl = `http://127.0.0.1:${site.address().port}/`;

let desktop, mcp;
const guard = watchdog(120000, steps, () => closeApp(desktop, steps));
try {
  steps.step('launch app');
  desktop = await electron.launch({ executablePath: require('electron'), args: [path.resolve('packages/desktop/test/browser-tools-main.mjs')], env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000 });
  const page = await desktop.firstWindow();
  watchPage(page, steps);
  await page.waitForSelector('.app-shell');
  // A first run opens the setup guide and the tour; the user would close them before watching the browser.
  await page.evaluate(() => { for (const key of ['superai-setup-dismissed', 'superai-tour-dismissed', 'superai-tutorial-dismissed']) localStorage.setItem(key, '1'); });
  await page.reload(); await page.waitForSelector('.app-shell'); await page.waitForTimeout(500);
  assert.equal(await page.locator('[role=dialog]').count(), 0, 'no dialog covers the browser panel');

  steps.step('how a chat CLI would start the MCP server');
  let launch = null;
  for (let i = 0; i < 50 && !launch; i++) { launch = await desktop.evaluate(() => globalThis.superaiBrowserTools.browserMcpLaunch()); if (!launch) await new Promise((r) => setTimeout(r, 100)); }
  assert.ok(launch, 'the desktop app offers the browser tools');

  steps.step('start the MCP server');
  mcp = spawn(launch.command, launch.args, { env: { SUPERAI_LANG: 'th', ...process.env, ...launch.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  const waiting = new Map();
  mcp.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (let i; (i = buffer.indexOf('\n')) >= 0;) { const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); const m = JSON.parse(line); waiting.get(m.id)?.(m); }
  });
  mcp.stderr.on('data', (chunk) => steps.log(String(chunk).trim()));
  let next = 0;
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++next; const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 30000);
    waiting.set(id, (m) => { clearTimeout(timer); resolve(m); });
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const call = async (name, args = {}) => {
    const { result } = await rpc('tools/call', { name, arguments: args });
    assert.ok(!result.isError, `${name} failed: ${result.content?.[0]?.text}`);
    return result;
  };
  const refOf = (text, pattern) => { const m = new RegExp(`\\[(e\\d+)\\][^\\n]*${pattern}`).exec(text); assert.ok(m, `no element matching ${pattern} in:\n${text.slice(0, 800)}`); return m[1]; };

  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'superai-browser');
  const tools = (await rpc('tools/list', {})).result.tools.map((t) => t.name);
  assert.ok(tools.includes('browser_open') && tools.includes('browser_click') && tools.includes('browser_screenshot'));

  steps.step('open a page; the side browser is shown');
  let snap = (await call('browser_open', { url: pageUrl })).content[0].text;
  assert.match(snap, /Title: Order form/);
  await page.waitForFunction(() => document.querySelector('.preview-footer')?.textContent.includes('AI'), null, { timeout: 5000 });
  await page.locator('.right-dock:visible').waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(output, 'opened.png') });
  const shown = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.map((v) => ({ visible: v.getVisible?.(), bounds: v.getBounds?.() })));
  steps.log(JSON.stringify(shown));
  assert.ok(shown.some((v) => v.visible !== false && v.bounds.width > 100 && v.bounds.height > 100), 'the browser view is laid out in the panel');

  steps.step('type, select, click and land on the next page');
  snap = (await call('browser_type', { ref: refOf(snap, 'Your name'), text: 'Somchai' })).content[0].text;
  assert.match(snap, /value="Somchai"/);
  snap = (await call('browser_select', { ref: refOf(snap, 'Size'), value: 'Large' })).content[0].text;
  snap = (await call('browser_click', { ref: refOf(snap, 'Send order') })).content[0].text;
  assert.match(snap, /Thanks Somchai/);
  assert.match(snap, /size=l/);

  steps.step('back, press, scroll, wait, screenshot');
  snap = (await call('browser_back')).content[0].text;
  assert.match(snap, /Title: Order form/);
  snap = (await call('browser_type', { ref: refOf(snap, 'Your name'), text: 'Ann', submit: true })).content[0].text;
  assert.match(snap, /Thanks Ann/, 'Enter submits the form');
  await call('browser_back');
  snap = (await call('browser_scroll', { direction: 'bottom' })).content[0].text;
  assert.doesNotMatch(snap, /Scroll: 0\//);
  await call('browser_wait', { text: 'Bottom of page', seconds: 3 });
  const shot = await call('browser_screenshot');
  steps.log(JSON.stringify(shot.content.map((c) => ({ type: c.type, text: c.text?.slice(0, 80), size: c.data?.length }))));
  assert.equal(shot.content[1].type, 'image');
  await fs.writeFile(path.join(output, 'ai-screenshot.png'), Buffer.from(shot.content[1].data, 'base64'));
  await page.screenshot({ path: path.join(output, 'app.png') });

  steps.step('bad input is reported, not crashed');
  const bad = (await rpc('tools/call', { name: 'browser_click', arguments: { ref: 'e999' } })).result;
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /snapshot/);
  const refused = await fetch(launch.env.SUPERAI_BROWSER_URL + '/api/browser-tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"tool":"browser_snapshot"}' });
  assert.equal(refused.status, 403, 'calls without the token are refused');

  console.log(JSON.stringify({ passed: true, tools: tools.length, screenshots: output }));
} finally {
  clearTimeout(guard);
  mcp?.kill();
  site.close();
  if (desktop) await closeApp(desktop, steps);
}
