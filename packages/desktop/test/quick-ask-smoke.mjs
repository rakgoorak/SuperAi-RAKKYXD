// Quick ask: the box opens over other apps; Enter sends its text to a new chat in the main window.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
await fs.mkdir('output', { recursive: true });
const data = await fs.mkdtemp(path.resolve('output', 'quick-ask-'));
const app = await electron.launch({ executablePath: require('electron'), args: ['packages/desktop'], timeout: 60000,
  env: { SUPERAI_LANG: 'en', ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1' } });
const passed = [];
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai_locale', 'en'); });
  await page.reload(); await page.waitForSelector('.app-shell');
  // No real CLI starts: the new chat and its message are answered here.
  const sent = [];
  await page.route('**/api/terminals/spawn', route => route.fulfill({ json: { id: 'quick-1', name: 'Quick', agentType: 'claude-code', status: 'running', createdAt: Date.now(), view: 'chat', cwd: data } }));
  await page.route('**/api/terminals/quick-1/chat', route => { sent.push(route.request().postDataJSON()); return route.fulfill({ json: { success: true } }); });

  await page.evaluate(() => window.superai.quickAsk('open'));
  const box = await (async () => { for (let i = 0; i < 50; i++) { const w = app.windows().find(p => p.url().includes('quick.html')); if (w) return w; await new Promise(r => setTimeout(r, 100)); } })();
  assert.ok(box, 'the quick ask window opens');
  await box.waitForSelector('textarea');
  assert.equal(await box.locator('textarea').getAttribute('placeholder'), 'Ask the AI anything…');
  passed.push('the box opens with an English placeholder');

  await box.locator('textarea').fill('QUICK_ASK_TEXT');
  await box.locator('textarea').press('Enter');
  for (let i = 0; i < 100 && !sent.length; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(sent[0]?.text, 'QUICK_ASK_TEXT', 'the text is sent to a new chat');
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => w.webContents.getURL().includes('quick.html') && w.isVisible())), false, 'the box closes');
  passed.push('Enter sends the text to a new chat and closes the box');

  await page.evaluate(() => window.superai.quickAsk('open'));
  await box.locator('textarea').fill('never sent');
  await box.locator('textarea').press('Escape');
  await new Promise(r => setTimeout(r, 500));
  assert.equal(sent.length, 1, 'Esc closes without sending');
  passed.push('Esc closes without sending');
  console.log(JSON.stringify({ passed }, null, 1));
} finally {
  await app.close().catch(() => {});
  await fs.rm(data, { recursive: true, force: true }).catch(() => {});
}
