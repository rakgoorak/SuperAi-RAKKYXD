// Enter while multi-AI is answering queues the message; it is sent by itself once the run ends.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
await fs.mkdir('output', { recursive: true });
const data = await fs.mkdtemp(path.resolve('output', 'queue-check-'));
const asked = [];
const service = http.createServer(async (req, res) => {
  if (req.url === '/api/tags') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ models: [{ name: 'slow-fixture' }] })); return; }
  let input = ''; for await (const chunk of req) input += chunk;
  const prompt = JSON.parse(input).messages.map(m => m.content).join('\n');
  // The newest question is at the end; earlier ones also appear in the history sent along.
  const last = prompt.trim();
  const which = last.endsWith('to cancel') ? 'CANCELLED' : last.endsWith('SECOND_QUESTION') ? 'SECOND' : 'FIRST';
  asked.push(which);
  await new Promise(r => setTimeout(r, which === 'FIRST' ? 4000 : 200));
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: `${which}_ANSWER` } }] }));
});
await new Promise(r => service.listen(0, '127.0.0.1', r));
const app = await electron.launch({ executablePath: require('electron'), args: ['packages/desktop'], timeout: 60000,
  env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_OLLAMA_URL: `http://127.0.0.1:${service.address().port}`, SUPERAI_TEST_MODE: '1' } });
const passed = [];
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1'));
  await page.evaluate(async (p) => { await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Queue fixture', rootPath: p }) }); }, data);
  await page.reload(); await page.waitForSelector('.app-shell');
  await page.getByRole('button', { name: 'Queue fixture', exact: true }).click();
  await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByRole('button', { name: 'ตั้งค่าทีม Chat', exact: true }).click();
  while (await page.getByTitle('เอาMain 3ออก', { exact: true }).count()) await page.getByTitle('เอาMain 3ออก', { exact: true }).click();
  while (await page.getByTitle('เอาMain 2ออก', { exact: true }).count()) await page.getByTitle('เอาMain 2ออก', { exact: true }).click();
  if (await page.getByLabel('model ของผู้สรุป', { exact: true }).count()) await page.getByLabel('ให้ AI สรุปผลรวม').uncheck();
  await page.getByLabel('ผู้ให้บริการของMain 1', { exact: true }).selectOption('ollama');
  await page.getByLabel('model ของMain 1', { exact: true }).fill('slow-fixture');
  await page.getByRole('button', { name: 'บันทึกทีม', exact: true }).click();

  const box = page.getByLabel('คำสั่ง', { exact: true });
  await box.fill('FIRST_QUESTION'); await box.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.conversation-run').length === 1);
  await box.fill('SECOND_QUESTION'); await box.press('Enter');
  const chip = page.locator('.queued-run');
  await chip.waitFor({ timeout: 5000 });
  assert.match(await chip.innerText(), /SECOND_QUESTION/);
  assert.equal(await box.inputValue(), '', 'the box is cleared once the message is queued');
  passed.push('Enter while a run works queues the message and shows it');

  await page.getByText('SECOND_ANSWER', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await chip.count(), 0);
  assert.deepEqual(asked, ['FIRST', 'SECOND'], 'the queued message goes only after the first answer');
  passed.push('the queued message is sent by itself after the run ends');

  // Cancel: queue one, take it back, and nothing more is asked.
  await box.fill('FIRST_QUESTION again'); await box.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.conversation-run').length === 3);
  await box.fill('SECOND_QUESTION to cancel'); await box.press('Enter');
  await chip.waitFor({ timeout: 5000 });
  await box.fill('Existing draft');
  await chip.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="คำสั่ง"]')?.value === 'Existing draft\n\nSECOND_QUESTION to cancel', null, { timeout: 5000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.conversation-run')].every(r => !r.querySelector('.spin')), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  assert.deepEqual(asked, ['FIRST', 'SECOND', 'FIRST'], 'a removed message is never sent');
  passed.push('removing a queued message restores it alongside the current draft');
  console.log(JSON.stringify({ passed }, null, 1));
} finally {
  await app.close().catch(() => {});
  await new Promise(r => service.close(r));
  await fs.rm(data, { recursive: true, force: true }).catch(() => {});
}
