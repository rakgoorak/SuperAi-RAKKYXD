// Review by section: undo one changed section of a file from the changes panel; the other stays.
import { _electron as electron } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
await fs.mkdir('output', { recursive: true });
const data = await fs.mkdtemp(path.resolve('output', 'hunk-review-'));
const project = path.join(data, 'repo'); await fs.mkdir(project);
const git = (...args) => execFileSync('git', args, { cwd: project, windowsHide: true });
const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
await fs.writeFile(path.join(project, 'notes.txt'), lines.join('\n') + '\n');
git('init', '-q'); git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
const edited = [...lines]; edited[2] = 'FIRST CHANGE'; edited[35] = 'SECOND CHANGE';
await fs.writeFile(path.join(project, 'notes.txt'), edited.join('\n') + '\n');

const app = await electron.launch({ executablePath: require('electron'), args: ['packages/desktop'], timeout: 60000,
  env: { SUPERAI_LANG: 'en', ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_TEST_MODE: '1' } });
const passed = [];
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai_locale', 'en'); });
  await page.evaluate(async (p) => { await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hunk fixture', rootPath: p }) }); }, project);
  await page.reload(); await page.waitForSelector('.app-shell');
  await page.getByRole('button', { name: 'Hunk fixture', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('superai:show-changes')));
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'notes.txt', exact: true }).click();
  await panel.getByRole('button', { name: 'Review by section' }).click();
  const sections = panel.locator('.diff-hunk');
  await sections.first().waitFor();
  assert.equal(await sections.count(), 2);
  passed.push('two changed sections are listed');

  await sections.first().getByRole('button', { name: 'Undo this part' }).click();
  for (let i = 0; i < 50; i++) { if (!(await fs.readFile(path.join(project, 'notes.txt'), 'utf8')).includes('FIRST CHANGE')) break; await new Promise(r => setTimeout(r, 100)); }
  const now = await fs.readFile(path.join(project, 'notes.txt'), 'utf8');
  assert.ok(!now.includes('FIRST CHANGE') && now.includes('line 3'), 'the first section is undone on disk');
  assert.ok(now.includes('SECOND CHANGE'), 'the second section stays');
  await page.waitForFunction(() => document.querySelectorAll('.diff-hunk').length === 1);
  passed.push('Undo this part reverts only that section, and the list refreshes');

  await panel.locator('.diff-hunk').first().getByRole('button', { name: 'Keep' }).click();
  await panel.getByText('Every section reviewed').waitFor();
  assert.ok((await fs.readFile(path.join(project, 'notes.txt'), 'utf8')).includes('SECOND CHANGE'), 'Keep leaves the file as it is');
  passed.push('Keep hides the section and leaves the change');
  console.log(JSON.stringify({ passed }, null, 1));
} finally {
  await app.close().catch(() => {});
  await fs.rm(data, { recursive: true, force: true }).catch(() => {});
}
