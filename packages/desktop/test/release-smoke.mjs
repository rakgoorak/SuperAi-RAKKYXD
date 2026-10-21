import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const manifest = JSON.parse(await fs.readFile('output/release-manifest.json', 'utf8'));
const data = await fs.mkdtemp(path.resolve('output', 'release-check-'));
const website = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<title>Release Preview</title><h1>SuperAi ทดสอบ Preview</h1>'); });
await new Promise(resolve => website.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${website.address().port}`;
const app = await electron.launch({ executablePath: manifest.main, args: [], env: { ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1' }, timeout: 60000 });
const errors = [], passed = [];
async function eventually(fn) { for (let i = 0; i < 150; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Condition timed out'); }
try {
  const page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message)); // Setup guide is covered by smoke.mjs.
  await page.waitForSelector('.app-shell'); await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1')); await page.reload(); await page.waitForSelector('.app-shell');
  await page.waitForSelector('.app-shell');
  const request = (route, body) => page.evaluate(async ({route,body}) => {
    const r = await fetch(route, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : undefined);
    if (!r.ok) throw new Error(await r.text()); return r.json();
  }, {route,body});
  assert.equal(await page.title(), 'SuperAi & RAKKYXD'); passed.push('main startup');
  const health = await request('/api/health'); assert.equal(health.pty, true); passed.push('native PTY');
  const ws = await request('/api/workspaces', { name: 'Release test', rootPath: data });
  await page.getByRole('button', {name:'Release test',exact:true}).click();
  const terminal = await request('/api/terminals/spawn', { wsId:ws.id, agentType:'terminal', name:'Release terminal' });
  await page.waitForSelector('.xterm');
  const result = await request(`/api/terminals/${terminal.id}/input`, {input:'echo RELEASE_PTY_OK\r'}); assert.equal(result.success,true);
  await eventually(async()=> (await request('/api/terminals')).find(s=>s.id===terminal.id)?.bufferedOutput.includes('RELEASE_PTY_OK')); passed.push('PTY command/output');
  await page.getByRole('textbox',{name:'URL เว็บไซต์',exact:true}).fill(address);
  await page.getByTitle('เปิด URL',{exact:true}).click();
  await eventually(()=>page.evaluate(()=>window.superai.browser('state').then(s=>s.visible&&s.tabs.some(t=>t.title==='Release Preview'&&!t.loading))));
  const isolation=await app.evaluate(({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url)).executeJavaScript('typeof window.superai'),address);
  assert.equal(isolation,'undefined'); passed.push('native browser and isolation');
  await page.getByTitle('เปิดแผงสถานะ',{exact:true}).click();
  await eventually(()=>page.evaluate(()=>window.superai.browser('state').then(s=>!s.visible))); passed.push('dock suspends native browser');
  assert.deepEqual(errors,[]); passed.push('no renderer errors');
  await page.screenshot({path:path.join(data,'workspace.png')});
  await request(`/api/terminals/${terminal.id}/kill`,{});
  await eventually(async()=>!(await request('/api/terminals')).some(s=>s.id===terminal.id)); passed.push('PTY cleanup');
  console.log(JSON.stringify({platform:process.platform,arch:process.arch,passed,errors}));
} finally { await app.close(); await new Promise(resolve=>website.close(resolve)); }
