import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const output = path.resolve('output/playwright');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'layout-check-'));
const app = await electron.launch({
  executablePath: process.env.SUPERAI_PORTABLE_DIR ? path.join(process.env.SUPERAI_PORTABLE_DIR, 'SuperAi-RAKKYXD.exe') : require('electron'),
  args: process.env.SUPERAI_PORTABLE_DIR ? [] : ['packages/desktop'],
  env: { ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000,
});
let checks = 0;
const measurements = [];
try {
  const page = await app.firstWindow(); // Setup guide is covered by smoke.mjs.
  await page.waitForSelector('.app-shell'); await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1')); await page.reload(); await page.waitForSelector('.app-shell');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('.app-shell');
  const request = (route, body) => page.evaluate(async ({ route, body }) => {
    const response = await fetch(route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }, { route, body });
  const workspace = await request('/api/workspaces', { name: 'ทดสอบพื้นที่ session', rootPath: data });
  await page.getByRole('button', { name: 'ทดสอบพื้นที่ session', exact: true }).click();
  const resize = async (width, height) => {
    await app.evaluate(({ BrowserWindow }, size) => {
      const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(...size);
    }, [width, height]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const measure = () => page.evaluate(() => {
    const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { width: r.width, height: r.height }; };
    return { canvas: box('.terminal-layout'), pane: box('.terminal-cell:not(.not-visible)'), composer: box('.composer-area'),
      columns: getComputedStyle(document.querySelector('.terminal-layout')).gridTemplateColumns.split(' ').length,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  // The layout buttons are hidden while the project has one session or none: start in split directly.
  await page.evaluate(() => localStorage.setItem('superai-canvas-layout-v2', 'split'));
  await page.reload(); await page.waitForSelector('.app-shell');
  const ids = [];
  for (let i = 1; i <= 12; i++) {
    ids.push((await request('/api/terminals/spawn', { wsId: workspace.id, agentType: 'terminal', name: `Terminal ${i}` })).id);
    if (![1, 2, 3, 6, 12].includes(i)) continue;
    await page.waitForFunction(n => document.querySelectorAll('.terminal-cell').length === n, i);
    await resize(1366, 720);
    await page.waitForFunction(() => document.querySelector('.terminal-cell')?.getBoundingClientRect().height >= 359);
    const size = await measure(); measurements.push({ sessions: i, ...size });
    assert.ok(size.pane.height >= 359, JSON.stringify(size));
    assert.ok(size.composer.height <= 180, JSON.stringify(size));
    assert.equal(size.overflow, false);
    assert.equal(size.columns, i === 1 ? 1 : 2);
    checks++;
    if (i === 6) {
      await page.screenshot({ path: path.join(output, 'superai-layout-six.png') });
      await page.getByTitle('ขยาย Terminal 1', { exact: true }).click();
      const focused = await measure();
      assert.ok(focused.pane.height >= 359, JSON.stringify(focused));
      assert.equal(await page.locator('.terminal-cell:visible').count(), 1);
      await page.screenshot({ path: path.join(output, 'superai-layout-focused.png') });
      await page.getByTitle('กลับการจัดวางเดิม', { exact: true }).click();
      assert.equal(await page.locator('.terminal-cell:visible').count(), 6);
      checks++;
      await page.getByTitle('เรียงแนวตั้ง', { exact: true }).click();
      assert.equal((await measure()).columns, 1);
      await page.reload();
      await page.waitForSelector('.terminal-layout.stack');
      assert.equal(await page.getByTitle('เรียงแนวตั้ง', { exact: true }).getAttribute('aria-pressed'), 'true');
      checks++;
      await page.getByTitle('แบ่งสองคอลัมน์', { exact: true }).click();
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.waitForSelector('.preview-panel');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.terminal-layout')).gridTemplateColumns.split(' ').length === 1);
      assert.equal((await measure()).columns, 1);
      await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).fill('echo ทดสอบแจ้งเตือนขณะเปิด Preview');
      await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).press('Enter');
      await page.waitForSelector('.message-banner:not(.error)');
      assert.ok(await page.evaluate(() => {
        const toast = document.querySelector('.message-banner').getBoundingClientRect();
        const canvas = document.querySelector('.work-canvas').getBoundingClientRect();
        return toast.left >= canvas.left && toast.right <= canvas.right;
      }));
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      checks++;
      await resize(1040, 680);
      assert.equal((await measure()).columns, 1);
      assert.equal((await measure()).overflow, false);
      await resize(1920, 1080);
      assert.equal((await measure()).columns, 2);
      await page.screenshot({ path: path.join(output, 'superai-layout-wide.png') });
      checks++;
      const plus = page.getByRole('button', { name: 'แนบไฟล์', exact: true });
      await plus.click(); await page.getByRole('menuitem', { name: 'ขยายช่องพิมพ์', exact: true }).click();
      await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).fill('บรรทัดที่หนึ่ง\nบรรทัดที่สอง');
      await plus.click(); await page.getByRole('menuitem', { name: 'ย่อช่องพิมพ์', exact: true }).click();
      assert.equal(await page.getByRole('combobox', { name: 'คำสั่ง', exact: true }).inputValue(), 'บรรทัดที่หนึ่ง\nบรรทัดที่สอง');
      checks++;
      await request(`/api/terminals/${ids[0]}/input`, { input: 'echo LAYOUT_SESSION_PRESERVED\r' });
      await page.waitForFunction(async id => (await (await fetch('/api/terminals')).json()).find(s => s.id === id)?.bufferedOutput.includes('LAYOUT_SESSION_PRESERVED'), ids[0]);
      const actual = await request('/api/terminals');
      assert.deepEqual(actual.map(s => s.id).sort(), [...ids].sort());
      assert.ok(actual.every(s => s.status === 'running'));
      checks++;
    }
  }
  assert.deepEqual(errors, []); checks++;
  console.log(JSON.stringify({ passed: checks, measurements, rendererErrors: errors, screenshots: output }, null, 2));
} finally { await app.close(); }
