import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { stepper, withTimeout, watchPage, closeApp, watchdog, snapshot } from './smoke-harness.mjs';
const manifest = JSON.parse(await fs.readFile('output/release-manifest.json', 'utf8'));
const data = await fs.mkdtemp(path.resolve('output', 'release-check-'));
const website = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<title>Release Preview</title><h1>SuperAi ทดสอบ Preview</h1>'); });
await new Promise(resolve => website.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${website.address().port}`;
const steps = stepper('release');
let page;
watchdog(240000, steps, () => page && snapshot(page, path.join(data, 'watchdog.png'), steps));
steps.step('launch packaged app');
const app = await electron.launch({ executablePath: manifest.main, args: ['--disable-gpu'], env: { ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1' }, timeout: 60000 });
const errors = [], passed = [];
let failure = null;
async function eventually(fn) { for (let i = 0; i < 150; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Condition timed out at step "${steps.current}"`); }
try {
  steps.step('first window');
  page = await app.firstWindow(); page.on('pageerror', e => { errors.push(e.message); steps.log(`pageerror: ${e.message}`); }); watchPage(page, steps); // Setup guide is covered by smoke.mjs.
  await page.waitForSelector('.app-shell'); await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1')); await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForSelector('.app-shell');
  await page.waitForSelector('.app-shell');
  // page.evaluate has no timeout of its own; a stuck server must fail the step, not hang the job.
  const request = (route, body) => withTimeout(page.evaluate(async ({route,body}) => {
    const r = await fetch(route, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : undefined);
    if (!r.ok) throw new Error(await r.text()); return r.json();
  }, {route,body}), 20000, `request ${route}`);
  assert.equal(await page.title(), 'SuperAi & RAKKYXD'); passed.push('main startup');
  steps.step('health');
  const health = await request('/api/health'); assert.equal(health.pty, true); passed.push('native PTY');
  steps.step('create workspace');
  const ws = await request('/api/workspaces', { name: 'Release test', rootPath: data });
  await page.getByRole('button', {name:'Release test',exact:true}).click();
  steps.step('spawn terminal');
  const terminal = await request('/api/terminals/spawn', { wsId:ws.id, agentType:'terminal', name:'Release terminal' });
  steps.step('wait for xterm');
  await page.waitForSelector('.xterm');
  steps.step('send command to PTY');
  const result = await request(`/api/terminals/${terminal.id}/input`, {input:'echo RELEASE_PTY_OK\r'}); assert.equal(result.success,true);
  await eventually(async()=> (await request('/api/terminals')).find(s=>s.id===terminal.id)?.bufferedOutput.includes('RELEASE_PTY_OK')); passed.push('PTY command/output');
  steps.step('open preview');
  await page.getByRole('textbox',{name:'URL เว็บไซต์',exact:true}).fill(address);
  await page.getByTitle('เปิด URL',{exact:true}).click();
  await eventually(()=>withTimeout(page.evaluate(()=>window.superai.browser('state').then(s=>s.visible&&s.tabs.some(t=>t.title==='Release Preview'&&!t.loading))), 10000, 'browser state'));
  steps.step('check preview isolation');
  const isolation=await withTimeout(app.evaluate(({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url)).executeJavaScript('typeof window.superai'),address), 20000, 'isolation check');
  assert.equal(isolation,'undefined'); passed.push('native browser and isolation');
  steps.step('dock suspends browser');
  await page.getByTitle('เปิดแผงสถานะ',{exact:true}).click();
  await eventually(()=>withTimeout(page.evaluate(()=>window.superai.browser('state').then(s=>!s.visible)), 10000, 'browser state')); passed.push('dock suspends native browser');
  assert.deepEqual(errors,[]); passed.push('no renderer errors');
  await snapshot(page, path.join(data,'workspace.png'), steps);
  steps.step('kill terminal');
  await request(`/api/terminals/${terminal.id}/kill`,{});
  await eventually(async()=>!(await request('/api/terminals')).some(s=>s.id===terminal.id)); passed.push('PTY cleanup');
  console.log(JSON.stringify({platform:process.platform,arch:process.arch,passed,errors}));
} catch (error) {
  // Report before cleanup: if closing the app hangs, the cause is already in the log.
  failure = error;
  steps.log(`FAILED at step "${steps.current}": ${error?.stack || error}`);
  if (page) await snapshot(page, path.join(data, 'failure.png'), steps);
} finally {
  steps.step('close app');
  await closeApp(app, steps);
  await new Promise(resolve => website.close(() => resolve()));
  steps.log(`done: ${passed.length} passed${failure ? ', FAILED' : ''}`);
  process.exit(failure || errors.length ? 1 : 0);
}
