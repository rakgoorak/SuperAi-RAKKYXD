// First launch asks before counting the computer as a user; the answer is kept and nothing asks again.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
await fs.mkdir('output', { recursive: true });
const data = await fs.mkdtemp(path.resolve('output', 'usage-consent-'));
const passed = [];
const launch = () => electron.launch({
  executablePath: require('electron'), args: ['packages/desktop'], timeout: 60000,
  // An https address nothing listens on: the counter is "available", and a ping just fails.
  env: { ...process.env, SUPERAI_LANG: 'en', SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1', SUPERAI_TEST_USAGE: '1', SUPERAI_USAGE_URL: 'https://127.0.0.1:9' },
});
const userData = async (app) => app.evaluate(({ app }) => app.getPath('userData'));
let app = await launch();
try {
  let page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai_locale', 'en'); });
  await page.reload(); await page.waitForSelector('.app-shell');
  const file = path.join(await userData(app), 'usage.json');
  await fs.rm(file, { force: true });
  await page.reload(); await page.waitForSelector('.app-shell');

  const card = page.getByRole('dialog', { name: 'Help us count users?' });
  await card.waitFor({ timeout: 10000 });
  await assert.rejects(fs.readFile(file), 'no id is stored before the answer');
  passed.push('first launch asks, and nothing is stored before the answer');
  await page.screenshot({ path: path.join(data, 'consent.png') });

  await card.getByRole('button', { name: 'Deny', exact: true }).click();
  await card.waitFor({ state: 'hidden' });
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { id: null, choice: 'no' });
  passed.push('no: kept as "no" with no id');

  await page.reload(); await page.waitForSelector('.app-shell'); await page.waitForTimeout(1500);
  assert.equal(await card.count(), 0, 'the answer is not asked again');
  passed.push('not asked again after a restart of the window');

  // Settings can change the answer; yes creates the id.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Notifications' }).or(page.getByRole('button', { name: 'Notifications', exact: true })).first().click();
  const toggle = page.getByLabel('Count this computer as a user');
  assert.equal(await toggle.isChecked(), false);
  await toggle.click();
  await page.waitForFunction(async () => (await window.superai.usage('state')).enabled === true);
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(saved.choice, 'yes');
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  passed.push('Settings turns it on and creates the id');
  console.log(JSON.stringify({ passed, screenshots: data }, null, 1));
} finally {
  await app.close().catch(() => {});
}
