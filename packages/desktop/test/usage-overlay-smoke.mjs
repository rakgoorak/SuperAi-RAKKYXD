import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);
const output = path.resolve('output/playwright');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'usage-overlay-'));
const website = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<title>Overlay fixture</title><body style="background:#65977b">Browser preview</body>');
});
await new Promise(resolve => website.listen(0, '127.0.0.1', resolve));
let app;
let checks = 0;
try {
  app = await electron.launch({
    executablePath: require('electron'), args: ['packages/desktop'],
    env: { ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1' }, timeout: 60000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1'));
  await page.reload();
  await page.waitForSelector('.app-shell');
  await page.route('**/api/usage/*', route => route.fulfill({ json: {
    id: 'fixture', name: 'Fixture', status: 'ok', updatedAt: Date.now(),
    windows: [{ label: '5 ชั่วโมง', remainingPercent: 80 }],
  } }));
  await page.getByRole('textbox', { name: 'URL เว็บไซต์', exact: true }).fill(`http://127.0.0.1:${website.address().port}`);
  await page.getByRole('button', { name: 'เปิด URL', exact: true }).click();
  await page.waitForFunction(async () => (await window.superai.browser('state')).tabs.some(t => t.title === 'Overlay fixture' && !t.loading));
  const tabId = await page.evaluate(async () => (await window.superai.browser('state')).activeId);
  await app.evaluate(({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.at(-1);
    const setVisible = view.setVisible.bind(view);
    view.setVisible = visible => { view.overlayTestVisible = visible; setVisible(visible); };
  });
  const expectBrowserVisible = async visible => {
    // Inspect the actual native view: DOM z-index alone cannot detect this bug.
    await page.waitForFunction(async visible => (await window.superai.browser('state')).visible === visible, visible, { timeout: 5000 });
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.at(-1).overlayTestVisible), visible);
    assert.equal(await page.evaluate(async () => (await window.superai.browser('state')).activeId), tabId);
    checks++;
  };
  const usage = page.getByTitle('โควตาการใช้งานของแต่ละผู้ให้บริการ', { exact: true });
  const panel = page.getByRole('dialog', { name: 'โควตาการใช้งาน', exact: true });
  for (const width of [1366, 1040]) {
    await app.evaluate(({ BrowserWindow }, width) => {
      const window = BrowserWindow.getAllWindows()[0]; window.unmaximize(); window.setContentSize(width, 800);
    }, width);
    await expectBrowserVisible(true);
    for (const close of ['button', 'escape', 'toggle', 'outside']) {
      await usage.click();
      await panel.waitFor();
      await expectBrowserVisible(false);
      if (close === 'button') {
        const png = await app.evaluate(async ({ BrowserWindow }) =>
          (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
        await fs.writeFile(path.join(output, `usage-overlay-${width}.png`), Buffer.from(png, 'base64'));
      }
      if (close === 'button') await panel.getByTitle('ปิด', { exact: true }).click();
      else if (close === 'escape') await page.keyboard.press('Escape');
      else if (close === 'toggle') await usage.click();
      else await page.locator('.statusbar').click({ position: { x: 10, y: 5 } });
      await panel.waitFor({ state: 'hidden' });
      await expectBrowserVisible(true);
    }
  }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 800));
  // Opening a different overlay must keep the native browser suspended.
  await usage.click();
  await expectBrowserVisible(false);
  await page.getByRole('button', { name: 'การตั้งค่า', exact: true }).click();
  await page.locator('.modal-backdrop').waitFor();
  await expectBrowserVisible(false);
  await page.getByRole('button', { name: 'เสร็จแล้ว', exact: false }).click();
  await expectBrowserVisible(true);
  // Usage must not reopen a Preview that the user has hidden.
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expectBrowserVisible(false);
  await usage.click();
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  await expectBrowserVisible(false);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expectBrowserVisible(true);
  assert.deepEqual(errors, []);
  checks++;
  console.log(JSON.stringify({ passed: checks, rendererErrors: errors, screenshots: output }));
} finally {
  if (app) await app.close();
  await new Promise(resolve => website.close(resolve));
}
